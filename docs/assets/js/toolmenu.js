/* ===========================================================================
 * toolmenu.js — the Tools popover in the topbar.
 *
 * A disclosure: a button that shows a panel of links. Deliberately not an ARIA
 * menu widget — the contents are ordinary links, so there is no roving
 * tabindex and no arrow-key model to learn. What it does provide is what any
 * popover must: Escape closes it, clicking outside closes it, and focus goes
 * somewhere sensible in both directions.
 * ======================================================================== */
(function () {
  "use strict";

  var root = document.querySelector("[data-toolmenu]");
  if (!root) return;

  var btn = root.querySelector(".toolmenu__btn");
  var panel = root.querySelector(".toolmenu__panel");
  if (!btn || !panel) return;

  function isOpen() { return !panel.hidden; }

  function open() {
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    root.classList.add("is-open");
    var first = panel.querySelector("a");
    if (first) first.focus();
    if (window.lethilLayers) window.lethilLayers.opened("tools", function () { close(false); });
  }

  function close(returnFocus) {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
    // Only pull focus back when the panel was dismissed rather than followed —
    // otherwise clicking a link would yank focus off the page being left.
    if (returnFocus) btn.focus();
    if (window.lethilLayers) window.lethilLayers.closed("tools");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    isOpen() ? close(false) : open();
  });

  document.addEventListener("click", function (e) {
    if (isOpen() && !root.contains(e.target)) close(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) close(true);
  });

  // Focus leaving the panel entirely closes it, so tabbing past the last link
  // does not leave an open panel floating behind the page.
  root.addEventListener("focusout", function (e) {
    // A touch tap moves focus to nothing, so relatedTarget is null and this
    // fired on the way to the button's own click — closing the panel, which
    // the click then reopened. Tapping the button twice appeared to do
    // nothing. Focus going nowhere is not focus leaving; real outside taps are
    // already covered by the document click handler.
    if (!e.relatedTarget) return;
    if (isOpen() && !root.contains(e.relatedTarget)) close(false);
  });
})();
