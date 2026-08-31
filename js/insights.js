/* World Earthquake Labs — seismic insights page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = "#7b8698";

  var BLUE = "#2563eb";
  var state = { days: 30, region: "Global" };
  var charts = {};

  function makeChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  function windowEvents() {
    return EQ.byRegion(EQ.inWindow(state.days * EQ.D), state.region);
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
    var dc = EQ.dailyCounts(state.days, evs);
    var avg = EQ.movingAvg(dc.counts, 7);
    var every = state.days > 30 ? 14 : 7;

    makeChart("timeChart", {
      type: "line",
      data: {
        labels: dc.labels,
        datasets: [
          { label: "Daily Count", data: dc.counts, borderColor: BLUE, borderWidth: 1.6, pointRadius: 0, tension: 0 },
          { label: "7–Day Average", data: avg, borderColor: "#7fa6f2", borderWidth: 1.6, borderDash: [5, 4], pointRadius: 0, tension: .35 }
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
          x: { type: "linear", min: 3.8, max: 9.5, title: { display: true, text: "Magnitude" }, grid: { color: "#f2f5f9" } },
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
    var es = EQ.energySeries(state.days, windowEvents());
    var every = state.days > 30 ? 14 : 7;
    makeChart("energyChart", {
      type: "line",
      data: {
        labels: es.labels,
        datasets: [{ data: es.values, borderColor: BLUE, borderWidth: 1.5, pointRadius: 2.6, pointBackgroundColor: BLUE, tension: 0 }]
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
    var evs = EQ.inWindow(state.days * EQ.D);
    var rows = EQ.hotspots(evs, 5);
    document.getElementById("hotRangeLbl").textContent = "(" + state.days + " Days)";
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
    a.download = "wel_catalog_" + state.days + "d_" + state.region.toLowerCase().replace(/\s+/g, "_") + ".csv";
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
  });
})();
