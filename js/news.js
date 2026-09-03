/* World Earthquake Labs — news & updates page

   Four views, in the shape the Research Hub uses. Overview merges the newest
   of everything the site collects -- headlines, papers, earthquakes -- into
   one list with the kind of each row marked. News is the coverage feed with
   its category chips, newest first. Papers is the newest papers the collector
   added. Earthquakes is the newest events in the live USGS overlay.

   The feeds are their own JSON files, collected by scripts/update_content.py
   and scripts/auto_update.py and committed to the repo, so nothing here waits
   on the 13 MB earthquake bands. */
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
  var OVERVIEW_CAP = { news: 8, paper: 4, quake: 4 };
  var OVERVIEW_MIN_MAG = 4.5;   // an overview row is an earthquake worth a headline
  var PAGE = 30;                // rows per page in the News, Papers and Earthquakes views

  var feed = byId("newsFeed");
  var items = [];          // news rows
  var current = "all";     // news category
  var quakeFloor = 0;      // Earthquakes view: minimum magnitude
  var page = { news: 0, papers: 0, quakes: 0 };   // current page per view
  var stores = { news: null, papers: null, live: null, meta: null };

  /* ---------- formatting ---------- */

  var DFMT = (function () {
    try { return new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }); }
    catch (e) { return null; }
  })();

  function timeAgo(t) {
    if (typeof t === "string") t = Date.parse(t);
    if (!isFinite(t)) return "";
    var s = Math.max(60, (Date.now() - t) / 1000);
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 14) return Math.round(s / 86400) + " d ago";
    var d = new Date(t);
    return DFMT ? DFMT.format(d) : d.toISOString().slice(0, 10);
  }
  function dateOf(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";
    return DFMT ? DFMT.format(new Date(t)) : String(iso).slice(0, 10);
  }
  // Always Western digits with comma groups: that is what the translation
  // engine's {n} pattern matches, whatever the language.
  function num(n) { return Number(n || 0).toLocaleString("en-US"); }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function magColor(m) {
    try { if (window.EQ && EQ.magColor) return EQ.magColor(m); } catch (e) { /* fall through */ }
    return m >= 6 ? "#e53935" : m >= 5 ? "#f4511e" : m >= 4 ? "#fb8c00" : m >= 3 ? "#ffb300" : "#ffd54f";
  }

  /* ---------- view switching ---------- */

  var VIEWS = ["overview", "news", "papers", "quakes"];

  function selectView(name, writeHash) {
    // Old deep links: the categories (#event, #research) land on the feed,
    // filtered; the retired #log lands on Overview.
    if (CATEGORIES.indexOf(name) !== -1) { current = name; name = "news"; }
    if (VIEWS.indexOf(name) === -1) name = "overview";
    byId("viewOverview").hidden = name !== "overview";
    byId("viewNews").hidden = name !== "news";
    byId("viewPapers").hidden = name !== "papers";
    byId("viewQuakes").hidden = name !== "quakes";
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
    paginate("news", feed, rows, function (n) {
      return row(kindPill("news", "News"), n.title, escapeHTML(n.source || ""), timeAgo(n.published), n.url);
    }, "No updates in this category yet.");
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
    page.news = 0;   // a new filter is a new list; page four of it would be arbitrary
    paintCategory();
  });

  /* ---------- paging ---------- */

  /* Thirty rows a page, with Previous / Next under the list. */
  function paginate(view, host, list, render, emptyText) {
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page[view] >= pages) page[view] = pages - 1;
    if (page[view] < 0) page[view] = 0;
    var start = page[view] * PAGE;
    var slice = list.slice(start, start + PAGE);
    var html = slice.length ? slice.map(render).join("") : '<p class="news-empty">' + emptyText + "</p>";
    if (pages > 1) {
      html += '<div class="upd-pager" data-view="' + view + '">'
        + '<button type="button" class="btn btn-outline" data-dir="-1"' + (page[view] === 0 ? " disabled" : "") + ">Previous</button>"
        + '<span class="upd-page">Page ' + (page[view] + 1) + " of " + pages + "</span>"
        + '<button type="button" class="btn btn-outline" data-dir="1"' + (page[view] === pages - 1 ? " disabled" : "") + ">Next</button>"
        + "</div>";
    }
    host.innerHTML = html;
  }
  var RENDER = {};   // view -> render function, filled below
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest(".upd-pager button[data-dir]");
    if (!b || b.disabled) return;
    var view = b.closest(".upd-pager").dataset.view;
    page[view] += Number(b.dataset.dir);
    if (RENDER[view]) RENDER[view]();
    var card = b.closest(".card");
    if (card) card.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  /* ---------- shared row markup ---------- */

  function row(pill, title, by, when, url) { return rowHTML(pill, escapeHTML(title), by, when, url); }
  function rowHTML(pill, titleHTML, by, when, url) {
    var body = '<div class="upd-main"><div class="upd-title">' + titleHTML + "</div>"
      + (by ? '<div class="upd-by">' + by + "</div>" : "") + "</div>";
    var inner = pill + body + '<span class="upd-time">' + when + "</span>";
    if (!url) return '<div class="upd-row">' + inner + "</div>";
    var external = /^https?:/i.test(url);
    // A row that points at another page of this site opens that page as a
    // console tab when we are inside the console (common.js handles it).
    return '<a class="upd-row" href="' + escapeHTML(url) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + ">" + inner + "</a>";
  }
  function kindPill(kind, label) { return '<span class="upd-type ' + kind + '">' + label + "</span>"; }
  /* The magnitude leads the title in the title's own dark type: the map's
     yellow for a M 2 or M 3 is unreadable as text on white. */
  function magHTML(m) { return "M " + Number(m).toFixed(1); }

  /* ---------- the three lists ---------- */

  function newestPapers() {
    var papers = stores.papers;
    // The recent pool is the newest papers from the major journals; a paper
    // is dated by when the site first saw it, falling back to its publication
    // date for rows written before that stamp existed.
    return ((papers && papers.items) || []).filter(function (p) { return p.recent || p.added_utc; })
      .map(function (p) { return { p: p, t: Date.parse(p.added_utc || p.date) || 0 }; })
      .sort(function (a, b) { return b.t - a.t; });
  }
  function newestQuakes(floor) {
    var live = stores.live;
    return ((live && live.events) || []).filter(function (e) { return e.magnitude >= floor; })
      .sort(function (a, b) { return b.time_ms - a.time_ms; });
  }
  // Each phrase is its own text node, so the engine can translate it alone.
  /* The map opens on this event. The query names the place and time; the
     id is a shortcut when the map's own list has the same event. The "./" is
     deliberate: js/common.js turns plain /map links into console tabs and
     would drop the query, and it does not match this form. */
  function quakeHref(e) {
    return "./map?focus=" + [e.latitude, e.longitude, e.time_ms, Math.round(e.depth_km || 0), e.magnitude].join(",")
      + "&fid=" + encodeURIComponent(e.id || "") + "#3d";
  }
  function quakeBy(e) { return "<span>Depth " + Math.round(e.depth_km || 0) + " km</span> · USGS"; }
  function paperBy(p) { return escapeHTML(p.venue || "") + (p.date ? " · " + dateOf(p.date) : ""); }

  function renderOverview() {
    var host = byId("updList");
    if (!host) return;
    var rows = [];
    ((stores.news && stores.news.items) || []).forEach(function (n) {
      var t = Date.parse(n.added_utc || n.published);
      if (isFinite(t)) rows.push({ kind: "news", t: t, html: row(kindPill("news", "News"), n.title, escapeHTML(n.source || ""), timeAgo(t), n.url) });
    });
    newestPapers().forEach(function (x) {
      rows.push({ kind: "paper", t: x.t, html: row(kindPill("paper", "Paper"), x.p.title, paperBy(x.p), timeAgo(x.t), x.p.url) });
    });
    newestQuakes(OVERVIEW_MIN_MAG).forEach(function (e) {
      rows.push({ kind: "quake", t: e.time_ms, html: rowHTML(kindPill("quake", "Earthquake"), magHTML(e.magnitude) + " \u00b7 " + escapeHTML(e.place || ""), quakeBy(e), timeAgo(e.time_ms), quakeHref(e)) });
    });
    rows.sort(function (a, b) { return b.t - a.t; });
    var taken = { news: 0, paper: 0, quake: 0 };
    rows = rows.filter(function (r) { return ++taken[r.kind] <= OVERVIEW_CAP[r.kind]; });
    host.innerHTML = rows.length ? rows.map(function (r) { return r.html; }).join("") : '<p class="news-empty">No updates yet.</p>';
  }

  function renderPapers() {
    var host = byId("paperList");
    if (!host) return;
    paginate("papers", host, newestPapers(), function (x) {
      var by = paperBy(x.p) + (x.p.open_access ? ' · <span class="pub-oa">Open access</span>' : "");
      return row(kindPill("paper", "Paper"), x.p.title, by, timeAgo(x.t), x.p.url);
    }, "No updates yet.");
  }

  function renderQuakes() {
    var host = byId("quakeList");
    if (!host) return;
    // The same Earthquake pill as the Overview, so the four views read alike.
    paginate("quakes", host, newestQuakes(quakeFloor), function (e) {
      var place = e.place || (Number(e.latitude).toFixed(1) + ", " + Number(e.longitude).toFixed(1));
      return rowHTML(kindPill("quake", "Earthquake"), magHTML(e.magnitude) + " \u00b7 " + escapeHTML(place), quakeBy(e), timeAgo(e.time_ms), quakeHref(e));
    }, "No earthquakes in the last 14 days.");
    var note = byId("quakeNote");
    if (note && stores.live) {
      note.innerHTML = "<span>Live overlay refreshed:</span> <span>" + timeAgo(stores.live.generated_utc) + "</span>"
        + (stores.meta ? " · <span>Catalogue rebuilt:</span> <span>" + dateOf(stores.meta.generated_utc) + "</span>" : "");
    }
  }

  on("quakeFilter", "click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    quakeFloor = Number(b.dataset.min) || 0;
    page.quakes = 0;
    document.querySelectorAll("#quakeFilter button").forEach(function (x) { x.classList.toggle("active", x === b); });
    renderQuakes();
  });

  /* Inside the console the link cannot navigate -- the map is another frame
     -- so the shell is asked to open the map on this event instead. */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest('a.upd-row[href^="./map?focus="]');
    if (!a || window.parent === window) return;
    ev.preventDefault();
    var u = new URL(a.getAttribute("href"), location.href);
    var p = (u.searchParams.get("focus") || "").split(",");
    window.parent.postMessage({ wel: "focus-quake", lat: p[0], lng: p[1], t: p[2], depth: p[3], m: p[4], id: u.searchParams.get("fid") }, "*");
  });

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
    if (newest) set("statUpdated", timeAgo(newest));
  }

  RENDER.news = renderFeed; RENDER.papers = renderPapers; RENDER.quakes = renderQuakes;
  function renderAll() { renderStats(); renderOverview(); renderPapers(); renderQuakes(); }

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
    renderAll();
  });
  Promise.all([load(PAPERS_PATH), load(LIVE_PATH), load(META_PATH)]).then(function (r) {
    stores.papers = r[0]; stores.live = r[1]; stores.meta = r[2];
    renderAll();
  });
  setInterval(renderAll, 60e3);
})();
