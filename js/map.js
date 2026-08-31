/* World Earthquake Labs — live map page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  var state = {
    range: "live",          // live | 24h | 7d | 30d
    minMag: 2,
    depths: { shallow: true, mid: true, deep: true },
    playing: false,
    cursor: null,
    selectedId: null,
    expandedTable: false
  };

  var RANGE_MS = { live: 24 * EQ.H, "24h": 24 * EQ.H, "7d": 7 * EQ.D, "30d": 30 * EQ.D };

  /* ---------------- map ---------------- */

  var map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    worldCopyJump: true,
    minZoom: 1.6,
    maxZoom: 9,
    zoomSnap: 0.25,
    maxBounds: [[-85, -220], [85, 220]],
    maxBoundsViscosity: 0.7
  });

  // fit the world to the container width (console view is wider than the standalone page)
  var mapW = document.getElementById("map").clientWidth || 1200;
  var baseZoom = Math.max(1.7, Math.min(3.2, Math.log2(mapW / 256)));
  map.setView([23, 8], baseZoom);

  /* ---------------- region + 2D/3D controls ---------------- */

  var REGION_VIEWS = {
    global: { center: [23, 8], zoom: null, bbox: null },
    japan: { center: [36.8, 137.2], zoom: 5.25, bbox: [24, 122, 46.5, 150] } // [latMin, lngMin, latMax, lngMax]
  };
  state.mapRegion = "global";

  document.getElementById("mapRegion").addEventListener("change", function () {
    state.mapRegion = this.value;
    var v = REGION_VIEWS[state.mapRegion];
    map.flyTo(v.center, v.zoom || baseZoom, { duration: 1.6 });
    renderTable();
    sync3dView();
  });

  function inRegion(e) {
    var v = REGION_VIEWS[state.mapRegion];
    if (!v || !v.bbox) return true;
    return e.lat >= v.bbox[0] && e.lat <= v.bbox[2] && e.lng >= v.bbox[1] && e.lng <= v.bbox[3];
  }

  /* 2D/3D toggle — 3D loads the Earthquake 4D engine (Three.js, full 1900–present catalog) */

  var frame3d = null;

  function ensure3d() {
    if (frame3d) return;
    try { // boot the 4D app in the console's language
      var lang = (window.WEL_I18N && WEL_I18N.lang) || "en";
      localStorage.setItem("jq4d.lang", lang);
    } catch (e) { /* ignore */ }
    frame3d = document.createElement("iframe");
    frame3d.className = "map-3d-frame";
    frame3d.src = "3d/index.html";
    frame3d.title = "Earthquake 4D";
    document.getElementById("mapShell").appendChild(frame3d);
    frame3d.addEventListener("load", function () {
      style3dFrame();
      sync3dView();
    });
  }

  // drive the 4D app's Japan/World toggle from our Region combo (same origin);
  // keeps enforcing for a while because the app may restore a saved view mid-boot
  function sync3dView() {
    if (!frame3d) return;
    var want = state.mapRegion === "japan" ? "japan" : "globe";
    var tries = 0;
    (function poll() {
      var doc;
      try { doc = frame3d.contentDocument; } catch (e) { return; }
      var btn = doc && doc.querySelector('#seg-view [data-v="' + want + '"]');
      if (btn && btn.classList.contains("on")) return;      // in the wanted view
      if (btn) btn.click();
      if (++tries < 30) setTimeout(poll, 600);
    })();
  }

  // our Region combo + Filters panel are the single source of truth:
  // hide the app's own view toggle and its in-map control panel
  function style3dFrame() {
    try {
      var doc = frame3d.contentDocument;
      if (!doc || !doc.head || doc.getElementById("welHide")) return;
      var st = doc.createElement("style");
      st.id = "welHide";
      st.textContent = "#seg-view{display:none!important}" +
        "#panel{display:none!important}" +
        "#panel-toggle{display:none!important}" +
        "#mfabs{display:none!important}" +
        "#feed{display:none!important}" +      // our side table lists events instead
        "#mcards{display:none!important}";
      doc.head.appendChild(st);
    } catch (e) { /* ignore */ }
  }

  /* focus an event on the 4D globe: find the same event in the active
     catalog (identical USGS/ISC source) and reuse the app's focusEvent() */
  function focus3d(e) {
    try {
      var w = frame3d && frame3d.contentWindow;
      var app = w && w.__app;
      if (!app || !app.data) return false;
      var onGlobe = app.view === "globe" && app.globe && app.globe.layer;
      var ev = onGlobe ? app.globe.layer.events : app.data.events;
      if (!ev || !ev.t || !ev.t.length) return false;

      var tSec = Math.round((e.t - app.data.epochMs) / 1000);
      var tArr = ev.t, lo = 0, hi = tArr.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (tArr[mid] < tSec) lo = mid + 1; else hi = mid; }

      var best = -1, bestScore = Infinity;
      var from = Math.max(0, lo - 600), to = Math.min(tArr.length - 1, lo + 600);
      for (var i = from; i <= to; i++) {
        var score = Math.abs(tArr[i] - tSec) / 60 +
          (Math.abs(ev.lat[i] - e.lat) + Math.abs(ev.lon[i] - e.lng)) * 10;
        if (score < bestScore) { bestScore = score; best = i; }
      }
      if (best < 0 || bestScore > 90) return false;
      app.focusEvent(best);
      return true;
    } catch (err) {
      return false;
    }
  }

  document.getElementById("dimToggle").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("active", x === b); });
    var is3d = b.dataset.dim === "3d";
    if (is3d) { ensure3d(); sync3dView(); map.closePopup(); }
    document.getElementById("mapShell").classList.toggle("mode-3d", is3d);
    syncFilterSections();
    syncLayerSections();
  });

  /* ---------------- 3D filter proxy (the 4D panel, re-homed into our Filters) ---------------- */

  function x3(fn) {
    try { if (frame3d) fn(frame3d.contentDocument, frame3d.contentWindow); } catch (e) { /* ignore */ }
  }

  function syncFilterSections() {
    var is3d = document.getElementById("mapShell").classList.contains("mode-3d");
    document.getElementById("filters2d").hidden = is3d;
    document.getElementById("filters3d").hidden = !is3d;
    if (is3d) refresh3dFilters();
  }

  /* both proxy panels (Filters + in-map Layers) share the same wiring */
  var SCOPES = Array.prototype.slice.call(document.querySelectorAll(".x3dscope"));

  function eachScoped(sel, fn) {
    SCOPES.forEach(function (scope) {
      scope.querySelectorAll(sel).forEach(fn);
    });
  }

  function paintDual(wrap) {
    var ins = wrap.querySelectorAll("input[type=range]");
    if (ins.length < 2) return;
    var min = +ins[0].min, max = +ins[0].max;
    var lo = Math.min(+ins[0].value, +ins[1].value);
    var hi = Math.max(+ins[0].value, +ins[1].value);
    var fill = wrap.querySelector(".dual-fill");
    var a = ((lo - min) / (max - min)) * 100;
    var b = ((hi - min) / (max - min)) * 100;
    fill.style.left = a + "%";
    fill.style.width = Math.max(0, b - a) + "%";
  }

  function paintDuals() {
    eachScoped(".dualwrap", paintDual);
  }

  SCOPES.forEach(function (scope) {
    scope.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-x3d]");
      if (!b) return;
      x3(function (doc) {
        var t = doc.querySelector(b.dataset.x3d);
        if (t) t.click();
      });
      setTimeout(refresh3dFilters, 150);
    });

    scope.addEventListener("input", function (ev) {
      var r = ev.target.closest("[data-x3d-range]");
      if (!r) return;
      x3(function (doc, w) {
        var t = doc.querySelector(r.dataset.x3dRange);
        if (t) { t.value = r.value; t.dispatchEvent(new w.Event("input", { bubbles: true })); }
      });
      var wrap = r.closest(".dualwrap");
      if (wrap) paintDual(wrap);
    });

    scope.addEventListener("change", function (ev) {
      var d = ev.target.closest("[data-x3d-date]");
      if (d) {
        x3(function (doc, w) {
          var t = doc.querySelector(d.dataset.x3dDate);
          if (t) {
            t.value = d.value;
            t.dispatchEvent(new w.Event("input", { bubbles: true }));
            t.dispatchEvent(new w.Event("change", { bubbles: true }));
          }
        });
        setTimeout(refresh3dFilters, 150);
        return;
      }
      var c = ev.target.closest("[data-x3d-check]");
      if (c) {
        x3(function (doc, w) {
          var t = doc.querySelector(c.dataset.x3dCheck);
          if (t) { t.checked = c.checked; t.dispatchEvent(new w.Event("change", { bubbles: true })); }
        });
        return;
      }
      if (ev.target.closest("[data-x3d-range]")) setTimeout(refresh3dFilters, 120);
    });
  });

  function refresh3dFilters() {
    x3(function (doc) {
      eachScoped("[data-x3d]", function (b) {
        var t = doc.querySelector(b.dataset.x3d);
        b.classList.toggle("on", !!(t && t.classList.contains("on")));
      });
      eachScoped("[data-x3d-check]", function (c) {
        var t = doc.querySelector(c.dataset.x3dCheck);
        if (t) c.checked = t.checked;
      });
      eachScoped("[data-x3d-range]", function (r) {
        var t = doc.querySelector(r.dataset.x3dRange);
        if (t) r.value = t.value;
      });
      // mirror the app's formatted outputs ("1.6×", "50%", "0 – 700", …)
      eachScoped("[data-x3d-out]", function (o) {
        var t = doc.querySelector(o.dataset.x3dOut);
        if (t) o.textContent = t.textContent;
      });
      eachScoped("[data-x3d-date]", function (d) {
        var t = doc.querySelector(d.dataset.x3dDate);
        if (t && document.activeElement !== d) d.value = t.value;
      });
      // Japan-only controls follow the app's view; window-length follows its mode
      var globeMode = doc.body.classList.contains("globe-mode");
      eachScoped(".jp3d", function (el) { el.hidden = globeMode; });
      var rw = doc.getElementById("row-window");
      var ourRw = document.getElementById("p3dWindowRow");
      if (rw && ourRw) ourRw.hidden = (rw.offsetParent === null);
      paintDuals();
    });
  }

  document.getElementById("filtersBtn").addEventListener("click", syncFilterSections);

  /* ---------------- in-map layers button (2D basemaps / 3D map layers) ---------------- */

  var layersPanel = document.getElementById("layersPanel");

  function syncLayerSections() {
    var is3d = document.getElementById("mapShell").classList.contains("mode-3d");
    document.getElementById("layers2d").hidden = is3d;
    document.getElementById("layers3d").hidden = !is3d;
    if (is3d) refresh3dFilters();
  }

  document.getElementById("layersBtn").addEventListener("click", function (ev) {
    ev.stopPropagation();
    layersPanel.hidden = !layersPanel.hidden;
    if (!layersPanel.hidden) syncLayerSections();
  });
  layersPanel.addEventListener("click", function (ev) { ev.stopPropagation(); });
  document.addEventListener("click", function () { layersPanel.hidden = true; });

  document.getElementById("layers2d").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-base]");
    if (!b) return;
    this.querySelectorAll("[data-base]").forEach(function (x) { x.classList.toggle("on", x === b); });
    setBasemap(b.dataset.base);
  });

  document.getElementById("ck2dPlates").addEventListener("change", function () {
    if (this.checked) platesLayer2d.addTo(map);
    else map.removeLayer(platesLayer2d);
  });

  document.getElementById("ck2dTint").addEventListener("change", function () {
    if (this.checked) { if (!map.hasLayer(tintRect)) tintRect.addTo(map); }
    else if (map.hasLayer(tintRect)) map.removeLayer(tintRect);
  });

  paintDuals();

  map.attributionControl.setPrefix(false);

  /* selectable basemaps (2D) */
  var BASES = {
    sat: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri, Maxar, Earthstar Geographics" },
    gray: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", attr: "Esri" },
    topo: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", attr: "Esri" },
    ocean: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", attr: "Esri, GEBCO, NOAA" },
    osm: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "&copy; OpenStreetMap contributors" }
  };

  var baseLayer = L.tileLayer(BASES.topo.url, { attribution: BASES.topo.attr, noWrap: false }).addTo(map);

  function setBasemap(key) {
    var b = BASES[key];
    if (!b) return;
    map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(b.url, { attribution: b.attr, noWrap: false }).addTo(map);
    // the navy night look only suits satellite imagery
    document.getElementById("mapShell").classList.toggle("base-sat", key === "sat");
    var tintChk = document.getElementById("ck2dTint");
    var wantTint = key === "sat" && tintChk.checked;
    if (wantTint) { if (!map.hasLayer(tintRect)) tintRect.addTo(map); }
    else if (map.hasLayer(tintRect)) map.removeLayer(tintRect);
    tintChk.disabled = key !== "sat";
  }

  // navy tint above tiles, below vectors
  map.createPane("tint");
  map.getPane("tint").style.zIndex = 250;
  map.getPane("tint").style.pointerEvents = "none";
  var tintRect = L.rectangle([[-90, -720], [90, 720]], {
    pane: "tint", stroke: false, fillColor: "#0b2254", fillOpacity: 0.42, interactive: false
  });
  document.getElementById("ck2dTint").disabled = true; // enabled with the Satellite basemap

  // plate boundaries (toggleable overlay)
  var platesLayer2d = L.layerGroup();
  EQ.segments.forEach(function (seg) {
    platesLayer2d.addLayer(L.polyline(seg.pts, { color: "#ff6b35", weight: 1.3, opacity: 0.75, dashArray: "3 4", interactive: false }));
  });
  platesLayer2d.addTo(map);

  var quakeLayer = L.layerGroup().addTo(map);
  var pulseMarker = null;

  /* ---------------- filtering ---------------- */

  function depthOk(d) {
    if (d < 70) return state.depths.shallow;
    if (d < 300) return state.depths.mid;
    return state.depths.deep;
  }

  function windowStart() { return Date.now() - RANGE_MS[state.range]; }

  function filtered() {
    var from = windowStart();
    return EQ.events.filter(function (e) {
      return e.t >= from && e.m >= state.minMag && depthOk(e.depth);
    });
  }

  /* ---------------- rendering ---------------- */

  function renderQuakes() {
    quakeLayer.clearLayers();
    var list = filtered();
    if (state.playing && state.cursor) {
      list = list.filter(function (e) { return e.t <= state.cursor; });
    }
    // oldest first so recent/big draw on top
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      var color = EQ.magColor(e.m);
      var r = EQ.magRadius(e.m);
      if (e.m >= 5) {
        quakeLayer.addLayer(L.circleMarker([e.lat, e.lng], {
          radius: r + (e.m >= 6 ? 9 : 6), stroke: false, fillColor: color, fillOpacity: 0.16, interactive: false
        }));
      }
      var dot = L.circleMarker([e.lat, e.lng], {
        radius: r,
        color: "rgba(255,255,255,.45)",
        weight: e.m >= 4 ? 1 : 0.5,
        fillColor: color,
        fillOpacity: 0.9
      });
      dot.eq = e;
      dot.on("click", function (ev) { select(ev.target.eq, true); });
      quakeLayer.addLayer(dot);
    }
    var fc = document.getElementById("filterCount");
    if (fc) fc.textContent = list.length + " events";
  }

  function setPulse(e) {
    if (pulseMarker) { map.removeLayer(pulseMarker); pulseMarker = null; }
    if (!e) return;
    var size = Math.max(26, EQ.magRadius(e.m) * 2 + 22);
    pulseMarker = L.marker([e.lat, e.lng], {
      interactive: false,
      icon: L.divIcon({
        className: "",
        iconSize: [size, size],
        html: '<div class="pulse-wrap" style="--pc:' + EQ.magColor(e.m) + ';width:' + size + "px;height:" + size + 'px"><div class="ring"></div><div class="ring"></div></div>'
      })
    }).addTo(map);
  }

  /* ---------------- selection card ---------------- */

  function coordStr(e) {
    return Math.abs(e.lat).toFixed(3) + "&deg; " + (e.lat >= 0 ? "N" : "S") +
      " &nbsp; " + Math.abs(e.lng).toFixed(3) + "&deg; " + (e.lng >= 0 ? "E" : "W");
  }

  var activePopup = null;

  function select(e, pan) {
    state.selectedId = e.id;
    var html =
      '<button class="qc-close" id="qcClose">' + WEL.icon("x", 16) + "</button>" +
      '<div class="qc-mag">M ' + e.m.toFixed(1) + "</div>" +
      '<div class="qc-title">' + e.loc + "</div>" +
      '<div class="qc-row"><span>' + EQ.fmtUTC(e.t, true) + "</span></div>" +
      '<div class="qc-row"><span>' + coordStr(e) + "</span></div>" +
      '<div class="qc-row"><span class="k">Depth</span><span>' + e.depth + " km</span></div>" +
      '<div class="qc-div"></div>' +
      '<div class="qc-row"><span class="k">Status</span><span>' + (e.status || "Automatic") + "</span></div>" +
      '<button class="btn btn-primary btn-block" id="qcDetails">View Details</button>';

    if (activePopup) map.closePopup(activePopup);
    activePopup = L.popup({
      className: "quake-pop",
      closeButton: false,
      autoPan: true,
      autoPanPadding: [46, 46],
      offset: [0, -4],
      maxWidth: 290
    }).setLatLng([e.lat, e.lng]).setContent(html).openOn(map);

    document.getElementById("qcClose").onclick = function () { map.closePopup(activePopup); };
    document.getElementById("qcDetails").onclick = function () { openDetail(e); };
    setPulse(e);
    if (pan) map.panTo([e.lat, e.lng], { animate: true });
  }

  map.on("popupclose", function (ev) {
    if (ev.popup === activePopup) {
      activePopup = null;
      state.selectedId = null;
      setPulse(null);
    }
  });

  function openDetail(e) {
    var back = document.getElementById("detailBack");
    document.getElementById("detailModal").innerHTML =
      '<button class="qc-close" id="dmClose">' + WEL.icon("x", 16) + "</button>" +
      '<div class="qc-mag" style="font-size:40px">M ' + e.m.toFixed(1) + "</div>" +
      "<h3>" + e.loc + "</h3>" +
      '<div class="qc-div"></div>' +
      '<div class="qc-row"><span class="k">Origin time</span><span>' + EQ.fmtUTC(e.t, true) + "</span></div>" +
      '<div class="qc-row"><span class="k">Epicenter</span><span>' + coordStr(e) + "</span></div>" +
      '<div class="qc-row"><span class="k">Depth</span><span>' + e.depth + " km</span></div>" +
      '<div class="qc-row"><span class="k">Region</span><span>' + e.group + "</span></div>" +
      '<div class="qc-row"><span class="k">Event ID</span><span>wel' + e.id.slice(2) + "</span></div>" +
      '<div class="qc-row"><span class="k">Type</span><span>Earthquake</span></div>' +
      '<div class="qc-row"><span class="k">Review status</span><span>' + (e.status || "Automatic") + "</span></div>" +
      '<div class="qc-div"></div>' +
      '<p style="font-size:13px;color:var(--faint);margin:0">Solution by the World Earthquake Labs global network. Magnitudes are moment magnitude (Mw) unless otherwise noted.</p>';
    back.classList.add("open");
    document.getElementById("dmClose").onclick = function () { back.classList.remove("open"); };
  }

  document.getElementById("detailBack").addEventListener("click", function (ev) {
    if (ev.target === this) this.classList.remove("open");
  });

  /* ---------------- table ---------------- */

  function renderTable() {
    var floor = Math.max(4.3, state.minMag);
    var pool = filtered().filter(inRegion);
    var rows = pool.filter(function (e) { return e.m >= floor; });
    var baseCount = window.WEL && WEL.embed ? 14 : 5;
    if (rows.length < baseCount) rows = pool;
    if (rows.length < baseCount) {
      // quiet region/window: widen beyond the selected range so the list is never empty
      rows = EQ.events.filter(function (e) {
        return e.m >= state.minMag && depthOk(e.depth) && inRegion(e);
      });
    }
    rows = rows.slice(0, state.expandedTable ? (baseCount === 5 ? 25 : 40) : baseCount);
    document.getElementById("eqTableBody").innerHTML = rows.map(function (e) {
      var timeStr = window.WEL && WEL.embed ? EQ.fmtList(e.t) : EQ.fmtShort(e.t);
      return "<tr data-id=\"" + e.id + "\" style=\"cursor:pointer\">" +
        '<td class="mag' + (e.m >= 6 ? " big" : "") + '">M&nbsp;&nbsp;' + e.m.toFixed(1) + "</td>" +
        "<td>" + e.loc + "</td>" +
        "<td>" + timeStr + "</td>" +
        '<td class="right">' + e.depth + " km</td></tr>";
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("#eqTableBody tr"), function (tr) {
      tr.addEventListener("click", function () {
        var e = EQ.events.find(function (x) { return x.id === tr.dataset.id; });
        if (!e) return;
        if (document.getElementById("mapShell").classList.contains("mode-3d")) {
          focus3d(e);   // swing the 4D globe to the event and open its card
        } else {
          select(e, true);
          if (!(window.WEL && WEL.embed)) window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  }

  document.getElementById("viewAllBtn").addEventListener("click", function () {
    state.expandedTable = !state.expandedTable;
    this.textContent = state.expandedTable ? "Show Fewer" : "View All Earthquakes";
    renderTable();
  });

  /* ---------------- time bar ---------------- */

  var playBtn = document.getElementById("playBtn");
  var readout = document.getElementById("timeReadout");
  var nowBtn = document.getElementById("nowBtn");

  var PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor"/></svg>';
  var PAUSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5.5v13M16 5.5v13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  playBtn.innerHTML = PLAY_SVG;

  function tickReadout() {
    if (state.playing && state.cursor) {
      readout.textContent = EQ.fmtUTC(state.cursor, true);
    } else {
      readout.textContent = EQ.fmtUTC(Date.now(), true);
    }
  }
  setInterval(tickReadout, 1000);
  tickReadout();

  var playRAF = null;

  function stopPlay() {
    state.playing = false;
    state.cursor = null;
    if (playRAF) cancelAnimationFrame(playRAF);
    playBtn.innerHTML = PLAY_SVG;
    renderQuakes();
    tickReadout();
  }

  function startPlay() {
    var from = windowStart();
    var span = Date.now() - from;
    var dur = 12000;
    var t0 = performance.now();
    state.playing = true;
    playBtn.innerHTML = PAUSE_SVG;

    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      state.cursor = from + span * k;
      renderQuakes();
      tickReadout();
      if (k < 1 && state.playing) playRAF = requestAnimationFrame(step);
      else stopPlay();
    }
    playRAF = requestAnimationFrame(step);
  }

  playBtn.addEventListener("click", function () {
    if (state.playing) stopPlay(); else startPlay();
  });

  document.getElementById("rangeChips").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    stopPlay();
    state.range = b.dataset.range;
    Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) {
      x.classList.toggle("active", x === b);
    });
    nowBtn.classList.toggle("active", state.range === "live");
    renderQuakes();
    renderTable();
  });

  nowBtn.addEventListener("click", function () {
    stopPlay();
    state.range = "live";
    var chips = document.querySelectorAll("#rangeChips button");
    Array.prototype.forEach.call(chips, function (x) {
      x.classList.toggle("active", x.dataset.range === "live");
    });
    nowBtn.classList.add("active");
    renderQuakes();
    renderTable();
  });

  /* ---------------- zoom ---------------- */

  document.getElementById("zoomIn").addEventListener("click", function () { map.zoomIn(); });
  document.getElementById("zoomOut").addEventListener("click", function () { map.zoomOut(); });

  /* ---------------- dropdowns ---------------- */

  function wireDrop(btnId, panelId) {
    var btn = document.getElementById(btnId), panel = document.getElementById(panelId);
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      document.querySelectorAll(".drop-panel.open").forEach(function (p) {
        if (p !== panel) p.classList.remove("open");
      });
      panel.classList.toggle("open");
    });
    panel.addEventListener("click", function (ev) { ev.stopPropagation(); });
  }
  wireDrop("filtersBtn", "filtersPanel");
  document.addEventListener("click", function () {
    document.querySelectorAll(".drop-panel.open").forEach(function (p) { p.classList.remove("open"); });
  });

  /* ---------------- filters ---------------- */

  function updateFilterBadge() {
    var active = 0;
    if (state.minMag > 2) active++;
    if (!state.depths.shallow || !state.depths.mid || !state.depths.deep) active++;
    var badge = document.getElementById("filterBadge");
    badge.hidden = active === 0;
    badge.textContent = active;
  }

  document.getElementById("minMag").addEventListener("input", function () {
    state.minMag = parseFloat(this.value);
    document.getElementById("minMagVal").textContent = state.minMag.toFixed(1);
    renderQuakes();
    renderTable();
    updateFilterBadge();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".depthChk"), function (chk) {
    chk.addEventListener("change", function () {
      state.depths[chk.value] = chk.checked;
      renderQuakes();
      renderTable();
      updateFilterBadge();
    });
  });

  /* ---------------- live updates ---------------- */

  EQ.onLive(function (e) {
    if (state.range !== "live" || state.playing) return;
    renderQuakes();
    renderTable();
    if (!state.selectedId) setPulse(e);
  });

  /* ---------------- boot ---------------- */

  renderQuakes();
  renderTable();

  if (location.hash === "#pop") { // debug/deep-link: open the largest recent event's card
    var big = filtered().reduce(function (a, b) { return (!a || b.m > a.m) ? b : a; }, null);
    if (big) select(big, true);
  }

  if (location.hash === "#3d" || location.hash === "#3d-filters") {
    document.querySelector('#dimToggle button[data-dim="3d"]').click();
    if (location.hash === "#3d-filters") {
      document.getElementById("filtersPanel").classList.add("open");
      setTimeout(refresh3dFilters, 2500);
      setTimeout(refresh3dFilters, 8000);
    }
  }
  });
})();
