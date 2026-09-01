/* World Earthquake Labs — platform console shell */
(function () {
  "use strict";

  var LANG = new URLSearchParams(location.search).get("lang") || (function () {
    try { return localStorage.getItem("wel-lang") || "en"; } catch (e) { return "en"; }
  })();
  if (["en", "ja", "ko"].indexOf(LANG) === -1) LANG = "en";

  var VIEWS = {
    overview: { title: "Dashboard Overview", src: "dashboard.html?embed=1" },
    map: { title: "Live Earthquake Map", src: "map.html?embed=1" },
    learn: { title: "Earthquake Guide", src: "learn.html?embed=1" },
    insights: { title: "Seismic Insights", src: "insights.html?embed=1" },
    research: { title: "Research Hub", src: "research.html?embed=1" },
    news: { title: "News & Updates", src: "news.html?embed=1" }
  };

  var SUBVIEWS = {
    map: ["3d", "2d"],
    learn: ["overview", "basics", "plates", "magnitude", "terms", "faq", "safety"],
    insights: ["overview", "statistics", "magnitude", "depth", "regional", "energy", "forecast", "custom"],
    research: ["overview", "publications", "data-library", "datasets", "tools", "projects", "partners"],
    news: ["all", "event", "research", "network"]
  };
  var DEFAULT_SUBVIEW = { map: "3d", learn: "overview", insights: "overview", research: "overview", news: "all" };

  /* language switcher — pages inside the console load with the same language */
  var langSel = document.getElementById("langSelect");
  langSel.value = LANG;
  langSel.addEventListener("change", function () {
    try { localStorage.setItem("wel-lang", this.value); } catch (e) { /* ignore */ }
    if (location.search) location.replace(location.pathname + location.hash);
    else location.reload();
  });

  var current = null;
  var currentSub = {};

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
      if (on && !frame.getAttribute("src")) {
        frame.src = VIEWS[v].src + (LANG !== "en" ? "&lang=" + LANG : "") +
          (validSubview(v, sub) ? "#" + sub : ""); // lazy-load at the requested child view
      } else if (on && validSubview(v, sub)) {
        try {
          if (frame.contentWindow.location.hash !== "#" + sub) frame.contentWindow.location.hash = sub;
        } catch (e) { /* same-origin iframe is expected */ }
      }
    });

    var nextHash = routeHash(view, sub);
    if (pushHash !== false && location.hash !== nextHash) {
      try { history.replaceState(null, "", nextHash); } catch (e) { location.hash = nextHash.slice(1); }
    }
  }

  document.getElementById("appNav").addEventListener("click", function (ev) {
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
    if (a.dataset.view === current && group && group.classList.contains("has-subnav")) {
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
    if (LANG === "ko") return m < 60 ? m + "분 전 갱신" : Math.round(m / 60) + "시간 전 갱신";
    if (LANG === "ja") return m < 60 ? m + "分前更新" : Math.round(m / 60) + "時間前更新";
    return "Updated " + (m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago");
  }

  function renderUpdated() {
    var el = document.getElementById("appUpdated");
    if (!updatedAt) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = agoText(updatedAt);
  }

  function fetchStamp(url) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { return (m && Date.parse(m.generated_utc)) || 0; })
      .catch(function () { return 0; }); // offline — keep the last value
  }

  /* The live overlay is republished every half hour, the archive only on a
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
  function p2(x) { return (x < 10 ? "0" : "") + x; }
  function tick() {
    var d = new Date();
    var hms = p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + ":" + p2(d.getUTCSeconds());
    var out;
    if (LANG === "ko") {
      out = d.getUTCFullYear() + "년 " + (d.getUTCMonth() + 1) + "월 " + d.getUTCDate() + "일 " + hms + " UTC";
    } else if (LANG === "ja") {
      out = d.getUTCFullYear() + "年" + (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日 " + hms + " UTC";
    } else {
      out = MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() + " " + hms + " UTC";
    }
    document.getElementById("appClock").textContent = out;
  }
  setInterval(tick, 1000);
  tick();

  var initialRoute = parseRoute();
  activate(initialRoute.view, false, initialRoute.sub);
})();
