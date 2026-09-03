/* World Earthquake Labs — seismic insights page */
(function () {
  "use strict";

  /* A page and its scripts can disagree for as long as a browser holds an old
     copy of one of them -- which is how a removed control took the whole
     Overview down: getElementById returned null, the throw killed the rest of
     the module, and nothing rendered. Binding through here degrades that to a
     control that does not respond. */
  function on(id, type, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(type, fn);
    return el;
  }

  EQ.ready.then(function () {

  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = "#7b8698";

  var BLUE = "#2563eb";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var PERIOD_LBL = { 1: "24h", 7: "7d", 30: "30d", 90: "90d", 365: "1y", 1095: "3y", 1826: "5y", 3652: "10y", 7305: "20y", 10958: "30y", 18263: "50y" };
  var ALL_DAYS = Math.ceil((Date.now() - Date.parse("1900-01-01T00:00:00Z")) / 86400e3);
  function periodLbl() { return PERIOD_LBL[state.days] || "All"; }
  var state = { days: 30, region: "Global" };
  var charts = {};
  var eventLookup = {};
  var historyState = { page: 0, size: 20, query: "", sort: "latest" };
  var lastModalTrigger = null;

  function analysisFloor() {
    if (state.days <= 120) return 2;
    return state.days > 7300 ? 5 : 4;
  }

  function scopeText() {
    return "Selected catalog: M " + analysisFloor() + "+ events · " + periodLbl() + " · " + state.region;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function eventKey(e) {
    var key = String(e.id || (e.t + "-" + e.lat + "-" + e.lng));
    eventLookup[key] = e;
    return escapeHTML(key);
  }

  function fmtMagnitude(m) { return Number(m || 0).toFixed(1); }
  /* The magnitude cell, coloured by the same nine steps the map legend uses --
     a table of numbers gives no sense of which rows matter, and the reader
     already knows this palette from the globe. The band is the integer part,
     so M 5.0 and M 5.9 share a colour exactly as they do on the map. */
  function magCell(m, extraClass) {
    var band = Math.max(1, Math.min(9, Math.floor(Number(m) || 0)));
    return '<td class="mag' + (extraClass ? " " + extraClass : "") + '">'
      + '<span class="mag-pill mag-b' + band + '">M ' + fmtMagnitude(m) + "</span></td>";
  }
  function fmtDepth(depth) { return Math.round(Number(depth || 0)).toLocaleString() + " km"; }
  function fmtCoord(value, positive, negative) {
    var n = Number(value || 0);
    return Math.abs(n).toFixed(3) + "° " + (n >= 0 ? positive : negative);
  }

  function emptyRow(cols, message) {
    return '<tr><td class="analysis-empty" colspan="' + cols + '">' + escapeHTML(message) + "</td></tr>";
  }

  function eventRow(e, cells) {
    return '<tr tabindex="0" data-event-key="' + eventKey(e) + '" aria-label="View details for M ' +
      fmtMagnitude(e.m) + " " + escapeHTML(e.loc || e.region || "Unknown location") + '">' + cells.join("") + "</tr>";
  }

  function makeChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  /* short windows use the recent-events cache; long ones materialize M4+ */
  var longCache = { key: null, list: [] };
  var selectedCache = { key: null, list: [] };

  function baseEvents() {
    if (state.days <= 120) return EQ.inWindow(state.days * EQ.D);
    if (longCache.key !== state.days) {
      var floor = state.days > 7300 ? 5 : 4; // full catalog stays tractable at M5+
      longCache = { key: state.days, list: EQ.buildWindow(state.days, floor) };
    }
    return longCache.list;
  }

  function windowEvents() {
    var source = baseEvents();
    var key = state.days + "|" + state.region + "|" + source.length;
    if (selectedCache.key !== key) selectedCache = { key: key, list: EQ.byRegion(source, state.region) };
    return selectedCache.list;
  }

  /* Month bins for long charts. A one-year view needs month + year context;
     multi-year views stay sparse and use year ticks only. */
  function monthBins() {
    var now = new Date();
    var start = new Date(Date.now() - state.days * EQ.D);
    var y = start.getUTCFullYear(), mo = start.getUTCMonth();
    var labels = [], keys = [];
    var showMonthYear = state.days <= 400;
    while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && mo <= now.getUTCMonth())) {
      labels.push(showMonthYear ? EQ.axisMon(mo) + " '" + String(y).slice(-2) : (mo === 0 ? String(y) : ""));
      keys.push(y * 12 + mo);
      mo++; if (mo === 12) { mo = 0; y++; }
    }
    if (!showMonthYear) EQ.thinYearLabels(labels);
    return {
      labels: labels,
      tickEvery: showMonthYear && labels.length > 9 ? 2 : 1,
      idx: function (t) {
        var d = new Date(t);
        return keys.indexOf(d.getUTCFullYear() * 12 + d.getUTCMonth());
      }
    };
  }

  function logTicks(value) {
    var l = Math.log10(value);
    if (l % 1 === 0) {
      var exp = Math.round(l);
      var sup = String(exp).split("").map(function (ch) {
        return "⁰¹²³⁴⁵⁶⁷⁸⁹"["0123456789".indexOf(ch)] || ch;
      }).join("");
      return "10" + sup;
    }
    return null;
  }

  /* ---------- 1. earthquakes over time ---------- */
  function renderTime() {
    var evs = windowEvents();
    var labels, counts, every, mainLbl, avgLbl, avgW;

    if (state.days === 1) {
      labels = []; counts = [];
      var start = Date.now() - 24 * EQ.H;
      for (var i = 0; i < 24; i++) { labels.push((i < 10 ? "0" + i : i) + ":00"); counts.push(0); }
      evs.forEach(function (e) {
        var bi = Math.min(23, Math.floor((e.t - start) / EQ.H));
        if (bi >= 0) counts[bi]++;
      });
      every = 4; mainLbl = "Hourly Count"; avgLbl = "6-Hour Average"; avgW = 6;
    } else if (state.days <= 120) {
      var dc = EQ.dailyCounts(state.days, evs);
      labels = dc.labels; counts = dc.counts;
      every = state.days > 30 ? 14 : state.days > 7 ? 7 : 1;
      mainLbl = "Daily Count"; avgLbl = "7-Day Average"; avgW = 7;
    } else {
      var mb = monthBins();
      labels = mb.labels;
      counts = labels.map(function () { return 0; });
      evs.forEach(function (e) { var bi2 = mb.idx(e.t); if (bi2 >= 0) counts[bi2]++; });
      every = mb.tickEvery;
      mainLbl = "Monthly Count"; avgLbl = "6-Month Average"; avgW = 6;
    }

    var avg = EQ.movingAvg(counts, avgW);

    makeChart("timeChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: mainLbl, data: counts, borderColor: BLUE, borderWidth: 1.6, pointRadius: 0, tension: 0 },
          { label: avgLbl, data: avg, borderColor: "#7fa6f2", borderWidth: 1.6, borderDash: [5, 4], pointRadius: 0, tension: .35 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", align: "start", labels: { boxWidth: 18, boxHeight: 1.5, usePointStyle: false } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: function (v, i) { return i % every === 0 ? this.getLabelForValue(v) : ""; } } },
          y: { beginAtZero: true, grid: { color: "#eef2f7" }, border: { display: false } }
        }
      }
    });
  }

  /* ---------- 2. magnitude frequency (log) — current selection ---------- */
  function renderMag() {
    var evs = windowEvents();
    var floor = analysisFloor();
    var step = 0.2;
    var count = Math.ceil((9.6 - floor) / step);
    var bins = Array(count).fill(0);
    evs.forEach(function (e) {
      var idx = Math.floor((e.m - floor) / step + 0.0001);
      if (idx >= 0 && idx < bins.length) bins[idx]++;
    });
    var data = bins.map(function (value, i) {
      return { x: Math.round((floor + i * step) * 10) / 10, y: value || null };
    });

    makeChart("magChart", {
      type: "line",
      data: {
        datasets: [{
          data: data, borderColor: BLUE, borderWidth: 1.5, showLine: true,
          pointRadius: 3, pointBackgroundColor: BLUE, tension: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: "linear", min: floor, max: 9.5, title: { display: true, text: "Magnitude" }, grid: { color: "#f2f5f9" } },
          y: { type: "logarithmic", min: 1, grid: { color: "#eef2f7" }, border: { display: false },
               ticks: { callback: logTicks } }
        }
      }
    });
  }

  /* ---------- 3. depth distribution ---------- */
  function renderDepth() {
    var d = EQ.depthBins(windowEvents());
    makeChart("depthChart", {
      type: "bar",
      data: {
        labels: d.labels,
        datasets: [{ data: d.pct, backgroundColor: BLUE, borderRadius: 3, categoryPercentage: 0.62 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.y + "%"; } } } },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: "Depth (km)" } },
          y: { beginAtZero: true, grid: { color: "#eef2f7" }, border: { display: false },
               ticks: { callback: function (v) { return v + "%"; } } }
        }
      }
    });
  }

  /* ---------- 4. energy release (log) ---------- */
  function renderEnergy() {
    var evs = windowEvents();
    var labels, values, every;

    if (state.days > 120) {
      var mb = monthBins();
      labels = mb.labels;
      values = labels.map(function () { return 0; });
      evs.forEach(function (e) {
        var bi = mb.idx(e.t);
        if (bi >= 0) values[bi] += Math.pow(10, 1.5 * (e.m - 3));
      });
      values = values.map(function (x) { return Math.max(1, Math.round(x)); });
      every = mb.tickEvery;
    } else if (state.days === 1) {
      labels = []; values = [];
      var start = Date.now() - 24 * EQ.H;
      for (var i = 0; i < 24; i++) { labels.push((i < 10 ? "0" + i : i) + ":00"); values.push(0); }
      evs.forEach(function (e) {
        var bi2 = Math.min(23, Math.floor((e.t - start) / EQ.H));
        if (bi2 >= 0) values[bi2] += Math.pow(10, 1.5 * (e.m - 3));
      });
      values = values.map(function (x) { return Math.max(1, Math.round(x)); });
      every = 4;
    } else {
      var es = EQ.energySeries(state.days, evs);
      labels = es.labels; values = es.values;
      every = state.days > 30 ? 14 : state.days > 7 ? 7 : 1;
    }

    makeChart("energyChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [{ data: values, borderColor: BLUE, borderWidth: 1.5, pointRadius: 2.6, pointBackgroundColor: BLUE, tension: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: function (v, i) { return i % every === 0 ? this.getLabelForValue(v) : ""; } } },
          y: { type: "logarithmic", grid: { color: "#eef2f7" }, border: { display: false }, ticks: { callback: logTicks } }
        }
      }
    });
  }

  /* ---------- 5. hotspots ---------- */
  function renderHot() {
    var evs = windowEvents();
    var rows = EQ.hotspots(evs, 5).filter(function (r) { return r.count > 0; });
    document.getElementById("hotRangeLbl").textContent = "(" + periodLbl() + ")";
    document.getElementById("hotList").innerHTML = rows.length ? rows.map(function (r, i) {
      return '<div class="hot-row"><div class="hot-rank">' + (i + 1) + "</div>" +
        '<div class="hot-name">' + r.name + '</div><div class="hot-count">' + r.count.toLocaleString() + "</div></div>";
    }).join("") : '<div class="analysis-empty">No earthquakes match this selection.</div>';
  }

  /* ---------- 6. activity anomaly — observed counts vs rolling baseline ---------- */
  function activitySeries() {
    var evs = windowEvents();
    var labels, counts, every, baselineWindow;
    if (state.days === 1) {
      labels = []; counts = [];
      var start = Date.now() - 24 * EQ.H;
      for (var h = 0; h < 24; h++) { labels.push((h < 10 ? "0" + h : h) + ":00"); counts.push(0); }
      evs.forEach(function (e) {
        var hi = Math.min(23, Math.floor((e.t - start) / EQ.H));
        if (hi >= 0) counts[hi]++;
      });
      every = 4; baselineWindow = 6;
    } else if (state.days <= 120) {
      var daily = EQ.dailyCounts(state.days, evs);
      labels = daily.labels; counts = daily.counts;
      every = state.days > 30 ? 14 : state.days > 7 ? 7 : 1;
      baselineWindow = Math.min(14, Math.max(5, Math.floor(state.days / 4)));
    } else {
      var monthly = monthBins();
      labels = monthly.labels; counts = labels.map(function () { return 0; });
      evs.forEach(function (e) { var mi = monthly.idx(e.t); if (mi >= 0) counts[mi]++; });
      every = monthly.tickEvery; baselineWindow = 12;
    }
    return { labels: labels, counts: counts, every: every, baselineWindow: baselineWindow };
  }

  function renderModel() {
    var series = activitySeries();
    var z = series.counts.map(function (count, i) {
      var from = Math.max(0, i - series.baselineWindow);
      var history = series.counts.slice(from, i);
      if (history.length < Math.min(4, series.baselineWindow)) return null;
      var mean = history.reduce(function (sum, n) { return sum + n; }, 0) / history.length;
      var variance = history.reduce(function (sum, n) { return sum + Math.pow(n - mean, 2); }, 0) / history.length;
      var sd = Math.max(1, Math.sqrt(variance));
      return Math.max(-4, Math.min(4, Math.round(((count - mean) / sd) * 100) / 100));
    });
    makeChart("modelChart", {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          { label: "Activity anomaly", data: z, borderColor: BLUE, backgroundColor: "rgba(37,99,235,.08)", fill: true, borderWidth: 1.5, pointRadius: 0, tension: .18 },
          { label: "Elevated threshold", data: series.labels.map(function () { return 2; }), borderColor: "#e66a4e", borderDash: [5, 4], borderWidth: 1.1, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", align: "start", labels: { boxWidth: 18, boxHeight: 2 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: function (val, i) { return i % series.every === 0 ? this.getLabelForValue(val) : ""; } } },
          y: { min: -4, max: 4, title: { display: true, text: "z-score" }, grid: { color: "#eef2f7" }, border: { display: false } }
        }
      }
    });
  }

  /* ---------- richer analysis panels ---------- */
  function renderStats() {
    var evs = windowEvents();
    var strongest = evs.reduce(function (best, e) { return !best || e.m > best.m ? e : best; }, null);
    var meanDepth = evs.length ? evs.reduce(function (sum, e) { return sum + Number(e.depth || 0); }, 0) / evs.length : 0;
    var shallow = evs.filter(function (e) { return e.depth < 70; }).length;
    var days = Math.max(1, Math.min(state.days, ALL_DAYS));
    var rows = [
      { k: "Cataloged events", v: evs.length.toLocaleString(), hint: "M " + analysisFloor() + "+ selection" },
      { k: "Strongest", v: strongest ? "M " + fmtMagnitude(strongest.m) : "—", hint: strongest ? strongest.loc : "No event" },
      { k: "Average per day", v: (evs.length / days).toLocaleString(undefined, { maximumFractionDigits: 1 }), hint: "Across selected interval" },
      { k: "Average depth", v: evs.length ? Math.round(meanDepth).toLocaleString() + " km" : "—", hint: "Hypocentral depth" },
      { k: "Shallow share", v: evs.length ? Math.round(shallow / evs.length * 1000) / 10 + "%" : "—", hint: "Depth under 70 km" }
    ];
    document.getElementById("statsKpis").innerHTML = rows.map(function (r) {
      return '<div class="analysis-kpi"><div class="k">' + escapeHTML(r.k) + '</div><div class="v" title="' +
        escapeHTML(r.v) + '">' + escapeHTML(r.v) + '</div><div class="hint" title="' + escapeHTML(r.hint) + '">' + escapeHTML(r.hint) + "</div></div>";
    }).join("");
  }

  function renderMagBands() {
    var buckets = EQ.magBuckets(windowEvents());
    var labels = ["M 2–2.9", "M 3–3.9", "M 4–4.9", "M 5–5.9", "M 6–6.9", "M 7+"];
    makeChart("magBandsChart", {
      type: "doughnut",
      data: { labels: labels, datasets: [{ data: labels.map(function (k) { return buckets[k] || 0; }), backgroundColor: ["#f7cf63", "#f4ad3c", "#ef862d", "#e85c35", "#d93e42", "#822f9f"], borderColor: "#fff", borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "58%",
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8 } }, tooltip: { callbacks: { label: function (ctx) { return ctx.label + ": " + ctx.parsed.toLocaleString(); } } } }
      }
    });
  }

  function renderDepthScatter() {
    var evs = windowEvents();
    var limit = 1000;
    var step = Math.max(1, evs.length / limit);
    var sampled = [];
    for (var i = 0; i < evs.length && sampled.length < limit; i += step) {
      var e = evs[Math.floor(i)];
      sampled.push({ x: e.m, y: e.depth, event: e });
    }
    makeChart("depthScatterChart", {
      type: "scatter",
      data: { datasets: [{ label: "Earthquake", data: sampled, backgroundColor: "rgba(37,99,235,.42)", borderColor: "rgba(37,99,235,.7)", pointRadius: 2.8, pointHoverRadius: 5 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: function (_, points) { if (points.length) openEventModal(sampled[points[0].index].event); },
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: function (ctx) { return "M " + fmtMagnitude(ctx.raw.x) + " · " + fmtDepth(ctx.raw.y); },
          afterLabel: function (ctx) { return ctx.raw.event.loc || ctx.raw.event.region || "Unknown location"; }
        } } },
        scales: {
          x: { title: { display: true, text: "Magnitude" }, grid: { color: "#eef2f7" } },
          y: { reverse: true, beginAtZero: true, title: { display: true, text: "Depth (km)" }, grid: { color: "#eef2f7" }, border: { display: false } }
        }
      }
    });
  }

  function renderHeatmap() {
    var canvas = document.getElementById("spatialHeatmap");
    var box = canvas.parentElement;
    var w = Math.round(box.clientWidth), h = Math.round(box.clientHeight);
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = 36, rows = 18, grid = Array(cols * rows).fill(0);
    windowEvents().forEach(function (e) {
      var col = Math.max(0, Math.min(cols - 1, Math.floor((e.lng + 180) / 10)));
      var row = Math.max(0, Math.min(rows - 1, Math.floor((90 - e.lat) / 10)));
      grid[row * cols + col]++;
    });
    var max = Math.max.apply(null, grid.concat([0]));
    var cw = w / cols, ch = h / rows;
    ctx.fillStyle = "#f2f7fc"; ctx.fillRect(0, 0, w, h);
    grid.forEach(function (count, idx) {
      if (!count) return;
      var intensity = Math.log1p(count) / Math.max(1, Math.log1p(max));
      ctx.fillStyle = "rgba(232, 77, 48, " + (0.12 + intensity * 0.82) + ")";
      ctx.fillRect((idx % cols) * cw, Math.floor(idx / cols) * ch, Math.ceil(cw) + .2, Math.ceil(ch) + .2);
    });
    ctx.strokeStyle = "rgba(112,139,174,.15)"; ctx.lineWidth = 1;
    for (var x = 0; x <= cols; x += 6) { ctx.beginPath(); ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, h); ctx.stroke(); }
    for (var y = 0; y <= rows; y += 3) { ctx.beginPath(); ctx.moveTo(0, y * ch); ctx.lineTo(w, y * ch); ctx.stroke(); }
    document.getElementById("heatmapMax").textContent = max ? "Peak cell " + max.toLocaleString() + " events" : "No events";
  }

  function renderRankedTables() {
    var evs = windowEvents();
    var top = evs.slice().sort(function (a, b) { return b.m - a.m || b.t - a.t; }).slice(0, 10);
    document.getElementById("topEventsBody").innerHTML = top.length ? top.map(function (e, i) {
      return eventRow(e, ['<td class="muted">' + (i + 1) + "</td>", magCell(e.m), '<td class="location">' + escapeHTML(e.loc || e.region || "Unknown location") + "</td>", '<td class="muted">' + escapeHTML(EQ.fmtTime(e.t, true)) + "</td>", '<td class="right">' + escapeHTML(fmtDepth(e.depth)) + "</td>"]);
    }).join("") : emptyRow(5, "No earthquakes match this selection.");

    var deep = evs.slice().sort(function (a, b) { return b.depth - a.depth || b.m - a.m; }).slice(0, 10);
    document.getElementById("deepEventsBody").innerHTML = deep.length ? deep.map(function (e, i) {
      return eventRow(e, ['<td class="muted">' + (i + 1) + "</td>", '<td><strong>' + escapeHTML(fmtDepth(e.depth)) + "</strong></td>", magCell(e.m), '<td class="location">' + escapeHTML(e.loc || e.region || "Unknown location") + "</td>", '<td class="muted">' + escapeHTML(EQ.fmtTime(e.t, true)) + "</td>"]);
    }).join("") : emptyRow(5, "No earthquakes match this selection.");

    var strongest = top.length ? top[0].m : 0;
    var weighted = evs.map(function (e) { return { event: e, weight: Math.pow(10, 1.5 * (e.m - strongest)) }; });
    var totalWeight = weighted.reduce(function (sum, item) { return sum + item.weight; }, 0) || 1;
    weighted.sort(function (a, b) { return b.weight - a.weight || b.event.t - a.event.t; });
    var energyTop = weighted.slice(0, 10);
    document.getElementById("energyEventsBody").innerHTML = energyTop.length ? energyTop.map(function (item, i) {
      var e = item.event;
      var share = item.weight / totalWeight * 100;
      return eventRow(e, ['<td class="muted">' + (i + 1) + "</td>", magCell(e.m), '<td class="location">' + escapeHTML(e.loc || e.region || "Unknown location") + "</td>", "<td><strong>" + (share < .1 ? "&lt;0.1" : share.toFixed(1)) + "%</strong></td>", '<td class="muted">' + escapeHTML(EQ.fmtTime(e.t, true)) + "</td>"]);
    }).join("") : emptyRow(5, "No earthquakes match this selection.");
  }

  function renderHistory() {
    var q = historyState.query.trim().toLowerCase();
    var evs = windowEvents().filter(function (e) {
      return !q || String(e.loc || e.region || e.group || "").toLowerCase().indexOf(q) !== -1;
    });
    var sorter = historyState.sort === "largest" ? function (a, b) { return b.m - a.m || b.t - a.t; } :
      historyState.sort === "deepest" ? function (a, b) { return b.depth - a.depth || b.t - a.t; } :
      function (a, b) { return b.t - a.t; };
    evs.sort(sorter);
    var pages = Math.max(1, Math.ceil(evs.length / historyState.size));
    historyState.page = Math.min(historyState.page, pages - 1);
    var start = historyState.page * historyState.size;
    var page = evs.slice(start, start + historyState.size);
    document.getElementById("historyBody").innerHTML = page.length ? page.map(function (e) {
      return eventRow(e, [magCell(e.m), '<td class="location">' + escapeHTML(e.loc || e.region || "Unknown location") + "</td>", '<td class="muted">' + escapeHTML(EQ.fmtTime(e.t, true)) + "</td>", '<td class="right">' + escapeHTML(fmtDepth(e.depth)) + "</td>"]);
    }).join("") : emptyRow(4, "No earthquakes match your search.");
    document.getElementById("historyCount").textContent = evs.length ? (start + 1).toLocaleString() + "–" + Math.min(start + historyState.size, evs.length).toLocaleString() + " of " + evs.length.toLocaleString() : "0 events";
    document.getElementById("historyPrev").disabled = historyState.page === 0;
    document.getElementById("historyNext").disabled = historyState.page >= pages - 1;
  }

  /* The modal's locator map. Built on first open and reused: Leaflet in a
     hidden container measures zero, so it is created only once the card is on
     screen and told to re-measure right after. */
  var modalMap = null;
  var modalMarks = null;

  function showModalMap(e) {
    var host = document.getElementById("eventModalMap");
    if (!host || typeof L === "undefined") { if (host) host.hidden = true; return; }
    host.hidden = false;

    if (!modalMap) {
      // A real map, not a picture of one: the opening frame answers "where on
      // Earth", and anyone who wants the street the fault runs down can zoom
      // in. Capped at 10 because that is where these tiles stop, and at 1
      // because below that the world repeats sideways in a 420px box.
      modalMap = L.map(host, {
        zoomControl: true, attributionControl: true,
        scrollWheelZoom: true, doubleClickZoom: true, boxZoom: true,
        keyboard: true, zoomSnap: 0.25, minZoom: 1, maxZoom: 10,
        worldCopyJump: true
      });
      modalMap.zoomControl.setPosition("topright");
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 10, attribution: "Esri"
      }).addTo(modalMap);
      // The grey canvas carries no place names, so a pulled-back view was a
      // blank field with an island in it. The reference tiles add country and
      // ocean labels, which is the half of "where did this happen" that
      // coordinates cannot give you.
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 10
      }).addTo(modalMap);
      modalMarks = L.layerGroup().addTo(modalMap);
    }

    modalMarks.clearLayers();
    var colour = EQ.magColor(e.m);
    // Two rings: a filled dot for the epicentre and a wide halo, so a single
    // point still reads as a location at continent zoom.
    L.circleMarker([e.lat, e.lng], {
      radius: Math.max(6, EQ.magRadius(e.m)), color: "#fff", weight: 2,
      fillColor: colour, fillOpacity: 0.95
    }).addTo(modalMarks);
    L.circleMarker([e.lat, e.lng], {
      radius: Math.max(16, EQ.magRadius(e.m) * 2.6), color: colour, weight: 1.5,
      opacity: 0.45, fill: false
    }).addTo(modalMarks);

    // Pulled back far enough to place the event on a continent -- at the old
    // 4/5 a mid-ocean epicentre filled the frame with empty water and told you
    // nothing. Not the whole globe either: that shrinks the halo to a speck.
    modalMap.setView([e.lat, e.lng], 2, { animate: false });
    // The container had no size while the modal was hidden.
    requestAnimationFrame(function () { modalMap.invalidateSize(); });
  }

  function openEventModal(e) {
    if (!e) return;
    var modal = document.getElementById("eventModal");
    lastModalTrigger = document.activeElement;
    document.getElementById("eventModalMag").textContent = "M " + fmtMagnitude(e.m);
    document.getElementById("eventModalTitle").textContent = e.loc || e.region || "Unknown location";
    document.getElementById("eventModalTime").textContent = EQ.fmtTimeBoth(e.t);
    document.getElementById("eventModalCoords").textContent = fmtCoord(e.lat, "N", "S") + "  " + fmtCoord(e.lng, "E", "W");
    document.getElementById("eventModalDepth").textContent = fmtDepth(e.depth);
    document.getElementById("eventModalRegion").textContent = e.region || e.group || "—";
    document.getElementById("eventModalStatus").textContent = e.status ? e.status.charAt(0).toUpperCase() + e.status.slice(1) : "Reviewed";
    modal.hidden = false;
    document.body.classList.add("insight-modal-open");
    showModalMap(e);
    modal.querySelector(".insight-modal-close").focus();
  }

  function closeEventModal() {
    var modal = document.getElementById("eventModal");
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("insight-modal-open");
    if (lastModalTrigger && lastModalTrigger.focus) lastModalTrigger.focus();
  }

  /* ---------- controls ---------- */

  var VIEW_INFO = {
    overview: {
      kicker: "Overview",
      title: "The seismic record, connected",
      copy: "Compare event frequency, magnitude, depth, energy, regional concentration, and activity anomalies in one view.",
      cards: ["cardTime", "cardMag", "cardDepth", "cardEnergy", "cardHot", "cardModel"]
    },
    statistics: {
      kicker: "Statistics",
      title: "How earthquake activity changes over time and depth",
      copy: "Review key statistics, temporal patterns, depth composition, and the complete searchable history for the current selection.",
      cards: ["cardStats", "cardTime", "cardDepth", "cardHistory"]
    },
    magnitude: {
      kicker: "Magnitude Analysis",
      title: "Frequency falls as seismic energy rises",
      copy: "Compare magnitude frequency and composition, then inspect the ten largest events and their details.",
      cards: ["cardMag", "cardMagBands", "cardEnergy", "cardTopEvents"]
    },
    depth: {
      kicker: "Depth Analysis",
      title: "Where earthquakes begin below the surface",
      copy: "Compare depth bands, explore magnitude–depth relationships, and inspect the deepest events in the selected catalog.",
      cards: ["cardDepth", "cardDepthScatter", "cardDeepEvents"]
    },
    regional: {
      kicker: "Regional Insights",
      title: "Where seismic activity is concentrating",
      copy: "Use hotspot rankings and a global density grid to find concentrations, then search the underlying event history.",
      cards: ["cardHot", "cardHeatmap", "cardTime", "cardHistory"]
    },
    energy: {
      kicker: "Energy Analysis",
      title: "A few large events can dominate the signal",
      copy: "Track relative energy through time and identify the individual earthquakes contributing most of the selected total.",
      cards: ["cardEnergy", "cardEnergyTop", "cardTopEvents"]
    },
    forecast: {
      kicker: "Forecast Models",
      title: "Monitor departures from the activity baseline",
      copy: "The anomaly chart compares observed counts with a rolling baseline. It highlights unusual activity but is not a deterministic earthquake prediction.",
      cards: ["cardModel", "cardTime", "cardStats"]
    },
    custom: {
      kicker: "Custom Analysis",
      title: "Build your own comparison",
      copy: "Choose a time range and region above, then compare every analysis panel using the same selection.",
      cards: ["cardStats", "cardTime", "cardMag", "cardMagBands", "cardDepth", "cardDepthScatter", "cardEnergy", "cardHot", "cardHeatmap", "cardModel", "cardTopEvents", "cardDeepEvents", "cardEnergyTop", "cardHistory"]
    }
  };

  var viewLinks = Array.prototype.slice.call(document.querySelectorAll(".side-nav a[data-insight-view]"));
  var insightCards = Array.prototype.slice.call(document.querySelectorAll("#insightCharts > .card"));

  function setInsightView(name, updateHash) {
    var info = VIEW_INFO[name] || VIEW_INFO.overview;
    name = VIEW_INFO[name] ? name : "overview";

    document.getElementById("insightViewKicker").textContent = info.kicker;
    document.getElementById("insightViewTitle").textContent = info.title;
    document.getElementById("insightViewCopy").textContent = info.copy;

    insightCards.forEach(function (card) {
      var show = info.cards.indexOf(card.id) !== -1;
      card.hidden = !show;
      card.classList.toggle("insight-card-wide", show && info.cards.length === 1);
    });
    viewLinks.forEach(function (link) {
      var active = link.dataset.insightView === name;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (updateHash && history.replaceState) history.replaceState(null, "", "#" + name);
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "insights", sub: name }, "*");
    }
    requestAnimationFrame(function () {
      Object.keys(charts).forEach(function (id) {
        if (!document.getElementById(id).closest(".card").hidden) charts[id].resize();
      });
      if (!document.getElementById("cardHeatmap").hidden) renderHeatmap();
    });
  }

  viewLinks.forEach(function (link) {
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      setInsightView(link.dataset.insightView, true);
      var top = document.getElementById("chartsTop");
      window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 92, behavior: "smooth" });
    });
  });

  on("insightCharts", "click", function (ev) {
    var row = ev.target.closest("tr[data-event-key]");
    if (row) openEventModal(eventLookup[row.dataset.eventKey]);
  });

  on("insightCharts", "keydown", function (ev) {
    var row = ev.target.closest("tr[data-event-key]");
    if (row && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      openEventModal(eventLookup[row.dataset.eventKey]);
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-modal-close]"), function (button) {
    button.addEventListener("click", closeEventModal);
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeEventModal();
  });

  on("historySearch", "input", function () {
    historyState.query = this.value;
    historyState.page = 0;
    renderHistory();
  });

  on("historySort", "change", function () {
    historyState.sort = this.value;
    historyState.page = 0;
    renderHistory();
  });

  on("historyPrev", "click", function () {
    historyState.page = Math.max(0, historyState.page - 1);
    renderHistory();
  });

  on("historyNext", "click", function () {
    historyState.page++;
    renderHistory();
  });

  on("rangeSelect", "change", function () {
    state.days = this.value === "all" ? ALL_DAYS : +this.value;
    historyState.page = 0;
    renderAll();
  });

  on("regionSelect", "change", function () {
    state.region = this.value;
    historyState.page = 0;
    renderAll();
  });

  window.addEventListener("wel:tz", function () { renderAll(); });

  function renderAll() {
    eventLookup = {};
    selectedCache.key = null;
    document.getElementById("analysisScope").textContent = scopeText();
    document.getElementById("magDataNote").textContent = "Selected-period M " + analysisFloor() + "+ event counts in 0.2-magnitude bins on a logarithmic scale.";
    renderTime();
    renderMag();
    renderDepth();
    renderEnergy();
    renderHot();
    renderModel();
    renderStats();
    renderMagBands();
    renderDepthScatter();
    renderHeatmap();
    renderRankedTables();
    renderHistory();
  }

  renderAll();

  var initialView = (location.hash || "").slice(1);
  setInsightView(VIEW_INFO[initialView] ? initialView : "overview", false);

  window.addEventListener("hashchange", function () {
    var name = (location.hash || "").slice(1);
    if (VIEW_INFO[name]) setInsightView(name, false);
  });

  // deep-link: #r365 opens the page on that time range
  var rm = (location.hash || "").match(/^#r(\d+)$/);
  if (rm && PERIOD_LBL[+rm[1]]) {
    var sel = document.getElementById("rangeSelect");
    sel.value = rm[1];
    sel.dispatchEvent(new Event("change"));
  }

  var heatmapResizeFrame = 0;
  window.addEventListener("resize", function () {
    cancelAnimationFrame(heatmapResizeFrame);
    heatmapResizeFrame = requestAnimationFrame(function () {
      if (!document.getElementById("cardHeatmap").hidden) renderHeatmap();
    });
  });
  });
})();
