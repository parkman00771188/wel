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

  /* language switcher — pages inside the console load with the same language */
  var langSel = document.getElementById("langSelect");
  langSel.value = LANG;
  langSel.addEventListener("change", function () {
    try { localStorage.setItem("wel-lang", this.value); } catch (e) { /* ignore */ }
    if (location.search) location.replace(location.pathname + location.hash);
    else location.reload();
  });

  var current = null;

  function activate(view, pushHash) {
    if (!VIEWS[view]) view = "overview";
    if (view === current) return;
    current = view;

    document.querySelectorAll("#appNav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.view === view);
    });
    document.getElementById("appTitle").textContent = VIEWS[view].title;

    Object.keys(VIEWS).forEach(function (v) {
      var frame = document.getElementById("frame-" + v);
      var on = v === view;
      frame.classList.toggle("active", on);
      if (on && !frame.getAttribute("src")) {
        frame.src = VIEWS[v].src + (LANG !== "en" ? "&lang=" + LANG : ""); // lazy-load
      }
    });

    if (pushHash !== false && location.hash !== "#" + view) {
      try { history.replaceState(null, "", "#" + view); } catch (e) { location.hash = view; }
    }
  }

  document.getElementById("appNav").addEventListener("click", function (ev) {
    var a = ev.target.closest("a[data-view]");
    if (!a) return;
    ev.preventDefault();
    activate(a.dataset.view);
  });

  window.addEventListener("hashchange", function () {
    activate((location.hash || "#overview").slice(1), false);
  });

  // pages inside iframes ask the console to switch tabs
  window.addEventListener("message", function (ev) {
    if (ev.data && ev.data.wel === "nav" && VIEWS[ev.data.view]) activate(ev.data.view);
  });

  /* ---------- catalog freshness chip (next to LIVE) ---------- */

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

  function fetchMeta() {
    fetch("3d/data/global/meta.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (m) { updatedAt = Date.parse(m.generated_utc); renderUpdated(); })
      .catch(function () { /* offline — keep last value */ });
  }
  fetchMeta();
  setInterval(fetchMeta, 10 * 60e3);
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

  activate((location.hash || "#overview").slice(1), false);
})();
