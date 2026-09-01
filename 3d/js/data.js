/**
 * Loads the generated data payload.
 *
 *   meta.json    describes the binary layout and the catalogue's extents
 *   quakes.bin   nine parallel arrays, index-aligned and sorted by origin time
 *   labels.json  dictionaries for place names, magnitude types and USGS ids
 *   basemap.json reference polylines
 *
 * Place names used to be a ~40 MB array of repeated strings. They are now a
 * Uint16 column into a few-thousand-entry dictionary, so names are available
 * immediately instead of arriving after a lazy second fetch.
 */

import { count, t } from './i18n.js';
import { liveEndSeconds, liveRows, loadLive } from './live.js';

const MAGIC = 'JQ4D';
const SUPPORTED = new Set([2]);
const DAY = 86400;

const SRC_ISC = 0;
const SRC_USGS = 1;
const SRC_JMA = 2;

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function getBuffer(url, onProgress) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) return res.arrayBuffer();

  // Stream so the loader bar reflects real progress -- the payload is tens of MB.
  const chunks = [];
  let read = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    read += value.length;
    onProgress?.(read / total);
  }
  const out = new Uint8Array(read);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out.buffer;
}

const CTORS = {
  Float32: Float32Array, Uint32: Uint32Array,
  Uint16: Uint16Array, Uint8: Uint8Array,
};

function decodeBinary(buffer, meta) {
  const tag = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (tag !== MAGIC) {
    const err = new Error(`quakes.bin: 형식이 올바르지 않습니다 (magic "${tag}")`);
    err.kind = 'stale-build';
    throw err;
  }

  const head = new Uint32Array(buffer, 4, 3);
  const [version, count] = head;
  if (!SUPPORTED.has(version)) {
    const err = new Error(`quakes.bin 형식 버전 ${version} 은 지원하지 않습니다`);
    err.kind = 'stale-build';
    throw err;
  }
  if (count !== meta.count) {
    // Almost always an interrupted build: the binary was rewritten but the
    // metadata describing it was not. Tag it so the UI can say what to do.
    const err = new Error(
      `quakes.bin has ${count.toLocaleString('ko-KR')} events but meta.json describes `
      + `${meta.count.toLocaleString('ko-KR')} — 두 파일이 서로 맞지 않습니다`);
    err.kind = 'stale-build';
    throw err;
  }

  const out = { count };
  for (const [name, spec] of Object.entries(meta.binary.arrays)) {
    const Ctor = CTORS[spec.type];
    if (!Ctor) throw new Error(`unknown array type ${spec.type} for ${name}`);
    out[name] = new Ctor(buffer, spec.offset, spec.length);
  }
  return out;
}

/**
 * Splice the Japan overlay onto the end of the archive.
 *
 * Append-only, unlike the global catalogue. Japan's recent tail is mostly JMA
 * rows that USGS never publishes -- roughly 100 JMA events to 40 USGS ones in a
 * typical fortnight -- so cutting the archive at the overlay's window and
 * replacing it would delete far more than it refreshed. What is genuinely
 * missing from the archive is everything after its last origin time, and that
 * is exactly what gets added here.
 */
function appendJapanLive(events, labels, live, epochMs) {
  if (!events.count) return events;
  const lastSec = events.t[events.count - 1];
  const rows = liveRows(live, epochMs)
    .filter((r) => (r.time_ms - epochMs) / 1000 > lastSec);
  if (!rows.length) return events;

  labels.places ??= [];
  labels.magTypes ??= [];
  labels.usgsIds ??= [];
  // place/magType are Uint16 columns into these dictionaries. A handful of new
  // names per update cannot realistically fill them, but point at the first
  // slot rather than wrap around if one ever does.
  const intern = (dict, value) => {
    const at = dict.indexOf(value);
    if (at >= 0) return at;
    return dict.length > 0xffff ? 0 : dict.push(value) - 1;
  };

  const n = events.count;
  const total = n + rows.length;
  const grow = (Ctor, src) => { const a = new Ctor(total); a.set(src); return a; };
  const out = {
    count: total,
    lon: grow(Float32Array, events.lon),
    lat: grow(Float32Array, events.lat),
    depth: grow(Float32Array, events.depth),
    mag: grow(Float32Array, events.mag),
    t: grow(Uint32Array, events.t),
    place: grow(Uint16Array, events.place),
    magType: grow(Uint16Array, events.magType),
    extId: grow(Uint32Array, events.extId),
    src: grow(Uint8Array, events.src),
  };
  rows.forEach((r, k) => {
    const i = n + k;
    out.lon[i] = r.longitude;
    out.lat[i] = r.latitude;
    out.depth[i] = Math.max(0, r.depth_km);
    out.mag[i] = r.magnitude;
    out.t[i] = (r.time_ms - epochMs) / 1000;
    out.place[i] = intern(labels.places, r.place || '');
    out.magType[i] = intern(labels.magTypes, r.mag_type || '');
    out.extId[i] = intern(labels.usgsIds, r.id || '');
    out.src[i] = SRC_USGS;
  });
  return out;
}

/**
 * The timeline's right edge comes from the Japan meta and is shared by both
 * catalogues, so it has to clear the newest event in either overlay. Left
 * alone, the freshest quakes would sit past the end of every scrubbable range
 * and never be drawn at all.
 */
function extendSpan(meta, ...endsSeconds) {
  meta.t_max_seconds = Math.max(meta.t_max_seconds ?? 0, ...endsSeconds);
  return meta;
}

function assembleData(meta, events, labels, basemap) {
  const epochMs = Date.parse(meta.epoch);
  const places = labels.places ?? [];
  const magTypes = labels.magTypes ?? [];
  const usgsIds = labels.usgsIds ?? [];

  return {
    meta,
    events,
    basemap,
    labels,
    epochMs,

    /** Absolute Date for an event index. */
    dateAt: (i) => new Date(epochMs + events.t[i] * 1000),
    /** Days since epoch (the unit the shader and timeline both use). */
    days: (i) => events.t[i] / DAY,
    totalDays: meta.t_max_seconds / DAY,

    placeOf: (i) => places[events.place[i]] ?? '',
    magTypeOf: (i) => magTypes[events.magType[i]] ?? '',
    sourceOf: (i) => (events.src[i] === SRC_USGS ? 'usgs'
      : events.src[i] === SRC_JMA ? 'jma' : 'isc'),

    /** Agency page for an event, or null when the id cannot be resolved. */
    urlOf: (i) => {
      if (events.src[i] === SRC_USGS) {
        const id = usgsIds[events.extId[i]];
        return id ? `https://earthquake.usgs.gov/earthquakes/eventpage/${id}` : null;
      }
      if (events.src[i] === SRC_JMA) return null;
      return 'http://www.isc.ac.uk/cgi-bin/web-db-run?request=COMPREHENSIVE'
        + `&out_format=ISF2&event_id=${events.extId[i]}`;
    },
  };
}

/**
 * Lightweight shell for an embedded globe-first launch. The App still needs
 * regional metadata to construct its shared controls, but the 34 MB Japan
 * catalogue and its label/basemap payloads are intentionally skipped.
 */
export async function loadGlobeShellData(onStage) {
  onStage?.(t('메타데이터 확인 중…'), 0.05);
  const [meta, live] = await Promise.all([getJSON('data/meta.json'), loadLive('global')]);
  extendSpan(meta, liveEndSeconds(live, Date.parse(meta.epoch)));
  const f32 = new Float32Array(0);
  const u32 = new Uint32Array(0);
  const events = {
    count: 0,
    lon: f32, lat: f32, depth: f32, mag: f32,
    t: u32, place: new Uint16Array(0), magType: new Uint16Array(0),
    extId: u32, src: new Uint8Array(0),
  };
  onStage?.(t('장면 구성 중…'), 0.9);
  return assembleData(meta, events, { places: [], magTypes: [], usgsIds: [] }, {});
}

export async function loadData(onStage) {
  onStage?.(t('메타데이터 확인 중…'), 0.03);
  const meta = await getJSON('data/meta.json');
  // Both overlays: japan's rows join this catalogue, global's newest event only
  // has to be inside the shared timeline for the globe view to show it.
  const livePromise = Promise.all([loadLive('japan'), loadLive('global')]);

  const mb = (meta.binary?.bytes ?? 0) / 1e6;
  const label = `${t('지진 데이터 불러오는 중…')} ${count(meta.count)}`;

  onStage?.(label, 0.06);
  const buffer = await getBuffer('data/quakes.bin',
    (p) => onStage?.(label, 0.06 + p * 0.66));
  const events = decodeBinary(buffer, meta);

  onStage?.(t('지명 · 기준 지형 불러오는 중…'), 0.76);
  const [labels, basemap] = await Promise.all([
    getJSON('data/labels.json').catch((err) => {
      console.warn('labels.json unavailable:', err);
      return { places: [], magTypes: [], usgsIds: [] };
    }),
    getJSON('data/basemap.json').catch((err) => {
      console.warn('basemap.json unavailable:', err);
      return { coast: [], plates: [] };
    }),
  ]);

  const [liveJapan, liveGlobal] = await livePromise;
  const epochMs = Date.parse(meta.epoch);
  const merged = appendJapanLive(events, labels, liveJapan, epochMs);
  extendSpan(meta, liveEndSeconds(liveJapan, epochMs), liveEndSeconds(liveGlobal, epochMs));
  meta.count = merged.count;

  onStage?.(t('장면 구성 중…'), 0.9);

  return assembleData(meta, merged, labels, basemap);
}

/**
 * What the most recent data update added or revised. Written by build_data.py,
 * with event ids already resolved to array indices. Absent or malformed is a
 * normal state (no update has run yet), not an error.
 */
let changesPromise = null;
export function loadChanges() {
  changesPromise ??= getJSON('data/changes.json').catch(() => ({ available: false }));
  return changesPromise;
}

export { DAY };
