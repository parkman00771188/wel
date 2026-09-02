/* World Earthquake Labs — dashboard page */
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

  var PERIOD_LBL = { 1: "24h", 7: "7d", 30: "30d", 90: "90d", 365: "1y", 1095: "3y", 1826: "5y", 3652: "10y" };
  var ALL_DAYS = Math.ceil((Date.now() - Date.parse("1900-01-01T00:00:00Z")) / 86400e3);
  var SIGNIFICANT_MIN_MAG = 4;
  function periodLbl() { return PERIOD_LBL[state.days] || "All"; }

  var state = { region: "All Regions", days: 7 };

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
      var recent5 = cur.filter(function (e) { return e.m >= SIGNIFICANT_MIN_MAG; })
        .sort(function (a, b) { return b.t - a.t; }).slice(0, 5);
      return {
        count: cur.length, prevCount: prev.length,
        sumMag: sum, prevSum: prevSum,
        buckets: EQ.magBuckets(cur), top5: top5,
        recent5: recent5, events: cur, long: false
      };
    }
    var rs = EQ.rangeStats(state.days); // full catalog scan (region not applied)
    rs.recent5 = EQ.events.filter(function (e) {
      return e.t >= now - state.days * EQ.D && e.m >= SIGNIFICANT_MIN_MAG;
    }).sort(function (a, b) { return b.t - a.t; }).slice(0, 5);
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
    var lbl = periodLbl();
    var suffix = state.days === 1 ? "vs yesterday" : "vs previous period";
    var largest = s.top5[0] || null;

    var strong = (s.events || []).filter(function (e) { return e.m >= 5; }).length;
    var archive = EQ.meta && EQ.meta.count
      ? (EQ.meta.count / 1e6).toFixed(2) + "M"
      : "—";

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

      // These two used to read "Stations Online 2,846 / 96% uptime" and
      // "Active Alerts 3". This site runs no stations and issues no alerts; both
      // numbers were fixed strings. What can honestly go here is the size of the
      // archive and a count of the events large enough to be felt.
      '<div class="stat-card"><div class="stat-label">Damaging range (M 5+)</div>' +
      '<div class="stat-value">' + strong.toLocaleString() + "</div>" +
      '<div class="stat-sub">' + lbl + "</div></div>" +

      '<div class="stat-card"><div class="stat-label">Archive</div>' +
      '<div class="stat-value">' + archive + "</div>" +
      '<div class="stat-sub">events since 1900</div></div>';
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
      labels = s.labels; // already year-ticked and thinned
      counts = s.series;
    }
    return { labels: labels, counts: counts };
  }

  function renderHist(s) {
    var d = histData(s);
    document.getElementById("histRangeLbl").textContent = periodLbl();
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
  var DONUT_COLORS = ["#082c6e", "#0b3a8c", "#1d5fd6", "#3b82f6", "#8ab4f8", "#d4e4fb"];

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

    document.getElementById("donutRangeLbl").textContent = "(" + periodLbl() + ")";

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
    document.getElementById("sigList").innerHTML = s.recent5.map(function (e) {
      return '<div class="sig-row">' +
        '<div class="sig-mag' + (e.m >= 6 ? " big" : "") + '">M&nbsp;&nbsp;' + e.m.toFixed(1) + "</div>" +
        '<div class="sig-loc"><div class="l1">' + e.loc + '</div><div class="l2">' +
        EQ.fmtTimeShort(e.t) + " " + EQ.tzLabel() + "</div></div>" +
        '<div class="sig-depth">' + e.depth + " km</div></div>";
    }).join("") || '<p style="color:var(--faint);font-size:13.5px">No events in this window.</p>';
  }

  /* ---------------- mini map (follows the selected dashboard period) ---------------- */

  var mini = L.map("miniMap", {
    zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, preferCanvas: true,
    zoomSnap: 0.1
  }).setView([21, 10], 1.15);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 10
  }).addTo(mini);

  var miniLayer = L.layerGroup().addTo(mini);

  function miniCellSize() {
    if (state.days <= 1) return 1.25;
    if (state.days <= 7) return 2;
    if (state.days <= 30) return 3;
    if (state.days <= 90) return 4;
    if (state.days <= 365) return 5;
    if (state.days <= 1095) return 6;
    if (state.days <= 3652) return 8;
    return 10;
  }

  function renderMini() {
    miniLayer.clearLayers();
    document.getElementById("mapRangeLbl").textContent = "(" + periodLbl() + ")";

    var now = Date.now();
    var from = now - state.days * EQ.D;
    var cellSize = miniCellSize();
    var cells = Object.create(null);

    // Keep one representative (the strongest, then newest) per geographic
    // cell so long periods remain responsive while still covering the full window.
    function addPoint(mag, lat, lng, depth, t) {
      if (mag < 2.5) return;
      var key = Math.floor((lat + 90) / cellSize) + ":" + Math.floor((lng + 180) / cellSize);
      var cur = cells[key];
      if (!cur || mag > cur.m || (mag === cur.m && t > cur.t)) {
        cells[key] = { m: mag, lat: lat, lng: lng, depth: depth, t: t };
      }
    }

    if (state.days <= 120) {
      regionEvents().forEach(function (e) {
        if (e.t >= from && e.t <= now) addPoint(e.m, e.lat, e.lng, e.depth, e.t);
      });
    } else {
      EQ.forEachInRange(from, now, addPoint);
    }

    var evs = Object.keys(cells).map(function (key) { return cells[key]; });
    evs.sort(function (a, b) { return a.m - b.m; });
    evs.forEach(function (e) {
      var markerRadius = Math.max(1.5, EQ.magRadius(e.m) * 0.55);
      if (e.m >= 5.5) {
        miniLayer.addLayer(L.circleMarker([e.lat, e.lng], {
          radius: markerRadius + 3, stroke: false, fillColor: EQ.miniColor(e.m), fillOpacity: 0.16, interactive: false
        }));
      }
      miniLayer.addLayer(L.circleMarker([e.lat, e.lng], {
        radius: markerRadius,
        color: "#ffffff", weight: 0.6,
        fillColor: EQ.miniColor(e.m), fillOpacity: 0.92, interactive: false
      }));
    });
  }

  var KEY = [["M 2–2.9", "#a7c8f0"], ["M 3–3.9", "#2f6bff"], ["M 4–4.9", "#f2b544"], ["M 5–5.9", "#ef8b3a"], ["M 6+", "#e8432d"]];
  document.getElementById("mapKey").innerHTML = KEY.map(function (k) {
    return "<span><span class='legend-dot' style='width:9px;height:9px;margin:0;background:" + k[1] + "'></span>" + k[0] + "</span>";
  }).join("");

  /* ---------------- controls ---------------- */

  on("periodSelect", "change", function () {
    state.days = this.value === "all" ? ALL_DAYS : +this.value;
    var regionSel = document.getElementById("regionSelect");
    var isLong = state.days > 120;
    regionSel.disabled = isLong; // long windows aggregate the whole catalog
    if (isLong) { regionSel.value = "All Regions"; state.region = "All Regions"; }
    renderAll();
  });

  on("regionSelect", "change", function () {
    state.region = this.value;
    renderAll();
  });

  // The zone lives in the header now, and every page listens for the change.
  window.addEventListener("wel:tz", function () { renderAll(); });

  /* "updated" is the live overlay's timestamp when one is spliced in — the
     archive's own build date can be weeks old while the last 14 days are half
     an hour fresh. */
  function renderMeta() {
    if (!EQ.meta) return;
    var stamp = Date.parse(EQ.meta.updated || EQ.meta.generated);
    document.getElementById("dataMeta").textContent =
      "Catalog: USGS ANSS ComCat + ISC Bulletin · " + EQ.meta.count.toLocaleString() +
      " events since 1900 · updated " + (isFinite(stamp) ? EQ.fmtTime(stamp) : "—");
  }

  function renderAll() {
    var s = winStats();
    renderStats(s);
    renderHist(s);
    renderDonut(s);
    renderSig(s);
    renderMini();
    renderMeta();
  }

  // The overlay is refreshed every 10 minutes; redraw when it lands.
  EQ.onLive(function () { renderAll(); });

  renderAll();
  setTimeout(function () { mini.invalidateSize(); }, 250);

  // deep-link: #p365 opens the dashboard on that period
  var pm = (location.hash || "").match(/^#p(\d+|all)$/);
  if (pm && (pm[1] === "all" || PERIOD_LBL[+pm[1]])) {
    var sel = document.getElementById("periodSelect");
    sel.value = pm[1];
    sel.dispatchEvent(new Event("change"));
  }

  });
})();
