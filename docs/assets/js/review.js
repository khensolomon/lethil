/* ===========================================================================
 * review.js — page notes: marking what needs fixing, where it needs fixing.
 *
 * Notes are captured on the page they concern and anchored to the nearest
 * heading, so a note reads as "Cloudflare Tunnel › Configure is outdated"
 * rather than "the cloudflare page needs work". They appear in two places from
 * one store: beside the heading in place, and collected at /todo/review/.
 *
 * Local to the device. The export exists because a note that never leaves the
 * browser never becomes a commit — which is the only outcome that matters.
 * ======================================================================== */
(function () {
  "use strict";

  var KEY = "lethil:review";
  var TYPES = ["outdated", "unclear", "missing", "typo"];

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var a = raw ? JSON.parse(raw) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  function forPage(url) {
    return read().filter(function (n) { return n.url === url; });
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* =======================================================================
     IN-PAGE: capture and markers
     ==================================================================== */
  var article = document.querySelector(".docs__content.prose");
  var pageUrl = window.location.pathname;

  function headings() {
    return article ? article.querySelectorAll("h2[id], h3[id]") : [];
  }

  /* The heading currently being read: the last one scrolled past. */
  function nearestHeading() {
    var hs = headings(), found = null;
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].getBoundingClientRect().top < 140) found = hs[i];
    }
    return found;
  }

  /* Re-attach a note whose heading id no longer exists.

     Anchors are derived from heading TEXT, so renaming "## Configure" to
     "## Configuration" changes the id and orphans every note on it — which is
     exactly when the note mattered. The text is stored alongside the id so a
     renamed-but-recognisable heading still matches, and a note that matches
     neither is surfaced at the top of the page rather than silently dropped. */
  function locate(note) {
    if (!note.headingId) return null;
    var byId = article ? article.querySelector('[id="' + CSS.escape(note.headingId) + '"]') : null;
    if (byId) return byId;
    if (!note.headingText) return null;
    var hs = headings();
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].textContent.replace(/#$/, "").trim() === note.headingText) return hs[i];
    }
    return null;
  }

  function renderMarkers() {
    if (!article) return;
    article.querySelectorAll(".notemark, .noteorphan").forEach(function (e) { e.remove(); });

    var notes = forPage(pageUrl);
    var orphans = [];

    notes.forEach(function (n) {
      var h = locate(n);
      if (!h) { orphans.push(n); return; }
      var mark = h.querySelector(".notemark");
      if (!mark) {
        mark = document.createElement("button");
        mark.type = "button";
        mark.className = "notemark";
        mark.dataset.count = "0";
        h.appendChild(mark);
        mark.addEventListener("click", function () { openList(h, mark); });
      }
      var c = parseInt(mark.dataset.count, 10) + 1;
      mark.dataset.count = String(c);
      mark.textContent = c > 1 ? "⚑ " + c : "⚑";
      mark.title = c + (c === 1 ? " note on this section" : " notes on this section");
    });

    if (orphans.length) {
      var box = document.createElement("div");
      box.className = "noteorphan";
      box.innerHTML = '<p class="noteorphan__head mono">' + orphans.length +
        ' note' + (orphans.length === 1 ? "" : "s") +
        ' whose section may have been renamed</p>';
      orphans.forEach(function (n) { box.appendChild(noteRow(n)); });
      article.insertBefore(box, article.firstChild);
    }
  }

  function noteRow(n) {
    var row = document.createElement("div");
    row.className = "noterow";
    row.innerHTML =
      '<span class="noterow__type mono" data-type="' + esc(n.type) + '">' + esc(n.type) + '</span>' +
      '<span class="noterow__text">' + esc(n.text) + '</span>';
    var done = document.createElement("button");
    done.type = "button";
    done.className = "noterow__done";
    done.textContent = "Resolve";
    done.title = "Remove this note";
    done.addEventListener("click", function () {
      write(read().filter(function (x) { return x.id !== n.id; }));
      renderMarkers();
      var pop = document.querySelector(".notelist");
      if (pop) pop.remove();
      paintCount();
    });
    row.appendChild(done);
    return row;
  }

  function openList(h, anchor) {
    var old = document.querySelector(".notelist");
    if (old) { old.remove(); if (old.dataset.for === h.id) return; }
    var pop = document.createElement("div");
    pop.className = "notelist";
    pop.dataset.for = h.id;
    forPage(pageUrl).forEach(function (n) {
      if (locate(n) === h) pop.appendChild(noteRow(n));
    });
    h.insertAdjacentElement("afterend", pop);
  }

  /* --- the capture form -------------------------------------------------- */
  var btn = document.querySelector("[data-review-add]");
  var panel = document.querySelector("[data-review-form]");

  function paintCount() {
    if (!btn) return;
    var n = forPage(pageUrl).length;
    btn.classList.toggle("is-on", n > 0);
    btn.title = n ? n + (n === 1 ? " note on this page" : " notes on this page")
                  : "Note something to fix on this page";
  }

  if (btn && panel && article) {
    var ta = panel.querySelector("textarea");
    var where = panel.querySelector("[data-review-where]");
    var sel = panel.querySelector("select");
    var target = null;

    function openForm() {
      target = nearestHeading();
      where.textContent = target ? target.textContent.replace(/⚑.*$/, "").replace(/#$/, "").trim()
                                 : "top of the page";
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      ta.value = "";
      ta.focus();
    }
    function closeForm() {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden ? openForm() : closeForm();
    });
    document.addEventListener("click", function (e) {
      if (panel.hidden) return;
      if (!e.target || !e.target.isConnected) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      closeForm();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { closeForm(); btn.focus(); }
    });

    panel.querySelector("[data-review-save]").addEventListener("click", function () {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      var list = read();
      list.push({
        id: uid(),
        url: pageUrl,
        title: (document.querySelector(".docs__content h1") || {}).textContent || document.title,
        section: (document.querySelector(".contextbar__crumbs li:nth-child(2)") || {}).textContent || "",
        headingId: target ? target.id : "",
        headingText: target ? target.textContent.replace(/⚑.*$/, "").replace(/#$/, "").trim() : "",
        type: TYPES.indexOf(sel.value) > -1 ? sel.value : "outdated",
        text: text,
        createdAt: new Date().toISOString()
      });
      write(list);
      closeForm();
      renderMarkers();
      paintCount();
    });

    renderMarkers();
    paintCount();
  }

  /* =======================================================================
     COLLECTED: /todo/review/
     ==================================================================== */
  var root = document.querySelector("[data-review-page]");
  if (!root) return;

  var notesEl = root.querySelector("[data-review-notes]");
  var findEl = root.querySelector("[data-review-findings]");
  var countEl = root.querySelector("[data-review-count]");

  function renderNotes() {
    var list = read().sort(function (a, b) {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    if (countEl) countEl.textContent = list.length + (list.length === 1 ? " note" : " notes");

    if (!list.length) {
      notesEl.innerHTML = '<p class="review__empty">No page notes yet. Use the flag in the header of any page.</p>';
      return;
    }
    var byPage = {};
    list.forEach(function (n) { (byPage[n.url] = byPage[n.url] || []).push(n); });

    notesEl.textContent = "";
    Object.keys(byPage).forEach(function (url) {
      var group = byPage[url];
      var sec = document.createElement("section");
      sec.className = "review__page";
      var h = document.createElement("h3");
      h.className = "review__page-title";
      h.innerHTML = '<a href="' + esc(url) + '">' + esc(group[0].title) + '</a>' +
        '<span class="review__page-count mono">' + group.length + '</span>';
      sec.appendChild(h);
      group.forEach(function (n) {
        var row = noteRow(n);
        if (n.headingText) {
          var w = document.createElement("a");
          w.className = "noterow__where mono";
          w.href = url + (n.headingId ? "#" + n.headingId : "");
          w.textContent = n.headingText;
          row.insertBefore(w, row.querySelector(".noterow__text"));
        }
        sec.appendChild(row);
      });
      notesEl.appendChild(sec);
    });
  }

  /* --- automatic findings ------------------------------------------------
     Computed from the indexes the site already publishes, so they are always
     current and need no upkeep. These are the problems that are invisible
     while writing but obvious across the whole set.                        */
  function renderFindings(dir, search, graph) {
    var out = [];

    var noDesc = dir.filter(function (p) { return !p.description; });
    if (noDesc.length) out.push({
      k: "No description",
      why: "Becomes an empty search snippet and an empty line on the section index.",
      items: noDesc.map(function (p) { return { t: p.title, u: p.url }; })
    });

    var seen = {}, dupes = {};
    dir.forEach(function (p) {
      var t = p.title.toLowerCase();
      if (seen[t]) dupes[t] = true; else seen[t] = p;
    });
    var dupeList = dir.filter(function (p) { return dupes[p.title.toLowerCase()]; });
    if (dupeList.length) out.push({
      k: "Duplicate titles",
      why: "A [[wiki-link]] to this title resolves to whichever page is reached first.",
      items: dupeList.map(function (p) { return { t: p.title, u: p.url }; })
    });

    var linked = {};
    (graph.edges || []).forEach(function (e) { linked[e.target] = true; });
    var orphans = dir.filter(function (p) { return !linked[p.url]; });
    if (orphans.length) out.push({
      k: "No inbound links",
      why: "Reachable only by search or the section list — nothing points at it.",
      items: orphans.map(function (p) { return { t: p.title, u: p.url }; })
    });

    var tagCount = {};
    dir.forEach(function (p) { (p.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
    var lonely = Object.keys(tagCount).filter(function (t) { return tagCount[t] === 1; });
    if (lonely.length) out.push({
      k: "Tags used once",
      why: "A tag on a single page groups nothing; it only adds noise to the tag index.",
      items: lonely.sort().map(function (t) {
        return { t: t, u: "/directory/#tag=" + encodeURIComponent(t) };
      })
    });

    findEl.textContent = "";
    if (!out.length) {
      findEl.innerHTML = '<p class="review__empty">Nothing flagged.</p>';
      return;
    }
    out.forEach(function (f) {
      var d = document.createElement("details");
      d.className = "finding";
      d.innerHTML =
        '<summary class="finding__summary"><span class="finding__title">' + esc(f.k) +
        '</span><span class="finding__count mono">' + f.items.length + '</span></summary>' +
        '<p class="finding__why">' + esc(f.why) + '</p>' +
        '<ul class="finding__list">' + f.items.map(function (i) {
          return '<li><a href="' + esc(i.u) + '">' + esc(i.t) + '</a></li>';
        }).join("") + '</ul>';
      findEl.appendChild(d);
    });
  }

  var base = root.getAttribute("data-review-page") || "";
  Promise.all(
    ["directory.json", "search.json", "graph.json"].map(function (f) {
      return fetch(base + f).then(function (r) { return r.json(); }).catch(function () { return null; });
    })
  ).then(function (r) {
    if (r[0] && r[2]) renderFindings(r[0], r[1] || [], r[2]);
    else findEl.innerHTML = '<p class="review__empty">Could not load the site indexes.</p>';
  });

  renderNotes();

  /* --- export / import / clear ------------------------------------------- */
  var ex = root.querySelector("[data-review-export]");
  var im = root.querySelector("[data-review-import]");
  var cl = root.querySelector("[data-review-clear]");
  var status = root.querySelector("[data-review-status]");
  function say(m) { if (status) status.textContent = m; }

  if (ex) ex.addEventListener("click", function () {
    // Markdown, not JSON: the point of a note is to become a commit or a Todo
    // item, and this is the form that pastes straight into either.
    var list = read();
    if (!list.length) return;
    var byPage = {};
    list.forEach(function (n) { (byPage[n.url] = byPage[n.url] || []).push(n); });
    var md = "# Page notes\n\n";
    Object.keys(byPage).forEach(function (url) {
      md += "## " + byPage[url][0].title + "\n\n";
      byPage[url].forEach(function (n) {
        md += "- [ ] **" + n.type + "**" + (n.headingText ? " · " + n.headingText : "") +
              " — " + n.text + "  \n  `" + url + (n.headingId ? "#" + n.headingId : "") + "`\n";
      });
      md += "\n";
    });
    var blob = new Blob([md], { type: "text/markdown" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "page-notes.md";
    a.click();
    URL.revokeObjectURL(a.href);
    say("Exported " + list.length + " note" + (list.length === 1 ? "." : "s."));
  });

  if (im) im.addEventListener("change", function () {
    var f = im.files && im.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var incoming;
      try { incoming = JSON.parse(String(reader.result)); } catch (e) { say("Not valid JSON."); return; }
      if (!Array.isArray(incoming)) { say("No notes found."); return; }
      var all = read(), have = {};
      all.forEach(function (n) { have[n.id] = true; });
      var added = 0;
      incoming.forEach(function (n) {
        if (!n || typeof n.url !== "string" || n.url.charAt(0) !== "/") return;
        if (have[n.id]) return;
        n.id = n.id || uid();
        all.push(n); added++;
      });
      write(all);
      renderNotes();
      say(added ? "Imported " + added + "." : "Nothing new.");
      im.value = "";
    };
    reader.readAsText(f);
  });

  if (cl) cl.addEventListener("click", function () {
    if (!read().length) return;
    if (!window.confirm("Remove all page notes? This cannot be undone.")) return;
    write([]);
    renderNotes();
    say("All notes removed.");
  });
})();
