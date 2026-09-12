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
  var dir = null;                 // directory.json — browse data + facets
  var activeSection = "";         // "" = every section
  var STORE_KEY = "search:q";
  var SECT_KEY = "search:section";
  var facets = box.querySelector("[data-search-facets]");
  var foot = box.querySelector("[data-search-foot]");
  var DIR_URL = (window.SITE && window.SITE.directoryUrl) || "/directory.json";

  try { activeSection = sessionStorage.getItem(SECT_KEY) || ""; } catch (e) {}

  // remember the last term across opens (and page navigations, same tab)
  try { var saved = sessionStorage.getItem(STORE_KEY); if (saved) input.value = saved; } catch (e) {}

  function load() {
    if (index || loading) return;
    loading = true;
    // Both indexes, in parallel: search.json carries page text for matching and
    // snippets, directory.json carries the section, description and tags that
    // browsing needs. Neither is fetched until the box is first used.
    Promise.all([
      fetch(URL_).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(DIR_URL).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (res) {
      index = res[0];
      dir = res[1];
      buildFacets();
      run(input.value);
    }).catch(function () { index = []; dir = []; renderError(); });
  }

  /* --- section chips: the only control in the panel --------------------- */
  function buildFacets() {
    if (!facets || !dir) return;
    var seen = {}, order = [];
    dir.forEach(function (it) {
      var s = it.section || "";
      if (s && !seen[s]) { seen[s] = 1; order.push(s); }
    });
    facets.textContent = "";
    order.unshift("");                       // the "All" chip
    facets.className = "search__facets";
    order.forEach(function (name) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "search__facet" + (activeSection === name ? " is-active" : "");
      b.dataset.section = name;
      b.textContent = name || "All";
      b.setAttribute("aria-pressed", String(activeSection === name));
      b.addEventListener("click", function () {
        activeSection = (activeSection === name) ? "" : name;
        try { sessionStorage.setItem(SECT_KEY, activeSection); } catch (e) {}
        // Repaint in place. Rebuilding the strip here would remove this very
        // button mid-event, and the document-level outside-click listener —
        // which runs later and asks box.contains(e.target) — would then see a
        // detached node, conclude the click was outside, and close the panel.
        paintFacets();
        run(input.value);
        input.focus();
      });
      facets.appendChild(b);
    });
  }

  // Reflect activeSection on the existing buttons without replacing them.
  function paintFacets() {
    if (!facets) return;
    var btns = facets.querySelectorAll(".search__facet");
    for (var i = 0; i < btns.length; i++) {
      var isOn = (btns[i].dataset.section || "") === activeSection;
      btns[i].classList.toggle("is-active", isOn);
      btns[i].setAttribute("aria-pressed", String(isOn));
    }
  }

  function inSection(url) {
    if (!activeSection || !dir) return true;
    var base = url.split("#")[0];
    for (var i = 0; i < dir.length; i++) {
      if (dir[i].url === base) return dir[i].section === activeSection;
    }
    return false;
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

  /* Trim to word boundaries so a snippet never starts or ends mid-token —
     the old fixed ±40 characters routinely cut through a path. */
  function snippet(text, q) {
    if (!text) return "";
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return escapeHtml(text.slice(0, 120));

    var start = Math.max(0, i - 45);
    var end = Math.min(text.length, i + q.length + 95);
    if (start > 0) {
      var sp = text.indexOf(" ", start);
      if (sp > -1 && sp < i) start = sp + 1;
    }
    if (end < text.length) {
      var ep = text.lastIndexOf(" ", end);
      if (ep > i + q.length) end = ep;
    }
    var slice = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    var rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return escapeHtml(slice).replace(rx, "<mark>$1</mark>");
  }

  /* Page-title matches outrank heading matches, which outrank body text.
     Without that ordering, typing a page name could bury the page itself under
     its own sections — the cost of indexing per heading. */
  function score(item, q) {
    var t = (item.t || "").toLowerCase();
    var h = (item.h || "").toLowerCase();
    var x = (item.x || "").toLowerCase();
    var isPage = !item.h;

    if (isPage) {
      if (t === q) return 120;
      if (t.indexOf(q) === 0) return 90;
      if (t.indexOf(q) > -1) return 70;
    }
    if (h) {
      if (h === q) return 65;
      if (h.indexOf(q) === 0) return 55;
      if (h.indexOf(q) > -1) return 45;
    }
    if (!isPage && t.indexOf(q) > -1) return 30;
    if (x.indexOf(q) > -1) return 12;
    return 0;
  }

  /* --- browse: an empty box lists pages instead of showing nothing ------- */
  function browse() {
    if (!dir) { load(); return; }
    var items = dir.filter(function (it) {
      return !activeSection || it.section === activeSection;
    });

    if (!items.length) {
      results.innerHTML = '<li class="search__empty">Nothing in this section yet.</li>';
    } else {
      results.innerHTML = items.map(function (it) {
        return '<li role="option"><a href="' + it.url + '">' +
          '<span class="search__badge" aria-hidden="true">' + escapeHtml((it.section || "?").slice(0, 1)) + '</span>' +
          '<span class="search__rbody">' +
            '<span class="search__rtitle">' + escapeHtml(it.title) + '</span>' +
            (it.description ? '<span class="search__rsnip">' + escapeHtml(it.description) + '</span>' : '') +
          '</span></a></li>';
      }).join("");
    }
    if (foot) {
      foot.textContent = items.length + (items.length === 1 ? " page" : " pages") +
        (activeSection ? " in " + activeSection : "") + " — type to search";
    }
    showPanel();
  }

  function run(raw) {
    var q = raw.trim().toLowerCase();
    focusIdx = -1;
    if (!index) { load(); return; }
    if (!q) { browse(); return; }

    var scored = index
      .filter(function (it) { return inSection(it.u); })
      .map(function (it) { return { it: it, s: score(it, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });

    /* At most three rows from one page: a long runbook can match in a dozen
       sections, and burying every other page under it is worse than showing
       fewer of its parts. */
    var perPage = {}, hits = [];
    for (var n = 0; n < scored.length && hits.length < 8; n++) {
      var key = scored[n].it.t;
      perPage[key] = (perPage[key] || 0) + 1;
      if (perPage[key] > 3) continue;
      hits.push(scored[n]);
    }

    if (!hits.length) {
      results.innerHTML = '<li class="search__empty">No matches for “' + escapeHtml(raw) +
        '”' + (activeSection ? " in " + escapeHtml(activeSection) : "") + '.</li>';
      if (foot) foot.textContent = activeSection ? "Pick All to search everywhere" : "";
      showPanel();
      return;
    }

    results.innerHTML = hits.map(function (x) {
      var it = x.it;
      // The term travels with the link so the destination can jump to it. A
      // query parameter rather than a #:~: text fragment: the fragment syntax
      // is not supported everywhere, and a parameter survives being copied,
      // shared, or reloaded. The anchor from the record is kept after it.
      var parts = it.u.split("#");
      var href = parts[0] + "?q=" + encodeURIComponent(q) + (parts[1] ? "#" + parts[1] : "");
      return '<li role="option"><a href="' + href + '">' +
        '<span class="search__badge" aria-hidden="true">' + escapeHtml(it.b || "") + '</span>' +
        '<span class="search__rbody">' +
          '<span class="search__rtitle">' + escapeHtml(it.t) +
            (it.h ? '<span class="search__rsep">›</span><span class="search__rhead">' + escapeHtml(it.h) + '</span>' : '') +
          '</span>' +
          '<span class="search__rsnip">' + snippet(it.x || "", q) + '</span>' +
        '</span></a></li>';
    }).join("");
    if (foot) {
      foot.textContent = hits.length + (hits.length === 1 ? " match" : " matches") +
        (activeSection ? " in " + activeSection : "");
    }
    showPanel();
  }

  function showPanel() {
    if (window.lethilLayers) window.lethilLayers.opened("search", hidePanel);
    panel.hidden = false;
    box.classList.add("has-results");
    if (!mqPhone.matches) document.body.classList.add("search-dim");
  }
  function hidePanel() {
    if (window.lethilLayers) window.lethilLayers.closed("search");
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
      run(input.value);   // empty box browses; a remembered term searches
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
      run(input.value);
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
    run(input.value);   // empty box browses; a remembered term re-searches
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

  if (facets) {
    facets.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (facets.scrollWidth <= facets.clientWidth) return;
      e.preventDefault();
      facets.scrollLeft += e.deltaY;
    }, { passive: false });
  }

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
    // A node removed by an earlier handler in this same click is not "outside";
    // it just no longer exists. Without this, re-rendering anything inside the
    // panel on click would close the panel.
    if (!e.target || !e.target.isConnected) return;
    if (box.contains(e.target)) return;
    if (!mqPhone.matches) hidePanel();     // the phone overlay owns the screen
  });
})();
