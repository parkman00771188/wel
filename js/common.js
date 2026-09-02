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

  var NAV = [
    { id: "platform", label: "Platform", href: "index.html#platform" },
    { id: "livemap", label: "Live Map", href: "index.html#livemap" },
    { id: "guide", label: "Earthquake Guide", href: "index.html#guide" },
    { id: "insights", label: "Insights", href: "index.html#insights" },
    { id: "research", label: "Research", href: "index.html#research" },
    { id: "news", label: "News", href: "index.html#news" }
  ];

  var CTA = {
    "get-started": { label: "Get Started", href: "app.html" },
    dashboard: { label: "Dashboard", href: "app.html" },
    download: { label: "Download", href: "#", id: "ctaDownload" }
  };

  function buildHeader() {
    var mount = document.getElementById("site-header");
    if (!mount) return;
    var active = document.body.dataset.nav || "";
    var cta = CTA[document.body.dataset.cta || "dashboard"];

    var links = NAV.map(function (n) {
      return '<a href="' + n.href + '"' + (n.id === active ? ' class="active"' : "") + ">" + n.label + "</a>";
    }).join("");

    mount.outerHTML =
      '<header class="site-header"><div class="container header-inner">' +
      '<a class="brand" href="index.html"><img src="resource/img/logo_new.png" alt="World Earthquake Labs"></a>' +
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
    if (burger) burger.addEventListener("click", function () {
      document.getElementById("mainNav").classList.toggle("open");
    });
  }

  function buildFooter() {
    var mount = document.getElementById("site-footer");
    if (!mount) return;
    mount.outerHTML =
      '<footer class="site-footer"><div class="container footer-top">' +
      '<div class="footer-tagline"><div class="l1">The World Earthquake Labs Platform</div>' +
      '<div class="l2">Integrated. Open. Built for Science and Society.</div></div>' +
      '<nav class="footer-links">' +
      '<a href="#">Data Use Policy</a><a href="#">Privacy Policy</a><a href="#">Terms of Service</a>' +
      '<a href="#">Contact Us</a><a href="#">API Documentation</a></nav>' +
      '<div class="footer-social">' +
      '<a href="#" aria-label="X">' + icon("social_x", 16) + "</a>" +
      '<a href="#" aria-label="LinkedIn">' + icon("social_in", 17) + "</a>" +
      '<a href="#" aria-label="YouTube">' + icon("social_yt", 17) + "</a>" +
      "</div></div>" +
      '<div class="footer-bottom"><div class="container">\u00a9 ' + new Date().getFullYear() +
      " World Earthquake Labs. All rights reserved.</div></div></footer>";
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

  function initEmbed() {
    document.body.classList.add("embed");
    var h = document.getElementById("site-header");
    if (h) h.remove();
    var f = document.getElementById("site-footer");
    if (f) f.remove();

    // clicks on internal page links switch the console tab instead of navigating the iframe
    var VIEW_OF = { dashboard: "overview", map: "map", insights: "insights", research: "research", learn: "learn", news: "news" };
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (/^#/.test(href)) return; // in-page anchors stay in the page
      var m = href.match(/^(map|dashboard|insights|research|learn|news)\.html/);
      if (m) {
        ev.preventDefault();
        if (window.parent !== window) {
          window.parent.postMessage({ wel: "nav", view: VIEW_OF[m[1]] }, "*");
        } else {
          location.href = m[1] + ".html?embed=1";
        }
        return;
      }
      if (/^index\.html/.test(href)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
    }, true);
  }

  /* ---------- Google AdSense ----------

     Two placements, and they never both apply at once. On a wide screen the
     console shows a unit at the bottom of its sidebar. On a phone that
     sidebar is a drawer, so the unit is only visible while the drawer is
     open -- which is almost never -- and a dismissible anchor bar takes over
     at the bottom of the viewport instead.

     Both need an ad-unit id from AdSense (광고 → 광고 단위 → 디스플레이 광고).
     Paste them below. While an id is empty nothing is pushed for it: an <ins>
     without a slot can never fill, and a permanent grey bar across the bottom
     of a live site is worse than no bar. */

  var AD = {
    client: "ca-pub-7720076982812531",
    sidebar: "",   // 콘솔 사이드바 하단 (데스크톱)
    anchor: ""     // 모바일 하단 앵커
  };

  /** Turn a container into a display unit and ask AdSense to fill it. */
  function mountAd(host, slot, style) {
    if (!host || !slot) return false;
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.cssText = style || "display:block;width:100%";
    ins.dataset.adClient = AD.client;
    ins.dataset.adSlot = slot;
    if (!style) {
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
    }
    host.textContent = "";
    host.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.warn("adsbygoogle unavailable:", err);
      return false;
    }
    return true;
  }

  /* The anchor belongs to the top-level document only. Inside the console the
     child pages run in iframes; an anchor there would sit on top of the one
     the shell already has. */
  function mountAnchor() {
    if (EMBED || window.parent !== window || !AD.anchor) return;
    try {
      if (sessionStorage.getItem("wel-ad-anchor-closed")) return;
    } catch (e) { /* private mode: just show it */ }

    var bar = document.createElement("div");
    bar.className = "ad-anchor";
    bar.id = "adAnchor";
    var close = document.createElement("button");
    close.className = "ad-anchor-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close ad");
    close.innerHTML = icon("x", 15);
    var inner = document.createElement("div");
    inner.className = "ad-anchor-inner";
    bar.appendChild(close);
    bar.appendChild(inner);
    document.body.appendChild(bar);

    close.addEventListener("click", function () {
      bar.remove();
      document.body.classList.remove("has-ad-anchor");
      try { sessionStorage.setItem("wel-ad-anchor-closed", "1"); } catch (e) { /* ignore */ }
    });

    // 320x50 fixed: the bar then has a height the layout can reserve, instead
    // of resizing under the reader once a creative arrives.
    if (mountAd(inner, AD.anchor, "display:inline-block;width:320px;height:50px")) {
      document.body.classList.add("has-ad-anchor");
    } else {
      bar.remove();
    }
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
    fetch("3d/data/global/meta.json", { cache: "no-cache" })
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

  window.WEL = {
    icon: icon, renderIcons: renderIcons, toast: toast, embed: EMBED,
    AD: AD, mountAd: mountAd, tz: TZ, tzControlHTML: tzControlHTML, langControlHTML: langControlHTML
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (EMBED) {
      initEmbed();
    } else {
      buildHeader();
      buildFooter();
    }
    // The console builds its own top bar in markup; give it the same control.
    var tzHost = document.getElementById("appTz");
    if (tzHost) tzHost.outerHTML = tzControlHTML("app-tz");
    paintTzHeads();
    paintMetaFigures();
    renderIcons(document);
    initSideNav();
    mountAnchor();
  });
})();
