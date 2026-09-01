/**
 * The live overlay.
 *
 * The 1900-present archives (`quakes.bin`, `quakes-m*.bin`) are rebuilt offline
 * and are far too large to republish on a schedule. The "Update earthquake
 * data" action instead refetches the last 14 days from USGS ComCat into
 * `data/live/<region>.json` and commits that, so a deployed site keeps pace
 * with the catalogue without touching a single byte of the binaries.
 *
 * Both catalogues read the files through here, so each one is fetched once per
 * page load. A missing or malformed overlay is a normal state, not an error:
 * the archive renders exactly as it did before.
 */

const cache = new Map();

export function loadLive(region) {
  if (!cache.has(region)) {
    cache.set(region, fetch(`data/live/${region}.json`, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((live) => (live?.events?.length && live.window_start_utc ? live : null))
      .catch((err) => {
        console.warn(`live overlay ${region} unavailable:`, err);
        return null;
      }));
  }
  return cache.get(region);
}

/** Overlay rows, oldest first, dropped down to the sane and the plausible. */
export function liveRows(live, epochMs) {
  return (live?.events ?? [])
    .filter((r) => {
      const m = +r.magnitude;
      return Number.isFinite(m) && m <= 9.55 && Number.isFinite(+r.time_ms)
        && r.time_ms > epochMs;
    })
    .sort((a, b) => a.time_ms - b.time_ms);
}

/** Origin time of the newest overlay event, in epoch-seconds (0 when empty). */
export function liveEndSeconds(live, epochMs) {
  const rows = live?.events ?? [];
  let newest = 0;
  for (const r of rows) if (r.time_ms > newest) newest = r.time_ms;
  return newest > epochMs ? (newest - epochMs) / 1000 : 0;
}

/** First index of `t` at or after `sec`; `t` is time-sorted everywhere here. */
export function lowerBound(t, sec) {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] < sec) lo = mid + 1; else hi = mid;
  }
  return lo;
}
