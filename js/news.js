/* World Earthquake Labs — news & updates page */
(function () {
  "use strict";

  EQ.ready.then(function () {

  function timeAgo(t) {
    var s = Math.max(60, (Date.now() - t) / 1000);
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 14) return Math.round(s / 86400) + " d ago";
    return EQ.fmtList(t) + " UTC";
  }

  var now = Date.now();

  /* thumbnails — earthquake-related photos (Wikimedia Commons / article images);
     rows without one show a "no image" state, and broken links fall back to it too */
  var WM = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  var IMGS = {
    sf1906: WM + "San%20Francisco%20Fire%20Sacramento%20Street%201906-04-18.jpg?width=480",
    fault: WM + "Kluft-photo-Carrizo-Plain-Nov-2007-Img%200327.jpg?width=480",
    chile: WM + "2010%20Chile%20earthquake%20-%20Building%20destroyed%20in%20Concepci%C3%B3n.jpg?width=480",
    seismo: WM + "Kinemetrics%20seismograph.jpg?width=480",
    seismogram: WM + "Seismogram%20at%20Weston%20Observatory.JPG?width=480",
    ajIndonesia: "https://www.aljazeera.com/wp-content/uploads/2026/08/epa_6a8138c804dd-1786853576.jpg"
  };

  var items = [];

  /* ---------- platform items generated from the live catalog ---------- */

  var recentBig = EQ.events
    .filter(function (e) { return e.t >= now - 48 * EQ.H && e.m >= 5.2; })
    .sort(function (a, b) { return b.m - a.m; })
    .slice(0, 2);

  var PLATFORM_IMGS = [IMGS.seismogram, IMGS.sf1906];

  recentBig.forEach(function (e, i) {
    items.push({
      cat: "event", tag: "Event Report", cls: "t-event", t: e.t + 38 * 60e3,
      img: PLATFORM_IMGS[i], source: "World Earthquake Labs",
      title: "M " + e.m.toFixed(1) + " " + e.loc + " — " + (i === 0 ? "rapid event report published" : "reviewed solution published"),
      desc: i === 0
        ? "Rupture parameters, shaking estimates, and felt reports are now available on the event page. The solution has been reviewed by duty seismologists."
        : "Origin time, hypocenter, and moment tensor were finalized after analyst review. Waveform data from " + (140 + Math.round(e.m * 40)) + " stations contributed to the solution."
    });
  });

  if (recentBig[0]) {
    items.push({
      cat: "event", tag: "Advisory", cls: "t-advisory", t: recentBig[0].t + 70 * 60e3,
      source: "World Earthquake Labs",
      title: "Aftershock forecast issued for the " + recentBig[0].loc.replace(/^(Off the coast of|Near the coast of|Near)\s*/i, "") + " sequence",
      desc: "Based on regional aftershock statistics, the probability of an M 5+ aftershock within the next 7 days is estimated at 32%. The forecast will be updated daily as the sequence evolves."
    });
  }

  /* ---------- real news coverage (click-through to the original article) ---------- */

  items.push(
    { cat: "event", tag: "News", cls: "t-news", t: Date.UTC(2026, 7, 16, 9, 30), source: "Al Jazeera",
      url: "https://www.aljazeera.com/news/2026/8/16/indonesias-magnitude-7-7-quake-kills-at-least-51-displaces-thousands",
      img: IMGS.ajIndonesia,
      title: "Indonesia's magnitude 7.7 quake kills at least 53, displaces thousands",
      desc: "The M 7.7 earthquake struck 68 km north-northwest of Ende, Flores Island, at 10 km depth, triggering a tsunami warning and hundreds of aftershocks. About 5,000 people were evacuated." },
    { cat: "event", tag: "News", cls: "t-news", t: Date.UTC(2026, 7, 16, 23, 54), source: "CBS News",
      url: "https://www.cbsnews.com/news/indonesia-earthquake-tsunami-warning/",
      title: "Nearly 1,000 aftershocks followed Indonesia earthquake that killed at least 53",
      desc: "Officials say aftershocks could continue for days after one of Indonesia's deadliest earthquakes since 2022. A 1.6 m tsunami reached the coastal village of Riung before the warning was lifted." },
    { cat: "event", tag: "News", cls: "t-news", t: Date.UTC(2026, 7, 10, 21, 0), source: "CNN",
      url: "https://www.cnn.com/2026/08/10/world/live-news/colombia-earthquake-san-jose-del-palmar",
      img: IMGS.chile,
      title: "Death toll rises to 132 following 7.4 magnitude earthquake in Colombia",
      desc: "The epicenter was located near San José del Palmar in western Colombia, about 240 km west of Bogotá. Collapsed structures include parts of a hospital in Cali; more than 570 people were injured." },
    { cat: "event", tag: "Advisory", cls: "t-advisory", t: Date.UTC(2026, 7, 10, 15, 0), source: "ReliefWeb",
      url: "https://reliefweb.int/disaster/eq-2026-000146-col",
      title: "Colombia: Earthquake — humanitarian situation reports and response updates",
      desc: "OCHA-coordinated situation reports, appeals, and response maps for the August 2026 Colombia earthquake, updated as the humanitarian operation progresses." },
    { cat: "event", tag: "News", cls: "t-news", t: Date.UTC(2026, 7, 31, 5, 0), source: "VolcanoDiscovery",
      url: "https://www.volcanodiscovery.com/earthquake/news/322615/World-Earthquake-Report-for-August-2026.html",
      img: IMGS.fault,
      title: "World Earthquake Report for August 2026 — two M 7+ events worldwide",
      desc: "During August 2026 there were 2 earthquakes of magnitude 7.0 or higher, 9 of 6.0+, and 161 of 5.0+ worldwide, alongside thousands of smaller recorded events." }
  );

  /* ---------- platform announcements ---------- */

  items.push(
    { cat: "network", tag: "Network", cls: "t-network", t: now - 2.2 * EQ.D, img: IMGS.seismo,
      source: "World Earthquake Labs",
      title: "24 new broadband stations come online across Southeast Asia",
      desc: "The expansion closes a long-standing coverage gap around the Banda Sea and improves detection thresholds in the region by roughly 0.3 magnitude units." },
    { cat: "data", tag: "Data Release", cls: "t-data", t: now - 4.6 * EQ.D,
      source: "World Earthquake Labs",
      title: "Global Earthquake Catalog v1.1 released with revised early-century magnitudes",
      desc: "Magnitudes for 1900–1950 events were re-estimated from digitized station bulletins. The release is versioned and citable; changes are documented in the release notes." },
    { cat: "research", tag: "Research", cls: "t-research", t: now - 7.3 * EQ.D,
      source: "World Earthquake Labs",
      title: "New study: machine-learned pickers improve small-event detection by 38%",
      desc: "The deep-learning phase picker now running in our pipeline finds significantly more M < 3 events, sharpening fault imaging between larger earthquakes." },
    { cat: "data", tag: "Data Release", cls: "t-data", t: now - 15 * EQ.D,
      source: "World Earthquake Labs",
      title: "Strong Motion Database updated with 312 new records",
      desc: "Processed accelerograms and intensity measures from recent significant events are now available for download in the Data Library." }
  );

  items.sort(function (a, b) { return b.t - a.t; });

  var feed = document.getElementById("newsFeed");

  function render(cat) {
    var rows = cat === "all" ? items : items.filter(function (n) { return n.cat === cat; });
    feed.innerHTML = rows.map(function (n) {
      var thumb = '<div class="news-thumb">' +
        '<span class="ph-in">' + WEL.icon("doc", 20) + "No image</span>" +
        (n.img ? '<img src="' + n.img + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
        "</div>";
      var body = thumb +
        '<div class="grow"><div class="nt">' + n.title + '</div><div class="nd">' + n.desc + "</div>" +
        '<div class="news-meta"><span class="news-tag ' + n.cls + '">' + n.tag.toUpperCase() + "</span>" +
        '<span class="news-src">' + n.source + (n.url ? " &nearr;" : "") + "</span>" +
        '<span class="news-time">' + timeAgo(n.t) + "</span></div></div>";
      return n.url
        ? '<a class="news-row lg" href="' + n.url + '" target="_blank" rel="noopener">' + body + "</a>"
        : '<div class="news-row lg">' + body + "</div>";
    }).join("") || '<p style="color:var(--faint);padding:20px 0">No updates in this category.</p>';
  }

  var CATEGORIES = ["all", "event", "network", "data", "research"];

  function selectCategory(cat, writeHash) {
    if (CATEGORIES.indexOf(cat) === -1) cat = "all";
    document.querySelectorAll("#newsFilter button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.cat === cat);
    });
    render(cat);
    if (writeHash) {
      try { history.replaceState(null, "", "#" + cat); } catch (e) { /* ignore */ }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "news", sub: cat }, "*");
    }
  }

  document.getElementById("newsFilter").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    selectCategory(b.dataset.cat, true);
  });

  window.addEventListener("hashchange", function () {
    selectCategory((location.hash || "#all").slice(1), false);
  });

  selectCategory((location.hash || "#all").slice(1), false);
  });
})();
