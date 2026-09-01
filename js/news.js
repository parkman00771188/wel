/* World Earthquake Labs — news & updates page

   The feed is real coverage, collected by scripts/update_content.py on the
   same 30-minute cycle as the earthquake data and committed to
   data/news.json. Nothing here is generated from the catalogue, so the page
   does not wait on the 13 MB band download to render. */
(function () {
  "use strict";

  var FEED_PATH = "data/news.json";
  var CATEGORIES = ["all", "event", "research", "network"];

  var feed = document.getElementById("newsFeed");
  var items = [];
  var current = "all";

  function timeAgo(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";
    var s = Math.max(60, (Date.now() - t) / 1000);
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 14) return Math.round(s / 86400) + " d ago";
    var d = new Date(t);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render() {
    var rows = current === "all"
      ? items
      : items.filter(function (n) { return n.cat === current; });

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

  function selectCategory(cat, writeHash) {
    current = CATEGORIES.indexOf(cat) === -1 ? "all" : cat;
    document.querySelectorAll("#newsFilter button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.cat === current);
    });
    render();
    if (writeHash) {
      try { history.replaceState(null, "", "#" + current); } catch (e) { /* ignore */ }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "news", sub: current }, "*");
    }
  }

  document.getElementById("newsFilter").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (b) selectCategory(b.dataset.cat, true);
  });

  window.addEventListener("hashchange", function () {
    selectCategory((location.hash || "#all").slice(1), false);
  });

  feed.innerHTML = '<p class="news-empty">Loading coverage…</p>';

  fetch(FEED_PATH, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error(FEED_PATH + " -> HTTP " + r.status);
      return r.json();
    })
    .then(function (payload) {
      items = (payload && payload.items) || [];
      // A filter that can only ever show "nothing here" is worse than no
      // filter, so tabs appear only once the feed has something for them.
      document.querySelectorAll("#newsFilter button").forEach(function (button) {
        var cat = button.dataset.cat;
        button.hidden = cat !== "all" && !items.some(function (n) { return n.cat === cat; });
      });
      selectCategory((location.hash || "#all").slice(1), false);
    })
    .catch(function (err) {
      console.error("news feed unavailable:", err);
      feed.innerHTML = '<p class="news-empty">Coverage is not available right now.</p>';
    });
})();
