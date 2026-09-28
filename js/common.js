/* World Earthquake Labs — shared header/footer, icon set, small utilities */
(function () {
  "use strict";

  var S = 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  var ICONS = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" ' + S + '/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" ' + S + '/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" ' + S + '/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" ' + S + '/>',
    bars: '<path d="M5 20V10M12 20V4M19 20v-9" ' + S + '/>',
    activity: '<path d="M2.5 12h4l2.5-7 4.5 14 2.5-7h5.5" ' + S + '/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5z" ' + S + '/><path d="m3 12.5 9 5 9-5" ' + S + '/><path d="m3 17 9 5 9-5" ' + S + '/>',
    globe: '<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M3.5 12h17M12 3.5c2.6 2.3 3.9 5.2 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.2-3.9-8.5S9.4 5.8 12 3.5z" ' + S + '/>',
    antenna: '<path d="M12 9.5v11M8.5 20.5h7" ' + S + '/><circle cx="12" cy="7.5" r="2" ' + S + '/><path d="M7.8 11.7a6 6 0 0 1 0-8.4M16.2 3.3a6 6 0 0 1 0 8.4" ' + S + '/>',
    branch: '<circle cx="6" cy="6" r="2.4" ' + S + '/><circle cx="6" cy="18" r="2.4" ' + S + '/><circle cx="18" cy="8" r="2.4" ' + S + '/><path d="M6 8.4v7.2M6 12c6 0 7.5-1 12-1.6" ' + S + '/>',
    sliders: '<path d="M4 8h10M18 8h2M4 16h4M12 16h8" ' + S + '/><circle cx="16" cy="8" r="2.2" ' + S + '/><circle cx="10" cy="16" r="2.2" ' + S + '/>',
    book: '<path d="M12 6.5C10.4 5 8.2 4.5 4 4.5v14c4.2 0 6.4.5 8 2 1.6-1.5 3.8-2 8-2v-14c-4.2 0-6.4.5-8 2z" ' + S + '/><path d="M12 6.5v14" ' + S + '/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" ' + S + '/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" ' + S + '/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" ' + S + '/>',
    box: '<path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7L12 2.8z" ' + S + '/><path d="M3.5 7 12 11.2 20.5 7M12 11.2v10" ' + S + '/>',
    tool: '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6a2 2 0 1 0 2.8 2.8l5.7-5.7a4.5 4.5 0 0 0 5.6-6l-3 3-2.8-.7-.7-2.8 3.1-2.9z" ' + S + '/>',
    folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17v-10.5z" ' + S + '/>',
    users: '<circle cx="9" cy="8" r="3.2" ' + S + '/><path d="M3.5 19.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" ' + S + '/><circle cx="16.8" cy="9" r="2.5" ' + S + '/><path d="M16.5 14.6c2.2.2 3.7 1.7 4.2 4" ' + S + '/>',
    radio: '<circle cx="12" cy="12" r="2" ' + S + '/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M6 18a9 9 0 0 1 0-12M18 6a9 9 0 0 1 0 12" ' + S + '/>',
    target: '<circle cx="12" cy="12" r="8.5" ' + S + '/><circle cx="12" cy="12" r="4.8" ' + S + '/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M12 7.2V12l3.2 1.9" ' + S + '/>',
    chartline: '<path d="M3.5 4v15.5a1 1 0 0 0 1 1H21" ' + S + '/><path d="m7 14 3.5-4 3 2.5L18.5 7" ' + S + '/><circle cx="18.5" cy="7" r="1.3" fill="currentColor"/>',
    inbox: '<path d="M4 4.5h16v15H4z" rx="2" ' + S + '/><path d="M4 13h4.5l1.5 2.5h4L15.5 13H20" ' + S + '/><path d="M4 4.5h16v15a0 0 0 0 1 0 0H4a0 0 0 0 1 0 0v-15z" ' + S + '/>',
    server: '<rect x="3.5" y="4" width="17" height="6.5" rx="1.5" ' + S + '/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5" ' + S + '/><path d="M7 7.2h.01M7 16.8h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    bell: '<path d="M18 10a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" ' + S + '/><path d="M10 19.5a2.2 2.2 0 0 0 4 0" ' + S + '/>',
    playcircle: '<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M10 8.8v6.4l5.2-3.2L10 8.8z" fill="currentColor"/>',
    upload: '<path d="M12 15V4M7.5 8 12 3.5 16.5 8" ' + S + '/><path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5" ' + S + '/>',
    mail: '<rect x="3.5" y="5" width="17" height="14" rx="2" ' + S + '/><path d="m4.5 7 7.5 5.5L19.5 7" ' + S + '/>',
    filter: '<path d="M4 5.5h16L14 12.8v5.7l-4 2v-7.7L4 5.5z" ' + S + '/>',
    plus: '<path d="M12 5.5v13M5.5 12h13" ' + S + '/>',
    minus: '<path d="M5.5 12h13" ' + S + '/>',
    x: '<path d="m6 6 12 12M18 6 6 18" ' + S + '/>',
    chevdown: '<path d="m6 9.5 6 6 6-6" ' + S + '/>',
    check: '<path d="m4.5 12.5 5 5L19.5 7" ' + S + '/>',
    help: '<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.8" ' + S + '/><path d="M12 17.2h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    shield: '<path d="M12 3 19 5.8v5.4c0 4.4-2.9 7.8-7 9.3-4.1-1.5-7-4.9-7-9.3V5.8L12 3z" ' + S + '/><path d="m8.8 11.8 2.3 2.3 4.1-4.4" ' + S + '/>',
    up: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" ' + S + '/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11" ' + S + '/><path d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5" ' + S + '/>',
    bookmark: '<path d="M6.5 3.5h11V21L12 17l-5.5 4V3.5z" ' + S + '/>',
    doc: '<path d="M6 3.5h8L19 8.5V20.5H6z" rx="1" ' + S + '/><path d="M14 3.5v5h5M9 12h6M9 15.5h6" ' + S + '/>',
    social_x: '<path d="M4 4l7.2 9.3L4.4 20h2.2l5.6-5.5L16.8 20H20l-7.5-9.7L18.9 4h-2.2l-5.2 5.1L7.2 4H4z" fill="currentColor"/>',
    social_in: '<path d="M6.5 9.5v9M6.5 6.2v.1M11 18.5v-5.2c0-2 1.3-3.3 3.1-3.3s3 1.2 3 3.5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
    social_yt: '<rect x="3" y="6" width="18" height="12" rx="3.5" ' + S + '/><path d="M10.2 9.5v5l4.6-2.5-4.6-2.5z" fill="currentColor"/>'
  };

  function icon(name, size) {
    size = size || 20;
    var body = ICONS[name] || ICONS.globe;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  function renderIcons(root) {
    (root || document).querySelectorAll("i[data-icon]").forEach(function (el) {
      var span = document.createElement("span");
      span.className = el.className || "";
      span.style.display = "inline-flex";
      span.innerHTML = icon(el.dataset.icon, el.dataset.size ? +el.dataset.size : 20);
      el.replaceWith(span);
    });
  }

  /* ---------- header / footer ---------- */

  /* The header points at the pages themselves. It used to point at sections
     of the home page, and the call to action at the console, so a visitor who
     followed the navigation never arrived at a page with its own URL, header
     and footer -- an AdSense reviewer saw a landing page and an app shell. */
  var NAV = [
    { id: "platform", label: "Dashboard", href: "/" },
    { id: "livemap", label: "Live Map", href: "/map" },
    { id: "guide", label: "Earthquake Guide", href: "/learn" },
    { id: "insights", label: "Insights", href: "/insights" },
    { id: "research", label: "Research", href: "/research" },
    { id: "news", label: "News", href: "/news" }
  ];

  var CTA = {
    "get-started": { label: "Get Started", href: "/" },
    dashboard: { label: "Dashboard", href: "/" },
    map: { label: "Live Map", href: "/map" },
    download: { label: "Download", href: "#", id: "ctaDownload" }
  };

  function buildHeader() {
    var mount = document.getElementById("site-header");
    if (!mount) return;
    var active = document.body.dataset.nav || "";
    var cta = CTA[document.body.dataset.cta || "dashboard"];

    var links = NAV.map(function (n) {
      var href = n.href;
      return '<a href="' + href + '"' + (n.id === active ? ' class="active"' : "") + ">" + n.label + "</a>";
    }).join("");

    mount.outerHTML =
      '<header class="site-header"><div class="container header-inner">' +
      '<a class="brand" href="/"><img src="/resource/img/logo_new.png" alt="World Earthquake Labs"></a>' +
      /* The picker is emitted twice and the stylesheet shows one of them: on a
         phone the bar is only wide enough for the wordmark, the call to action
         and the burger, so the picker moves inside the dropdown, which has the
         room. Both selects carry the same delegated handler, so whichever one
         is visible works. */
      '<nav class="main-nav" id="mainNav">' + links + langControlHTML("header-lang nav-lang") + "</nav>" +
      '<div class="header-actions">' +
      langControlHTML("header-lang") +
      '<a class="btn btn-primary" href="' + cta.href + '"' +
      (cta.id ? ' id="' + cta.id + '"' : "") +
      (cta.target ? ' target="' + cta.target + '" rel="noopener"' : "") + ">" + cta.label + "</a>" +
      '<button class="nav-burger" id="navBurger" aria-label="Menu">' + icon("bars", 18) + "</button>" +
      "</div></div></header>";

    var burger = document.getElementById("navBurger");
    var nav = document.getElementById("mainNav");
    if (burger) burger.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
    /* Close the dropdown on a click so it is not left open over the page. */
    if (nav) nav.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) nav.classList.remove("open");
    });
  }

  function buildFooter() {
    var mount = document.getElementById("site-footer");
    if (!mount) return;
    /* Every link goes to a real page. There used to be "#" links, an "API
       Documentation" link for an API that does not exist, and three social
       icons with no accounts behind them; a footer of dead links is what an
       AdSense reviewer calls a navigation problem. */
    mount.outerHTML =
      '<footer class="site-footer"><div class="container footer-top">' +
      '<div class="footer-brand"><a class="footer-wordmark" href="/">World Earthquake Labs</a>' +
      '<p class="footer-desc">Earthquakes today and every recorded event since 1900, built on open data ' +
      'from the USGS, the ISC and the JMA and refreshed every ten minutes.</p></div>' +
      '<nav class="footer-links" aria-label="Site information">' +
      '<a href="/about">About</a><a href="/terms#data">Data Use Policy</a><a href="/privacy">Privacy Policy</a>' +
      '<a href="/terms">Terms of Service</a><a href="/about#contact">Contact Us</a><a href="/app">Console</a></nav>' +
      "</div>" +
      '<div class="footer-bottom"><div class="container">' +
      '<span>\u00a9 ' + new Date().getFullYear() + ' World Earthquake Labs. All rights reserved.</span>' +
      '<span class="footer-credit">Not an alert service. For warnings, follow your national agency.</span>' +
      "</div></div></footer>";
  }

  /* ---------- sidebar scroll-nav ---------- */

  function initSideNav() {
    var links = document.querySelectorAll(".side-nav a[data-target]");
    if (!links.length) return;

    function activateLink(a, smooth, writeHash) {
      links.forEach(function (x) { x.classList.remove("active"); });
      a.classList.add("active");
      var t = a.dataset.target && document.getElementById(a.dataset.target);
      window.scrollTo({
        top: t ? t.getBoundingClientRect().top + window.scrollY - 96 : 0,
        behavior: smooth ? "smooth" : "auto"
      });
      if (a.dataset.subview) {
        if (writeHash) {
          try { history.replaceState(null, "", "#" + a.dataset.subview); } catch (e) { /* ignore */ }
        }
        if (window.parent !== window) {
          window.parent.postMessage({ wel: "subnav-active", view: "research", sub: a.dataset.subview }, "*");
        }
      }
    }

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        activateLink(a, true, true);
      });
    });

    function activateFromHash() {
      var sub = (location.hash || "").slice(1);
      var match = Array.prototype.find.call(links, function (a) { return a.dataset.subview === sub; });
      if (match) activateLink(match, false, false);
    }
    window.addEventListener("hashchange", activateFromHash);
    activateFromHash();
  }

  /* ---------- toast ---------- */

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  /* ---------- embed mode (page rendered inside the app console iframe) ---------- */

  var EMBED = /[?&]embed\b/.test(location.search);

  /* Which console tab a content link belongs to. The pages are real URLs --
     /map, /learn, /guide/plate-tectonics -- and stay that way in the markup so
     crawlers and new tabs get the page. This is only consulted on a plain
     click, to open the same thing in the console instead. Returns null for
     anything that is not one of those pages. */
  /* The guide, in reading order: [section key, URL slug, label]. The key is
     what the console and the sidebar call the chapter and what each chapter
     page carries in data-gd-section. */
  var GUIDE_CHAPTERS = [
    ["basics", "earthquake-basics", "Basics"],
    ["plates", "plate-tectonics", "Plate Tectonics"],
    ["measuring", "measuring-earthquakes", "Measuring Quakes"],
    ["magnitude", "magnitude-and-intensity", "Magnitude &amp; Intensity"],
    ["catalogue", "reading-the-catalogue", "Reading the Catalogue"],
    ["hazards", "earthquake-hazards", "Hazards &amp; Effects"],
    ["buildings", "buildings-and-codes", "Buildings &amp; Codes"],
    ["warning", "earthquake-early-warning", "Early Warning"],
    ["induced", "induced-earthquakes", "Induced Earthquakes"],
    ["history", "notable-earthquakes", "Notable Earthquakes"],
    ["terms", "earthquake-glossary", "Key Terms"],
    ["faq", "earthquake-faq", "FAQ"],
    ["safety", "earthquake-safety", "Safety Guide"]
  ];
  var GUIDE_SUB = {};
  GUIDE_CHAPTERS.forEach(function (c) { GUIDE_SUB[c[1]] = c[0]; });
  var VIEW_OF = { dashboard: "overview", map: "map", insights: "insights", research: "research", learn: "learn", news: "news" };
  function consoleRoute(href) {
    if (!href || /^(#|https?:|mailto:)/i.test(href)) return null;
    var path = href.replace(/[?#].*$/, "");
    var m = path.match(/^\/?(map|dashboard|insights|research|learn|news)(?:\.html)?\/?$/);
    // research#publications names a section of the target page, not just the
    // page. Dropping the fragment landed the click on that page's default
    // view, so "Open the Research Hub" arrived at Overview and the reader had
    // to find Publications again. The shell validates the name it is given.
    if (m) return { view: VIEW_OF[m[1]], sub: (href.match(/#([a-z0-9-]+)$/) || [])[1] || null, path: "/" + m[1] };
    m = path.match(/^\/?guide\/([a-z0-9-]+)(?:\.html)?\/?$/);
    if (m && GUIDE_SUB[m[1]]) return { view: "learn", sub: GUIDE_SUB[m[1]], path: "/guide/" + m[1], guide: true };
    return null;
  }

  /* A click the reader means as a plain navigation: left button, no modifier,
     no target, not a download. Anything else keeps the real link. */
  function plainClick(ev, a) {
    return ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey &&
      !ev.defaultPrevented && !a.hasAttribute("download") && (!a.target || a.target === "_self");
  }

  function initEmbed() {
    document.body.classList.add("embed");
    var h = document.getElementById("site-header");
    if (h) h.remove();
    var f = document.getElementById("site-footer");
    if (f) f.remove();

    // clicks on internal page links switch the console tab instead of navigating the iframe
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (/^#/.test(href)) return; // in-page anchors stay in the page
      var route = consoleRoute(href);
      if (route && plainClick(ev, a)) {
        ev.preventDefault();
        if (window.parent !== window) {
          // A guide topic goes by path: the shell already maps /guide/<slug>
          // to its section (see the guide-nav handler in js/app.js). Every
          // other page carries its section in the fragment instead, so the
          // guide is told apart by its own flag rather than by having a sub.
          if (route.guide) window.parent.postMessage({ wel: "guide-nav", path: route.path }, "*");
          else window.parent.postMessage({ wel: "nav", view: route.view, sub: route.sub }, "*");
        } else {
          location.href = "/app#" + route.view + (route.sub ? "/" + route.sub : "");
        }
        return;
      }
      if (/^index\.html/.test(href)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
    }, true);
  }

  /* ---------- the shell: console chrome on every page ----------

     Every page is laid out the way the console lays it out -- the sidebar with
     the six views and their sections, the top bar with the clock and the
     settings, the page itself in the main area. What differs from the console
     is that nothing is framed. Each page is its own document at its own URL,
     the sidebar entries are ordinary links, and a crawler or a reviewer sees
     exactly what a reader sees, with the policy links one click away.

     The reason it is built here rather than written into each page: the
     sidebar changes whenever a section is added, and twenty pages carrying a
     copy each is how the console and the guide once stopped agreeing.

     Inside the console (?embed=1) the page skips this: the console is the
     shell there. A page can also opt out with data-chrome="header" on <body>
     and get the plain site header instead. */

  var SHELL_VIEW = { platform: "overview", livemap: "map", guide: "learn", insights: "insights", research: "research", news: "news" };
  var SHELL_TITLE = {
    overview: "Dashboard Overview", map: "Live Earthquake Map", learn: "Earthquake Guide",
    insights: "Seismic Insights", research: "Research Hub", news: "News &amp; Updates"
  };
  var SHELL_DEFAULT_SUB = { map: "3d", learn: "overview", insights: "overview", research: "overview", news: "overview" };

  function shellGroupHTML(view, icn, label, href, subs) {
    var has = !!(subs && subs.length);
    var html = '<div class="app-nav-group' + (has ? " has-subnav" : "") + '" data-nav-group="' + view + '">' +
      '<a href="' + href + '" data-view="' + view + '"' + (has ? ' aria-expanded="false"' : "") + ">" +
      icon(icn, 19) + '<span class="app-nav-label">' + label + "</span>" +
      (has ? '<span class="app-nav-caret" aria-hidden="true"></span>' : "") + "</a>";
    if (has) {
      html += '<div class="app-subnav">' + subs.map(function (s) {
        return '<a href="' + s[1] + '" data-parent-view="' + view + '" data-subview="' + s[0] + '"><span>' + s[2] + "</span></a>";
      }).join("") + "</div>";
    }
    return html + "</div>";
  }

  function shellNavHTML() {
    var guide = [["overview", "/learn", "Overview"]].concat(GUIDE_CHAPTERS.map(function (c) {
      return [c[0], "/guide/" + c[1], c[2]];
    }));
    return shellGroupHTML("overview", "grid", "Overview", "/", null) +
      shellGroupHTML("map", "target", "Live Map", "/map", [["3d", "/map#3d", "3D Map"], ["2d", "/map#2d", "2D Map"]]) +
      shellGroupHTML("learn", "book", "Earthquake Guide", "/learn", guide) +
      shellGroupHTML("insights", "chartline", "Seismic Insights", "/insights", [
        ["overview", "/insights#overview", "Overview"], ["statistics", "/insights#statistics", "Statistics"],
        ["magnitude", "/insights#magnitude", "Magnitude Analysis"], ["depth", "/insights#depth", "Depth Analysis"],
        ["regional", "/insights#regional", "Regional Insights"], ["energy", "/insights#energy", "Energy Analysis"],
        ["forecast", "/insights#forecast", "Activity Anomaly Monitor"], ["custom", "/insights#custom", "Custom Analysis"]
      ]) +
      shellGroupHTML("research", "folder", "Research Hub", "/research", [
        ["overview", "/research#overview", "Overview"], ["publications", "/research#publications", "Publications"],
        ["sources", "/research#sources", "Data Sources"]
      ]) +
      shellGroupHTML("news", "radio", "News &amp; Updates", "/news", [
        ["overview", "/news#overview", "Overview"], ["news", "/news#news", "News"],
        ["papers", "/news#papers", "Papers"], ["quakes", "/news#quakes", "Earthquakes"]
      ]);
  }

  function buildShell() {
    var mount = document.getElementById("site-header");
    if (!mount || EMBED || document.body.dataset.chrome === "header") return false;
    var body = document.body;
    var view = SHELL_VIEW[body.dataset.nav || ""] || null;
    var title = view ? SHELL_TITLE[view] : (document.title.split(" \u2014 ")[0] || "World Earthquake Labs");

    /* The page's own markup moves into the main area. Scripts stay where they
       are: they have run, and the main area is content, not code. */
    var main = document.createElement("div");
    main.className = "app-main";
    main.id = "appMain";
    Array.prototype.slice.call(body.childNodes).forEach(function (node) {
      if (node === mount) return;
      if (node.nodeType === 1 && node.tagName === "SCRIPT") return;
      main.appendChild(node);
    });
    mount.remove();

    /* "embed" alongside "shell": the page is laid out inside console chrome
       either way, so the stylesheet's embed rules -- full-width container,
       the map filling its area, the guide's tab row sticking to the top --
       apply here too. The few places where the two differ are marked .shell. */
    body.classList.add("app-body", "shell", "embed");
    body.insertAdjacentHTML("afterbegin",
      '<div class="app-scrim" id="appScrim" hidden></div>' +
      '<aside class="app-side" id="appSide">' +
        '<div class="app-side-head"><a class="brand" href="/" title="World Earthquake Labs">' +
        '<img src="/resource/img/logo_new.png" alt="World Earthquake Labs"></a>' +
        '<span class="app-updated app-side-updated" id="appSideUpdated" hidden></span></div>' +
        '<nav class="app-nav" id="appNav">' + shellNavHTML() + "</nav>" +
        '<div class="spacer"></div>' +
        '<nav class="app-side-foot" aria-label="Site information">' +
        '<a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>' +
        '<a href="/about#contact">Contact</a><a href="/app">Console</a></nav>' +
      "</aside>" +
      '<header class="app-top">' +
        '<button class="app-burger" id="appBurger" aria-label="Menu" aria-expanded="false" aria-controls="appSide">' +
        "<span></span><span></span><span></span></button>" +
        '<p class="app-title" id="appTitle">' + title + "</p>" +
        '<span class="app-updated" id="appUpdated" hidden></span>' +
        '<span class="app-clock" id="appClock">\u2014</span>' +
        '<span class="app-tz" id="appTz"></span>' +
        langControlHTML("app-lang") +
      "</header>");
    body.appendChild(main);

    /* Which row is the page: the group from data-nav, the child from the
       chapter attribute on guide pages and from the fragment elsewhere. */
    function paintShellNav() {
      var sub = view === "learn" ? (body.dataset.gdSection || "overview") : (location.hash || "").slice(1);
      if (!sub) sub = SHELL_DEFAULT_SUB[view] || "";
      document.querySelectorAll("#appNav .app-nav-group").forEach(function (group) {
        var on = group.dataset.navGroup === view;
        var has = group.classList.contains("has-subnav");
        group.classList.toggle("open", on && has);
        var link = group.querySelector("a[data-view]");
        if (link) {
          link.classList.toggle("active", on);
          if (has) link.setAttribute("aria-expanded", on ? "true" : "false");
        }
        group.querySelectorAll("a[data-subview]").forEach(function (a) {
          a.classList.toggle("active", on && a.dataset.subview === sub);
        });
      });
    }
    paintShellNav();
    window.addEventListener("hashchange", paintShellNav);
    startFreshnessChip();

    /* A link into the page currently open switches its section rather than
       reloading it: the page's own hashchange handler does the switching. */
    document.getElementById("appNav").addEventListener("click", function (ev) {
      var a = ev.target.closest("a[data-subview]");
      if (!a) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.pathname === location.pathname && url.hash && plainClick(ev, a)) {
        ev.preventDefault();
        if (location.hash !== url.hash) location.hash = url.hash;
        setDrawer(false);
      }
    });

    /* ---- phone drawer: the sidebar slides over the content ---- */
    var side = document.getElementById("appSide");
    var scrim = document.getElementById("appScrim");
    var burger = document.getElementById("appBurger");
    function drawerOpen() { return body.classList.contains("app-drawer-open"); }
    function setDrawer(open) {
      body.classList.toggle("app-drawer-open", open);
      side.classList.toggle("open", open);
      scrim.hidden = !open;
      if (open) requestAnimationFrame(function () { scrim.classList.add("on"); });
      else scrim.classList.remove("on");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    }
    burger.addEventListener("click", function () { setDrawer(!drawerOpen()); });
    scrim.addEventListener("click", function () { setDrawer(false); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && drawerOpen()) setDrawer(false);
    });
    try {
      window.matchMedia("(min-width: 861px)").addEventListener("change", function (ev) {
        if (ev.matches && drawerOpen()) setDrawer(false);
      });
    } catch (e) { /* an old browser without matchMedia events keeps the drawer manual */ }

    /* ---- clock, in whichever zone the header is set to ---- */
    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var locale = { en: "en-US", zh: "zh-CN", fil: "fil-PH" }[currentLang()] || currentLang();
    var dfmt = null;
    try { dfmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }); } catch (e) { /* fallback below */ }
    function p2(x) { return (x < 10 ? "0" : "") + x; }
    function tick() {
      var utc = !TZ.isLocal;
      var d = new Date();
      var Y = utc ? d.getUTCFullYear() : d.getFullYear();
      var M = utc ? d.getUTCMonth() : d.getMonth();
      var D = utc ? d.getUTCDate() : d.getDate();
      var date = MON[M] + " " + D + ", " + Y;
      if (dfmt) { try { date = dfmt.format(Date.UTC(Y, M, D)); } catch (e) { /* keep the literal */ } }
      var hms = p2(utc ? d.getUTCHours() : d.getHours()) + ":" + p2(utc ? d.getUTCMinutes() : d.getMinutes()) + ":" +
        p2(utc ? d.getUTCSeconds() : d.getSeconds());
      document.getElementById("appClock").textContent = date + " " + hms + " " + TZ.label();
    }
    setInterval(tick, 1000);
    window.addEventListener("wel:tz", tick);
    tick();
    return true;
  }

  /* ---------- time zone ---------- */

  /* Every earthquake time on the site is one instant shown two ways. The
     agencies publish UTC and that is what a seismologist wants; everyone else
     wants to know what time it was where they are. So the site keeps one
     setting, defaulting to the visitor's own clock, and every page reads it.
     Detail views print both, because on a card there is room to be unambiguous.

     The console runs its pages in iframes, and a localStorage write does not
     raise a storage event in the tab that made it -- so the change is announced
     directly, up to the parent and down to every frame, and each document
     re-renders off one custom event. */

  var TZ_KEY = "wel-tz";

  var tzMode = (function () {
    try {
      var v = localStorage.getItem(TZ_KEY);
      if (v === "utc" || v === "local") return v;
    } catch (e) { /* private mode: fall through */ }
    return "local";
  })();

  // Intl's short name for most Asian zones is just "GMT+9". These are the
  // household abbreviations for the audiences this site actually has; the same
  // table lives in the 3D engine, which has no access to this file.
  var TZ_ABBR = {
    "Asia/Seoul": "KST", "Asia/Tokyo": "JST", "Asia/Shanghai": "CST",
    "Asia/Taipei": "CST", "Asia/Hong_Kong": "HKT", "Asia/Singapore": "SGT",
    UTC: "UTC", "Etc/UTC": "UTC"
  };

  var LOCAL_ABBR = (function () {
    var zone = "";
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* ignore */ }
    if (TZ_ABBR[zone]) return TZ_ABBR[zone];
    try {
      var part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(new Date())
        .filter(function (x) { return x.type === "timeZoneName"; })[0];
      return part ? part.value.replace(/^GMT/, "UTC") : "Local";
    } catch (e) { return "Local"; }
  })();

  function tzBroadcast(mode) {
    var msg = { wel: "tz", mode: mode };
    try { if (window.parent !== window) window.parent.postMessage(msg, "*"); } catch (e) { /* ignore */ }
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      try { frames[i].contentWindow.postMessage(msg, "*"); } catch (e) { /* cross-origin ad frames */ }
    }
  }

  /* Always relay, in both directions. The console nests the 3D engine inside
     the map page, so a change made in the top bar has two hops to travel; a
     document that swallowed the message would strand everything below it. The
     early return above is what stops the relay looping back on itself. */
  function tzApply(mode) {
    mode = mode === "utc" ? "utc" : "local";
    if (mode === tzMode) return;
    tzMode = mode;
    try { localStorage.setItem(TZ_KEY, mode); } catch (e) { /* ignore */ }
    document.querySelectorAll("[data-tz-select]").forEach(function (sel) { sel.value = mode; });
    window.dispatchEvent(new CustomEvent("wel:tz", { detail: mode }));
    tzBroadcast(mode);
  }

  var TZ = {
    get mode() { return tzMode; },
    get isLocal() { return tzMode === "local"; },
    label: function () { return tzMode === "utc" ? "UTC" : LOCAL_ABBR; },
    localLabel: function () { return LOCAL_ABBR; },
    set: function (mode) { tzApply(mode); }
  };

  window.addEventListener("message", function (ev) {
    if (ev.data && ev.data.wel === "tz") tzApply(ev.data.mode);
  });

  /* A column of times needs the zone named once, in its heading, rather than
     repeated on every row. Mark the heading and it keeps itself right. */
  function paintTzHeads() {
    document.querySelectorAll("[data-tz-head]").forEach(function (th) {
      var base = th.dataset.tzHead || th.textContent.replace(/\s*\([^)]*\)\s*$/, "").trim();
      th.dataset.tzHead = base;
      th.textContent = base + " (" + TZ.label() + ")";
    });
  }
  window.addEventListener("wel:tz", paintTzHeads);

  /* ---------- language ---------- */

  /* The standalone pages had no way to change language at all: the picker lived
     only in the console's top bar. It goes in the site header now, in the spot
     the time-zone control briefly held -- of the two, language is the one a
     first-time visitor needs before anything else, and the time zone keeps its
     sensible default (the visitor's own clock) with the control still available
     in the console. Same persistence as the console's picker: one localStorage
     key, then a reload so every script boots in the new language. */
  var LANG_KEY = "wel-lang";

  // js/i18n.js owns the list of languages and the choice between them. It runs
  // after this file, so both are read at call time rather than captured here;
  // the fallbacks cover a page that somehow ships without it.
  function langs() { return (window.WEL_I18N && WEL_I18N.langs) || [["en", "English"]]; }

  function currentLang() {
    if (window.WEL_I18N && WEL_I18N.lang) return WEL_I18N.lang;
    var q = new URLSearchParams(location.search).get("lang");
    if (q) return q;
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch (e) { return "en"; }
  }

  function langControlHTML(cls) {
    var cur = currentLang();
    return '<label class="' + cls + '" title="Language">'
      + icon("globe", 15)
      + '<select data-lang-select aria-label="Language">'
      + langs().map(function (l) {
          return '<option value="' + l[0] + '"' + (l[0] === cur ? " selected" : "") + ">" + l[1] + "</option>";
        }).join("")
      + "</select></label>";
  }

  document.addEventListener("change", function (ev) {
    var sel = ev.target.closest ? ev.target.closest("[data-lang-select]") : null;
    if (!sel) return;
    try { localStorage.setItem(LANG_KEY, sel.value); } catch (e) { /* ignore */ }
    // A ?lang= in the URL would win over the stored choice, so drop it.
    if (location.search) location.replace(location.pathname + location.hash);
    else location.reload();
  });

  /* The control itself. Same markup in the console's top bar and in the site
     header, so one handler covers both. */
  function tzControlHTML(cls) {
    return '<label class="' + cls + '" title="Time zone">'
      + icon("clock", 15)
      + '<select data-tz-select aria-label="Time zone">'
      + '<option value="local"' + (tzMode === "local" ? " selected" : "") + ">"
      + "Local time (" + LOCAL_ABBR + ")</option>"
      + '<option value="utc"' + (tzMode === "utc" ? " selected" : "") + ">UTC</option>"
      + "</select></label>";
  }

  document.addEventListener("change", function (ev) {
    var sel = ev.target.closest ? ev.target.closest("[data-tz-select]") : null;
    if (sel) TZ.set(sel.value);
  });

  /* ---------- archive figures ----------
     The catalogue is rebuilt regularly, so any headline count written into the
     markup starts going stale the day it is written. Elements carrying
     data-meta hold last known good value as their text, and this replaces it
     with the live one from the build's own manifest. If the fetch fails the
     page still shows a real number, just an older one. */
  function paintMetaFigures() {
    var nodes = document.querySelectorAll("[data-meta]");
    if (!nodes.length) return;
    fetch("/3d/data/global/meta.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (meta) {
        if (!meta) return;
        var vals = {
          count: meta.count,
          usgs_rows: meta.sources && meta.sources.usgs_rows,
          isc_rows: meta.sources && meta.sources.isc_rows,
          duplicates_removed: meta.sources && meta.sources.duplicates_removed
        };
        Array.prototype.forEach.call(nodes, function (el) {
          var v = vals[el.dataset.meta];
          if (typeof v !== "number" || !isFinite(v)) return;
          el.textContent = el.dataset.metaFmt === "compact"
            ? (v / 1e6).toFixed(2) + "M"
            : v.toLocaleString("en-US");
        });
      })
      .catch(function () {});
  }

  /* ---------- what the ten-minute cycle last put on the page ----------

     The News & Updates Overview lists the newest of the three things the site
     collects, and the console header carries an "Updated" chip. The two have
     to be the same number: a chip reading five minutes, next to a list whose
     newest row is an hour old, sends the reader looking for something that
     was never there.

     The chip used to read generated_utc -- when the collector last rewrote a
     feed -- which is a different quantity. A feed is rewritten whenever the
     collector adds a row, and a row whose own date falls outside the store's
     cap is dropped again in the same run, so data/news.json was seven minutes
     old while its newest row was fifty-seven. Both now read the rows
     themselves, through here, so they cannot drift apart. */

  var OVERVIEW_MIN_MAG = 4.5;   // an overview row is an earthquake worth a headline

  /* Rows of {kind, t, item}, newest first, from the three payloads the pages
     already fetch. A store that is missing or still loading contributes
     nothing rather than throwing. */
  function feedRows(stores) {
    var rows = [];
    stores = stores || {};
    ((stores.news && stores.news.items) || []).forEach(function (n) {
      var t = Date.parse(n.added_utc || n.published);
      if (isFinite(t)) rows.push({ kind: "news", t: t, item: n });
    });
    /* A paper is dated by when the site first saw it: its publication date can
       be months before OpenAlex lists it. Only the recent pool counts as an
       update -- the cited pool is a library, and a 2018 classic added by the
       widening loop is not news. */
    ((stores.papers && stores.papers.items) || []).forEach(function (p) {
      if (!p.recent && !p.added_utc) return;
      var t = Date.parse(p.added_utc || p.date);
      if (isFinite(t)) rows.push({ kind: "paper", t: t, item: p });
    });
    ((stores.live && stores.live.events) || []).forEach(function (e) {
      if (!(e.magnitude >= OVERVIEW_MIN_MAG) || !isFinite(e.time_ms)) return;
      rows.push({ kind: "quake", t: e.time_ms, item: e });
    });
    rows.sort(function (a, b) { return b.t - a.t; });
    return rows;
  }

  /* The stamp the "Updated" chip shows: the top row's own time, and 0 when
     there is nothing to show yet, which leaves the chip hidden. */
  function feedNewest(stores) {
    var rows = feedRows(stores);
    return rows.length ? rows[0].t : 0;
  }

  /* The chip itself: "Updated N min ago" in the top bar, and in the drawer
     on a phone. It reads the same three stores as the News & Updates
     Overview through feedNewest, so the chip and the list never disagree.
     Refetched every five minutes, re-worded every minute. The paths are
     absolute because the guide pages live a level down. Shared by the
     console (js/app.js) and the shell. */
  function startFreshnessChip() {
    var chips = document.querySelectorAll(".app-updated");
    if (!chips.length || typeof fetch !== "function") return null;
    var updatedAt = null;
    function agoText(ms) {
      var m = Math.max(1, Math.round((Date.now() - ms) / 60e3));
      // Ordinary UI copy: the dictionary translates it into every language.
      return "Updated " + (m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago");
    }
    function render() {
      chips.forEach(function (el) {
        el.hidden = !updatedAt;
        if (updatedAt) el.textContent = agoText(updatedAt);
      });
    }
    function feed(url) {
      return fetch(url, { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }); // offline: keep the last value
    }
    function refresh() {
      return Promise.all([feed("/data/news.json"), feed("/data/papers.json"), feed("/3d/data/live/global.json")])
        .then(function (r) {
          var newest = feedNewest({ news: r[0], papers: r[1], live: r[2] });
          if (newest) { updatedAt = newest; render(); }
        });
    }
    setInterval(refresh, 5 * 60e3);
    setInterval(render, 60e3);
    return refresh();
  }

  window.WEL = {
    icon: icon, renderIcons: renderIcons, toast: toast, embed: EMBED,
    tz: TZ, tzControlHTML: tzControlHTML, langControlHTML: langControlHTML,
    feedRows: feedRows, feedNewest: feedNewest, OVERVIEW_MIN_MAG: OVERVIEW_MIN_MAG,
    startFreshnessChip: startFreshnessChip
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (EMBED) {
      initEmbed();
    } else {
      if (!buildShell()) buildHeader();
      buildFooter();
    }
    // The console builds its own top bar in markup; give it the same control.
    var tzHost = document.getElementById("appTz");
    if (tzHost) tzHost.outerHTML = tzControlHTML("app-tz");
    paintTzHeads();
    paintMetaFigures();
    renderIcons(document);
    initSideNav();
  });
})();
