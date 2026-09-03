/* World Earthquake Labs — news & updates page

   Three views, in the shape the Research Hub uses. Overview says what the
   ten-minute cycle brought in most recently -- news, papers and earthquake
   data, in one list with the kind of each row marked. News is the coverage
   feed as it was. Update Log lists every file the cycle writes and when it
   last wrote it.

   The feeds are their own JSON files, collected by scripts/update_content.py
   and committed to data/, so nothing here waits on the 13 MB earthquake bands. */
(function () {
  "use strict";

  /* A page and its scripts can disagree for as long as a browser holds an old
     copy of one of them. Binding through here degrades a missing control to
     one that does not respond, instead of a throw that kills the module. */
  function on(id, type, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(type, fn);
    return el;
  }
  function byId(id) { return document.getElementById(id); }

  var LANG = (window.WEL_I18N && WEL_I18N.lang) || "en";
  var LOCALE = LANG === "fil" ? "fil-PH" : LANG;

  var NEWS_PATH = "data/news.json";
  var PAPERS_PATH = "data/papers.json";
  var LIVE_PATH = "3d/data/live/global.json";
  var META_PATH = "3d/data/global/meta.json";
  var CATEGORIES = ["all", "event", "research", "network"];
  // Overview takes the newest few of each kind, then merges them by time. A
  // single cap across kinds would fill the list with headlines, which arrive
  // hourly, and hide the papers, which arrive weekly.
  var OVERVIEW_CAP = { news: 8, paper: 4, quake: 99 };

  var feed = byId("newsFeed");
  var items = [];          // news rows
  var current = "all";     // news category
  var stores = { news: null, papers: null, live: null, meta: null };

  /* ---------- formatting ---------- */

  var DFMT = (function () {
    try { return new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }); }
    catch (e) { return null; }
  })();
  var TFMT = (function () {
    try { return new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }); }
    catch (e) { return null; }
  })();

  function timeAgo(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";
    var s = Math.max(60, (Date.now() - t) / 1000);
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 14) return Math.round(s / 86400) + " d ago";
    var d = new Date(t);
    return DFMT ? DFMT.format(d) : d.toISOString().slice(0, 10);
  }
  function stamp(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "—";
    return (TFMT ? TFMT.format(new Date(t)) : new Date(t).toISOString().slice(0, 16).replace("T", " ")) + " UTC";
  }
  // Always Western digits with comma groups: that is what the translation
  // engine's {n} pattern matches, whatever the language.
  function num(n) { return Number(n || 0).toLocaleString("en-US"); }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- view switching ---------- */

  var VIEWS = ["overview", "news", "log"];

  function selectView(name, writeHash) {
    // The old deep links were categories (#event, #research); they still land
    // on the feed, filtered.
    if (CATEGORIES.indexOf(name) !== -1) { current = name; name = "news"; }
    if (VIEWS.indexOf(name) === -1) name = "overview";
    byId("viewOverview").hidden = name !== "overview";
    byId("viewNews").hidden = name !== "news";
    byId("viewLog").hidden = name !== "log";
    byId("newsStats").hidden = name !== "overview";

    document.querySelectorAll(".side-nav a[data-subview]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.subview === name);
    });
    if (name === "news") paintCategory();
    if (writeHash) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "news", sub: name }, "*");
    }
  }

  document.querySelectorAll(".side-nav a[data-subview]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      selectView(a.dataset.subview, true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  window.addEventListener("hashchange", function () {
    selectView((location.hash || "#overview").slice(1), false);
  });

  /* ---------- the news feed ---------- */

  function renderFeed() {
    if (!feed) return;
    var rows = current === "all" ? items : items.filter(function (n) { return n.cat === current; });
    if (!rows.length) {
      feed.innerHTML = '<p class="news-empty">No updates in this category yet.</p>';
      return;
    }
    feed.innerHTML = rows.map(function (n) {
      var meta = '<div class="news-meta">'
        + '<span class="news-src">' + escapeHTML(n.source || "") + "</span>"
        + '<span class="news-time">' + timeAgo(n.published) + "</span></div>";
      var body = '<div class="nt">' + escapeHTML(n.title) + "</div>"
        + (n.desc ? '<div class="nd">' + escapeHTML(n.desc) + "</div>" : "")
        + meta;
      return n.url
        ? '<a class="news-row" href="' + escapeHTML(n.url) + '" target="_blank" rel="noopener">' + body + "</a>"
        : '<div class="news-row">' + body + "</div>";
    }).join("");
  }

  function paintCategory() {
    document.querySelectorAll("#newsFilter button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.cat === current);
    });
    renderFeed();
  }

  on("newsFilter", "click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    current = CATEGORIES.indexOf(b.dataset.cat) === -1 ? "all" : b.dataset.cat;
    paintCategory();
  });

  /* ---------- overview: the latest of everything ---------- */

  /* One row per thing the cycle brought in. A news item is dated by when the
     site first saw it, falling back to its publication time for rows written
     before that stamp existed; a paper likewise, because its publication
     date can be months before OpenAlex lists it. */
  function collectUpdates() {
    var rows = [];
    var news = stores.news, papers = stores.papers, live = stores.live, meta = stores.meta;

    (news && news.items || []).forEach(function (n) {
      var t = Date.parse(n.added_utc || n.published);
      if (isFinite(t)) rows.push({ kind: "news", t: t, title: n.title, by: n.source || "", url: n.url || "" });
    });
    (papers && papers.items || []).forEach(function (p) {
      if (!p.recent && !p.added_utc) return;        // the cited pool is not "new"
      var t = Date.parse(p.added_utc || p.date);
      if (isFinite(t)) rows.push({ kind: "paper", t: t, title: p.title, by: p.venue || "", url: p.url || "" });
    });
    if (live && live.generated_utc) {
      rows.push({ kind: "quake", t: Date.parse(live.generated_utc),
        title: "Live earthquake overlay refreshed: " + num(live.count) + " events in the last 14 days", by: "USGS", url: "map#3d" });
    }
    if (meta && meta.generated_utc) {
      rows.push({ kind: "quake", t: Date.parse(meta.generated_utc),
        title: "Earthquake catalogue rebuilt: " + num(meta.count) + " events since 1900", by: "USGS + ISC", url: "map" });
    }
    if (news && news.generated_utc) {
      // A feed's own refresh is filed under what the feed carries.
      rows.push({ kind: "news", t: Date.parse(news.generated_utc),
        title: "News feed refreshed: " + num(news.count || (news.items || []).length) + " items", by: "Google News + ScienceDaily", url: "#news" });
    }
    if (papers && papers.generated_utc) {
      rows.push({ kind: "paper", t: Date.parse(papers.generated_utc),
        title: "Publication list refreshed: " + num(papers.count || (papers.items || []).length) + " papers", by: "OpenAlex", url: "research#publications" });
    }
    rows.sort(function (a, b) { return b.t - a.t; });
    var taken = { news: 0, paper: 0, quake: 0 };
    return rows.filter(function (r) { return ++taken[r.kind] <= OVERVIEW_CAP[r.kind]; });
  }

  var KIND_LABEL = { news: "News", paper: "Paper", quake: "Earthquake" };

  function renderOverview() {
    var host = byId("updList");
    if (!host) return;
    var rows = collectUpdates();
    if (!rows.length) {
      host.innerHTML = '<p class="news-empty">No updates yet.</p>';
      return;
    }
    host.innerHTML = rows.map(function (r) {
      var tag = '<span class="upd-type ' + r.kind + '">' + KIND_LABEL[r.kind] + "</span>";
      var body = '<div class="upd-main"><div class="upd-title">' + escapeHTML(r.title) + "</div>"
        + (r.by ? '<div class="upd-by">' + escapeHTML(r.by) + "</div>" : "") + "</div>";
      var when = '<span class="upd-time">' + timeAgo(new Date(r.t).toISOString()) + "</span>";
      var inner = tag + body + when;
      if (!r.url) return '<div class="upd-row">' + inner + "</div>";
      var external = /^https?:/i.test(r.url);
      // A row that points at another page of this site opens that page as a
      // console tab when we are inside the console (common.js handles it);
      // a hash stays on this page.
      return '<a class="upd-row" href="' + escapeHTML(r.url) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + ">" + inner + "</a>";
    }).join("");
  }

  on("updList", "click", function (ev) {
    var a = ev.target.closest("a[href^='#']");
    if (!a) return;
    ev.preventDefault();
    selectView(a.getAttribute("href").slice(1), true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- update log ---------- */

  function renderLog() {
    var host = byId("logList");
    if (!host) return;
    var news = stores.news, papers = stores.papers, live = stores.live, meta = stores.meta;
    var rows = [
      { name: "Live earthquake overlay", file: LIVE_PATH, at: live && live.generated_utc,
        what: live ? num(live.count) + " events" : "" , by: "USGS ANSS ComCat" },
      { name: "Earthquake catalogue", file: META_PATH, at: meta && meta.generated_utc,
        what: meta ? num(meta.count) + " events" : "", by: "USGS + ISC" },
      { name: "News feed", file: NEWS_PATH, at: news && news.generated_utc,
        what: news ? num(news.count || (news.items || []).length) + " items" : "", by: "Google News + ScienceDaily" },
      { name: "Publication list", file: PAPERS_PATH, at: papers && papers.generated_utc,
        what: papers ? num(papers.count || (papers.items || []).length) + " papers" : "", by: "OpenAlex" }
    ];
    rows.sort(function (a, b) { return (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0); });
    host.innerHTML = rows.map(function (r) {
      return '<div class="log-row">'
        + '<div class="upd-main"><div class="upd-title">' + r.name + "</div>"
        + '<div class="upd-by">' + escapeHTML(r.by) + ' · <code>' + escapeHTML(r.file) + "</code></div></div>"
        + '<div class="log-side"><span class="log-when">' + (r.at ? stamp(r.at) : "—") + "</span>"
        + '<span class="upd-time">' + (r.at ? timeAgo(r.at) : "") + "</span>"
        + (r.what ? '<span class="src-tag">' + r.what + "</span>" : "") + "</div>"
        + "</div>";
    }).join("");
  }

  /* ---------- stats strip ---------- */

  function renderStats() {
    var news = stores.news, papers = stores.papers, live = stores.live;
    var set = function (id, v) { var el = byId(id); if (el) el.textContent = v; };
    if (news) set("statNews", num(news.count || (news.items || []).length));
    if (papers) set("statPapers", num(papers.count || (papers.items || []).length));
    if (live) set("statLive", num(live.count));
    var newest = 0;
    [news, papers, live, stores.meta].forEach(function (s) {
      var t = s && Date.parse(s.generated_utc);
      if (t && t > newest) newest = t;
    });
    if (newest) set("statUpdated", timeAgo(new Date(newest).toISOString()));
  }

  /* ---------- loading ---------- */

  function load(path) {
    return fetch(path, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(path + " -> HTTP " + r.status); return r.json(); })
      .catch(function (err) { console.error(path + " unavailable:", err); return null; });
  }

  if (feed) feed.innerHTML = '<p class="news-empty">Loading coverage…</p>';
  selectView((location.hash || "#overview").slice(1), false);

  // The news feed first: it is the page's own content, and small.
  load(NEWS_PATH).then(function (payload) {
    stores.news = payload;
    items = (payload && payload.items) || [];
    document.querySelectorAll("#newsFilter button").forEach(function (button) {
      var cat = button.dataset.cat;
      button.hidden = cat !== "all" && !items.some(function (n) { return n.cat === cat; });
    });
    if (!payload && feed) feed.innerHTML = '<p class="news-empty">Coverage is not available right now.</p>';
    else renderFeed();
    renderStats(); renderOverview(); renderLog();
  });
  Promise.all([load(PAPERS_PATH), load(LIVE_PATH), load(META_PATH)]).then(function (r) {
    stores.papers = r[0]; stores.live = r[1]; stores.meta = r[2];
    renderStats(); renderOverview(); renderLog();
  });
  setInterval(function () { renderStats(); renderOverview(); renderLog(); }, 60e3);
})();
