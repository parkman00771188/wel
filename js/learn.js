/* World Earthquake Labs — earthquake guide page */
(function () {
  "use strict";

  /* ---------- section tabs ---------- */

  var SECTIONS = ["overview", "basics", "plates", "measuring", "magnitude",
                  "hazards", "history", "terms", "faq", "safety"];
  var nav = document.getElementById("gdNav");

  function activate(name, fromHash) {
    if (SECTIONS.indexOf(name) === -1) name = "overview";
    nav.querySelectorAll("a[data-gd]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.gd === name);
    });
    SECTIONS.forEach(function (s) {
      var sec = document.getElementById("gd-" + s);
      if (sec) sec.classList.toggle("active", s === name);
    });
    if (!fromHash) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ wel: "subnav-active", view: "learn", sub: name }, "*");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nav.addEventListener("click", function (ev) {
    var a = ev.target.closest("a[data-gd]");
    if (!a) return;
    ev.preventDefault();
    activate(a.dataset.gd);
  });

  // in-content links like "See the Safety Guide" (#safety) and the shortcut tiles
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest('a[href^="#"]');
    if (!a || a.closest("#gdNav")) return;
    var name = a.getAttribute("href").slice(1);
    if (SECTIONS.indexOf(name) !== -1) {
      ev.preventDefault();
      activate(name);
    }
  });

  window.addEventListener("hashchange", function () {
    activate((location.hash || "#overview").slice(1), true);
  });

  activate((location.hash || "#overview").slice(1), true);

  /* ---------- emergency kit checklist ---------- */

  var list = document.getElementById("kitList");
  var progress = document.getElementById("kitProgress");
  if (!list) return;

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
