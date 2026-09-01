/* World Earthquake Labs — seismic insights page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = "#7b8698";

  var BLUE = "#2563eb";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var PERIOD_LBL = { 1: "24h", 7: "7d", 30: "30d", 90: "90d", 365: "1y", 1095: "3y", 1826: "5y", 3652: "10y" };
  var state = { days: 30, region: "Global" };
  var charts = {};

  function makeChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  /* short windows use the recent-events cache; long ones materialize M4+ */
  var longCache = { key: null, list: [] };

  function baseEvents() {
    if (state.days <= 120) return EQ.inWindow(state.days * EQ.D);
    if (longCache.key !== state.days) {
      longCache = { key: state.days, list: EQ.buildWindow(state.days, 4) };
    }
    return longCache.list;
  }

  function windowEvents() {
    return EQ.byRegion(baseEvents(), state.region);
  }

  /* month bins for 1y+ charts */
  function monthBins() {
    var now = new Date();
    var start = new Date(Date.now() - state.days * EQ.D);
    var y = start.getUTCFullYear(), mo = start.getUTCMonth();
    var labels = [], keys = [];
    while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && mo <= now.getUTCMonth())) {
      labels.push(MON[mo] + " '" + String(y).slice(2));
      keys.push(y * 12 + mo);
      mo++; if (mo === 12) { mo = 0; y++; }
    }
    return {
      labels: labels,
      idx: function (t) {
        var d = new Date(t);
        return keys.indexOf(d.getUTCFullYear() * 12 + d.getUTCMonth());
      }
    };
  }

  function labelEvery(n) { return n > 40 ? 12 : n > 14 ? 3 : 1; }

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
      every = labelEvery(labels.length);
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

  /* ---------- 2. magnitude frequency (log) — full catalog since 1900 ---------- */
  function renderMag() {
    var gr = EQ.grCurve;
    var data = gr.x.map(function (x, i) { return { x: x, y: gr.y[i] }; });

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
          x: { type: "linear", min: (gr.x[0] || 4) - 0.2, max: 9.5, title: { display: true, text: "Magnitude" }, grid: { color: "#f2f5f9" } },
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
      every = labelEvery(labels.length);
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
    var evs = baseEvents();
    var rows = EQ.hotspots(evs, 5);
    document.getElementById("hotRangeLbl").textContent = "(" + PERIOD_LBL[state.days] + ")";
    document.getElementById("hotList").innerHTML = rows.map(function (r, i) {
      return '<div class="hot-row"><div class="hot-rank">' + (i + 1) + "</div>" +
        '<div class="hot-name">' + r.name + '</div><div class="hot-count">' + r.count.toLocaleString() + "</div></div>";
    }).join("");
  }

  /* ---------- 6. model performance ---------- */
  function renderModel() {
    var labels = [], vals = [];
    var n = Math.min(45, Math.max(20, state.days));
    var v = 0.42;
    for (var i = 0; i < n; i++) {
      var d = new Date(Date.now() - (n - 1 - i) * EQ.D);
      labels.push(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()] + " " + d.getUTCDate());
      v += (Math.sin(i / 2.3) * 0.045 + (((i * 7919) % 13) / 13 - 0.5) * 0.24);
      v = Math.max(0.12, Math.min(0.85, v));
      vals.push(Math.round(v * 100) / 100);
    }
    var every = n > 30 ? 10 : 7;
    makeChart("modelChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [{ data: vals, borderColor: BLUE, borderWidth: 1.4, pointRadius: 2.4, pointBackgroundColor: "#fff", pointBorderColor: BLUE, tension: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: function (val, i) { return i % every === 0 ? this.getLabelForValue(val) : ""; } } },
          y: { min: 0, max: 1, ticks: { stepSize: 0.5 }, grid: { color: "#eef2f7" }, border: { display: false } }
        }
      }
    });
  }

  /* ---------- controls ---------- */

  document.getElementById("rangeSelect").addEventListener("change", function () {
    state.days = +this.value;
    renderAll();
  });

  document.getElementById("regionSelect").addEventListener("change", function () {
    state.region = this.value;
    renderAll();
  });

  // header "Download" button / in-page "Export CSV" chip → CSV of current selection
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("#ctaDownload, #csvBtn");
    if (!btn) return;
    ev.preventDefault();
    var rows = [["time_utc", "magnitude", "latitude", "longitude", "depth_km", "location", "region"]];
    windowEvents().forEach(function (e) {
      rows.push([new Date(e.t).toISOString(), e.m, e.lat, e.lng, e.depth, '"' + e.loc + '"', '"' + e.group + '"']);
    });
    var blob = new Blob([rows.map(function (r) { return r.join(","); }).join("\n")], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wel_catalog_" + PERIOD_LBL[state.days] + "_" + state.region.toLowerCase().replace(/\s+/g, "_") + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    WEL.toast("Catalog exported — " + (rows.length - 1).toLocaleString() + " events (CSV)");
  });

  function renderAll() {
    renderTime();
    renderMag();
    renderDepth();
    renderEnergy();
    renderHot();
    renderModel();
  }

  renderAll();

  // deep-link: #r365 opens the page on that time range
  var rm = (location.hash || "").match(/^#r(\d+)$/);
  if (rm && PERIOD_LBL[+rm[1]]) {
    var sel = document.getElementById("rangeSelect");
    sel.value = rm[1];
    sel.dispatchEvent(new Event("change"));
  }
  });
})();
