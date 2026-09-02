/* World Earthquake Labs — UI translation.
 *
 * The engine only. Each language's strings live in js/i18n/<code>.js and are
 * fetched on demand, so an English visitor downloads nothing extra and a Turkish
 * one downloads Turkish and nothing else. English is the source language: its
 * "translation" is the markup itself, so there is no en.js.
 *
 * Matching is on text nodes rather than on tagged elements. That is unusual, and
 * it is deliberate: the markup is hand-written across nine pages and a console
 * that injects most of its own strings from script, so tagging every one of them
 * would be a large edit that goes stale the moment somebody writes a new line of
 * copy. Text-node matching means a string is translated wherever it appears, and
 * an untranslated string simply stays in English instead of breaking.
 *
 * Long-form article copy — the Earthquake Guide's explanations — stays in
 * English in every language. Its headings and controls are translated.
 */
(function () {
  "use strict";

  /* Roughly by number of speakers, which is also the order people scan a list
     like this for their own language. */
  var LANGS = [
    ["en",  "English"],
    ["zh",  "中文（简体）"],
    ["es",  "Español"],
    ["hi",  "हिन्दी"],
    ["id",  "Bahasa Indonesia"],
    ["ar",  "العربية"],
    ["ja",  "日本語"],
    ["fil", "Filipino"],
    ["tr",  "Türkçe"],
    ["ko",  "한국어"]
  ];
  var CODES = LANGS.map(function (l) { return l[0]; });
  var RTL = { ar: 1 };

  var params = new URLSearchParams(location.search);
  var lang = params.get("lang") || (function () {
    try { return localStorage.getItem("wel-lang"); } catch (e) { return null; }
  })() || "en";
  if (CODES.indexOf(lang) === -1) lang = "en";

  window.WEL_I18N = { lang: lang, langs: LANGS, rtl: !!RTL[lang] };

  document.documentElement.lang = lang;
  if (RTL[lang]) document.documentElement.dir = "rtl";

  if (lang === "en") return;

  /* ---------- dictionary ---------- */

  var DICT = {};

  /* Strings that carry a number or a fragment the dictionary cannot enumerate.
     A key may contain {n} for a number and {t} for a run of text; the
     translation refers back to them as $1, $2 … in order of appearance. So
     "{n} events" -> "$1건" turns "1,204 events" into "1,204건", while
     "Cataloged events" is left alone because {n} only matches digits. */
  var PATTERNS = [];

  function compile(key) {
    var out = "", i = 0;
    while (i < key.length) {
      var ch = key[i];
      if (ch === "{" && key.slice(i, i + 3) === "{n}") { out += "([\\d.,]+)"; i += 3; continue; }
      if (ch === "{" && key.slice(i, i + 3) === "{t}") { out += "(.+?)"; i += 3; continue; }
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    }
    return new RegExp("^" + out + "$");
  }

  function load(more) {
    for (var k in more) {
      if (!Object.prototype.hasOwnProperty.call(more, k)) continue;
      if (k.indexOf("{n}") !== -1 || k.indexOf("{t}") !== -1) {
        PATTERNS.push([compile(k), more[k]]);
      } else {
        DICT[k] = more[k];
      }
    }
    if (document.body) walk(document.body);
  }
  window.WEL_I18N.load = load;

  /* ---------- matching ---------- */

  /* Match on the text with its internal whitespace collapsed: source paragraphs
     are wrapped across several lines, so the raw node carries newlines and runs
     of indentation that no dictionary key could sensibly reproduce. The leading
     and trailing whitespace is put back around the translation so the layout is
     not disturbed. */
  var WS = /\s+/g;
  var EDGES = /^(\s*)([\s\S]*?)(\s*)$/;

  /* Whether the whitespace the source had at a fragment's edge should survive
     into the translation.
   *
   * A sentence broken by a <b> or an <a> arrives as three text nodes, and in
   * English the spaces around the emphasised word belong there. In Japanese and
   * Chinese they do not: those languages set no space between words, so
   * re-attaching one puts a visible gap around every bold term. In Korean the
   * answer depends on what the fragment starts with -- a particle binds to the
   * preceding word and takes no space, an ordinary word does.
   *
   * The test is on the translation's own edge character, so a fragment that
   * begins with a Latin name keeps its space in every language. */
  var CJK = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
  var HANGUL = /[가-힣]/;
  /* Korean particles, as whole tokens: 는 can only be a particle, but 도 also
     starts 도시, so the match has to end at a boundary. */
  var PARTICLE = /^(?:은|는|이|가|을|를|와|과|의|에|도|만|로|으로|에서|에게|부터|까지|보다|처럼|이다|입니다|이며|이자|이라는|라는|이라고|라고)(?![가-힣])/;
  var TIGHT = lang === "ja" || lang === "zh";

  function edge(ws, out, trailing) {
    if (!ws || !out) return ws;
    var ch = trailing ? out.charAt(out.length - 1) : out.charAt(0);
    if (TIGHT && CJK.test(ch)) return "";
    if (lang === "ko" && !trailing && HANGUL.test(ch) && PARTICLE.test(out)) return "";
    return ws;
  }

  function translate(text) {
    var m = text.match(EDGES);
    var key = m[2].replace(WS, " ");
    if (!key) return null;

    var out = DICT[key];
    if (out === undefined) {
      for (var i = 0; i < PATTERNS.length; i++) {
        var hit = key.match(PATTERNS[i][0]);
        if (hit) {
          out = PATTERNS[i][1].replace(/\$(\d)/g, function (_, d) { return hit[+d] || ""; });
          break;
        }
      }
    }
    /* An empty translation is a real answer, not a missing one: it is how a
       language that has no articles drops a stray "The" left stranded outside
       a <b> or an <a>. Only the dictionary can produce one -- the generator
       writes a comment, not an empty string, for a key nobody translated. */
    if (out === undefined || out === null) return null;
    return edge(m[1], out, 0) + out + edge(m[3], out, 1);
  }

  /* ---------- applying ---------- */

  var applying = false;

  function walk(root) {
    if (!root) return;
    applying = true;
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = it.nextNode())) {
      var p = n.parentNode && n.parentNode.nodeName;
      if (p === "SCRIPT" || p === "STYLE") continue;
      var out = translate(n.nodeValue);
      if (out !== null) n.nodeValue = out;
    }
    applying = false;
  }

  function retranslate(node) {
    if (node.nodeType === 3) {
      var o = translate(node.nodeValue);
      if (o !== null) { applying = true; node.nodeValue = o; applying = false; }
    } else if (node.nodeType === 1) {
      walk(node);
    }
  }

  function boot() {
    walk(document.body);
    /* Most of the console's text is written by script after load, and the map
       and charts rewrite theirs continuously, so translation cannot be a
       one-off pass. */
    new MutationObserver(function (muts) {
      if (applying) return;
      muts.forEach(function (mu) {
        if (mu.type === "characterData") { retranslate(mu.target); return; }
        Array.prototype.forEach.call(mu.addedNodes, retranslate);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ---------- fetch this language ---------- */

  /* Injected rather than listed in every page's markup: a page should not have
     to know which languages exist. A page with a lot of copy of its own — the
     Earthquake Guide — asks for an extra pack with data-i18n-pack, so the other
     eight pages are not carrying the guide's prose. */
  var packs = ["js/i18n/" + lang + ".js"];
  var extra = document.body && document.body.dataset.i18nPack;
  if (extra) extra.split(/\s+/).forEach(function (p) {
    if (p) packs.push("js/i18n/" + lang + "-" + p + ".js");
  });

  var pending = packs.length;
  function done() {
    if (--pending) return;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
  packs.forEach(function (src) {
    var s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = done;
    /* A pack that is missing is not an error: those strings stay in English. */
    s.onerror = done;
    document.head.appendChild(s);
  });
})();
