/* World Earthquake Labs — real catalog loader
   Source: 3d/data/global (USGS ANSS ComCat + ISC Bulletin, deduplicated, 1900–present),
   the same dataset that drives the Earthquake 4D globe. Pages read window.EQ after
   EQ.ready resolves; when the underlying files are rebuilt by the update pipeline,
   a periodic meta check reloads events in place. */
(function () {
  "use strict";

  var DATA_BASE = "3d/data/global/";
  // default: M4+ (~13 MB) for the analytics pages; the live map opts into all
  // bands (M2+, ~59 MB) by setting window.EQ_ALL_BANDS before this script
  var BANDS = window.EQ_ALL_BANDS
    ? ["quakes-m5.bin", "quakes-m4.bin", "quakes-m3.bin", "quakes-m2.bin"]
    : ["quakes-m5.bin", "quakes-m4.bin"];
  var RECENT_DAYS = 120;                          // window kept in memory as objects
  var H = 3600e3, D = 86400e3;

  /* ---------- plate-boundary segments: 2D map lines + region naming ---------- */
  var SEGMENTS = [
    { id: "aleutian", group: "Alaska Region", rof: true,
      pts: [[51, 173], [51.5, 179.9]], names: ["Rat Islands, Aleutian Islands", "Near Islands, Aleutian Islands"] },
    { id: "aleutian2", group: "Alaska Region", rof: true,
      pts: [[51.5, -179.9], [52, -172], [53.5, -164], [56, -156], [58.5, -150]], names: ["Andreanof Islands, Aleutian Islands", "Fox Islands, Aleutian Islands", "Alaska Peninsula", "South of Kodiak Island, Alaska"] },
    { id: "alaska", group: "Alaska Region", rof: true,
      pts: [[60, -150], [61.5, -147], [60, -141], [59, -136.5]], names: ["Southern Alaska", "Kenai Peninsula, Alaska", "Southeastern Alaska"] },
    { id: "cascadia", group: "North America", rof: true,
      pts: [[48.8, -127.5], [45, -125], [40.5, -124.8]], names: ["Off the coast of Vancouver Island, Canada", "Off the coast of Oregon, USA", "Offshore Northern California, USA"] },
    { id: "sanandreas", group: "North America", rof: true,
      pts: [[40.3, -124.4], [37.5, -122.2], [35.5, -120], [33.8, -116.8]], names: ["Northern California, USA", "Central California, USA", "Southern California, USA"] },
    { id: "gulfcal", group: "North America", rof: true,
      pts: [[31, -114.5], [27, -111.5], [23.5, -108.5]], names: ["Gulf of California, Mexico", "Baja California, Mexico"] },
    { id: "mexico", group: "Central America", rof: true,
      pts: [[19.5, -105.5], [17.5, -101], [16.2, -97.5], [15.2, -94.5], [14.5, -92.5]], names: ["Near the coast of Guerrero, Mexico", "Offshore Oaxaca, Mexico", "Off the coast of Chiapas, Mexico"] },
    { id: "centam", group: "Central America", rof: true,
      pts: [[13.8, -91], [12.5, -88.5], [10.5, -86], [9, -84]], names: ["Off the coast of Guatemala", "Off the coast of El Salvador", "Near the coast of Nicaragua", "Costa Rica region"] },
    { id: "carib", group: "Caribbean", rof: false,
      pts: [[19.5, -75], [19, -70], [18.5, -65], [16.5, -61.5], [14, -60.8]], names: ["Dominican Republic region", "Puerto Rico region", "Leeward Islands", "Martinique region"] },
    { id: "southam", group: "South America", rof: true,
      pts: [[5, -77.8], [0, -79.5], [-6, -80.5], [-12, -76.5], [-18, -71.5], [-23, -70.3], [-30, -71.5], [-36, -73.2], [-43, -74.5], [-50, -74.5]],
      names: ["Near the coast of Ecuador", "Northern Peru", "Near the coast of Central Peru", "Southern Peru", "Tarapacá, Chile", "Antofagasta, Chile", "Coquimbo, Chile", "Offshore Bío-Bío, Chile", "Aysén, Chile"] },
    { id: "sandwich", group: "South Atlantic", rof: false,
      pts: [[-55.5, -27], [-58, -25.5], [-60, -27.5]], names: ["South Sandwich Islands region"] },
    { id: "mar_n", group: "Mid-Atlantic Ridge", rof: false,
      pts: [[66, -18], [60, -29], [52.5, -32], [45, -28], [38, -30.5], [30, -41.5], [23, -45], [15, -46], [7.5, -34.5], [0.8, -26]],
      names: ["Iceland region", "Reykjanes Ridge", "Northern Mid-Atlantic Ridge", "Azores Islands region", "Central Mid-Atlantic Ridge"] },
    { id: "mar_s", group: "South Atlantic", rof: false,
      pts: [[0.8, -26], [-8, -13.5], [-20, -11.5], [-31, -13.5], [-42, -16], [-52, -8], [-55.5, 0]],
      names: ["Ascension Island region", "Southern Mid-Atlantic Ridge", "Tristan da Cunha region"] },
    { id: "epr", group: "East Pacific Rise", rof: false,
      pts: [[17, -105.3], [9, -104.2], [0, -102], [-9, -110.5], [-18, -113.3], [-28, -112], [-38, -110.5], [-49, -113.5], [-56, -122]],
      names: ["Central East Pacific Rise", "Southern East Pacific Rise", "Easter Island region"] },
    { id: "med", group: "Mediterranean", rof: false,
      pts: [[36.8, 8], [38.2, 14.8], [39.5, 20], [37.5, 21.5], [35.5, 25], [36.3, 28.5], [37.2, 30.5], [38.5, 35], [39, 39.5], [39.5, 43.5]],
      names: ["Sicily, Italy", "Southern Italy", "Greece region", "Crete, Greece", "Dodecanese Islands, Greece", "Western Turkey", "Central Turkey", "Eastern Turkey"] },
    { id: "iran", group: "Middle East", rof: false,
      pts: [[38.5, 44.5], [34.5, 47.5], [31, 50.5], [28.5, 53.5], [27, 57], [27.5, 60.5]],
      names: ["Northwestern Iran", "Zagros Mountains, Iran", "Southern Iran", "Southeastern Iran"] },
    { id: "hindukush", group: "Central Asia", rof: false,
      pts: [[36.8, 70.8], [36, 71.5], [34.5, 73.2]], names: ["Hindu Kush region, Afghanistan", "Tajikistan region", "Northern Pakistan"] },
    { id: "himalaya", group: "Central Asia", rof: false,
      pts: [[34, 74.5], [31.5, 78.5], [29.5, 81.5], [28, 85.5], [27.3, 88.5], [26.5, 92.5], [25.5, 95.5]],
      names: ["Northern India region", "Western Nepal", "Nepal region", "Sikkim, India", "Assam, India", "Myanmar-India border region"] },
    { id: "andaman", group: "Indonesia", rof: false,
      pts: [[22, 94.8], [17, 94.5], [12, 93], [8, 93.5], [5.5, 94.5]],
      names: ["Myanmar region", "Andaman Islands, India region", "Nicobar Islands, India region"] },
    { id: "sumatra", group: "Indonesia", rof: true,
      pts: [[5, 95], [2.5, 96.5], [0, 98.5], [-2.5, 100.3], [-4.8, 102.5], [-6.5, 104.5]],
      names: ["Northern Sumatra, Indonesia", "Nias region, Indonesia", "Southwest of Sumatra, Indonesia", "Southern Sumatra, Indonesia", "Sunda Strait, Indonesia"] },
    { id: "java", group: "Indonesia", rof: true,
      pts: [[-8.2, 107], [-8.8, 110.5], [-9.3, 114], [-9.5, 118], [-9.3, 122], [-8, 126], [-7, 129.5], [-6.5, 130.5]],
      names: ["Java, Indonesia", "South of Java, Indonesia", "Bali region, Indonesia", "Sumba region, Indonesia", "Timor region, Indonesia", "Banda Sea, Indonesia"] },
    { id: "sulawesi", group: "Indonesia", rof: true,
      pts: [[1.5, 120], [0, 122], [-1.5, 121.5], [0.5, 124.5], [1.5, 126.5], [3.5, 126.8]],
      names: ["Minahasa, Sulawesi, Indonesia", "Sulawesi, Indonesia", "Molucca Sea, Indonesia", "Talaud Islands, Indonesia", "Halmahera, Indonesia"] },
    { id: "philippines", group: "Philippines", rof: true,
      pts: [[18.5, 121], [16, 121.5], [13.5, 122], [11, 124.5], [8.5, 126.4], [6, 126.2]],
      names: ["Luzon, Philippines", "Samar, Philippines", "Leyte, Philippines", "Mindanao, Philippines", "Philippine Islands region"] },
    { id: "ryukyu", group: "Japan Region", rof: true,
      pts: [[23.8, 121.6], [25.5, 124], [27, 127.5], [29.5, 130], [31.5, 131.8]],
      names: ["Taiwan region", "Southwestern Ryukyu Islands, Japan", "Ryukyu Islands, Japan", "Kyushu, Japan"] },
    { id: "japan", group: "Japan Region", rof: true,
      pts: [[33, 133.5], [34.5, 137.5], [35.8, 140.8], [37.5, 141.8], [39.5, 142.8], [41.5, 143.8], [42.8, 145.2]],
      names: ["Shikoku, Japan", "Near the south coast of Honshu, Japan", "Off the east coast of Honshu, Japan", "Miyagi, Japan region", "Iwate, Japan region", "Hokkaido, Japan"] },
    { id: "kuril", group: "Japan Region", rof: true,
      pts: [[43.5, 147], [46, 151], [48.5, 154.5], [51, 157.5], [53.5, 160.5], [55.5, 163]],
      names: ["Kuril Islands", "East of the Kuril Islands", "Near the east coast of Kamchatka, Russia", "Off the east coast of Kamchatka, Russia"] },
    { id: "izubonin", group: "Japan Region", rof: true,
      pts: [[33.5, 140.5], [30, 141.5], [26.5, 142.5], [22.5, 143.5], [18.5, 145.5], [14.5, 146], [12, 144.5]],
      names: ["Izu Islands, Japan region", "Bonin Islands, Japan region", "Volcano Islands, Japan region", "Mariana Islands region", "Guam region"] },
    { id: "newguinea", group: "New Guinea", rof: true,
      pts: [[-2.5, 133], [-3.5, 138], [-4.5, 143], [-5.5, 147.5], [-6, 151], [-5, 154.5]],
      names: ["Papua, Indonesia", "New Guinea, Papua New Guinea", "Eastern New Guinea region", "New Britain region, Papua New Guinea", "New Ireland region, Papua New Guinea"] },
    { id: "solomon", group: "Southwest Pacific", rof: true,
      pts: [[-6.5, 155.5], [-8.5, 158.5], [-10.5, 162], [-12.5, 166.5], [-15.5, 167.5], [-19, 169.2], [-21.5, 170]],
      names: ["Solomon Islands", "Santa Cruz Islands", "Vanuatu region", "Loyalty Islands, New Caledonia"] },
    { id: "tonga", group: "Tonga-Kermadec", rof: true,
      pts: [[-14.5, -172.8], [-17, -173.3], [-19.5, -173.8], [-22.5, -175], [-26, -176.5], [-30, -178.2], [-33.5, -179.6]],
      names: ["Tonga Islands", "Fiji Islands region", "Tonga region", "Kermadec Islands, New Zealand", "South of the Kermadec Islands"] },
    { id: "nz", group: "New Zealand", rof: true,
      pts: [[-36.5, 178.5], [-39.5, 176.8], [-41.5, 174.3], [-43.5, 171], [-45.5, 167.5]],
      names: ["North Island of New Zealand", "Cook Strait, New Zealand", "South Island of New Zealand", "Off the west coast of the South Island, New Zealand"] },
    { id: "ear", group: "East Africa", rof: false,
      pts: [[13, 41.5], [8, 38.5], [3, 36], [-2, 36], [-7, 33.5], [-12, 34.2], [-16, 34.8]],
      names: ["Ethiopia region", "Kenya region", "Lake Tanganyika region", "Malawi region"] },
    { id: "cir", group: "Indian Ocean", rof: false,
      pts: [[2, 67], [-8, 68], [-18, 66.5], [-26, 70.5], [-34, 78], [-40, 86], [-45, 96], [-48, 110], [-50, 125], [-53, 140]],
      names: ["Carlsberg Ridge", "Mid-Indian Ridge", "Southeast Indian Ridge", "South of Australia"] },
    { id: "macquarie", group: "Southwest Pacific", rof: false,
      pts: [[-49, 164], [-54, 159], [-59, 155]], names: ["Macquarie Island region", "West of Macquarie Island"] }
  ];

  /* flat vertex list for nearest-region naming */
  var VERTS = [];
  SEGMENTS.forEach(function (seg) {
    seg.pts.forEach(function (p, vi) { VERTS.push({ lat: p[0], lng: p[1], seg: seg, vi: vi }); });
  });

  function nameFor(lat, lng) {
    var best = null, bestD = Infinity;
    var coslat = Math.cos(lat * Math.PI / 180);
    for (var i = 0; i < VERTS.length; i++) {
      var v = VERTS[i];
      var dlat = lat - v.lat;
      var dlng = Math.abs(lng - v.lng);
      if (dlng > 180) dlng = 360 - dlng;
      dlng *= coslat;
      var d = dlat * dlat + dlng * dlng;
      if (d < bestD) { bestD = d; best = v; }
    }
    if (!best || bestD > 100) { // > ~10° from every catalogued boundary
      return {
        loc: Math.abs(lat).toFixed(1) + "°" + (lat >= 0 ? "N" : "S") + ", " +
             Math.abs(lng).toFixed(1) + "°" + (lng >= 0 ? "E" : "W") + " region",
        group: "Other regions", rof: false
      };
    }
    var seg = best.seg;
    var ni = Math.min(seg.names.length - 1, Math.floor(best.vi / seg.pts.length * seg.names.length));
    return { loc: seg.names[ni], group: seg.group, rof: !!seg.rof };
  }

  /* ---------- palettes / sizing ---------- */
  function magColor(m) {
    if (m >= 9) return "#4a148c";
    if (m >= 8) return "#8e24aa";
    if (m >= 7) return "#c62828";
    if (m >= 6) return "#e53935";
    if (m >= 5) return "#f4511e";
    if (m >= 4) return "#fb8c00";
    if (m >= 3) return "#ffb300";
    if (m >= 2) return "#ffd54f";
    return "#ffe082";
  }
  function miniColor(m) {
    if (m >= 6) return "#e8432d";
    if (m >= 5) return "#ef8b3a";
    if (m >= 4) return "#f2b544";
    if (m >= 3) return "#2f6bff";
    return "#a7c8f0";
  }
  function magRadius(m) { return Math.max(2.4, 1.6 + (m - 1.6) * 1.9); }

  /* ---------- formatting ---------- */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function p2(x) { return (x < 10 ? "0" : "") + x; }

  function fmtUTC(t, seconds) {
    var d = new Date(t);
    return MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() + " " +
      p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + (seconds ? ":" + p2(d.getUTCSeconds()) : "") + " UTC";
  }
  function fmtShort(t, local) {
    var d = new Date(t);
    if (local) return MON[d.getMonth()] + " " + d.getDate() + ", " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    return MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + ":" + p2(d.getUTCSeconds());
  }
  function fmtList(t, local) {
    var d = new Date(t);
    if (local) return MON[d.getMonth()] + " " + d.getDate() + ", " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    return MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes());
  }

  /* ---------- queries / aggregations (operate on the recent-events window) ---------- */
  function inWindow(ms, list) {
    var from = Date.now() - ms;
    return (list || EQ.events).filter(function (e) { return e.t >= from; });
  }

  function byRegion(list, region) {
    if (!region || region === "Global" || region === "All Regions") return list;
    if (region === "Pacific Ring of Fire") return list.filter(function (e) { return e.rof; });
    return list.filter(function (e) { return e.group === region; });
  }

  function magBuckets(list) {
    var b = { "M 7+": 0, "M 6–6.9": 0, "M 5–5.9": 0, "M 4–4.9": 0, "M 3–3.9": 0, "M 2–2.9": 0 };
    list.forEach(function (e) {
      if (e.m >= 7) b["M 7+"]++;
      else if (e.m >= 6) b["M 6–6.9"]++;
      else if (e.m >= 5) b["M 5–5.9"]++;
      else if (e.m >= 4) b["M 4–4.9"]++;
      else if (e.m >= 3) b["M 3–3.9"]++;
      else b["M 2–2.9"]++;
    });
    return b;
  }

  function dailyCounts(days, list) {
    list = list || EQ.events;
    var out = [], labels = [];
    var windowStart = Date.now() - days * D;
    for (var i = 0; i < days; i++) {
      var dd = new Date(windowStart + (i + 0.5) * D);
      labels.push(MON[dd.getUTCMonth()] + " " + dd.getUTCDate() + " '" + String(dd.getUTCFullYear()).slice(2));
      out.push(0);
    }
    list.forEach(function (e) {
      var i = Math.floor((e.t - windowStart) / D);
      if (i >= 0 && i < days) out[i]++;
    });
    return { labels: labels, counts: out };
  }

  function movingAvg(arr, w) {
    return arr.map(function (_, i) {
      var a = Math.max(0, i - w + 1), s = 0;
      for (var j = a; j <= i; j++) s += arr[j];
      return Math.round((s / (i - a + 1)) * 10) / 10;
    });
  }

  function depthBins(list) {
    var bins = [0, 0, 0, 0, 0, 0];
    list.forEach(function (e) {
      if (e.depth < 10) bins[0]++;
      else if (e.depth < 30) bins[1]++;
      else if (e.depth < 70) bins[2]++;
      else if (e.depth < 150) bins[3]++;
      else if (e.depth < 300) bins[4]++;
      else bins[5]++;
    });
    var tot = Math.max(1, list.length);
    return {
      labels: ["0–10", "10–30", "30–70", "70–150", "150–300", "300+"],
      pct: bins.map(function (x) { return Math.round((x / tot) * 1000) / 10; })
    };
  }

  function energySeries(days, list) {
    var dc = dailyCounts(days, list), e = dc.labels.map(function () { return 0; });
    var windowStart = Date.now() - days * D;
    (list || EQ.events).forEach(function (ev) {
      var i = Math.floor((ev.t - windowStart) / D);
      if (i >= 0 && i < days) e[i] += Math.pow(10, 1.5 * (ev.m - 3));
    });
    return { labels: dc.labels, values: e.map(function (x) { return Math.max(1, Math.round(x)); }) };
  }

  var HOTSPOT_GROUPS = ["Pacific Ring of Fire", "Indonesia", "South America", "Japan Region", "Alaska Region",
    "Tonga-Kermadec", "Central America", "Mediterranean", "Philippines", "Southwest Pacific",
    "Mid-Atlantic Ridge", "New Guinea", "Central Asia", "New Zealand", "North America"];

  function hotspots(list, n) {
    var rows = HOTSPOT_GROUPS.map(function (g) {
      return { name: g === "Tonga-Kermadec" ? "Tonga–Kermadec" : g, count: byRegion(list, g).length };
    });
    rows.sort(function (a, b) { return b.count - a.count; });
    return rows.slice(0, n || 5);
  }

  /* ---------- live update hooks ---------- */
  var liveListeners = [];
  function onLive(cb) { liveListeners.push(cb); }

  /* ---------- real data loading ---------- */

  var EQ = {
    events: [],
    segments: SEGMENTS,
    meta: null,
    grCurve: { x: [], y: [] },
    NOW: Date.now(),
    H: H, D: D,
    magColor: magColor, miniColor: miniColor, magRadius: magRadius,
    fmtUTC: fmtUTC, fmtShort: fmtShort, fmtList: fmtList,
    inWindow: inWindow, byRegion: byRegion, magBuckets: magBuckets,
    dailyCounts: dailyCounts, movingAvg: movingAvg, depthBins: depthBins,
    energySeries: energySeries, hotspots: hotspots, onLive: onLive,
    rangeStats: rangeStats, buildWindow: buildWindow, buildRange: buildRange,
    latestInRange: latestInRange, forEachInRange: forEachInRange, regionFor: nameFor,
    thinYearLabels: thinYearLabels
  };
  window.EQ = EQ;

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
      return r.json();
    });
  }
  function fetchBuf(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
      return r.arrayBuffer();
    });
  }

  var MAGIC = 0x00315147; // 'GQ1\0'

  function parseBand(buf) {
    var head = new Uint32Array(buf, 0, 2);
    if (head[0] !== MAGIC) throw new Error("bad band file");
    var n = head[1];
    var f = function (k) { return new Float32Array(buf, 8 + k * n * 4, n); };
    return { n: n, lon: f(0), lat: f(1), depth: f(2), mag: f(3), t: new Uint32Array(buf, 8 + 4 * n * 4, n) };
  }

  var RAW = null; // parsed band arrays kept for long-range aggregation

  /* keep at most ~12 year labels on a monthly axis (mutates in place) */
  function thinYearLabels(labels) {
    var years = labels.filter(function (l) { return l; }).length;
    var step = Math.max(1, Math.ceil(years / 12));
    var seen = 0;
    for (var i = 0; i < labels.length; i++) {
      if (!labels[i]) continue;
      if (seen % step !== 0) labels[i] = "";
      seen++;
    }
  }

  function makeEvent(b, i, epochMs, id) {
    var lat = b.lat[i], lon = b.lon[i];
    var who = nameFor(lat, lon);
    var tMs = epochMs + b.t[i] * 1000;
    return {
      id: id,
      m: Math.round(b.mag[i] * 10) / 10,
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lon * 1000) / 1000,
      depth: Math.max(0, Math.round(b.depth[i])),
      t: tMs,
      loc: who.loc,
      group: who.group,
      rof: who.rof,
      status: (Date.now() - tMs) > 5 * D ? "Reviewed" : "Automatic"
    };
  }

  /* Materialize every event in [startMs, endMs] at or above `minMag` as plain
     objects (named, region-tagged, newest first). Long windows should pass a
     sensible floor — 10 years of M2+ would be hundreds of thousands of rows. */
  function buildRange(startMs, endMs, minMag) {
    if (!RAW) return [];
    var startSec = (startMs - RAW.epochMs) / 1000;
    var endSec = (endMs - RAW.epochMs) / 1000;
    var out = [], idc = 1;
    RAW.bands.forEach(function (b) {
      var i = lowerBound(b.t, startSec);
      for (; i < b.n; i++) {
        if (b.t[i] > endSec) break;
        var mag = b.mag[i];
        if (mag > 9.55 || mag < minMag) continue;
        out.push(makeEvent(b, i, RAW.epochMs, "w" + idc++));
      }
    });
    out.sort(function (a, b2) { return b2.t - a.t; });
    return out;
  }

  function buildWindow(days, minMag) {
    return buildRange(Date.now() - days * D, Date.now(), minMag);
  }

  /* Stream every event in [startMs, endMs] to `cb(mag, lat, lon, depth, tMs)`
     straight off the typed arrays — no objects, so half a million dots can be
     painted onto a canvas without materializing anything. */
  function forEachInRange(startMs, endMs, cb) {
    if (!RAW) return;
    var s = (startMs - RAW.epochMs) / 1000;
    var e = (endMs - RAW.epochMs) / 1000;
    RAW.bands.forEach(function (b) {
      var i = lowerBound(b.t, s);
      for (; i < b.n; i++) {
        var ts = b.t[i];
        if (ts > e) break;
        var mag = b.mag[i];
        if (mag > 9.55) continue;
        cb(mag, b.lat[i], b.lon[i], b.depth[i], RAW.epochMs + ts * 1000);
      }
    });
  }

  /* Newest events in [startMs, endMs] that pass `test(mag, lat, lon, depth)`,
     up to `limit`, scanning the time-sorted bands backwards — so an event
     table can honor the user's exact filters over any span, cheaply. */
  function latestInRange(startMs, endMs, limit, test) {
    if (!RAW) return [];
    var startSec = (startMs - RAW.epochMs) / 1000;
    var endSec = (endMs - RAW.epochMs) / 1000;
    var cand = [];
    RAW.bands.forEach(function (b) {
      var i = lowerBound(b.t, endSec + 1) - 1;
      var got = 0;
      for (; i >= 0 && got < limit; i--) {
        var ts = b.t[i];
        if (ts > endSec) continue;
        if (ts < startSec) break;
        var mag = b.mag[i];
        if (mag > 9.55) continue;
        if (test && !test(mag, b.lat[i], b.lon[i], b.depth[i])) continue;
        cand.push({ b: b, i: i, ts: ts });
        got++;
      }
    });
    cand.sort(function (a, c) { return c.ts - a.ts; });
    var idc = 1;
    return cand.slice(0, limit).map(function (c) {
      return makeEvent(c.b, c.i, RAW.epochMs, "L" + idc++);
    });
  }

  function lowerBound(arr, val) {
    var lo = 0, hi = arr.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (arr[mid] < val) lo = mid + 1; else hi = mid; }
    return lo;
  }

  /* Aggregate any window straight off the typed arrays (bands are time-sorted,
     so only the window itself is scanned). Used by the dashboard for 1y–10y. */
  function rangeStats(days) {
    if (!RAW) return null;
    var now = Date.now();
    var startSec = (now - days * D - RAW.epochMs) / 1000;
    var prevStartSec = (now - 2 * days * D - RAW.epochMs) / 1000;

    var monthly = days > 120;
    var labels = [], series = [], binStartsSec = [];
    if (monthly) {
      var d0 = new Date(now - days * D);
      var y = d0.getUTCFullYear(), mo = d0.getUTCMonth();
      var end = new Date(now);
      while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && mo <= end.getUTCMonth())) {
        labels.push(mo === 0 ? String(y) : ""); // year ticks only
        binStartsSec.push((Date.UTC(y, mo, 1) - RAW.epochMs) / 1000);
        mo++; if (mo === 12) { mo = 0; y++; }
      }
      thinYearLabels(labels);
      series = labels.map(function () { return 0; });
    } else {
      var windowStartMs = now - days * D;
      var nBins = Math.max(1, Math.round(days));
      for (var bi = 0; bi < nBins; bi++) {
        var dd = new Date(windowStartMs + (bi + 0.5) * D);
        labels.push(MON[dd.getUTCMonth()] + " " + dd.getUTCDate());
        series.push(0);
      }
    }

    var buckets = { "M 7+": 0, "M 6–6.9": 0, "M 5–5.9": 0, "M 4–4.9": 0, "M 3–3.9": 0, "M 2–2.9": 0 };
    var count = 0, sumMag = 0, prevCount = 0, prevSum = 0;
    var top = []; // [{m, lat, lng, depth, tMs}]

    RAW.bands.forEach(function (b) {
      var i = lowerBound(b.t, prevStartSec);
      for (; i < b.n; i++) {
        var tSec = b.t[i], mag = b.mag[i];
        if (mag > 9.55) continue; // bogus catalog rows
        if (tSec < startSec) { prevCount++; prevSum += mag; continue; }
        count++; sumMag += mag;
        if (mag >= 7) buckets["M 7+"]++;
        else if (mag >= 6) buckets["M 6–6.9"]++;
        else if (mag >= 5) buckets["M 5–5.9"]++;
        else if (mag >= 4) buckets["M 4–4.9"]++;
        else if (mag >= 3) buckets["M 3–3.9"]++;
        else buckets["M 2–2.9"]++;

        if (top.length < 5 || mag > top[top.length - 1].m) {
          top.push({ m: mag, lat: b.lat[i], lng: b.lon[i], depth: b.depth[i], tSec: tSec });
          top.sort(function (a, c) { return c.m - a.m; });
          if (top.length > 5) top.pop();
        }

        var idx;
        if (monthly) {
          idx = binStartsSec.length - 1;
          while (idx > 0 && binStartsSec[idx] > tSec) idx--;
        } else {
          idx = Math.floor((tSec - startSec) / 86400);
        }
        if (idx >= 0 && idx < series.length) series[idx]++;
      }
    });

    var top5 = top.map(function (e, i2) {
      var who = nameFor(e.lat, e.lng);
      return {
        id: "r" + i2,
        m: Math.round(e.m * 10) / 10,
        lat: Math.round(e.lat * 1000) / 1000,
        lng: Math.round(e.lng * 1000) / 1000,
        depth: Math.max(0, Math.round(e.depth)),
        t: RAW.epochMs + e.tSec * 1000,
        loc: who.loc, group: who.group, rof: who.rof
      };
    });

    return {
      count: count, prevCount: prevCount,
      sumMag: sumMag, prevSum: prevSum,
      buckets: buckets, top5: top5,
      labels: labels, series: series, monthly: monthly
    };
  }

  function build(meta, bands) {
    var epochMs = Date.parse(meta.epoch);
    RAW = { epochMs: epochMs, bands: bands };
    var cutoff = (Date.now() - RECENT_DAYS * D - epochMs) / 1000;

    // full-catalog magnitude histogram (Gutenberg–Richter, 0.2 bins)
    var grStart = BANDS.length > 2 ? 2.0 : 4.0;
    var gx = [], gy = [];
    for (var m0 = grStart; m0 < 9.4; m0 += 0.2) { gx.push(Math.round(m0 * 10) / 10); gy.push(0); }

    var events = [];
    var idc = 1;

    bands.forEach(function (b) {
      for (var i = 0; i < b.n; i++) {
        var mag = b.mag[i];
        if (mag > 9.55) continue; // bogus catalog rows (largest ever recorded: M 9.5)
        var gi = Math.floor((mag - grStart) / 0.2);
        if (gi >= 0 && gi < gy.length) gy[gi]++;

        if (b.t[i] < cutoff) continue; // bands are time-sorted, but cheap to test all
        events.push(makeEvent(b, i, epochMs, "g" + idc++));
      }
    });

    events.sort(function (a, b2) { return b2.t - a.t; });

    EQ.events = events;
    EQ.grCurve = { x: gx, y: gy.map(function (v) { return Math.max(1, v); }) };
    EQ.meta = {
      generated: meta.generated_utc,
      count: meta.count,
      source: meta.source,
      epoch: meta.epoch
    };
    EQ.NOW = Date.now();
  }

  function loadAll() {
    return fetchJSON(DATA_BASE + "meta.json").then(function (meta) {
      return Promise.all(BANDS.map(function (p) { return fetchBuf(DATA_BASE + p); }))
        .then(function (bufs) {
          build(meta, bufs.map(parseBand));
          return EQ;
        });
    });
  }

  EQ.ready = loadAll().catch(function (err) {
    console.error("catalog load failed:", err);
    EQ.loadError = String(err && err.message || err);
    return EQ; // pages still boot; charts show empty states
  });

  /* refresh in place when the update pipeline publishes a new build */
  setInterval(function () {
    fetchJSON(DATA_BASE + "meta.json").then(function (m2) {
      if (EQ.meta && m2.generated_utc !== EQ.meta.generated) {
        loadAll().then(function () {
          liveListeners.forEach(function (cb) { cb(null); });
        });
      }
    }).catch(function () { /* offline — try again next tick */ });
  }, 10 * 60e3);
})();
