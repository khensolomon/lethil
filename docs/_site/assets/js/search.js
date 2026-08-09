/* search.js — fetches /search.json on first use, filters client-side.
   Three presentations, one state machine (box.classList 'is-open'):
     - docs desktop:  input always visible, dropdown panel
     - home desktop:  collapsible pill (icon → input)
     - phones:        icon → full-screen overlay (back button + input + results)
   CSS decides what 'is-open' looks like per width; JS just manages state. */
(function () {
  "use strict";

  var box = document.querySelector("[data-search]");
  if (!box) return;

  var input    = box.querySelector("[data-search-input]");
  var panel    = box.querySelector("[data-search-panel]");
  var results  = box.querySelector("[data-search-results]");
  var toggle   = box.querySelector("[data-search-toggle]");
  var closeBtn = box.querySelector("[data-search-close]");
  var URL_     = (window.SITE && window.SITE.searchUrl) || "/search.json";
  var mqPhone  = window.matchMedia("(max-width: 699.98px)");

  // the shortcut hint shows the real modifier for the visitor's platform
  var modKey = box.querySelector("[data-search-hint-mod]");
  if (modKey && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "")) {
    modKey.textContent = "\u2318";        // ⌘
    var hintEl = box.querySelector("[data-search-hint]");
    if (hintEl) hintEl.title = "Press / or \u2318K to search";
  }

  var index = null, loading = false, focusIdx = -1;
  var STORE_KEY = "search:q";

  // remember the last term across opens (and page navigations, same tab)
  try { var saved = sessionStorage.getItem(STORE_KEY); if (saved) input.value = saved; } catch (e) {}

  function load() {
    if (index || loading) return;
    loading = true;
    fetch(URL_)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { index = data; if (document.activeElement === input) run(input.value); })
      .catch(function () { index = []; renderError(); });
  }

  function renderError() {
    results.innerHTML = '<li class="search__empty">Search index unavailable. Try reloading the page.</li>';
    showPanel();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function snippet(text, q) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    var start = Math.max(0, i - 40);
    var slice = (start > 0 ? "…" : "") + text.slice(start, start + 140);
    var rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return escapeHtml(slice).replace(rx, "<mark>$1</mark>");
  }

  function score(item, q) {
    var t = item.title.toLowerCase(), c = (item.content || "").toLowerCase();
    if (t === q) return 100;
    if (t.indexOf(q) === 0) return 60;
    if (t.indexOf(q) > -1) return 40;
    if (c.indexOf(q) > -1) return 10;
    return 0;
  }

  function run(raw) {
    var q = raw.trim().toLowerCase();
    focusIdx = -1;
    if (!q) { hidePanel(); return; }
    if (!index) { load(); return; }

    var hits = index
      .map(function (it) { return { it: it, s: score(it, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8);

    if (!hits.length) {
      results.innerHTML = '<li class="search__empty">No matches for “' + escapeHtml(raw) + '”.</li>';
      showPanel();
      return;
    }

    results.innerHTML = hits.map(function (x) {
      var it = x.it;
      return '<li role="option"><a href="' + it.url + '">' +
        '<span class="search__rcat">' + escapeHtml(it.category || "Docs") + '</span> ' +
        '<span class="search__rtitle">' + escapeHtml(it.title) + '</span>' +
        '<div class="search__rsnip">' + snippet(it.content || "", q) + '</div>' +
        '</a></li>';
    }).join("");
    showPanel();
  }

  function showPanel() {
    panel.hidden = false;
    box.classList.add("has-results");
    if (!mqPhone.matches) document.body.classList.add("search-dim");
  }
  function hidePanel() {
    panel.hidden = true;
    box.classList.remove("has-results");
    document.body.classList.remove("search-dim");
    focusIdx = -1;
  }

  /* ---- open / close (phone overlay + desktop focus) --------------------- */
  function openSearch() {
    box.classList.add("is-open");
    if (mqPhone.matches) document.body.classList.add("search-lock");
    load();
    requestAnimationFrame(function () {
      input.focus();
      if (input.value.trim()) run(input.value);   // show the remembered results
    });
  }

  function closeSearch() {
    box.classList.remove("is-open");
    document.body.classList.remove("search-lock");   // keep the term for next time
    hidePanel();
  }

  // activate/deactivate: the single entry point for click, tap, and keyboard
  // shortcuts alike — phones get the overlay, desktop just focuses the box.
  function activateSearch() {
    if (mqPhone.matches) openSearch();
    else {
      input.focus();
      if (input.value.trim()) run(input.value);
    }
  }
  function deactivateSearch() {
    if (mqPhone.matches) { closeSearch(); if (toggle) toggle.focus(); }
    else { hidePanel(); input.blur(); }
  }

  if (toggle) { toggle.addEventListener("click", function () {
    if (mqPhone.matches && box.classList.contains("is-open")) deactivateSearch();
    else activateSearch();
  }); }
  if (closeBtn) { closeBtn.addEventListener("click", deactivateSearch); }

  /* if the viewport grows out of phone width while the overlay is open, drop
     the scroll lock so the desktop layout isn't left frozen */
  mqPhone.addEventListener("change", function (e) {
    if (!e.matches) { document.body.classList.remove("search-lock"); }
  });

  /* ---- keyboard + result navigation ------------------------------------- */
  function linkEls() { return Array.prototype.slice.call(results.querySelectorAll("a")); }

  function move(dir) {
    var els = linkEls();
    if (!els.length) return;
    focusIdx = (focusIdx + dir + els.length) % els.length;
    els.forEach(function (a, i) { a.classList.toggle("is-focused", i === focusIdx); });
    els[focusIdx].scrollIntoView({ block: "nearest" });
  }

  var debounce;
  input.addEventListener("input", function () {
    try { sessionStorage.setItem(STORE_KEY, input.value); } catch (e) {}
    clearTimeout(debounce);
    debounce = setTimeout(function () { run(input.value); }, 120);
  });
  input.addEventListener("focus", function () {
    load();
    if (input.value.trim()) run(input.value);   // reopen shows the last results
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") {
      var els = linkEls();
      var target = els[focusIdx] || els[0];
      if (target) { e.preventDefault(); window.location.href = target.getAttribute("href"); }
    }
    // Escape is handled globally below, so it works even when a result link
    // (not the input) has keyboard focus.
  });

  /* ---- global shortcuts: "/" or Ctrl/Cmd+K to focus, Escape to unfocus --- */
  function isTypingElsewhere(el) {
    if (!el || el === input) return false;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  }
  document.addEventListener("keydown", function (e) {
    var openShortcut = (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) ||
      ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K"));

    if (openShortcut) {
      if (document.activeElement === input) return;      // let '/' type normally once inside
      if (isTypingElsewhere(document.activeElement)) return;  // don't hijack other fields
      e.preventDefault();
      activateSearch();
      return;
    }

    if (e.key === "Escape") {
      var openOnPhone = mqPhone.matches && box.classList.contains("is-open");
      var activeOnDesktop = !mqPhone.matches && (document.activeElement === input || box.classList.contains("has-results"));
      if (openOnPhone || activeOnDesktop) { e.preventDefault(); deactivateSearch(); }
    }
  });

  /* ---- click-away: close the dropdown (desktop box stays in place) ------- */
  document.addEventListener("click", function (e) {
    if (box.contains(e.target)) return;
    if (!mqPhone.matches) hidePanel();     // the phone overlay owns the screen
  });
})();
