/* ===========================================================================
 * highlight.js — arriving from a search result, jump to the match.
 *
 * Search links carry ?q=<term>. This finds that term in the article, marks
 * every occurrence, scrolls the first into view, and offers a small bar to
 * step between them or clear.
 *
 * Deliberately does not touch:
 *   .ph      placeholder spans, whose text is rewritten by placeholders.js —
 *            wrapping inside one would be overwritten on the next repaint
 *   script / style / mark   nothing useful, or already marked
 * ======================================================================== */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var q = (params.get("q") || "").trim();
  if (!q || q.length < 2) return;

  var scope = document.querySelector(".prose") ||
              document.querySelector(".docs__content") ||
              document.querySelector("main");
  if (!scope) return;

  var needle = q.toLowerCase();
  var hits = [];

  function walk(node) {
    for (var child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        markIn(child);
      } else if (child.nodeType === 1) {
        var tag = child.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") continue;
        if (child.classList && child.classList.contains("ph")) continue;
        walk(child);
      }
    }
  }

  function markIn(node) {
    var text = node.nodeValue;
    var lower = text.toLowerCase();
    if (lower.indexOf(needle) === -1) return;

    var frag = document.createDocumentFragment();
    var at = 0, i;
    // Collect the replacement first, then swap once: mutating while walking
    // would re-enter the nodes just created.
    while ((i = lower.indexOf(needle, at)) !== -1) {
      if (i > at) frag.appendChild(document.createTextNode(text.slice(at, i)));
      var m = document.createElement("mark");
      m.className = "hit";
      m.textContent = text.slice(i, i + needle.length);
      frag.appendChild(m);
      hits.push(m);
      at = i + needle.length;
    }
    if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
    node.parentNode.replaceChild(frag, node);
  }

  walk(scope);
  if (!hits.length) return;

  var current = 0;
  function focusHit(i) {
    hits.forEach(function (h, n) { h.classList.toggle("is-current", n === i); });
    var el = hits[i];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (label) label.textContent = (i + 1) + " of " + hits.length;
  }

  /* --- the bar ----------------------------------------------------------- */
  var bar = document.createElement("div");
  bar.className = "hitbar";
  bar.setAttribute("role", "status");

  var label = document.createElement("span");
  label.className = "hitbar__count mono";
  bar.appendChild(label);

  function btn(path, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "hitbar__btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + path + '"/></svg>';
    b.addEventListener("click", fn);
    return b;
  }

  bar.appendChild(btn("M6 15l6-6 6 6", "Previous match", function () {
    current = (current - 1 + hits.length) % hits.length;
    focusHit(current);
  }));
  bar.appendChild(btn("M6 9l6 6 6-6", "Next match", function () {
    current = (current + 1) % hits.length;
    focusHit(current);
  }));

  var term = document.createElement("span");
  term.className = "hitbar__term";
  term.textContent = q;
  bar.insertBefore(term, bar.firstChild);

  bar.appendChild(btn("M18 6 6 18M6 6l12 12", "Clear highlights", function () {
    hits.forEach(function (h) {
      var t = document.createTextNode(h.textContent);
      h.parentNode.replaceChild(t, h);
    });
    bar.remove();
    // Drop ?q= so a reload or a shared link is clean.
    var url = window.location.pathname + window.location.hash;
    history.replaceState(null, "", url);
  }));

  document.body.appendChild(bar);
  focusHit(0);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !bar.isConnected) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    bar.querySelector(".hitbar__btn:last-child").click();
  });
})();
