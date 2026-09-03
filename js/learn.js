/* World Earthquake Labs — earthquake guide
 *
 * The guide's ten topics used to be one page with nine of them hidden behind
 * tabs, and this file switched between them. They are separate URLs now --
 * /learn for the hub and /guide/<slug> for each topic -- so the tab row is
 * ordinary links and the switching logic is gone. What is left is the two
 * things a single topic page still needs.
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
