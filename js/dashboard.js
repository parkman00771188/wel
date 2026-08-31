/* World Earthquake Labs — dashboard page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = "#7b8698";

  var PERIOD_LBL = { 1: "24h", 7: "7d", 30: "30d", 90: "90d", 365: "1y", 1095: "3y", 1826: "5y", 3652: "10y" };

  var state = { region: "All Regions", tz: "utc", days: 1 };

  function regionEvents() {
    return EQ.byRegion(EQ.events, state.region);
  }

  /* one stats object per render pass — short windows use the tagged recent
     events (region-aware), long windows aggregate the full typed arrays */
  function winStats() {
    var now = Date.now();
    if (state.days <= 120) {
      var evs = regionEvents();
      var from = now - state.days * EQ.D;
      var prevFrom = now - 2 * state.days * EQ.D;
      var cur = [], prev = [];
      evs.forEach(function (e) {
        if (e.t >= from) cur.push(e);
        else if (e.t >= prevFrom) prev.push(e);
      });
      var sum = 0, prevSum = 0;
      cur.forEach(function (e) { sum += e.m; });
      prev.forEach(function (e) { prevSum += e.m; });
      var top5 = cur.slice().sort(function (a, b) { return b.m - a.m; }).slice(0, 5);
      return {
        count: cur.length, prevCount: prev.length,
        sumMag: sum, prevSum: prevSum,
        buckets: EQ.magBuckets(cur), top5: top5,
        events: cur, long: false
      };
    }
    var rs = EQ.rangeStats(state.days); // full catalog scan (region not applied)
    rs.long = true;
    return rs;
  }

  /* ---------------- stat cards ---------------- */

  function pct(cur, prev) {
    if (!prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }

  function trendHtml(delta, suffix) {
    if (delta === null || !isFinite(delta)) return "";
    var cls = delta >= 0 ? "up" : "down";
    var arrow = delta >= 0
      ? '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    return '<span class="' + cls + '">' + arrow + Math.abs(delta) + "%</span> " + suffix;
  }

  function renderStats(s) {
    var lbl = PERIOD_LBL[state.days];
    var suffix = state.days === 1 ? "vs yesterday" : "vs previous period";
    var largest = s.top5[0] || null;

    var locParts = largest ? largest.loc.split(", ") : ["—"];
    var locLine = locParts.length > 1
      ? locParts.slice(0, -1).join(", ") + ",<br>" + locParts[locParts.length - 1]
      : locParts[0];

    document.getElementById("statGrid").innerHTML =
      '<div class="stat-card"><div class="stat-label">Earthquakes (' + lbl + ")</div>" +
      '<div class="stat-value">' + s.count.toLocaleString() + "</div>" +
      '<div class="stat-sub">' + trendHtml(pct(s.count, s.prevCount), suffix) + "</div></div>" +

      '<div class="stat-card"><div class="stat-label">Total Magnitude</div>' +
      '<div class="stat-value">' + Math.round(s.sumMag).toLocaleString() + "</div>" +
      '<div class="stat-sub">' + trendHtml(pct(s.sumMag, s.prevSum), suffix) + "</div></div>" +

      '<div class="stat-card"><div class="stat-label">Largest Event</div>' +
      '<div class="stat-value red">' + (largest ? "M " + largest.m.toFixed(1) : "—") + "</div>" +
      '<div class="stat-sub">' + (largest ? locLine : "") + "</div></div>" +

      '<div class="stat-card"><div class="stat-label">Stations Online</div>' +
      '<div class="stat-value">2,846</div>' +
      '<div class="stat-sub">96% uptime</div></div>' +

      '<div class="stat-card"><div class="stat-label">Active Alerts</div>' +
      '<div class="stat-value red">3</div>' +
      '<div class="stat-sub">1 Watch &nbsp;&bull;&nbsp; 2 Advisory</div></div>';
  }

  /* ---------------- histogram ---------------- */

  var histChart = null;

  function histData(s) {
    var labels = [], counts = [];
    if (state.days === 1) {
      var bins = 24, now = Date.now(), start = now - 24 * EQ.H;
      for (var i = 0; i < bins; i++) {
        labels.push(i % 4 === 0 ? (i < 10 ? "0" + i : i) + ":00" : "");
        counts.push(0);
      }
      (s.events || []).forEach(function (e) {
        if (e.t < start) return;
        var i2 = Math.min(bins - 1, Math.floor((e.t - start) / EQ.H));
        counts[i2]++;
      });
    } else if (!s.long) {
      var dc = EQ.dailyCounts(state.days, s.events);
      var every = state.days > 30 ? 10 : (state.days > 7 ? 5 : 1);
      labels = dc.labels.map(function (l, i4) { return i4 % every === 0 ? l : ""; });
      counts = dc.counts;
    } else {
      var everyM = s.labels.length > 40 ? 12 : (s.labels.length > 14 ? 3 : 1);
      labels = s.labels.map(function (l, i5) { return i5 % everyM === 0 ? l : ""; });
      counts = s.series;
    }
    return { labels: labels, counts: counts };
  }

  function renderHist(s) {
    var d = histData(s);
    document.getElementById("histRangeLbl").textContent = PERIOD_LBL[state.days];
    if (histChart) histChart.destroy();
    histChart = new Chart(document.getElementById("histChart"), {
      type: "bar",
      data: {
        labels: d.labels,
        datasets: [{
          data: d.counts,
          backgroundColor: "#2f6bff",
          borderRadius: 2,
          categoryPercentage: 0.82,
          barPercentage: 0.9
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: "#eef2f7" }, border: { display: false } }
        }
      }
    });
  }

  /* ---------------- donut ---------------- */

  var donutChart = null;
  var DONUT_COLORS = ["#0b3a8c", "#1d5fd6", "#3b82f6", "#8ab4f8", "#c8dcfb"];

  var centerText = {
    id: "centerText",
    afterDraw: function (chart) {
      var total = chart.config.data.datasets[0].data.reduce(function (a, b) { return a + b; }, 0);
      var ctx = chart.ctx;
      var x = (chart.chartArea.left + chart.chartArea.right) / 2;
      var y = (chart.chartArea.top + chart.chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#16294e";
      ctx.font = "700 " + (total >= 100000 ? 22 : 28) + "px 'Source Serif 4', Georgia, serif";
      ctx.fillText(total.toLocaleString(), x, y - 2);
      ctx.fillStyle = "#7b8698";
      ctx.font = "500 12px Inter, sans-serif";
      ctx.fillText("Total", x, y + 18);
      ctx.restore();
    }
  };

  function renderDonut(s) {
    var b = s.buckets;
    var labels = Object.keys(b);
    var data = labels.map(function (k) { return b[k]; });
    var total = Math.max(1, data.reduce(function (a, x) { return a + x; }, 0));

    document.getElementById("donutRangeLbl").textContent = "(" + PERIOD_LBL[state.days] + ")";

    if (donutChart) donutChart.destroy();
    donutChart = new Chart(document.getElementById("donutChart"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: DONUT_COLORS, borderWidth: 2, borderColor: "#fff" }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: { legend: { display: false } }
      },
      plugins: [centerText]
    });

    document.getElementById("donutLegend").innerHTML = labels.map(function (k, i) {
      var v = b[k];
      return '<div class="row"><span class="legend-dot" style="width:10px;height:10px;background:' + DONUT_COLORS[i] + '"></span>' +
        "<span>" + k + '</span><span class="grow"></span><span class="val">' + v.toLocaleString() + " (" + Math.round((v / total) * 100) + "%)</span></div>";
    }).join("");
  }

  /* ---------------- significant list ---------------- */

  function renderSig(s) {
    document.getElementById("sigList").innerHTML = s.top5.map(function (e) {
      return '<div class="sig-row">' +
        '<div class="sig-mag' + (e.m >= 6 ? " big" : "") + '">M&nbsp;&nbsp;' + e.m.toFixed(1) + "</div>" +
        '<div class="sig-loc"><div class="l1">' + e.loc + '</div><div class="l2">' +
        EQ.fmtList(e.t, state.tz === "local") + (state.tz === "local" ? "" : " UTC") + "</div></div>" +
        '<div class="sig-depth">' + e.depth + " km</div></div>";
    }).join("") || '<p style="color:var(--faint);font-size:13.5px">No events in this window.</p>';
  }

  /* ---------------- mini map (always: live last 24h) ---------------- */

  var mini = L.map("miniMap", {
    zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, preferCanvas: true,
    zoomSnap: 0.1
  }).setView([21, 10], 1.15);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 10
  }).addTo(mini);

  var miniLayer = L.layerGroup().addTo(mini);

  function renderMini() {
    miniLayer.clearLayers();
    var evs = regionEvents().filter(function (e) { return e.t >= Date.now() - 24 * EQ.H && e.m >= 2.5; });
    evs.sort(function (a, b) { return a.m - b.m; });
    evs.forEach(function (e) {
      if (e.m >= 5.5) {
        miniLayer.addLayer(L.circleMarker([e.lat, e.lng], {
          radius: EQ.magRadius(e.m) + 6, stroke: false, fillColor: EQ.miniColor(e.m), fillOpacity: 0.22, interactive: false
        }));
      }
      miniLayer.addLayer(L.circleMarker([e.lat, e.lng], {
        radius: Math.max(2.5, EQ.magRadius(e.m) * 0.9),
        color: "#ffffff", weight: 0.8,
        fillColor: EQ.miniColor(e.m), fillOpacity: 0.92, interactive: false
      }));
    });
  }

  var KEY = [["M 4–4.9", "#f2b544"], ["M 5–5.9", "#ef8b3a"], ["M 6+", "#e8432d"]];
  document.getElementById("mapKey").innerHTML = KEY.map(function (k) {
    return "<span><span class='legend-dot' style='width:9px;height:9px;margin:0;background:" + k[1] + "'></span>" + k[0] + "</span>";
  }).join("");

  /* ---------------- controls ---------------- */

  document.getElementById("periodSelect").addEventListener("change", function () {
    state.days = +this.value;
    var regionSel = document.getElementById("regionSelect");
    var isLong = state.days > 120;
    regionSel.disabled = isLong; // long windows aggregate the whole catalog
    if (isLong) { regionSel.value = "All Regions"; state.region = "All Regions"; }
    renderAll();
  });

  document.getElementById("regionSelect").addEventListener("change", function () {
    state.region = this.value;
    renderAll();
  });

  document.getElementById("tzSelect").addEventListener("change", function () {
    state.tz = this.value;
    renderAll();
  });

  function renderAll() {
    var s = winStats();
    renderStats(s);
    renderHist(s);
    renderDonut(s);
    renderSig(s);
    renderMini();
  }

  if (EQ.meta) {
    var g = new Date(EQ.meta.generated);
    document.getElementById("dataMeta").textContent =
      "Catalog: USGS ANSS ComCat + ISC Bulletin · " + EQ.meta.count.toLocaleString() +
      " events since 1900 · updated " + EQ.fmtUTC(g.getTime());
  }

  renderAll();
  setTimeout(function () { mini.invalidateSize(); }, 250);

  // deep-link: #p365 opens the dashboard on that period
  var pm = (location.hash || "").match(/^#p(\d+)$/);
  if (pm && PERIOD_LBL[+pm[1]]) {
    var sel = document.getElementById("periodSelect");
    sel.value = pm[1];
    sel.dispatchEvent(new Event("change"));
  }

  });
})();
