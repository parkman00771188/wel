/* World Earthquake Labs — live map page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  var state = {
    live: true,                          // rolling last-24h with live refreshes
    startMs: Date.now() - 24 * 3600e3,   // selected window [startMs, endMs]
    endMs: Date.now(),
    magLo: 1, magHi: 9.5,                // shared filters (2D map, table, 4D globe)
    bands: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true, 10: true },
    depthLo: 0, depthHi: 700,
    playing: false,
    cursor: null,
    selectedId: null,
    expandedTable: false
  };

  function spanDays() { return (state.endMs - state.startMs) / EQ.D; }

  var lastTableRows = []; // what the table currently shows (for row clicks)

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

  function inRegionRaw(lat, lng) {
    var v = REGION_VIEWS[state.mapRegion];
    if (!v || !v.bbox) return true;
    return lat >= v.bbox[0] && lat <= v.bbox[2] && lng >= v.bbox[1] && lng <= v.bbox[3];
  }

  function inRegion(e) { return inRegionRaw(e.lat, e.lng); }

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
      // dates + shared filters once the app has bound its inputs (async boot)
      var pushAll = function () { sync3dDates(); push3dShared(); };
      setTimeout(pushAll, 2500);
      setTimeout(pushAll, 8000);
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
        "#mcards{display:none!important}" +
        "#m-edit-period{display:none!important}" + // dates are set from our header
        "#m-update{display:none!important}";       // shown in the console top bar instead
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
    document.getElementById("filters3dOnly").hidden = !is3d; // shared filters always show
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
    return d >= state.depthLo && d <= state.depthHi;
  }

  function bandOk(m) {
    var b = Math.min(10, Math.max(1, Math.floor(m)));
    return state.bands[b];
  }

  function magOk(m) {
    return m >= state.magLo && m <= state.magHi && bandOk(m);
  }

  function cacheCovers() {
    // the recent cache holds the last ~120 days
    return state.startMs >= Date.now() - 118 * EQ.D;
  }

  /* recent windows only — long windows are painted straight off the raw
     catalog by the fast canvas layer, with no per-event objects at all */
  function filtered() {
    if (!cacheCovers()) return [];
    return EQ.events.filter(function (e) {
      return e.t >= state.startMs && e.t <= state.endMs && magOk(e.m) && depthOk(e.depth);
    });
  }

  /* ---------------- rendering ---------------- */

  /* ---- fast canvas layer: paints any span (up to the full catalog) ---- */

  var fastCanvas = null, fastActive = false, fastCount = 0;

  function ensureFastCanvas() {
    if (fastCanvas) return;
    fastCanvas = L.DomUtil.create("canvas", "fast-quakes");
    fastCanvas.style.pointerEvents = "none";
    map.getPane("overlayPane").appendChild(fastCanvas);
    map.on("moveend zoomend resize", function () { if (fastActive) drawFast(); });
  }

  function passesShared(mag, depth, tMs) {
    return magOk(mag) && depthOk(depth) && (state.cursor == null || tMs <= state.cursor);
  }

  function drawFast() {
    ensureFastCanvas();
    var size = map.getSize();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    fastCanvas.width = size.x * dpr;
    fastCanvas.height = size.y * dpr;
    fastCanvas.style.width = size.x + "px";
    fastCanvas.style.height = size.y + "px";
    L.DomUtil.setPosition(fastCanvas, map.containerPointToLayerPoint([0, 0]));

    var ctx = fastCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    var b = map.getBounds();
    var west = b.getWest(), east = b.getEast();
    var count = 0;

    EQ.forEachInRange(state.startMs, state.endMs, function (mag, lat, lon, depth, tMs) {
      if (!passesShared(mag, depth, tMs)) return;
      count++;
      for (var k = -360; k <= 360; k += 360) {
        var lng = lon + k;
        if (lng < west - 3 || lng > east + 3) continue;
        var p = map.latLngToContainerPoint([lat, lng]);
        var r = Math.max(1.6, EQ.magRadius(mag) * 0.8);
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = EQ.magColor(mag);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.2832);
        ctx.fill();
        if (mag >= 6) { // halo for the big ones
          ctx.globalAlpha = 0.14;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 8, 0, 6.2832);
          ctx.fill();
        }
      }
    });

    ctx.globalAlpha = 1;
    fastCount = count;
    var fc = document.getElementById("filterCount");
    if (fc) fc.textContent = count.toLocaleString() + " events";
  }

  function setFast(on) {
    fastActive = on;
    if (fastCanvas) fastCanvas.style.display = on ? "" : "none";
  }

  // click → nearest drawn event within 10 px (long windows only)
  map.on("click", function (ev) {
    if (!fastActive) return;
    var pt = ev.containerPoint;
    var best = null, bestD = 100; // 10px squared
    EQ.forEachInRange(state.startMs, state.endMs, function (mag, lat, lon, depth, tMs) {
      if (!passesShared(mag, depth, tMs)) return;
      for (var k = -360; k <= 360; k += 360) {
        var p = map.latLngToContainerPoint([lat, lon + k]);
        var dx = p.x - pt.x, dy = p.y - pt.y;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = { m: mag, lat: lat, lng: lon, depth: depth, t: tMs }; }
      }
    });
    if (!best) return;
    var who = EQ.regionFor(best.lat, best.lng);
    select({
      id: "hit", m: Math.round(best.m * 10) / 10,
      lat: Math.round(best.lat * 1000) / 1000, lng: Math.round(best.lng * 1000) / 1000,
      depth: Math.max(0, Math.round(best.depth)), t: best.t,
      loc: who.loc, group: who.group, rof: who.rof, status: "Reviewed"
    }, false);
  });

  var lastFastDraw = 0;

  function renderQuakes() {
    if (!cacheCovers()) {
      quakeLayer.clearLayers();
      setFast(true);
      // playback repaints every frame — throttle full-catalog redraws
      if (state.playing && Date.now() - lastFastDraw < 150) return;
      lastFastDraw = Date.now();
      drawFast();
      return;
    }
    setFast(false);
    quakeLayer.clearLayers();
    var list = filtered();
    if (state.cursor != null) { // playing or scrubbed
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
    if (fc) fc.textContent = list.length.toLocaleString() + " events";
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
    var baseCount = window.WEL && WEL.embed ? 14 : 5;
    var want = state.expandedTable ? (baseCount === 5 ? 25 : 40) : baseCount;
    var rows;
    if (cacheCovers()) {
      // recent window: the events cache already carries full M2+ detail
      rows = filtered().filter(inRegion).slice(0, want);
    } else {
      // long window: scan the raw catalog backwards so the newest events that
      // match the CURRENT filters top the list (no magnitude re-sorting)
      rows = EQ.latestInRange(state.startMs, state.endMs, want, function (m, lat, lon, depth) {
        return magOk(m) && depthOk(depth) && inRegionRaw(lat, lon);
      });
    }
    lastTableRows = rows;
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
        var byId = function (x) { return x.id === tr.dataset.id; };
        var e = lastTableRows.find(byId) || EQ.events.find(byId);
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

  var scrub = document.getElementById("timeScrub");

  function tickReadout() {
    if (state.cursor != null) {
      readout.textContent = EQ.fmtUTC(state.cursor, true);
    } else if (state.live) {
      readout.textContent = EQ.fmtUTC(Date.now(), true);
    } else {
      readout.textContent = EQ.fmtUTC(state.startMs) + "  —  " + EQ.fmtUTC(state.endMs);
    }
  }
  setInterval(tickReadout, 1000);
  tickReadout();

  var playRAF = null;

  function syncScrub() {
    var span = state.endMs - state.startMs;
    scrub.value = state.cursor == null ? 1000
      : Math.round(((state.cursor - state.startMs) / span) * 1000);
  }

  /* pause: keep the playhead where it is */
  function pausePlay() {
    state.playing = false;
    if (playRAF) cancelAnimationFrame(playRAF);
    playBtn.innerHTML = PLAY_SVG;
  }

  /* full reset (window changed, Now pressed, …) */
  function stopPlay() {
    pausePlay();
    state.cursor = null;
    scrub.value = 1000;
    renderQuakes();
    tickReadout();
  }

  var PLAY_TOTAL_MS = 14000; // full window sweep duration

  function startPlay() {
    var span = state.endMs - state.startMs;
    var from = (state.cursor != null && state.cursor < state.endMs - span * 0.005)
      ? state.cursor
      : state.startMs;
    var dur = Math.max(600, PLAY_TOTAL_MS * ((state.endMs - from) / span));
    var t0 = performance.now();
    state.playing = true;
    playBtn.innerHTML = PAUSE_SVG;

    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      state.cursor = from + (state.endMs - from) * k;
      syncScrub();
      renderQuakes();
      tickReadout();
      if (k < 1 && state.playing) playRAF = requestAnimationFrame(step);
      else pausePlay();
    }
    playRAF = requestAnimationFrame(step);
  }

  playBtn.addEventListener("click", function () {
    if (state.playing) pausePlay(); else startPlay();
  });

  /* drag the bar to scrub through the window */
  scrub.addEventListener("input", function () {
    pausePlay();
    var span = state.endMs - state.startMs;
    state.cursor = state.startMs + (+this.value / 1000) * span;
    if (+this.value >= 1000) state.cursor = null; // fully right = everything
    renderQuakes();
    tickReadout();
  });

  function isoUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(d.getUTCDate()).padStart(2, "0");
  }

  var PRESET_DAYS = [1, 7, 30, 90, 365, 1095, 1826, 3652];

  function setRange(startMs, endMs, live) {
    stopPlay();
    state.startMs = Math.min(startMs, endMs - 60e3);
    state.endMs = endMs;
    state.live = !!live;

    document.getElementById("dateFrom").value = isoUTC(state.startMs);
    document.getElementById("dateTo").value = isoUTC(state.endMs);

    // reflect a matching preset in the Period combo, else "Custom"
    var sel = document.getElementById("mapPeriod");
    var days = spanDays();
    var endsNow = Math.abs(state.endMs - Date.now()) < 36e5;
    var preset = null;
    if (endsNow) {
      PRESET_DAYS.forEach(function (p) { if (Math.abs(days - p) < 0.2) preset = p; });
      if (state.startMs <= Date.parse("1900-01-02T00:00:00Z")) preset = "all";
    }
    sel.value = preset ? String(preset) : "custom";

    nowBtn.classList.toggle("active", state.live);
    renderQuakes();
    renderTable();
    sync3dDates();
  }

  function setPresetDays(days, live) {
    setRange(Date.now() - days * EQ.D, Date.now(), live);
  }

  document.getElementById("mapPeriod").addEventListener("change", function () {
    if (this.value === "custom") return;
    if (this.value === "all") {
      setRange(Date.parse("1900-01-01T00:00:00Z"), Date.now(), false);
      return;
    }
    var days = +this.value;
    setPresetDays(days, days === 1); // 24h keeps the live rolling behaviour
  });

  function onDateInput() {
    var a = document.getElementById("dateFrom").value;
    var b = document.getElementById("dateTo").value;
    if (!a || !b) return;
    var s = Date.parse(a + "T00:00:00Z");
    var e = Date.parse(b + "T23:59:59Z");
    if (isNaN(s) || isNaN(e) || e <= s) return;
    setRange(s, Math.min(e, Date.now()), false);
  }
  document.getElementById("dateFrom").addEventListener("change", onDateInput);
  document.getElementById("dateTo").addEventListener("change", onDateInput);

  nowBtn.addEventListener("click", function () { setPresetDays(1, true); });

  // push the selected dates into the 4D app so its timeline matches
  function sync3dDates() {
    x3(function (doc, w) {
      var a = doc.getElementById("in-date-a");
      var b = doc.getElementById("in-date-b");
      if (!a || !b) return;
      a.value = isoUTC(state.startMs);
      b.value = isoUTC(state.endMs);
      a.dispatchEvent(new w.Event("change", { bubbles: true }));
      b.dispatchEvent(new w.Event("change", { bubbles: true }));
    });
  }

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

  /* ---------- shared filters (drive 2D, the table, and the 4D globe) ---------- */

  var fMagLo = document.getElementById("fMagLo"), fMagHi = document.getElementById("fMagHi");
  var fDepthLo = document.getElementById("fDepthLo"), fDepthHi = document.getElementById("fDepthHi");

  function updateFilterBadge() {
    var active = 0;
    if (state.magLo > 1 || state.magHi < 9.5) active++;
    var bandsOff = Object.keys(state.bands).some(function (k) { return !state.bands[k]; });
    if (bandsOff) active++;
    if (state.depthLo > 0 || state.depthHi < 700) active++;
    var badge = document.getElementById("filterBadge");
    badge.hidden = active === 0;
    badge.textContent = active;
  }

  function readSharedInputs() {
    var lo = +fMagLo.value, hi = +fMagHi.value;
    state.magLo = Math.min(lo, hi);
    state.magHi = Math.max(lo, hi);
    var dlo = +fDepthLo.value, dhi = +fDepthHi.value;
    state.depthLo = Math.min(dlo, dhi);
    state.depthHi = Math.max(dlo, dhi);
    document.getElementById("fMagOut").textContent = state.magLo.toFixed(1) + " – " + state.magHi.toFixed(1);
    document.getElementById("fDepthOut").textContent = state.depthLo + " – " + state.depthHi;
    paintDual(document.getElementById("fMagWrap"));
    paintDual(document.getElementById("fDepthWrap"));
  }

  function applyShared() {
    renderQuakes();
    renderTable();
    updateFilterBadge();
    push3dShared();
  }

  /* mirror the shared filters into the 4D app (magnitude range, bands, depth) */
  function push3dShared() {
    x3(function (doc, w) {
      var set = function (id, v) {
        var t = doc.getElementById(id);
        if (t) { t.value = v; t.dispatchEvent(new w.Event("input", { bubbles: true })); }
      };
      set("in-mag-lo", state.magLo);
      set("in-mag-hi", state.magHi);
      set("in-depth-lo", state.depthLo);
      set("in-depth-hi", state.depthHi);
      for (var b = 1; b <= 10; b++) {
        var ck = doc.getElementById("ck-band-" + b);
        if (ck && ck.checked !== state.bands[b]) {
          ck.checked = state.bands[b];
          ck.dispatchEvent(new w.Event("change", { bubbles: true }));
        }
      }
    });
  }

  [fMagLo, fMagHi, fDepthLo, fDepthHi].forEach(function (el) {
    el.addEventListener("input", function () {
      readSharedInputs();
      applyShared();
    });
  });

  document.getElementById("fBands").addEventListener("change", function (ev) {
    var ck = ev.target.closest("[data-band]");
    if (!ck) return;
    state.bands[+ck.dataset.band] = ck.checked;
    applyShared();
  });

  document.getElementById("fDepthPresets").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-lo]");
    if (!b) return;
    this.querySelectorAll(".pchip").forEach(function (x) { x.classList.toggle("on", x === b); });
    fDepthLo.value = b.dataset.lo;
    fDepthHi.value = b.dataset.hi;
    readSharedInputs();
    applyShared();
  });

  readSharedInputs();

  /* ---------------- live updates ---------------- */

  EQ.onLive(function (e) {
    if (!state.live || state.playing || state.cursor != null) return;
    state.endMs = Date.now();
    state.startMs = state.endMs - 24 * EQ.H;
    renderQuakes();
    renderTable();
    if (!state.selectedId) setPulse(e);
  });

  /* ---------------- boot ---------------- */

  setPresetDays(1, true); // live last-24h, and seeds the date inputs

  var dm = (location.hash || "").match(/^#d(\d+)$/); // deep-link: #d365 = 1y window
  if (dm) setPresetDays(+dm[1], false);

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
