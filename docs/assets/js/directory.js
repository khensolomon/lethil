/* directory.js — the interactive "all pages" index. Fetches /directory.json once,
   renders a card grid, and filters it by facet chips. No search box: filtering
   is entirely facet-driven. Categories multi-select with OR (a page in ANY
   picked category shows); tags multi-select with AND (a page must have ALL
   picked tags) so tags narrow while categories broaden. Vanilla, no deps. */
(function () {
  "use strict";

  var grid = document.querySelector("[data-directory-grid]");
  if (!grid) return;

  var catBox = document.querySelector("[data-directory-categories]");
  var tagBox = document.querySelector("[data-directory-tags]");
  var countEl = document.querySelector("[data-directory-count]");
  var emptyEl = document.querySelector("[data-directory-empty]");
  var clearBtn = document.querySelector("[data-directory-clear]");

  var docs = [];
  var state = { categories: [], tags: [] };

  var PER_PAGE = 36;             // cards rendered per page
  var page = 1;                  // current page (1-based)
  var pagerEl = document.querySelector("[data-directory-pager]");

  // deep-link support: /directory/#tag=docker&category=Server (from the /tags/ and
  // /categories/ index pages, doc-page tag links, and card tags). Repeated keys
  // accumulate, so #category=Plex&category=Server selects both.
  function readHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return;
    h.split("&").forEach(function (pair) {
      var kv = pair.split("=");
      var k = kv[0], v = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
      if (!v) return;
      if (k === "category" && state.categories.indexOf(v) === -1) state.categories.push(v);
      else if (k === "tag" && state.tags.indexOf(v) === -1) state.tags.push(v);
    });
  }

  function writeHash() {
    var parts = [];
    state.categories.forEach(function (c) { parts.push("category=" + encodeURIComponent(c)); });
    state.tags.forEach(function (t) { parts.push("tag=" + encodeURIComponent(t)); });
    // replaceState so filtering doesn't spam browser history
    history.replaceState(null, "", parts.length ? "#" + parts.join("&") : location.pathname);
  }

  function uniqueSorted(values) {
    var seen = {}, out = [];
    values.forEach(function (v) {
      if (v == null || v === "") return;
      var k = v.toString();
      if (!seen[k]) { seen[k] = true; out.push(k); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  }

  // compact large counts so busy facets stay tidy: 1200 -> "1.2k", 1_000_000 -> "1M".
  // Small numbers are left as-is. Full value goes in the title for accessibility.
  function compactCount(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) {
      var k = n / 1000;
      return (k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)) + "k";
    }
    var m = n / 1000000;
    return (m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)) + "M";
  }

  function chip(label, count, kind) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "directory__chip";
    b.dataset.kind = kind;
    b.dataset.value = label;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = "<span class=\"directory__chip-label\"></span>" +
      "<span class=\"directory__chip-count mono\"></span>";
    b.querySelector(".directory__chip-label").textContent = label;
    var countEl2 = b.querySelector(".directory__chip-count");
    countEl2.textContent = compactCount(count);
    if (count >= 1000) countEl2.title = count + " pages";   // full number on hover
    return b;
  }

  function buildFacets() {
    var catCounts = {}, tagCounts = {};
    docs.forEach(function (d) {
      if (d.category) catCounts[d.category] = (catCounts[d.category] || 0) + 1;
      (d.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    uniqueSorted(Object.keys(catCounts)).forEach(function (c) {
      catBox.appendChild(chip(c, catCounts[c], "category"));
    });
    uniqueSorted(Object.keys(tagCounts)).forEach(function (t) {
      tagBox.appendChild(chip(t, tagCounts[t], "tag"));
    });
    catBox.addEventListener("click", onChip);
    tagBox.addEventListener("click", onChip);
    if (clearBtn) clearBtn.addEventListener("click", clearAll);
    setupCollapse();
  }

  // For each collapsible chip group: if its chips overflow the collapsed height,
  // show a "Show all (N)" toggle; otherwise hide it. Re-checked on resize since
  // wrapping changes with width.
  function setupCollapse() {
    var groups = document.querySelectorAll("[data-facet-group]");
    Array.prototype.forEach.call(groups, function (group) {
      var box = group.querySelector("[data-collapsible]");
      var btn = group.querySelector("[data-more]");
      if (!box || !btn) return;

      function refresh() {
        var expanded = box.classList.contains("is-expanded");
        // overflow exists if the full content is taller than the collapsed cap
        var overflowing = box.scrollHeight - box.clientHeight > 2 || expanded;
        // to test real overflow while expanded, briefly compare against cap
        if (expanded) {
          box.classList.remove("is-expanded");
          overflowing = box.scrollHeight - box.clientHeight > 2;
          box.classList.add("is-expanded");
        }
        btn.hidden = !overflowing;
        if (overflowing) {
          var count = box.querySelectorAll(".directory__chip").length;
          btn.textContent = expanded ? "Show less" : "Show all (" + count + ")";
        }
      }

      btn.addEventListener("click", function () {
        box.classList.toggle("is-expanded");
        refresh();
      });
      refresh();
      // re-evaluate on resize (debounced)
      var t;
      window.addEventListener("resize", function () {
        clearTimeout(t); t = setTimeout(refresh, 150);
      });
    });
  }

  function toggle(arr, val) {
    var i = arr.indexOf(val);
    if (i === -1) arr.push(val); else arr.splice(i, 1);
  }

  function onChip(ev) {
    var b = ev.target.closest(".directory__chip");
    if (!b) return;
    toggle(b.dataset.kind === "category" ? state.categories : state.tags, b.dataset.value);
    syncChips(); writeHash(); filter();
  }

  function clearAll() {
    state.categories = []; state.tags = [];
    syncChips(); writeHash(); filter();
  }

  function syncChips() {
    Array.prototype.forEach.call(catBox.children, function (b) {
      var on = state.categories.indexOf(b.dataset.value) !== -1;
      b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on);
    });
    Array.prototype.forEach.call(tagBox.children, function (b) {
      var on = state.tags.indexOf(b.dataset.value) !== -1;
      b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on);
    });
  }

  function matches(d) {
    // categories: OR (in ANY selected category)
    if (state.categories.length && state.categories.indexOf(d.category) === -1) return false;
    // tags: AND (has ALL selected tags)
    if (state.tags.length) {
      var tset = d.tags || [];
      for (var i = 0; i < state.tags.length; i++) {
        if (tset.indexOf(state.tags[i]) === -1) return false;
      }
    }
    return true;
  }

  function card(d) {
    var a = document.createElement("a");
    a.className = "directory__card";
    a.href = d.url;
    a.innerHTML =
      "<span class=\"directory__card-section mono\"></span>" +
      "<span class=\"directory__card-title\"></span>" +
      "<span class=\"directory__card-desc\"></span>" +
      "<span class=\"directory__card-tags\"></span>";
    a.querySelector(".directory__card-section").textContent = d.section;
    a.querySelector(".directory__card-title").textContent = d.title;
    a.querySelector(".directory__card-desc").textContent = d.description || "";
    // tags on the card are themselves filter buttons — clicking one adds it to
    // the tag filter instead of navigating to the page.
    var tagWrap = a.querySelector(".directory__card-tags");
    (d.tags || []).slice(0, 5).forEach(function (t) {
      var tb = document.createElement("button");
      tb.type = "button";
      tb.className = "directory__card-tag mono";
      tb.textContent = t;
      tb.dataset.tag = t;
      tb.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();       // don't follow the card link
        if (state.tags.indexOf(t) === -1) state.tags.push(t);
        syncChips(); writeHash(); filter();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      tagWrap.appendChild(tb);
    });
    return a;
  }

  // filter changed: always return to page 1, then draw
  function filter() { page = 1; render(); }

  function goToPage(n, total) {
    page = Math.max(1, Math.min(n, total));
    render();
    // bring the top of the grid into view when paging
    var top = document.querySelector(".directory__controls");
    if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pageButton(label, targetPage, totalPages, opts) {
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.className = "directory__page" + (opts.current ? " is-current" : "");
    b.textContent = label;
    if (opts.disabled) { b.disabled = true; }
    else { b.addEventListener("click", function () { goToPage(targetPage, totalPages); }); }
    if (opts.current) b.setAttribute("aria-current", "page");
    return b;
  }

  // numbered pager with Prev/Next and ellipses for long ranges
  function renderPager(totalItems) {
    if (!pagerEl) return;
    pagerEl.innerHTML = "";
    var totalPages = Math.ceil(totalItems / PER_PAGE);
    if (totalPages <= 1) { pagerEl.hidden = true; return; }
    pagerEl.hidden = false;

    pagerEl.appendChild(pageButton("‹ Prev", page - 1, totalPages, { disabled: page === 1 }));

    // window of page numbers: first, last, current±1, with ellipses between
    var nums = [];
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) nums.push(i);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    nums.forEach(function (n) {
      if (n === "…") {
        var s = document.createElement("span");
        s.className = "directory__page-gap"; s.textContent = "…";
        pagerEl.appendChild(s);
      } else {
        pagerEl.appendChild(pageButton(String(n), n, totalPages, { current: n === page }));
      }
    });

    pagerEl.appendChild(pageButton("Next ›", page + 1, totalPages, { disabled: page === totalPages }));
  }

  function render() {
    var shown = docs.filter(matches);
    var totalPages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
    if (page > totalPages) page = totalPages;      // clamp if filters shrank the set

    var startIdx = (page - 1) * PER_PAGE;
    var pageItems = shown.slice(startIdx, startIdx + PER_PAGE);

    grid.innerHTML = "";
    pageItems.forEach(function (d) { grid.appendChild(card(d)); });
    emptyEl.hidden = shown.length !== 0;

    var bits = [shown.length + " of " + docs.length + " pages"];
    if (shown.length > PER_PAGE) {
      var first = shown.length ? startIdx + 1 : 0;
      var last = startIdx + pageItems.length;
      bits[0] = "showing " + first + "\u2013" + last + " of " + shown.length;
    }
    if (state.categories.length) bits.push("categories: " + state.categories.join(", "));
    if (state.tags.length) bits.push("tags: " + state.tags.join(", "));
    countEl.textContent = bits.join(" \u00b7 ");

    if (clearBtn) clearBtn.hidden = !(state.categories.length || state.tags.length);
    renderPager(shown.length);
  }

  fetch(window.DIRECTORY_URL)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      docs = data || [];
      readHash();
      buildFacets();
      syncChips();
      render();
    })
    .catch(function () {
      if (countEl) countEl.textContent = "Couldn't load the page index.";
    });
})();
