/* World Earthquake Labs — live map page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  var state = {
    live: false,                         // All is the default; Now enables rolling 24h updates
    startMs: Date.parse("1900-01-01T00:00:00Z"), // selected window [startMs, endMs]
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
    // Exact coverage of the Japan-specific ISC/JMA + USGS catalogue.
    japan: { center: [35, 136], zoom: 5.25, bbox: [22, 120, 48, 152] } // [latMin, lngMin, latMax, lngMax]
  };
  state.mapRegion = "global";

  document.getElementById("mapRegion").addEventListener("change", function () {
    state.mapRegion = this.value;
    var v = REGION_VIEWS[state.mapRegion];
    if (!document.getElementById("mapShell").classList.contains("mode-3d")) {
      map.flyTo(v.center, v.zoom || baseZoom, { duration: 1.6 });
    }
    renderTable();
    sync3dView(true);
    if ((requestedDim === "2d" ||
         !document.getElementById("mapShell").classList.contains("mode-3d")) &&
        (!EQ.loaded || EQ.catalogRegion !== state.mapRegion)) {
      requestedDim = "2d";
      load2dAndActivate(document.querySelector('#dimToggle button[data-dim="2d"]'));
    }
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
    frame3d.src = "3d/index.html?view=globe";
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
  function sync3dView(force) {
    if (!frame3d) return;
    if (!force && !document.getElementById("mapShell").classList.contains("mode-3d")) return;
    var want = state.mapRegion === "japan" ? "japan" : "globe";
    var tries = 0;
    (function poll() {
      var doc;
      try { doc = frame3d.contentDocument; } catch (e) { return; }
      var btn = doc && doc.querySelector('#seg-view [data-v="' + want + '"]');
      if (btn && btn.classList.contains("on")) {
        // A Japan-mode reload may finish after the fixed post-load timers.
        // Reapply the host period and filters at the authoritative ready point.
        if (frame3d.contentWindow && frame3d.contentWindow.__app) {
          frame3d.contentWindow.__app.suspendedByHost =
            !document.getElementById("mapShell").classList.contains("mode-3d");
          sync3dDates();
          push3dShared();
          primeRecentTable(want === "japan" ? "japan" : "global");
          return;
        }
      }
      if (btn && !btn.classList.contains("on")) btn.click();
      if (++tries < 120) setTimeout(poll, 600);
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

  var requestedDim = "3d";

  function reportDimension(dim) {
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "map", sub: dim }, "*");
    }
  }

  function activateDimension(b) {
    var toggle = document.getElementById("dimToggle");
    toggle.querySelectorAll("button").forEach(function (x) { x.classList.toggle("active", x === b); });
    var is3d = b.dataset.dim === "3d";
    if (is3d) { ensure3d(); sync3dView(true); map.closePopup(); }
    try {
      var app3d = frame3d && frame3d.contentWindow && frame3d.contentWindow.__app;
      if (app3d) app3d.suspendedByHost = !is3d;
    } catch (err) { /* same-origin access is expected */ }
    document.getElementById("mapShell").classList.toggle("mode-3d", is3d);
    if (is3d) setFast(false);
    if (is3d) { sync3dDates(); push3dShared(); }
    syncFilterSections();
    syncLayerSections();
    if (!is3d) {
      var view2d = REGION_VIEWS[state.mapRegion];
      map.setView(view2d.center, view2d.zoom || baseZoom, { animate: false });
      ensure2dReferenceData();
      if (EQ.loaded) renderQuakes();
      setTimeout(function () { map.invalidateSize(); }, 0);
    }
    reportDimension(is3d ? "3d" : "2d");
  }

  function adopt3dCatalog(region) {
    try {
      var app = frame3d && frame3d.contentWindow && frame3d.contentWindow.__app;
      if (!app || !app.data) return false;
      var events, sourceMeta;
      if (region === "japan") {
        if (app.view !== "japan") return false;
        events = app.data.events;
        sourceMeta = app.data.meta || {};
      } else {
        var globe = app.globe;
        if (app.view !== "globe") return false;
        events = globe && globe.layer && globe.layer.events;
        sourceMeta = globe && globe.meta || {};
      }
      if (!events || !events.t || !events.t.length) return false;
      var meta = Object.assign({}, sourceMeta, {
        epochMs: app.data.epochMs,
        count: events.t.length,
        regionKey: region,
        source: region === "japan"
          ? "Japan regional catalogue (ISC/JMA + USGS)"
          : sourceMeta.source
      });
      EQ.adoptRaw(events, meta);
      return true;
    } catch (err) {
      return false;
    }
  }

  /* Prefer the catalogue already resident in the same-origin 3D iframe. Only
     fall back to a second fetch if the globe explicitly fails or never boots. */
  function waitFor3dCatalog(region) {
    if (EQ.loaded && EQ.catalogRegion === region) return Promise.resolve(EQ);
    ensure3d();
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function poll() {
        if (adopt3dCatalog(region)) { resolve(EQ); return; }
        var failed = false;
        try {
          var doc = frame3d && frame3d.contentDocument;
          failed = !!(doc && (region === "global"
            ? doc.querySelector("#globe-loader.error")
            : (doc.getElementById("fail") && !doc.getElementById("fail").hidden)));
        } catch (err) { /* same-origin access is expected */ }
        if (failed || Date.now() - started > 60000) {
          reject(new Error(failed ? "3D catalogue load failed" : "3D catalogue wait timed out"));
          return;
        }
        setTimeout(poll, 120);
      })();
    });
  }

  var recentPrimeId = 0;
  function primeRecentTable(region) {
    var id = ++recentPrimeId;
    Promise.all([EQ.ensureCountries(), waitFor3dCatalog(region)]).then(function () {
      if (id !== recentPrimeId || region !== state.mapRegion) return;
      renderTable();
    }).catch(function (err) {
      console.warn("Recent earthquake catalogue was not ready.", err);
    });
  }

  var load2dRequestId = 0;
  function load2dAndActivate(b) {
    var region = state.mapRegion;
    var requestId = ++load2dRequestId;
    b.disabled = true;
    b.setAttribute("aria-busy", "true");
    b.textContent = "Preparing 2D\u2026";
    Promise.all([
      EQ.ensureCountries(),
      waitFor3dCatalog(region).catch(function (err) {
        if (region !== "global") throw err;
        console.warn("Reusing the 3D catalogue was unavailable; loading the 2D fallback.", err);
        return EQ.ensureLoaded();
      })
    ]).then(function () {
      if (requestId !== load2dRequestId) return;
      if (region !== state.mapRegion) {
        b.disabled = false;
        b.removeAttribute("aria-busy");
        b.textContent = "2D";
        return;
      }
      b.disabled = false;
      b.removeAttribute("aria-busy");
      b.textContent = "2D";
      renderTable();
      if (requestedDim === "2d") activateDimension(b);
    }).catch(function (err) {
      if (requestId !== load2dRequestId) return;
      if (region !== state.mapRegion || requestedDim !== "2d") {
        b.disabled = false;
        b.removeAttribute("aria-busy");
        b.textContent = "2D";
        return;
      }
      console.error("2D catalog load failed:", err);
      b.disabled = false;
      b.removeAttribute("aria-busy");
      b.textContent = "Retry 2D";
    });
  }

  document.getElementById("dimToggle").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    requestedDim = b.dataset.dim;
    var is3d = b.dataset.dim === "3d";
    if (!is3d && (!EQ.loaded || EQ.catalogRegion !== state.mapRegion)) {
      load2dAndActivate(b);
      return;
    }
    activateDimension(b);
  });

  function applyDimensionHash() {
    var dim = (location.hash || "").slice(1);
    if (dim !== "2d" && dim !== "3d") return;
    var button = document.querySelector('#dimToggle button[data-dim="' + dim + '"]');
    if (button && !button.classList.contains("active")) button.click();
  }
  window.addEventListener("hashchange", applyDimensionHash);

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
        // One box can change another's availability, so re-read the app.
        setTimeout(refresh3dFilters, 150);
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
        if (!t) return;
        c.checked = t.checked;
        // The app locks some boxes depending on other settings -- additive glow
        // goes dead under the light palette. A proxy that stayed clickable
        // would look broken, so carry the disabled state across too.
        c.disabled = t.disabled;
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

  /* ---------------- reset a panel to its defaults ---------------- */

  /* Inputs carry their own defaults forever (defaultValue / defaultChecked),
     so nothing has to be registered here. Chip groups do not, and the console's
     own groups declare theirs with class "on" in the markup -- recorded now,
     before a click can move it. Proxy chips are skipped: their state belongs to
     the 3D app, which resets them itself. */
  var CHIP_DEFAULTS = [];
  document.querySelectorAll("#layers2d .chip-row, #fDepthPresets").forEach(function (row) {
    var on = row.querySelector(".pchip.on");
    if (on) CHIP_DEFAULTS.push([row, on]);
  });

  function resetOwnControls(root) {
    root.querySelectorAll("input, select").forEach(function (el) {
      if (el.closest(".x3dscope")) return;        // the app owns those
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked === el.defaultChecked) return;
        el.checked = el.defaultChecked;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      var want = el.tagName === "SELECT"
        ? ((el.querySelector("option[selected]") || el.options[0] || {}).value)
        : el.defaultValue;
      if (!want || el.value === want) return;
      el.value = want;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    CHIP_DEFAULTS.forEach(function (pair) {
      if (root.contains(pair[0]) && !pair[1].classList.contains("on")) pair[1].click();
    });
    paintDuals();
  }

  /* The 3D halves of these panels are the app's controls seen through a proxy.
     Clicking the app's own per-section reset is better than pushing values in
     from here: it owns the defaults and every side effect they carry. */
  function resetInApp(sections) {
    x3(function (doc) {
      sections.forEach(function (sel) {
        var b = doc.querySelector(sel + " .sec-reset");
        if (b) b.click();
      });
    });
    setTimeout(refresh3dFilters, 220);
  }

  function in3d() {
    return document.getElementById("mapShell").classList.contains("mode-3d");
  }

  document.getElementById("filtersReset").addEventListener("click", function (ev) {
    ev.stopPropagation();
    resetOwnControls(document.getElementById("filtersShared"));
    if (in3d()) resetInApp([".sec-anim", ".sec-visual"]);
  });

  document.getElementById("layersReset").addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (in3d()) resetInApp([".sec-map"]);
    else resetOwnControls(document.getElementById("layers2d"));
  });

  /* ---------------- in-map layers button (2D basemaps / 3D map layers) ---------------- */

  var layersPanel = document.getElementById("layersPanel");

  function syncLayerSections() {
    var is3d = document.getElementById("mapShell").classList.contains("mode-3d");
    document.getElementById("layers2d").hidden = is3d;
    document.getElementById("layers3d").hidden = !is3d;
    if (is3d) refresh3dFilters();
  }

  /* The on-map legend is a button on phones (see the .ml-toggle rules): nine
     magnitude steps and the layer keys do not fit beside a 390px map. */
  var legendBox = document.getElementById("mapLegend");
  var legendToggle = document.getElementById("mapLegendToggle");
  if (legendToggle) legendToggle.addEventListener("click", function (ev) {
    ev.stopPropagation();
    var open = legendBox.classList.toggle("open");
    legendToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

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

  function wire2dOverlay(id, key) {
    document.getElementById(id).addEventListener("change", function () {
      set2dOverlay(key, this.checked);
      sync2dLayerLegend(key, this.checked);
    });
  }
  wire2dOverlay("ck2dCoast", "coast");
  wire2dOverlay("ck2dPlates", "plates");
  wire2dOverlay("ck2dFaults", "faults");
  wire2dOverlay("ck2dVolcanoes", "volcanoes");

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

  var baseLayer = L.tileLayer(BASES.ocean.url, { attribution: BASES.ocean.attr, noWrap: false }).addTo(map);

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

  /* Global 2D reference layers. The 3D iframe normally owns this 2.8 MB
     payload, so reuse it when possible and only fetch as a fallback. */
  map.createPane("tectonic2d");
  map.getPane("tectonic2d").style.zIndex = 360;
  map.getPane("tectonic2d").style.pointerEvents = "none";
  var referenceRenderer2d = L.canvas({ pane: "tectonic2d", padding: 0.45 });
  var referenceData2d = null, referenceDataPromise2d = null;
  var referenceLayers2d = {};

  var fallbackPlates2d = L.layerGroup();
  EQ.segments.forEach(function (seg) {
    fallbackPlates2d.addLayer(L.polyline(seg.pts, {
      pane: "tectonic2d", renderer: referenceRenderer2d,
      color: "#ff8a3d", weight: 1.1, opacity: 0.72,
      dashArray: "3 4", interactive: false
    }));
  });
  referenceLayers2d.plates = fallbackPlates2d;
  fallbackPlates2d.addTo(map);

  function referencePaths2d(strips) {
    var paths = [];
    (strips || []).forEach(function (strip) {
      var path = [], prevLon = null;
      for (var i = 0; i + 1 < strip.length; i += 2) {
        var lon = strip[i], lat = strip[i + 1];
        if (prevLon != null && Math.abs(lon - prevLon) > 180) {
          if (path.length > 1) paths.push(path);
          path = [];
        }
        path.push([lat, lon]);
        prevLon = lon;
      }
      if (path.length > 1) paths.push(path);
    });
    return paths;
  }

  function referenceScale2d(key) {
    var input = document.getElementById({
      plates: "in2dPlateWidth", faults: "in2dFaultWidth", volcanoes: "in2dVolcanoSize"
    }[key]);
    return input ? +input.value : 1;
  }

  function create2dReferenceLayer(key) {
    if (!referenceData2d) return null;
    var common = { pane: "tectonic2d", renderer: referenceRenderer2d, interactive: false };
    if (key === "coast") {
      return L.polyline(referencePaths2d(referenceData2d.coast), Object.assign({}, common, {
        color: "#7f9ebb", weight: 0.8, opacity: 0.72, smoothFactor: 1.25
      }));
    }
    if (key === "plates") {
      return L.polyline(referencePaths2d(referenceData2d.plates), Object.assign({}, common, {
        color: "#ff8a3d", weight: 1.15 * referenceScale2d("plates"),
        opacity: 0.78, dashArray: "3 4", smoothFactor: 1.1
      }));
    }
    if (key === "faults") {
      return L.polyline(referencePaths2d(referenceData2d.faults), Object.assign({}, common, {
        color: "#e0566e", weight: 0.85 * referenceScale2d("faults"),
        opacity: 0.62, smoothFactor: 1.4
      }));
    }
    if (key === "volcanoes") {
      var volcanoes = L.layerGroup();
      (referenceData2d.volcanoes || []).forEach(function (row) {
        volcanoes.addLayer(L.circleMarker([row[1], row[0]], Object.assign({}, common, {
          radius: 2.4 * referenceScale2d("volcanoes"),
          color: "rgba(255,255,255,.8)", weight: 0.7,
          fillColor: "#e55b3d", fillOpacity: 0.88
        })));
      });
      return volcanoes;
    }
    return null;
  }

  function checkboxFor2dLayer(key) {
    return document.getElementById({
      coast: "ck2dCoast", plates: "ck2dPlates",
      faults: "ck2dFaults", volcanoes: "ck2dVolcanoes"
    }[key]);
  }

  function set2dOverlay(key, on) {
    var layer = referenceLayers2d[key];
    if (!layer && referenceData2d) {
      layer = create2dReferenceLayer(key);
      referenceLayers2d[key] = layer;
    }
    if (layer) {
      if (on) { if (!map.hasLayer(layer)) layer.addTo(map); }
      else if (map.hasLayer(layer)) map.removeLayer(layer);
    } else if (on) {
      ensure2dReferenceData();
    }
  }

  function sync2dLayerLegend(key, on) {
    var el = document.getElementById({
      coast: "legend2dCoast", plates: "legend2dPlates",
      faults: "legend2dFaults", volcanoes: "legend2dVolcanoes"
    }[key]);
    if (el) el.hidden = !on;
  }

  function sync2dReferenceLayers() {
    ["coast", "plates", "faults", "volcanoes"].forEach(function (key) {
      var checkbox = checkboxFor2dLayer(key);
      set2dOverlay(key, !!(checkbox && checkbox.checked));
      sync2dLayerLegend(key, !!(checkbox && checkbox.checked));
    });
  }

  function install2dReferenceData(data) {
    if (!data || !data.coast || !data.plates || !data.faults || !data.volcanoes) return null;
    var oldPlates = referenceLayers2d.plates;
    if (oldPlates && map.hasLayer(oldPlates)) map.removeLayer(oldPlates);
    referenceData2d = data;
    referenceLayers2d.plates = null;
    sync2dReferenceLayers();
    return data;
  }

  function shared2dReferenceData() {
    try {
      var app = frame3d && frame3d.contentWindow && frame3d.contentWindow.__app;
      return app && app.globe && app.globe.basemapData || null;
    } catch (err) {
      return null;
    }
  }

  function ensure2dReferenceData() {
    if (referenceData2d) return Promise.resolve(referenceData2d);
    if (referenceDataPromise2d) return referenceDataPromise2d;
    var shared = shared2dReferenceData();
    if (shared) return Promise.resolve(install2dReferenceData(shared));
    referenceDataPromise2d = fetch("3d/data/global/basemap.json")
      .then(function (response) {
        if (!response.ok) throw new Error("2D reference layers -> HTTP " + response.status);
        return response.json();
      })
      .then(install2dReferenceData)
      .catch(function (err) {
        referenceDataPromise2d = null;
        console.warn("2D reference layers unavailable:", err);
        return null;
      });
    return referenceDataPromise2d;
  }

  function apply2dReferenceScale(key) {
    var layer = referenceLayers2d[key];
    if (!layer) return;
    var scale = referenceScale2d(key);
    if (key === "volcanoes") {
      layer.eachLayer(function (marker) {
        if (marker.setRadius) marker.setRadius(2.4 * scale);
      });
      return;
    }
    var style = { weight: (key === "plates" ? 1.15 : 0.85) * scale };
    if (layer.setStyle) layer.setStyle(style);
    else if (layer.eachLayer) layer.eachLayer(function (line) {
      if (line.setStyle) line.setStyle(style);
    });
  }

  function wire2dReferenceScale(inputId, outputId, key) {
    var input = document.getElementById(inputId);
    var output = document.getElementById(outputId);
    input.addEventListener("input", function () {
      output.textContent = String(+this.value);
      apply2dReferenceScale(key);
    });
  }
  wire2dReferenceScale("in2dPlateWidth", "out2dPlateWidth", "plates");
  wire2dReferenceScale("in2dFaultWidth", "out2dFaultWidth", "faults");
  wire2dReferenceScale("in2dVolcanoSize", "out2dVolcanoSize", "volcanoes");

  ["coast", "plates", "faults", "volcanoes"].forEach(function (key) {
    var checkbox = checkboxFor2dLayer(key);
    sync2dLayerLegend(key, !!(checkbox && checkbox.checked));
  });

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

  function objectCacheCovers() {
    return cacheCovers() && EQ.events.length > 0;
  }

  /* recent windows only — long windows are painted straight off the raw
     catalog by the fast canvas layer, with no per-event objects at all */
  function filtered() {
    if (!objectCacheCovers()) return [];
    return EQ.events.filter(function (e) {
      return e.t >= state.startMs && e.t <= state.endMs && magOk(e.m) && depthOk(e.depth);
    });
  }

  /* ---------------- rendering ---------------- */

  /* ---- fast canvas layer: paints any span (up to the full catalog) ---- */

  var fastCanvas = null, fastActive = false, fastCount = 0;
  var fastPaintRAF = null, fastPaintTimer = null, fastRequest = 0;
  var fastHit = null, fastGrid = null, lastFastPaint = 0;

  function ensureFastCanvas() {
    if (fastCanvas) return;
    fastCanvas = L.DomUtil.create("canvas", "fast-quakes");
    fastCanvas.style.pointerEvents = "none";
    map.getPane("overlayPane").appendChild(fastCanvas);
    map.on("moveend zoomend resize", function () { if (fastActive) drawFast(); });
  }

  function dotRadius(mag, fast) {
    return Math.max(fast ? 1 : 1.4, EQ.magRadius(mag) * (fast ? 0.55 : 0.58));
  }

  function getFastGrid(cells) {
    if (!fastGrid || fastGrid.capacity < cells) {
      var capacity = Math.ceil(cells * 1.12);
      fastGrid = {
        capacity: capacity,
        mag: new Float32Array(capacity),
        lat: new Float32Array(capacity),
        lng: new Float32Array(capacity),
        rawLng: new Float32Array(capacity),
        depth: new Float32Array(capacity),
        time: new Float64Array(capacity),
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        occupied: new Int32Array(capacity)
      };
    } else {
      fastGrid.mag.fill(0, 0, cells);
    }
    return fastGrid;
  }

  function drawFast() {
    ensureFastCanvas();
    var request = ++fastRequest;
    if (fastPaintRAF) cancelAnimationFrame(fastPaintRAF);
    if (fastPaintTimer) clearTimeout(fastPaintTimer);
    // Collapse rapid slider and scrubber input into one capped redraw.
    var wait = Math.max(0, 45 - (performance.now() - lastFastPaint));
    fastPaintTimer = setTimeout(function () {
      fastPaintRAF = requestAnimationFrame(function () { paintFast(request); });
    }, wait);
  }

  function paintFast(request) {
    if (request !== fastRequest || !fastActive) return;
    lastFastPaint = performance.now();
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

    var bounds = map.getBounds();
    var west = bounds.getWest(), east = bounds.getEast();
    var south = bounds.getSouth(), north = bounds.getNorth();
    var lngSpan = Math.max(0.001, east - west);
    var latSpan = Math.max(0.001, north - south);
    // One representative per tiny screen cell removes fully overlapping arcs.
    // The largest event wins, keeping significant earthquakes visible.
    var cellPx = spanDays() > 3650 ? 3 : 2;
    var cols = Math.max(1, Math.ceil(size.x / cellPx));
    var rows = Math.max(1, Math.ceil(size.y / cellPx));
    var cells = cols * rows;
    var grid = getFastGrid(cells);
    var bestMag = grid.mag;
    var bestLat = grid.lat;
    var bestLng = grid.lng;
    var bestRawLng = grid.rawLng;
    var bestDepth = grid.depth;
    var bestTime = grid.time;
    var screenX = grid.x;
    var screenY = grid.y;
    var occupied = grid.occupied;
    var occupiedCount = 0, count = 0;
    var effectiveEnd = state.cursor == null ? state.endMs : Math.min(state.endMs, state.cursor);
    var ranges = EQ.rawRanges(state.startMs, effectiveEnd);

    for (var ri = 0; ri < ranges.length; ri++) {
      var range = ranges[ri], band = range.band;
      for (var i = range.from; i < range.to; i++) {
        var mag = band.mag[i], depth = band.depth[i];
        if (mag > 9.55 || !magOk(mag) || !depthOk(depth)) continue;
        count++;
        var lat = band.lat[i];
        if (lat < south || lat > north) continue;
        var lon = band.lon[i];
        var firstCopy = Math.ceil((west - lon) / 360);
        var lastCopy = Math.floor((east - lon) / 360);
        for (var copy = firstCopy; copy <= lastCopy; copy++) {
          var displayLng = lon + copy * 360;
          var col = Math.floor((displayLng - west) / lngSpan * cols);
          var row = Math.floor((north - lat) / latSpan * rows);
          if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
          var cell = row * cols + col;
          var tMs = range.epochMs + band.t[i] * 1000;
          if (!bestMag[cell]) occupied[occupiedCount++] = cell;
          if (mag > bestMag[cell] || (mag === bestMag[cell] && tMs > bestTime[cell])) {
            bestMag[cell] = mag;
            bestLat[cell] = lat;
            bestLng[cell] = displayLng;
            bestRawLng[cell] = lon;
            bestDepth[cell] = depth;
            bestTime[cell] = tMs;
          }
        }
      }
    }

    for (var oi = 0; oi < occupiedCount; oi++) {
      var ci = occupied[oi];
      var point = map.latLngToContainerPoint([bestLat[ci], bestLng[ci]]);
      var radius = dotRadius(bestMag[ci], true);
      screenX[ci] = point.x;
      screenY[ci] = point.y;
      ctx.fillStyle = EQ.magColor(bestMag[ci]);
      if (bestMag[ci] >= 6) {
        ctx.globalAlpha = 0.11;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 4, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 0.76;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 6.2832);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    fastCount = count;
    fastHit = {
      occupied: occupied, count: occupiedCount,
      mag: bestMag, lat: bestLat, lng: bestRawLng, depth: bestDepth, time: bestTime,
      x: screenX, y: screenY
    };
    var fc = document.getElementById("filterCount");
    if (fc) fc.textContent = count.toLocaleString() + " events";
  }

  function setFast(on) {
    fastActive = on;
    if (!on) {
      fastRequest++;
      if (fastPaintRAF) cancelAnimationFrame(fastPaintRAF);
      if (fastPaintTimer) clearTimeout(fastPaintTimer);
      fastHit = null;
    }
    if (fastCanvas) fastCanvas.style.display = on ? "" : "none";
  }

  // click → nearest drawn event within 10 px (long windows only)
  map.on("click", function (ev) {
    if (!fastActive || !fastHit) return;
    var pt = ev.containerPoint;
    var bestCell = -1, bestD = 81; // 9px squared
    for (var hi = 0; hi < fastHit.count; hi++) {
      var hitCell = fastHit.occupied[hi];
      var dx = fastHit.x[hitCell] - pt.x, dy = fastHit.y[hitCell] - pt.y;
      var dist = dx * dx + dy * dy;
      if (dist < bestD) { bestD = dist; bestCell = hitCell; }
    }
    if (bestCell < 0) return;
    var hitLat = fastHit.lat[bestCell], hitLng = fastHit.lng[bestCell];
    var who = EQ.regionFor(hitLat, hitLng);
    select({
      id: "hit", m: Math.round(fastHit.mag[bestCell] * 10) / 10,
      lat: Math.round(hitLat * 1000) / 1000, lng: Math.round(hitLng * 1000) / 1000,
      depth: Math.max(0, Math.round(fastHit.depth[bestCell])), t: fastHit.time[bestCell],
      loc: who.loc, group: who.group, region: who.region || who.group,
      rof: who.rof, status: "Reviewed"
    }, false);
  });

  var lastFastDraw = 0;

  function renderQuakes() {
    if (document.getElementById("mapShell").classList.contains("mode-3d")) return;
    if (!objectCacheCovers()) {
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
      var r = dotRadius(e.m, false);
      if (e.m >= 5) {
        quakeLayer.addLayer(L.circleMarker([e.lat, e.lng], {
          radius: r + (e.m >= 6 ? 5 : 3), stroke: false, fillColor: color, fillOpacity: 0.12, interactive: false
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
    var size = Math.max(22, dotRadius(e.m, false) * 2 + 14);
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
  var activeEvent = null;
  var sheet = document.getElementById("quakeSheet");

  function phoneSheet() {
    return !!sheet && window.matchMedia("(max-width: 760px)").matches;
  }

  function hideSheet() {
    if (sheet && !sheet.hidden) { sheet.hidden = true; sheet.innerHTML = ""; }
  }

  function select(e, pan) {
    state.selectedId = e.id;
    var html =
      '<button class="qc-close" id="qcClose" type="button" aria-label="Close earthquake details">' + WEL.icon("x", 16) + "</button>" +
      '<div class="qc-mag">M ' + e.m.toFixed(1) + "</div>" +
      '<div class="qc-title">' + e.loc + "</div>" +
      '<div class="qc-row"><span>' + EQ.fmtUTC(e.t, true) + "</span></div>" +
      '<div class="qc-row"><span>' + coordStr(e) + "</span></div>" +
      '<div class="qc-row"><span class="k">Depth</span><span>' + e.depth + " km</span></div>" +
      '<div class="qc-div"></div>' +
      '<div class="qc-row"><span class="k">Status</span><span>' + (e.status || "Automatic") + "</span></div>" +
      '<button class="btn btn-primary btn-block" id="qcDetails" type="button">View Details</button>';

    activeEvent = e;

    // Phones get a sheet instead. A popup has to be placed relative to its
    // point, and at that width there is often nowhere legal to put it: the
    // card is 280px tall, the sticky site header covers the top of the map,
    // the scrubber covers the bottom, and maxBounds means the map frequently
    // refuses to pan out of the way. A sheet has none of those problems.
    if (phoneSheet()) {
      if (activePopup) { map.closePopup(activePopup); activePopup = null; }
      sheet.innerHTML = html;
      sheet.hidden = false;
      setPulse(e);
      if (pan) map.panTo([e.lat, e.lng], { animate: true });
      return;
    }
    hideSheet();

    if (activePopup) map.closePopup(activePopup);
    activePopup = L.popup({
      className: "quake-pop",
      closeButton: false,
      autoPan: true,
      autoPanPadding: [36, 36],
      offset: [0, -4],
      maxWidth: 320
    }).setLatLng([e.lat, e.lng]).setContent(html).openOn(map);

    setPulse(e);
    if (pan) {
      map.panTo([e.lat, e.lng], { animate: true });
      map.once("moveend", keepPopupInside);
    } else {
      requestAnimationFrame(keepPopupInside);
    }
  }

  /* Placing the card is fiddlier than it looks. It opens above its point, and
     near the top of the map that puts it outside the container, which clips it
     -- so Close is not awkward to hit, it is not there to hit. Leaflet's autoPan
     is meant to prevent that and cannot here, because the map sets maxBounds and
     at high latitude the view is already against the northern limit, so the pan
     it asks for is simply refused. And "inside the container" is not sufficient
     either: the scrubber, the legend and the zoom cluster all paint above the
     popup pane, so a card that reaches them has its buttons behind furniture.
     Hence: work out the genuinely usable rectangle, try to pan into it, and if
     the map will not move, flip the card to the other side of its point. */
  var POP_PAD = 14;
  var FURNITURE = ".map-timebar, .zoom-ctl, .map-legend, .map-layers-btn";

  function usableBox(popRect) {
    var box = map.getContainer().getBoundingClientRect();
    var u = { left: box.left + POP_PAD, right: box.right - POP_PAD,
              top: box.top + POP_PAD, bottom: box.bottom - POP_PAD };
    var shell = map.getContainer().parentElement;
    if (!shell) return u;
    // Only furniture the card actually runs into counts -- the legend sits
    // bottom-left and the zoom cluster bottom-right, and a centred card often
    // passes between them.
    shell.querySelectorAll(FURNITURE).forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (!r.height || r.right <= popRect.left || r.left >= popRect.right) return;
      if (r.top > box.top + box.height / 2) u.bottom = Math.min(u.bottom, r.top - 8);
      else u.top = Math.max(u.top, r.bottom + 8);
    });
    return u;
  }

  function fits(r, u) { return r.top >= u.top && r.bottom <= u.bottom; }

  function keepPopupInside() {
    var el = activePopup && activePopup.getElement();
    if (!el) return;
    var pop = el.getBoundingClientRect();
    var u = usableBox(pop);

    var dx = 0;
    if (pop.left < u.left) dx = pop.left - u.left;
    else if (pop.right > u.right) dx = Math.min(pop.right - u.right, pop.left - u.left);
    if (dx) { map.panBy([dx, 0], { animate: false }); pop = el.getBoundingClientRect(); }
    if (fits(pop, u)) return;

    var dy = pop.top < u.top ? pop.top - u.top
                             : Math.min(pop.bottom - u.bottom, pop.top - u.top);
    if (dy) { map.panBy([0, dy], { animate: false }); pop = el.getBoundingClientRect(); }
    if (fits(pop, u)) return;

    // The pan was refused or was not enough. Try the other side of the point.
    var wasAbove = !el.classList.contains("pop-below");
    activePopup.options.offset = wasAbove ? L.point(0, pop.height + 18) : L.point(0, -4);
    el.classList.toggle("pop-below", wasAbove);
    activePopup.update();
    if (!fits(el.getBoundingClientRect(), u)) {
      // Neither side clears it; keep the original placement rather than a
      // flipped card that is just as clipped.
      activePopup.options.offset = wasAbove ? L.point(0, -4) : L.point(0, pop.height + 18);
      el.classList.toggle("pop-below", !wasAbove);
      activePopup.update();
    }
  }

  /* Delegated, not bound to the buttons themselves: Leaflet rebuilds a popup's
     content node whenever the popup is re-rendered -- which is exactly what
     flipping the card below its point does -- and a handler assigned to the old
     button goes with it. The container outlives every card. */
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest("#qcClose")) {
      hideSheet();
      if (activePopup) map.closePopup(activePopup);
      else { activeEvent = null; state.selectedId = null; setPulse(null); }
      return;
    }
    if (t.closest("#qcDetails") && activeEvent) openDetail(activeEvent);
  });

  map.on("popupclose", function (ev) {
    if (ev.popup === activePopup) {
      activePopup = null;
      activeEvent = null;
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
      '<div class="qc-row"><span class="k">Region</span><span>' + (e.region || e.group) + "</span></div>" +
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
    var body = document.getElementById("eqTableBody");
    if (!EQ.loaded || EQ.catalogRegion !== state.mapRegion) {
      lastTableRows = [];
      body.innerHTML = '<tr class="eq-loading"><td colspan="4">Loading ' +
        (state.mapRegion === "japan" ? "Japan" : "global") + ' earthquakes…</td></tr>';
      return;
    }
    var baseCount = window.WEL && WEL.embed ? 14 : 5;
    var want = state.expandedTable ? (baseCount === 5 ? 25 : 40) : baseCount;
    var rows;
    if (objectCacheCovers()) {
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
    body.innerHTML = rows.map(function (e) {
      var timeStr = window.WEL && WEL.embed ? EQ.fmtList(e.t) : EQ.fmtShort(e.t);
      return "<tr data-id=\"" + e.id + "\" style=\"cursor:pointer\">" +
        '<td class="mag' + (e.m >= 6 ? " big" : "") + '">M&nbsp;&nbsp;' + e.m.toFixed(1) + "</td>" +
        "<td>" + e.loc + "</td>" +
        "<td>" + timeStr + "</td>" +
        '<td class="right">' + e.depth + " km</td></tr>";
    }).join("") || '<tr class="eq-loading"><td colspan="4">No earthquakes in this period.</td></tr>';
    Array.prototype.forEach.call(document.querySelectorAll("#eqTableBody tr[data-id]"), function (tr) {
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

  function setRange(startMs, endMs, live, from3d) {
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
    if (!from3d) sync3dDates();
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
    if (!document.getElementById("mapShell").classList.contains("mode-3d")) return;
    x3(function (doc, w) {
      var a = doc.getElementById("in-date-a");
      var b = doc.getElementById("in-date-b");
      if (!a || !b) return;
      // Both inputs share the same change handler in the 3D app. Update them
      // together and fire it once, while preventing this host-driven sync from
      // being echoed back as a user-created Custom period.
      w.__welHostPeriodSync = true;
      try {
        a.value = isoUTC(state.startMs);
        b.value = isoUTC(state.endMs);
        b.dispatchEvent(new w.Event("change", { bubbles: true }));
      } finally {
        w.__welHostPeriodSync = false;
      }
    });
  }

  // Timeline grips live inside the same-origin 3D iframe. Apply their newest
  // range once per animation frame so the host dates / Period selector follow
  // smoothly without echoing the change back into the iframe.
  var pending3dPeriod = null;
  var pending3dPeriodFrame = 0;
  window.addEventListener("message", function (ev) {
    if (!frame3d || ev.source !== frame3d.contentWindow) return;
    if (location.origin !== "null" && ev.origin !== location.origin) return;
    var msg = ev.data;
    if (!msg || msg.type !== "wel:3d-period") return;
    var startMs = Number(msg.startMs), endMs = Number(msg.endMs);
    if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return;
    pending3dPeriod = [startMs, endMs];
    if (pending3dPeriodFrame) return;
    pending3dPeriodFrame = requestAnimationFrame(function () {
      pending3dPeriodFrame = 0;
      var range = pending3dPeriod;
      pending3dPeriod = null;
      if (range) setRange(range[0], range[1], false, true);
    });
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
    if (sharedApplyTimer) { clearTimeout(sharedApplyTimer); sharedApplyTimer = null; }
    renderQuakes();
    renderTable();
    updateFilterBadge();
    push3dShared();
  }

  var sharedApplyTimer = null;
  function scheduleSharedApply() {
    if (sharedApplyTimer) clearTimeout(sharedApplyTimer);
    sharedApplyTimer = setTimeout(function () {
      sharedApplyTimer = null;
      applyShared();
    }, 55);
  }

  /* mirror the shared filters into the 4D app (magnitude range, bands, depth) */
  function push3dShared() {
    if (!document.getElementById("mapShell").classList.contains("mode-3d")) return;
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
      updateFilterBadge();
      scheduleSharedApply();
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

  setRange(Date.parse("1900-01-01T00:00:00Z"), Date.now(), false);

  // Open the full-catalog 3D globe by default, unless the console requested
  // the 2D child route before this embedded page finished booting.
  var initialDim = location.hash === "#2d" ? "2d" : "3d";
  document.querySelector('#dimToggle button[data-dim="' + initialDim + '"]').click();

  var dm = (location.hash || "").match(/^#d(\d+)$/); // deep-link: #d365 = 1y window
  if (dm) setPresetDays(+dm[1], false);

  if (location.hash === "#pop") { // debug/deep-link: open the largest recent event's card
    var big = filtered().reduce(function (a, b) { return (!a || b.m > a.m) ? b : a; }, null);
    if (big) select(big, true);
  }

  if (location.hash === "#3d-filters") {
    document.getElementById("filtersPanel").classList.add("open");
    setTimeout(refresh3dFilters, 2500);
    setTimeout(refresh3dFilters, 8000);
  }
  });
})();
