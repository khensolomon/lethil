/* app.js — nav push/resize, theme toggle, scroll reveal. Vanilla, no deps. */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;

  /* =========================================================================
     NAV — body[data-nav="open|closed"] drives everything in CSS:
       - .sidebar slides in (fixed, full height)
       - .shell gets margin-left (>=700px, resize) or translateX (<700px, push)
     The INITIAL state is set by the inline script in default.html before the
     shell renders, so page loads never animate. This module only handles
     user-driven changes.
     ======================================================================= */
  var mqWide = window.matchMedia("(min-width: 700px)");
  var navBtn = document.querySelector("[data-nav-toggle]");
  var isDocs = body.classList.contains("is-docs");

  function navOpen() { return body.getAttribute("data-nav") === "open"; }

  function setNav(open, remember) {
    body.setAttribute("data-nav", open ? "open" : "closed");
    if (navBtn) navBtn.setAttribute("aria-expanded", String(open));
    // Only docs remembers the choice (per tab), so navigating between docs
    // pages keeps the sidebar where you left it. Home always starts closed.
    if (remember && isDocs) {
      try { sessionStorage.setItem("nav:docs", open ? "open" : "closed"); } catch (e) {}
    }
  }

  if (navBtn) {
    navBtn.setAttribute("aria-expanded", String(navOpen())); // sync initial
    navBtn.addEventListener("click", function () { setNav(!navOpen(), true); });
  }

  // Mobile: tapping the pushed-aside content closes the nav.
  var shell = document.querySelector(".shell");
  if (shell) {
    shell.addEventListener("click", function (e) {
      if (mqWide.matches || !navOpen()) return;
      if (navBtn && navBtn.contains(e.target)) return; // the toggle handles itself
      setNav(false, false);
    });
  }

  // Escape closes the nav (any viewport) when nothing else claims it.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && navOpen() && !mqWide.matches) setNav(false, false);
  });

  // Shrinking to mobile with the nav open would shove content off-screen —
  // close it. Growing back to wide on docs restores the remembered state.
  mqWide.addEventListener("change", function (e) {
    if (!e.matches) { if (navOpen()) setNav(false, false); return; }
    if (isDocs) {
      var stored = null;
      try { stored = sessionStorage.getItem("nav:docs"); } catch (err) {}
      setNav(stored !== "closed", false);
    }
  });

  /* =========================================================================
     THEME — two states: "auto" (follow the device) and a single manual
     override to the OPPOSITE of what the device currently prefers. So on a
     device set to dark, the toggle flips auto(dark) <-> light; on a device set
     to light, it flips auto(light) <-> dark. One click to override, one to
     return to auto.
     ======================================================================= */
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function resolve(pref) {
    if (pref === "dark") return "dark";
    if (pref === "light") return "light";
    return media.matches ? "dark" : "light";   // auto
  }

  // the manual override is always the opposite of the device's current pref
  function oppositeOfDevice() { return media.matches ? "light" : "dark"; }

  function apply(pref) {
    root.setAttribute("data-theme", resolve(pref));
    root.setAttribute("data-theme-pref", pref);
    var label = pref === "auto" ? "auto (following device)" : pref;
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-label", "Color theme: " + label + " (click to change)");
    });
  }

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var current = root.getAttribute("data-theme-pref") || "auto";
      // auto -> manual override (opposite of device); anything else -> back to auto
      var next = current === "auto" ? oppositeOfDevice() : "auto";
      try { localStorage.setItem("theme", next); } catch (e) {}
      apply(next);
    });
  });

  media.addEventListener("change", function () {
    var pref = root.getAttribute("data-theme-pref") || "auto";
    // in auto, follow the device live. If the device flips to match a manual
    // override (e.g. override was "dark" and device becomes dark), that
    // override is now redundant — fall back to auto so the next click behaves.
    if (pref === "auto") apply("auto");
    else if (pref === resolve("auto")) apply("auto");
  });

  apply(root.getAttribute("data-theme-pref") || "auto");

  /* =========================================================================
     SCROLL REVEAL
     ======================================================================= */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = document.querySelectorAll(".reveal-on-scroll");
  if (!reduce && "IntersectionObserver" in window && targets.length) {
    root.classList.add("js-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }
})();
