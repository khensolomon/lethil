/* activity.js — a quiet "is this portfolio alive?" signal.
   Pulls recent public GitHub events and cycles them one at a time between the
   hero and the first showcase. The dot's colour and pulse speed reflect how
   old the CURRENTLY SHOWN event is (six tiers, freshest to quiet) — not a
   separate "last active overall" stat — so it can never disagree with the
   "x ago" text sitting right next to it. The portfolio's own repo
   (khensolomon.github.io) still counts for the site's "last updated" footer
   line, but is kept OUT of the visible rotation so the site doesn't keep
   highlighting itself as a project.
   Degrades silently: if the API is unreachable or rate-limited, nothing shows. */
(function () {
  "use strict";

  var root = document.querySelector("[data-activity]");
  var updatedEl = document.querySelector("[data-site-updated]");
  if (!root && !updatedEl) return;

  var USER = "khensolomon";
  var SELF = USER + "/khensolomon.github.io";        // de-emphasised repo
  var API  = "https://api.github.com/users/" + USER + "/events/public?per_page=60";
  var CACHE_KEY = "gh:events", CACHE_TTL = 5 * 60 * 1000;   // 5 min

  var dotWrap = root && root.querySelector("[data-activity-status]");
  var dot = dotWrap && dotWrap.querySelector(".activity__dot");
  var labelEl = root && root.querySelector("[data-activity-label]");
  var linkEl  = root && root.querySelector("[data-activity-link]");
  var verbEl  = root && root.querySelector("[data-activity-verb]");
  var prepEl  = root && root.querySelector("[data-activity-prep]");
  var repoEl  = root && root.querySelector("[data-activity-repo]");
  var timeEl  = root && root.querySelector("[data-activity-time]");
  var eventEl = linkEl;

  /* ---- helpers ---------------------------------------------------------- */
  function relTime(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24); if (d < 7)  return d + "d ago";
    var w = Math.floor(d / 7);  if (w < 5)  return w + "w ago";
    var mo = Math.floor(d / 30); if (mo < 12) return mo + "mo ago";
    return Math.floor(d / 365) + "y ago";
  }
  function shortRepo(name) { return name.split("/").pop(); }
  function branch(ref) {
    if (!ref) return null;
    var b = ref.replace("refs/heads/", "").replace("refs/tags/", "");
    return (b === "master" || b === "main") ? null : b;
  }

  // turn one event into { verb, prep, repo, extra } — all fields defensive
  function describe(e) {
    var p = e.payload || {};
    var repo = shortRepo(e.repo.name);
    var c = e._count || 1;
    switch (e.type) {
      case "PushEvent":
        var n = p.size || (p.commits && p.commits.length) || 0;
        var br = c === 1 ? branch(p.ref) : null;        // branch only meaningful for a single push
        var verb = c > 1 ? ("Pushed " + c + "\u00d7") : (n ? ("Pushed " + n + " commit" + (n > 1 ? "s" : "")) : "Pushed");
        return { verb: verb, prep: "to", repo: repo, extra: br ? ("\u00b7 " + br) : "" };
      case "CreateEvent":
        return { verb: "Created " + (p.ref_type || "repo") + (p.ref ? (" " + p.ref) : ""), prep: "in", repo: repo };
      case "DeleteEvent":
        return { verb: "Deleted " + (p.ref_type || "ref") + (p.ref ? (" " + p.ref) : ""), prep: "in", repo: repo };
      case "PullRequestEvent":
        return { verb: (c > 1 ? c + " pull requests" : (p.action || "updated") + " a pull request"), prep: "in", repo: repo };
      case "PullRequestReviewEvent":
        return { verb: "Reviewed a pull request", prep: "in", repo: repo };
      case "IssuesEvent":
        return { verb: (c > 1 ? c + " issues" : (p.action || "updated") + " an issue"), prep: "in", repo: repo };
      case "IssueCommentEvent":
        return { verb: c > 1 ? (c + " comments") : "Commented", prep: "in", repo: repo };
      case "WatchEvent":
        return { verb: "Starred", prep: "", repo: repo };
      case "ForkEvent":
        return { verb: "Forked", prep: "", repo: repo };
      case "ReleaseEvent":
        return { verb: "Released " + ((p.release && p.release.tag_name) || ""), prep: "in", repo: repo };
      case "PublicEvent":
        return { verb: "Open-sourced", prep: "", repo: repo };
      case "MemberEvent":
        return { verb: "Added a collaborator", prep: "in", repo: repo };
      default:
        return { verb: e.type.replace(/Event$/, ""), prep: "in", repo: repo };
    }
  }

  // collapse consecutive events of the same type+repo into one, with a count
  // (keeps the newest timestamp of the run) so the ticker stays informative
  function group(events) {
    var out = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i], last = out[out.length - 1];
      var key = e.type + "|" + e.repo.name;
      if (last && last._key === key) { last._count++; }
      else { out.push({ type: e.type, repo: e.repo, payload: e.payload, created_at: e.created_at, _key: key, _count: 1 }); }
    }
    return out;
  }

  // Six tiers, keyed to how old THIS specific event is — not a separate
  // "last active overall" stat, so the dot can never disagree with the
  // "x ago" text sitting right next to it. Only the freshest tier gets an
  // extra text label ("Contribution"); every other tier is dot-only, since a
  // label repeating what "x ago" already says would be redundant.
  function tierFor(iso) {
    var mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
    if (mins <= 30)          return { cls: "tier-fresh",     label: "Contribution" };
    if (mins <= 1440)        return { cls: "tier-today",     label: "" };   // 1 day
    if (mins <= 10080)       return { cls: "tier-week",      label: "" };   // 1 week
    if (mins <= 20160)       return { cls: "tier-fortnight", label: "" };   // 2 weeks
    if (mins <= 43200)       return { cls: "tier-month",     label: "" };   // ~1 month
    return                          { cls: "tier-quiet",     label: "" };
  }

  /* ---- ticker ----------------------------------------------------------- */
  var timer = null, paused = false, idx = 0, feed = [];

  function paint(e) {
    var d = describe(e);
    var tier = tierFor(e.created_at);

    linkEl.href = "https://github.com/" + e.repo.name;
    verbEl.textContent = d.verb;
    prepEl.textContent = d.prep || "";      // empty -> :empty CSS rule hides it, no stray space
    repoEl.textContent = d.repo;
    timeEl.textContent = "\u00b7 " + relTime(e.created_at);

    dotWrap.className = "activity__status " + tier.cls;
    dotWrap.title = "Last active " + relTime(e.created_at);
    if (tier.label) { labelEl.textContent = tier.label; labelEl.hidden = false; }
    else { labelEl.textContent = ""; labelEl.hidden = true; }
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ping the dot in sync with the line cascade — Web Animations API so it
  // composites alongside the continuous box-shadow pulse rather than replacing
  // it (a CSS `animation` on the same element would clobber the pulse).
  function pingDot() {
    if (reduceMotion || !dot || !dot.animate) return;
    dot.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.55)", offset: 0.35 }, { transform: "scale(1)" }],
      { duration: 500, easing: "cubic-bezier(.22,.61,.36,1)" }
    );
  }

  // (re)play the whole line: re-arm the per-part cascade, ping the dot
  function reveal() {
    eventEl.classList.remove("is-in");
    void eventEl.offsetWidth;          // reflow so the animation restarts
    eventEl.classList.add("is-in");
    pingDot();
  }

  function advance() {
    idx = idx % feed.length;
    paint(feed[idx]);
    idx++;
    reveal();
  }

  function startTicker() {
    paint(feed[0]); idx = 1;
    requestAnimationFrame(reveal);
    if (feed.length > 1) {
      timer = setInterval(function () { if (!paused) advance(); }, 4200);
      root.addEventListener("mouseenter", function () { paused = true; });
      root.addEventListener("mouseleave", function () { paused = false; });
      // don't cycle in a background tab
      document.addEventListener("visibilitychange", function () { paused = document.hidden; });
    }
  }

  /* ---- render + fetch --------------------------------------------------- */
  function render(events) {
    if (!events || !events.length) return;
    events.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    // "last updated" = newest event on the portfolio repo itself (the very
    // events we keep OUT of the ticker) — that's when the site last changed
    if (updatedEl) {
      var self = null;
      for (var s = 0; s < events.length; s++) { if (events[s].repo.name === SELF) { self = events[s]; break; } }
      if (self) { updatedEl.textContent = "· updated " + relTime(self.created_at); updatedEl.hidden = false; }
    }

    if (root) {
      // the dot's tier is computed fresh inside paint() for whichever event
      // is currently shown, so there's nothing global to set up here

      feed = events.filter(function (e) { return e.repo.name !== SELF; });
      if (!feed.length) feed = events;                  // fallback: only self-activity
      feed = group(feed);                               // collapse repetitive runs

      root.hidden = false;
      requestAnimationFrame(function () { root.classList.add("is-ready"); });
      startTicker();
    }
  }

  function fromCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && (Date.now() - c.ts) < CACHE_TTL && c.events) return c.events;
    } catch (e) {}
    return null;
  }
  function toCache(events) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), events: events })); } catch (e) {}
  }

  var cached = fromCache();
  if (cached) { render(cached); return; }

  fetch(API, { headers: { "Accept": "application/vnd.github+json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (events) {
      if (!Array.isArray(events)) return;
      // keep only the fields we use, so the cache stays small
      var slim = events.map(function (e) {
        return { type: e.type, repo: { name: e.repo.name }, created_at: e.created_at,
                 payload: { size: e.payload && e.payload.size, ref: e.payload && e.payload.ref,
                            ref_type: e.payload && e.payload.ref_type, action: e.payload && e.payload.action,
                            release: e.payload && e.payload.release ? { tag_name: e.payload.release.tag_name } : undefined } };
      });
      toCache(slim);
      render(slim);
    })
    .catch(function () { /* offline / rate-limited: leave the widget hidden */ });
})();
