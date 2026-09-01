/* World Earthquake Labs — research hub publications

   Real papers, not placeholders: scripts/update_content.py pulls the most
   cited decade of OpenAlex topic T13018 ("Seismology and Earthquake Studies")
   on the same 30-minute cycle as the earthquake data and widens the archive a
   page at a time, so this list keeps growing on its own. */
(function () {
  "use strict";

  var PAPERS_PATH = "data/papers.json";
  var PAGE = 6;

  var grid = document.getElementById("pubGrid");
  var moreRow = document.getElementById("pubMoreRow");
  var moreBtn = document.getElementById("pubMore");
  var countEl = document.getElementById("pubCount");
  var sourceEl = document.getElementById("pubSource");
  if (!grid) return;

  var items = [];
  var shown = 0;

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

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
    var body = '<div class="pub-title">' + escapeHTML(p.title) + "</div>"
      + (p.authors ? '<div class="pub-authors">' + escapeHTML(p.authors) + "</div>" : "")
      + (meta ? '<div class="pub-meta">' + meta + "</div>" : "")
      + (cites || oa ? '<div class="pub-badges">' + cites + oa + "</div>" : "");
    return p.url
      ? '<a class="pub" href="' + escapeHTML(p.url) + '" target="_blank" rel="noopener">' + body + "</a>"
      : '<div class="pub">' + body + "</div>";
  }

  function draw() {
    grid.innerHTML = items.slice(0, shown).map(card).join("");
    moreRow.hidden = shown >= items.length;
  }

  moreBtn.addEventListener("click", function () {
    shown = Math.min(shown + PAGE, items.length);
    draw();
  });

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
        sourceEl.textContent = "OpenAlex · most cited of the last "
          + (payload.window_years || 10) + " years";
      }
      shown = Math.min(PAGE, items.length);
      draw();
    })
    .catch(function (err) {
      console.error("publications unavailable:", err);
      grid.innerHTML = '<p class="pub-empty">Publications are not available right now.</p>';
    });
})();
