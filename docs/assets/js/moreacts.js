/* ===========================================================================
 * moreacts.js — collapse the page actions behind one button on narrow screens.
 *
 * The topbar accumulated Save, note, values, composer, tools and search. That
 * is comfortable on a tablet and too much at 360px.
 *
 * The buttons are MOVED into the overflow panel, not copied. Duplicates would
 * mean two elements per action, and every script here binds with
 * querySelector — the first match wins, so the copy in the panel would look
 * live and do nothing. Moving keeps one element, one handler, one state.
 * ======================================================================== */
(function () {
  "use strict";

  var host = document.querySelector("[data-moreacts]");
  var panel = document.querySelector("[data-moreacts-panel]");
  var btn = document.querySelector("[data-moreacts-btn]");
  if (btn) btn.classList.add("moreacts__btn");
  if (!host || !panel || !btn) return;

  // Everything that can move, in the order it should appear when stacked.
  var SELECTORS = ["[data-bookmark]", "[data-review-add]", "[data-ph-toggle]", "[data-composer-open]"];
  var homes = [];

  SELECTORS.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    // The note button lives in a wrapper that also holds its popover form;
    // move the wrapper so the form travels with it.
    var node = el.closest(".reviewadd") || el;
    // A placeholder, not a remembered nextSibling: these buttons are siblings
    // of each other, so the node stored as "what came after" was itself moved
    // into the panel, and putting the first one back threw "child not found in
    // parent" — which is why widening the window never restored them. A marker
    // left in place cannot go stale.
    var mark = document.createComment("pageact");
    node.parentNode.insertBefore(mark, node);
    homes.push({ node: node, mark: mark, el: el });
  });
  if (!homes.length) return;

  var mq = window.matchMedia("(max-width: 599.98px)");

  function label(el) {
    return el.getAttribute("aria-label") || el.getAttribute("title") || "Action";
  }

  function collapse() {
    host.hidden = false;
    homes.forEach(function (h) {
      if (panel.contains(h.node)) return;
      var row = document.createElement("div");
      row.className = "moreacts__row";
      row.appendChild(h.node);
      var text = document.createElement("span");
      text.className = "moreacts__label";
      text.textContent = label(h.el);
      row.appendChild(text);
      // Tapping anywhere on the row triggers its button: a 24px icon is a poor
      // target, and the row is already the width of the sheet.
      row.addEventListener("click", function (e) {
        if (e.target === h.el || h.el.contains(e.target)) return;
        if (h.el.disabled) return;
        h.el.click();
      });
      panel.appendChild(row);
    });
  }

  function expand() {
    close();
    host.hidden = true;
    homes.forEach(function (h) {
      if (!panel.contains(h.node)) return;
      h.mark.parentNode.insertBefore(h.node, h.mark);
    });
    panel.textContent = "";
  }

  function open() {
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    host.classList.add("is-open");
    if (window.lethilLayers) window.lethilLayers.opened("moreacts", close);
  }
  function close() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    host.classList.remove("is-open");
    if (window.lethilLayers) window.lethilLayers.closed("moreacts");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    panel.hidden ? open() : close();
  });
  document.addEventListener("click", function (e) {
    if (panel.hidden || !e.target || !e.target.isConnected) return;
    if (host.contains(e.target)) return;
    close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) { close(); btn.focus(); }
  });

  function apply() { mq.matches ? collapse() : expand(); }
  apply();
  (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(apply);
})();
