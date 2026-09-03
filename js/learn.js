/* World Earthquake Labs — earthquake guide
 *
 * The guide's ten topics used to be one page with nine of them hidden behind
 * tabs, and this file switched between them. They are separate URLs now --
 * /learn for the hub and /guide/<slug> for each topic -- so the tab row is
 * ordinary links and the switching logic is gone. What is left is keeping the
 * console route in sync and the emergency-kit checklist.
 */
(function () {
  "use strict";

  /* ---------- tell the console which section is open ----------
     Inside the console the guide runs in an iframe, and the sidebar has to
     highlight the row the reader is actually on. The page knows which section
     it is from the attribute the generator wrote onto <body>. */
  var section = document.body.dataset.gdSection;
  if (section && window.parent !== window) {
    window.parent.postMessage({ wel: "subnav-active", view: "learn", sub: section }, "*");

    /* Guide links normally open standalone pages. Inside the console, ask the
       shell to load the matching embedded URL instead so its header and topic
       navigation are not nested inside the iframe. */
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest("a[href]");
      if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey ||
          ev.shiftKey || ev.altKey || a.hasAttribute("download") ||
          (a.target && a.target !== "_self")) return;

      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.origin !== location.origin ||
          !(/^\/learn\/?$/.test(url.pathname) || /^\/guide\/[^/]+\/?$/.test(url.pathname))) return;

      ev.preventDefault();
      window.parent.postMessage({ wel: "guide-nav", path: url.pathname.replace(/\/$/, "") || "/" }, "*");
    }, true);
  }

  /* ---------- emergency kit checklist ---------- */

  var list = document.getElementById("kitList");
  var progress = document.getElementById("kitProgress");
  if (!list || !progress) return;

  var boxes = list.querySelectorAll("input[type=checkbox]");
  var KEY = "wel-kit-checklist";

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    boxes.forEach(function (b, i) { b.checked = !!saved[i]; });
  } catch (e) { /* storage unavailable — start unchecked */ }

  function update() {
    var done = 0;
    boxes.forEach(function (b) { if (b.checked) done++; });
    progress.textContent = done + " / " + boxes.length + " done";
    progress.classList.toggle("all", done === boxes.length);
    try {
      localStorage.setItem(KEY, JSON.stringify(Array.prototype.map.call(boxes, function (b) { return b.checked; })));
    } catch (e) { /* ignore */ }
  }

  list.addEventListener("change", update);
  update();
})();
