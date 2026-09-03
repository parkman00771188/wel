/* World Earthquake Labs — research hub

   Two things live here and both are real. The publications come from
   OpenAlex, pulled by scripts/update_content.py on the same 10-minute cycle
   as the earthquake data and widened a page at a time, so the list grows on
   its own. The data sources are the catalogues and feeds the rest of the site
   actually reads — counts included, taken from the archive metadata rather
   than typed in. */
(function () {
  "use strict";

  var PAPERS_PATH = "data/papers.json";
  var GLOBAL_META = "3d/data/global/meta.json";
  var PAGE = 6;

  /* Everything the site reads. The two big row counts are filled in from the
     archive metadata once it loads; the rest does not change. */
  var SOURCES = [
    { name: "USGS ANSS ComCat", tag: "Earthquake catalogue",
      url: "https://earthquake.usgs.gov/earthquakes/search/",
      note: "Worldwide, M2.0+. Also the live overlay: the last 14 days are refetched every 10 minutes so revised magnitudes and withdrawn events land here too.",
      countKey: "usgs" },
    { name: "ISC Bulletin", tag: "Earthquake catalogue",
      url: "https://www.isc.ac.uk/iscbulletin/",
      note: "Reviewed, M3.0+, back to 1900. Publication lags the present by about two years, which is why the recent tail of the archive is USGS-derived.",
      countKey: "isc" },
    { name: "JMA", tag: "Earthquake catalogue",
      url: "https://www.jma.go.jp/jma/en/menu.html",
      note: "Japan and its surrounding seas, down to M1.5 — events USGS does not publish at all. Roughly a hundred JMA rows to forty USGS ones in a typical fortnight." },
    { name: "GEM Global Active Faults", tag: "Reference layer",
      url: "https://github.com/GEMScienceTools/gem-global-active-faults",
      note: "Fault traces drawn on both the 2D map and the globe." },
    { name: "Smithsonian Global Volcanism Program", tag: "Reference layer",
      url: "https://volcano.si.edu/",
      note: "Holocene volcanoes, shown as an optional layer." },
    { name: "Natural Earth", tag: "Reference layer",
      url: "https://www.naturalearthdata.com/",
      note: "Coastlines, plate boundaries and administrative borders." },
    { name: "NASA GIBS · Blue Marble", tag: "Basemap",
      url: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api",
      note: "The satellite imagery on the globe and the Japan surface." },
    { name: "OpenAlex", tag: "Literature",
      url: "https://openalex.org/",
      note: "Topics T10110 and T13018 — core seismology and the machine-learning stream — the source of the publication list on this page." }
  ];

  var grid = document.getElementById("pubGrid");
  if (!grid) return;
  var moreRow = document.getElementById("pubMoreRow");
  var moreBtn = document.getElementById("pubMore");
  var sortSel = document.getElementById("pubSort");
  var countEl = document.getElementById("pubCount");
  var sourceEl = document.getElementById("pubSource");

  var items = [];      // every paper the store holds
  var listed = [];     // the ones that match the search box, in the chosen order
  var shown = 0;
  var searchEl = document.getElementById("pubSearch");
  var matchEl = document.getElementById("pubMatch");

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- view switching ---------- */

  var VIEWS = ["overview", "publications", "sources"];

  function selectView(name, writeHash) {
    if (VIEWS.indexOf(name) === -1) name = "overview";
    var all = name === "overview";
    document.getElementById("viewPubs").hidden = !all && name !== "publications";
    document.getElementById("viewSources").hidden = !all && name !== "sources";
    // The stat strip is a summary of the whole hub, so it belongs to Overview.
    document.getElementById("resStats").hidden = !all;

    document.querySelectorAll(".side-nav a[data-subview]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.subview === name);
    });
    if (writeHash) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "research", sub: name }, "*");
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

  /* ---------- publications ---------- */

  var SORTS = {
    cited: function (a, b) { return (b.cited || 0) - (a.cited || 0); },
    newest: function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); },
    oldest: function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); },
    title: function (a, b) { return String(a.title || "").localeCompare(String(b.title || "")); }
  };

  function whenPublished(p) {
    if (!p.date) return p.year ? String(p.year) : "";
    var d = new Date(p.date + "T00:00:00Z");
    if (isNaN(d)) return p.year ? String(p.year) : "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
  }

  function card(p) {
    var meta = [p.venue, whenPublished(p)].filter(Boolean).map(escapeHTML).join(" &nbsp;&bull;&nbsp; ");
    var cites = p.cited
      ? '<span class="pub-cites">' + p.cited.toLocaleString() + " citations</span>"
      : "";
    var oa = p.open_access ? '<span class="pub-oa">Open access</span>' : "";
    // Papers in the recent pool are there for being new, not for being cited;
    // say so, or a card with no citation count looks like an oversight.
    var recent = p.recent ? '<span class="pub-recent">Recent</span>' : "";
    var body = '<div class="pub-title">' + escapeHTML(p.title) + "</div>"
      + (p.authors ? '<div class="pub-authors">' + escapeHTML(p.authors) + "</div>" : "")
      + (meta ? '<div class="pub-meta">' + meta + "</div>" : "")
      + (cites || oa || recent ? '<div class="pub-badges">' + recent + cites + oa + "</div>" : "");
    return p.url
      ? '<a class="pub" href="' + escapeHTML(p.url) + '" target="_blank" rel="noopener">' + body + "</a>"
      : '<div class="pub">' + body + "</div>";
  }

  function draw() {
    grid.innerHTML = listed.length
      ? listed.slice(0, shown).map(card).join("")
      : '<p class="pub-empty">No publications match that search.</p>';
    moreRow.hidden = shown >= listed.length;
    if (matchEl) {
      var q = searchEl && searchEl.value.trim();
      matchEl.hidden = !q;
      if (q) matchEl.textContent = listed.length === 1 ? "1 result" : listed.length.toLocaleString() + " results";
    }
  }

  /* Plain substring match over everything a reader might remember a paper by.
     Each word has to appear somewhere, in any field, in any order. */
  function haystack(p) {
    return [p.title, p.authors, p.venue, p.abstract, p.year].filter(Boolean).join(" \u0001 ").toLowerCase();
  }
  function matches(p, words) {
    var h = p._hay || (p._hay = haystack(p));
    for (var i = 0; i < words.length; i++) if (h.indexOf(words[i]) === -1) return false;
    return true;
  }

  function applySort() {
    var q = (searchEl && searchEl.value || "").trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    listed = words.length ? items.filter(function (p) { return matches(p, words); }) : items.slice();
    listed.sort(SORTS[sortSel.value] || SORTS.cited);
    // A new ordering or a new query is a new list; page four of it would be arbitrary.
    shown = Math.min(PAGE, listed.length);
    draw();
  }

  moreBtn.addEventListener("click", function () {
    shown = Math.min(shown + PAGE, listed.length);
    draw();
  });
  sortSel.addEventListener("change", applySort);
  if (searchEl) {
    var searchTimer = 0;
    searchEl.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applySort, 120);
    });
    searchEl.addEventListener("search", applySort);   // the clear button on the field
  }

  /* ---------- data sources ---------- */

  function drawSources(counts) {
    var host = document.getElementById("srcList");
    if (!host) return;
    host.innerHTML = SOURCES.map(function (s) {
      var rows = s.countKey && counts[s.countKey]
        ? '<span class="src-count">' + counts[s.countKey].toLocaleString() + " events</span>"
        : "";
      return '<a class="src-row" href="' + escapeHTML(s.url) + '" target="_blank" rel="noopener">'
        + '<div class="src-main">'
        + '<div class="src-name">' + escapeHTML(s.name) + "</div>"
        + '<div class="src-note">' + escapeHTML(s.note) + "</div></div>"
        + '<div class="src-side"><span class="src-tag">' + escapeHTML(s.tag) + "</span>" + rows + "</div>"
        + "</a>";
    }).join("");
    var n = document.getElementById("sourceCount");
    if (n) n.textContent = String(SOURCES.length);
  }

  /* ---------- boot ---------- */

  grid.innerHTML = '<p class="pub-empty">Loading publications…</p>';

  fetch(PAPERS_PATH, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error(PAPERS_PATH + " -> HTTP " + r.status);
      return r.json();
    })
    .then(function (payload) {
      items = (payload && payload.items) || [];
      if (!items.length) {
        grid.innerHTML = '<p class="pub-empty">No publications collected yet.</p>';
        return;
      }
      if (countEl) countEl.textContent = items.length.toLocaleString();
      if (sourceEl) {
        sourceEl.textContent = (payload.topics && payload.topics.length > 1)
          ? "OpenAlex \u00b7 two topics, the last " + (payload.window_years || 10) + " years of seismology."
          : "OpenAlex \u00b7 topic T13018, the last " + (payload.window_years || 10) + " years of seismology.";
      }
      applySort();
    })
    .catch(function (err) {
      console.error("publications unavailable:", err);
      grid.innerHTML = '<p class="pub-empty">Publications are not available right now.</p>';
    });

  fetch(GLOBAL_META, { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (meta) {
      var src = (meta && meta.sources) || {};
      drawSources({ usgs: src.usgs_rows, isc: src.isc_rows });
      var q = document.getElementById("quakeCount");
      if (q && meta && meta.count) {
        q.textContent = (meta.count / 1e6).toFixed(2) + "M";
      }
    })
    .catch(function () { drawSources({}); });

  selectView((location.hash || "#overview").slice(1), false);
})();
