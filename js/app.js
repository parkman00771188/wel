/* World Earthquake Labs — platform console shell */
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

  // js/i18n.js has already resolved and validated this against the list of
  // languages that actually ship; duplicating that list here is how the two
  // drift apart.
  var LANG = (window.WEL_I18N && WEL_I18N.lang) || "en";
  var LOCALE = { en: "en-US", zh: "zh-CN", fil: "fil-PH" }[LANG] || LANG;

  var VIEWS = {
    overview: { title: "Dashboard Overview", src: "dashboard.html?embed=1" },
    map: { title: "Live Earthquake Map", src: "map.html?embed=1" },
    learn: {
      title: "Earthquake Guide",
      src: "/learn?embed=1",
      /* The guide is nine pages plus a hub, not one page with tabs, so a
         subview here is a URL rather than a fragment. */
      subUrl: {
        overview: "/learn?embed=1",
        basics: "/guide/earthquake-basics?embed=1",
        plates: "/guide/plate-tectonics?embed=1",
        measuring: "/guide/measuring-earthquakes?embed=1",
        magnitude: "/guide/magnitude-and-intensity?embed=1",
        hazards: "/guide/earthquake-hazards?embed=1",
        history: "/guide/notable-earthquakes?embed=1",
        terms: "/guide/earthquake-glossary?embed=1",
        faq: "/guide/earthquake-faq?embed=1",
        safety: "/guide/earthquake-safety?embed=1"
      }
    },
    insights: { title: "Seismic Insights", src: "insights.html?embed=1" },
    research: { title: "Research Hub", src: "research.html?embed=1" },
    news: { title: "News & Updates", src: "news.html?embed=1" }
  };

  /* Read off the sidebar rather than repeated here. The two had to agree, and
     when they stopped agreeing -- three sections added to the Earthquake Guide
     and to the sidebar, but not to this list -- validSubview rejected them, so
     the sidebar quietly refused to follow the page and the route dropped them
     from the URL. Deriving it means adding a link is the only step. This script
     is the last thing in the body, so the markup is there to read. */
  var SUBVIEWS = {};
  var DEFAULT_SUBVIEW = {};
  Array.prototype.forEach.call(
    document.querySelectorAll("a[data-parent-view][data-subview]"),
    function (a) {
      var parent = a.dataset.parentView;
      if (!SUBVIEWS[parent]) { SUBVIEWS[parent] = []; DEFAULT_SUBVIEW[parent] = a.dataset.subview; }
      if (SUBVIEWS[parent].indexOf(a.dataset.subview) === -1) SUBVIEWS[parent].push(a.dataset.subview);
    });

  /* language switcher — pages inside the console load with the same language */
  var langSel = document.getElementById("langSelect");
  ((window.WEL_I18N && WEL_I18N.langs) || [["en", "English"]]).forEach(function (l) {
    var o = document.createElement("option");
    o.value = l[0];
    o.textContent = l[1];
    langSel.appendChild(o);
  });
  langSel.value = LANG;
  langSel.addEventListener("change", function () {
    try { localStorage.setItem("wel-lang", this.value); } catch (e) { /* ignore */ }
    if (location.search) location.replace(location.pathname + location.hash);
    else location.reload();
  });

  var current = null;
  var currentSub = {};

  /* Loaded views stay mounted so returning to them is instant. Tell each child
     whether it is actually on screen, because display:none does not make a
     same-origin iframe's document hidden and expensive render loops otherwise
     keep running behind the active view. */
  function reportViewActive(frame) {
    if (!frame.getAttribute("src") || !frame.contentWindow) return;
    frame.contentWindow.postMessage({
      wel: "view-active",
      view: frame.id.slice("frame-".length),
      active: frame.classList.contains("active")
    }, "*");
  }

  document.querySelectorAll(".app-frame").forEach(function (frame) {
    // Re-send after the child has installed its listeners. This also covers a
    // quick navigation away while the iframe is still loading.
    frame.addEventListener("load", function () { reportViewActive(frame); });
  });

  /* ---------- phone sidebar drawer ----------
     Below 760px the sidebar leaves the grid and slides in over the content:
     a 66px icon rail is a sixth of a phone screen, and the console has no
     width to spare. Everything that changes the view also closes it. */

  var side = document.getElementById("appSide");
  var scrim = document.getElementById("appScrim");
  var burger = document.getElementById("appBurger");

  function drawerOpen() { return document.body.classList.contains("app-drawer-open"); }

  function setDrawer(open) {
    document.body.classList.toggle("app-drawer-open", open);
    side.classList.toggle("open", open);
    scrim.hidden = !open;
    // The scrim fades, so it needs a frame between being displayed and being
    // told to become opaque -- otherwise the transition never runs.
    if (open) requestAnimationFrame(function () { scrim.classList.add("on"); });
    else scrim.classList.remove("on");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  burger.addEventListener("click", function () { setDrawer(!drawerOpen()); });
  scrim.addEventListener("click", function () { setDrawer(false); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && drawerOpen()) setDrawer(false);
  });
  // Back on a wide screen the sidebar is part of the grid again; a leftover
  // open state would otherwise keep the scrim and the scroll lock around.
  window.matchMedia("(min-width: 761px)").addEventListener("change", function (ev) {
    if (ev.matches && drawerOpen()) setDrawer(false);
  });

  function validSubview(view, sub) {
    return !!(sub && SUBVIEWS[view] && SUBVIEWS[view].indexOf(sub) !== -1);
  }

  function parseRoute() {
    var route = (location.hash || "#overview").slice(1).split("/");
    return { view: route[0] || "overview", sub: route[1] || null };
  }

  function routeHash(view, sub) {
    return "#" + view + (validSubview(view, sub) ? "/" + sub : "");
  }

  function paintNav(view, sub) {
    document.querySelectorAll("#appNav .app-nav-group").forEach(function (group) {
      var on = group.dataset.navGroup === view;
      group.classList.toggle("open", on && group.classList.contains("has-subnav"));
      var main = group.querySelector("a[data-view]");
      if (main) {
        main.classList.toggle("active", on);
        if (main.hasAttribute("aria-expanded")) main.setAttribute("aria-expanded", on ? "true" : "false");
      }
    });
    document.querySelectorAll("#appNav a[data-subview]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.parentView === view && a.dataset.subview === sub);
    });
  }

  function activate(view, pushHash, sub) {
    if (drawerOpen()) setDrawer(false);
    if (!VIEWS[view]) view = "overview";
    if (!validSubview(view, sub)) sub = currentSub[view] || DEFAULT_SUBVIEW[view] || null;
    if (validSubview(view, sub)) currentSub[view] = sub;
    current = view;

    paintNav(view, sub);
    document.getElementById("appTitle").textContent = VIEWS[view].title;

    Object.keys(VIEWS).forEach(function (v) {
      var frame = document.getElementById("frame-" + v);
      var on = v === view;
      frame.classList.toggle("active", on);
      var byUrl = VIEWS[v].subUrl;
      if (on && byUrl) {
        // A view whose subviews are separate pages: navigate, but only when the
        // frame is not already showing the one asked for -- a page announcing
        // itself on load would otherwise send us round again.
        var want = byUrl[validSubview(v, sub) ? sub : DEFAULT_SUBVIEW[v]] || VIEWS[v].src;
        if (frame.dataset.sub !== sub || !frame.getAttribute("src")) {
          frame.dataset.sub = sub;
          frame.src = want + (LANG !== "en" ? "&lang=" + LANG : "");
        }
      } else if (on && !frame.getAttribute("src")) {
        frame.src = VIEWS[v].src + (LANG !== "en" ? "&lang=" + LANG : "") +
          (validSubview(v, sub) ? "#" + sub : ""); // lazy-load at the requested child view
      } else if (on && validSubview(v, sub)) {
        try {
          if (frame.contentWindow.location.hash !== "#" + sub) frame.contentWindow.location.hash = sub;
        } catch (e) { /* same-origin iframe is expected */ }
      }
      reportViewActive(frame);
    });

    var nextHash = routeHash(view, sub);
    if (pushHash !== false && location.hash !== nextHash) {
      try { history.replaceState(null, "", nextHash); } catch (e) { location.hash = nextHash.slice(1); }
    }
  }

  on("appNav", "click", function (ev) {
    var child = ev.target.closest("a[data-subview]");
    if (child) {
      ev.preventDefault();
      activate(child.dataset.parentView, true, child.dataset.subview);
      return;
    }
    var a = ev.target.closest("a[data-view]");
    if (!a) return;
    ev.preventDefault();
    var group = a.closest(".app-nav-group");
    // Parent rows disclose their choices; only a child choice changes the view.
    if (group && group.classList.contains("has-subnav")) {
      var open = !group.classList.contains("open");
      group.classList.toggle("open", open);
      a.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    activate(a.dataset.view, true, currentSub[a.dataset.view] || DEFAULT_SUBVIEW[a.dataset.view]);
  });

  window.addEventListener("hashchange", function () {
    var route = parseRoute();
    activate(route.view, false, route.sub);
  });

  // pages inside iframes ask the console to switch tabs
  window.addEventListener("message", function (ev) {
    if (ev.data && ev.data.wel === "nav" && VIEWS[ev.data.view]) activate(ev.data.view);
    if (ev.data && ev.data.wel === "subnav-active" && VIEWS[ev.data.view] &&
        validSubview(ev.data.view, ev.data.sub)) {
      // Record it before activating, so a page reporting the section it just
      // loaded is not answered by loading that section again.
      var f = document.getElementById("frame-" + ev.data.view);
      if (f && VIEWS[ev.data.view].subUrl) f.dataset.sub = ev.data.sub;
      activate(ev.data.view, true, ev.data.sub);
    }
  });

  /* ---------- sidebar ad ----------
     Wide screens only in practice: below 760px this slot lives inside the
     drawer, and js/common.js puts an anchor bar at the bottom of the viewport
     instead. Both ids live together in WEL.AD. */

  WEL.mountAd(document.getElementById("adSlot"), WEL.AD.sidebar);

  /* ---------- catalog freshness chip ---------- */

  var updatedAt = null;

  function agoText(ms) {
    var m = Math.max(1, Math.round((Date.now() - ms) / 60e3));
    // Ordinary UI copy: the dictionary translates it into every language,
    // where an inline branch only ever covered two.
    return "Updated " + (m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago");
  }

  function renderUpdated() {
    document.querySelectorAll(".app-updated").forEach(function (el) {
      el.hidden = !updatedAt;
      if (updatedAt) el.textContent = agoText(updatedAt);
    });
  }

  function fetchStamp(url) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { return (m && Date.parse(m.generated_utc)) || 0; })
      .catch(function () { return 0; }); // offline — keep the last value
  }

  /* The live overlay is republished every 10 minutes, the archive only on a
     full rebuild, so the newer of the two is what "updated" actually means. */
  function fetchMeta() {
    Promise.all([
      fetchStamp("3d/data/live/global.json"),
      fetchStamp("3d/data/global/meta.json")
    ]).then(function (stamps) {
      var newest = Math.max(stamps[0], stamps[1]);
      if (newest) { updatedAt = newest; renderUpdated(); }
    });
  }
  fetchMeta();
  setInterval(fetchMeta, 5 * 60e3);
  setInterval(renderUpdated, 60e3);

  /* ---------- UTC clock ---------- */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Intl knows how ten languages write a date; a lookup table here would only
  // know two. The literal below is the fallback for a browser without it.
  var DFMT = (function () {
    try {
      return new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
    } catch (e) { return null; }
  })();
  function dateFmt(Y, M, D) {
    if (DFMT) { try { return DFMT.format(Date.UTC(Y, M, D)); } catch (e) { /* fall through */ } }
    return MON[M] + " " + D + ", " + Y;
  }
  function p2(x) { return (x < 10 ? "0" : "") + x; }
  function tick() {
    // The clock reads whichever zone the header is set to, like every other
    // time on the site -- a UTC clock beside a local-time table is the exact
    // confusion the setting exists to remove.
    var utc = !(window.WEL && WEL.tz) || !WEL.tz.isLocal;
    var d = new Date();
    var Y = utc ? d.getUTCFullYear() : d.getFullYear();
    var M = utc ? d.getUTCMonth() : d.getMonth();
    var D = utc ? d.getUTCDate() : d.getDate();
    var hms = p2(utc ? d.getUTCHours() : d.getHours()) + ":"
      + p2(utc ? d.getUTCMinutes() : d.getMinutes()) + ":"
      + p2(utc ? d.getUTCSeconds() : d.getSeconds());
    var zone = (window.WEL && WEL.tz) ? WEL.tz.label() : "UTC";
    document.getElementById("appClock").textContent = dateFmt(Y, M, D) + " " + hms + " " + zone;
  }
  setInterval(tick, 1000);
  window.addEventListener("wel:tz", tick);
  tick();

  var initialRoute = parseRoute();
  activate(initialRoute.view, false, initialRoute.sub);
})();
