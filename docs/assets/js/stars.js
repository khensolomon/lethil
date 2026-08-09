/* stars.js — shows a live star count on the feature banner's star button and
   opens the repo's real GitHub page — the only place a visitor can actually
   star it. GitHub has no API for starring on someone's behalf from another
   site, and there's no way to read their GitHub login state from here either,
   so this can't be a true in-page toggle or know for certain whether they
   starred it. What it CAN do honestly: when they come back to this tab after
   clicking through, re-check the real count and show it if it rose — genuine
   feedback instead of guessing. Degrades silently if the repo can't be parsed
   or the API is offline/rate-limited. */
(function () {
  "use strict";

  var el = document.querySelector("[data-feature-star]");
  if (!el) return;

  var countEl = el.querySelector("[data-feature-star-count]");
  var m = el.getAttribute("href").match(/github\.com\/([^\/]+)\/([^\/]+?)\/?$/i);
  if (!m) return;                                    // not a recognizable GitHub repo URL

  var owner = m[1], repo = m[2];
  var API = "https://api.github.com/repos/" + owner + "/" + repo;
  var CACHE_KEY = "gh:stars:" + owner + "/" + repo, CACHE_TTL = 10 * 60 * 1000;   // 10 min
  var lastCount = null, pendingRecheck = false;

  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function show(count, rose) {
    lastCount = count;
    if (countEl) countEl.textContent = fmt(count);
    el.hidden = false;
    if (rose) {
      el.classList.add("just-rose");
      setTimeout(function () { el.classList.remove("just-rose"); }, 2200);
    }
  }

  function fromCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && (Date.now() - c.ts) < CACHE_TTL && typeof c.count === "number") return c.count;
    } catch (e) {}
    return null;
  }
  function toCache(count) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), count: count })); } catch (e) {}
  }

  function fetchCount(skipCache) {
    if (!skipCache) {
      var cached = fromCache();
      if (cached != null) { show(cached, false); return; }
    }
    fetch(API, { headers: { "Accept": "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        if (typeof data.stargazers_count !== "number") return;
        toCache(data.stargazers_count);
        show(data.stargazers_count, skipCache && lastCount != null && data.stargazers_count > lastCount);
      })
      .catch(function () { /* offline / rate-limited: the plain link still works, stays hidden */ });
  }

  fetchCount(false);

  // the star link opens the real GitHub page in a new tab; when the visitor
  // comes back here, quietly re-check the live count (bypassing the cache)
  el.addEventListener("click", function () { pendingRecheck = true; });
  window.addEventListener("focus", function () {
    if (pendingRecheck) { pendingRecheck = false; fetchCount(true); }
  });
})();
