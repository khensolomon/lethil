/* ===========================================================================
 * layers.js — one rule about what sits above what.
 *
 * Two kinds of surface on this site:
 *
 *   window     the composer. Persistent, movable, survives navigation. It sits
 *              above the page and stays where it was put.
 *   transient  search, tools, page actions, the note form. Summoned for one
 *              action and dismissed by clicking away.
 *
 * A transient surface is always raised ABOVE the window while it is open. It
 * was explicitly asked for, so hiding it behind a window that happens to
 * overlap the header would be the wrong answer — and the window is not closed
 * by it, so nothing is lost either way.
 *
 * Opening one transient surface also closes any other. Two popovers open at
 * once has no meaning, and leaving stale ones behind is how a header ends up
 * with three panels hanging off it.
 * ======================================================================== */
(function () {
  "use strict";

  var open = null;   // { name, close }

  function raise(on) {
    document.body.classList.toggle("has-popover", on);
  }

  /* A write announces itself.
     The `storage` event only fires in OTHER tabs, so a page that edits its own
     localStorage gets no notification — which is why the drafts list and the
     notes list on /review/ sat stale until a reload while the composer, right
     there on the same page, had already saved. Every writer calls changed();
     every list listens. `storage` is still handled for the cross-tab case. */
  window.lethilStore = {
    changed: function (key) {
      try {
        window.dispatchEvent(new CustomEvent("lethil:store", { detail: { key: key } }));
      } catch (e) {}
    },
    onChange: function (key, fn) {
      window.addEventListener("lethil:store", function (e) {
        if (!e.detail || e.detail.key === key) fn();
      });
      window.addEventListener("storage", function (e) {
        if (!e.key || e.key === key) fn();
      });
    }
  };

  window.lethilLayers = {
    /* Called by a transient surface as it opens. */
    opened: function (name, close) {
      if (open && open.name !== name && typeof open.close === "function") {
        try { open.close(); } catch (e) {}
      }
      open = { name: name, close: close };
      raise(true);
    },
    /* Called as it closes. Ignored if something else has since taken over. */
    closed: function (name) {
      if (open && open.name !== name) return;
      open = null;
      raise(false);
    },
    isOpen: function () { return !!open; }
  };
})();
