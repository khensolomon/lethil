/* ===========================================================================
 * composer.js — a movable, resizable writing window, available on every page.
 *
 * Two kinds of draft from one form:
 *   page  front matter fields plus a body, exported as a ready-to-save .md
 *   note  a title and a body, for anything that is not a page yet
 *
 * Drafts live in localStorage and are listed on /review/. Nothing here writes
 * to disk — export hands over a file and the placing stays manual.
 *
 * The markdown preview is a deliberately small renderer rather than a library:
 * this site ships no build plugins and no third-party JS, and a preview only
 * has to cover what the docs actually use.
 * ======================================================================== */
(function () {
  "use strict";

  var KEY = "lethil:drafts";
  var OPEN = "lethil:composer:open";
  var GEOM = "lethil:composer:geom";
  var CUR = "lethil:composer:current";
  var MIN_W = 320, MIN_H = 260;

  function read() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function write(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
    if (window.lethilStore) window.lethilStore.changed(KEY);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* --- minimal markdown ---------------------------------------------------
     Escaped first, so no draft can inject markup into the preview. Covers
     what these docs use: fenced and inline code, headings, lists, tables,
     quotes, rules, links, emphasis. Anything else passes through as text. */
  function md(src) {
    var out = esc(src), blocks = [];
    // fenced code first, held aside so nothing below rewrites its contents
    out = out.replace(/```([a-z]*)\n([\s\S]*?)```/g, function (_, lang, body) {
      blocks.push('<pre><code>' + body.replace(/\n$/, "") + '</code></pre>');
      return "\u0000" + (blocks.length - 1) + "\u0000";
    });
    out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    out = out.replace(/^###### (.*)$/gm, "<h6>$1</h6>")
             .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
             .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
             .replace(/^### (.*)$/gm, "<h3>$1</h3>")
             .replace(/^## (.*)$/gm, "<h2>$1</h2>")
             .replace(/^# (.*)$/gm, "<h1>$1</h1>");
    out = out.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");
    out = out.replace(/^(---|\*\*\*)$/gm, "<hr>");
    out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, t, d) {
      return '<span class="cmp-wiki">' + (d || t) + "</span>";
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    // lists: consecutive markers collapse into one block
    out = out.replace(/(?:^[-*] .*(?:\n|$))+/gm, function (chunk) {
      var items = chunk.trim().split("\n").map(function (l) {
        var t = l.replace(/^[-*] /, "");
        var box = t.match(/^\[( |x|X)\] /);
        if (box) t = '<input type="checkbox" disabled' + (box[1] !== " " ? " checked" : "") + "> " +
                     t.slice(4);
        return "<li>" + t + "</li>";
      }).join("");
      return "<ul>" + items + "</ul>";
    });
    out = out.replace(/(?:^\d+\. .*(?:\n|$))+/gm, function (chunk) {
      return "<ol>" + chunk.trim().split("\n").map(function (l) {
        return "<li>" + l.replace(/^\d+\. /, "") + "</li>";
      }).join("") + "</ol>";
    });
    // paragraphs: anything left that is not already a block
    out = out.split(/\n{2,}/).map(function (p) {
      var t = p.trim();
      if (!t) return "";
      if (/^<(h\d|ul|ol|pre|blockquote|hr|table)/.test(t) || /^\u0000/.test(t)) return t;
      return "<p>" + t.replace(/\n/g, "<br>") + "</p>";
    }).join("\n");
    return out.replace(/\u0000(\d+)\u0000/g, function (_, i) { return blocks[i]; });
  }

  /* --- front matter ------------------------------------------------------- */
  function toMarkdown(d) {
    if (d.kind === "note") {
      return "# " + (d.title || "Untitled") + "\n\n" + (d.body || "") + "\n";
    }
    var fm = ["---"];
    function put(k, v) { if (v != null && String(v).trim() !== "") fm.push(k + ': "' + String(v).replace(/"/g, '\\"') + '"'); }
    put("title", d.title);
    put("description", d.description);
    put("category", d.category);
    put("group", d.group);
    if (d.nav_order && String(d.nav_order).trim()) fm.push("nav_order: " + String(d.nav_order).trim());
    if (d.status) fm.push('status: "' + d.status + '"');
    var tags = (d.tags || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    if (tags.length) fm.push("tags: [" + tags.join(", ") + "]");
    fm.push("---", "");
    return fm.join("\n") + "\n" + (d.body || "") + "\n";
  }

  function fileName(d) {
    var base = (d.title || "untitled").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
    return base + ".md";
  }

  /* --- the window --------------------------------------------------------- */
  var win = null, cur = null, saveTimer = null;

  var FIELDS = [
    ["title", "Title", "text"], ["description", "Description", "text"],
    ["category", "Category", "text"], ["group", "Group", "text"],
    ["nav_order", "Nav order", "text"], ["tags", "Tags (comma separated)", "text"],
    ["status", "Status", "text"]
  ];

  function icon(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function build() {
    win = document.createElement("section");
    win.className = "cmp";
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", "Composer");
    win.innerHTML =
      /* One bar, not three. Every control that fits on a line sits here so the
         writing area keeps the rest of the window; the front matter, which is
         only occasionally touched, collapses out of the way below. */
      '<header class="cmp__bar" data-cmp-drag>' +
        '<select class="cmp__kind" data-cmp-kind aria-label="Kind of draft">' +
          '<option value="page">Page</option><option value="note">Note</option>' +
        '</select>' +
        '<span class="cmp__title" data-cmp-name>Draft</span>' +
        '<span class="cmp__status mono" data-cmp-status></span>' +
        '<span class="cmp__spacer"></span>' +
        '<span class="cmp__tabs">' +
          '<button class="cmp__tab is-on" type="button" data-cmp-tab="write" title="Write" aria-label="Write">' +
            icon('M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17z') + '</button>' +
          '<button class="cmp__tab" type="button" data-cmp-tab="preview" title="Preview" aria-label="Preview">' +
            icon('M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8') + '</button>' +
        '</span>' +
        '<button class="cmp__btn" type="button" data-cmp-new title="Start a new draft" aria-label="Start a new draft">' +
          icon('M12 5v14M5 12h14') + '</button>' +
        '<button class="cmp__btn" type="button" data-cmp-export title="Download as markdown" aria-label="Download as markdown">' +
          icon('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14') + '</button>' +
        '<button class="cmp__btn" type="button" data-cmp-max title="Maximise" aria-label="Maximise">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>' +
        '</button>' +
        '<button class="cmp__btn" type="button" data-cmp-close title="Close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</header>' +
      '<div class="cmp__body">' +
        '<div class="cmp__pane" data-cmp-pane="write">' +
          '<details class="cmp__meta">' +
            '<summary class="cmp__meta-summary mono">Meta' +
              '<span class="cmp__id" data-cmp-id></span></summary>' +
            '<div class="cmp__fields" data-cmp-fields></div>' +
          '</details>' +
          '<textarea class="cmp__text" data-cmp-body placeholder="Markdown…"></textarea>' +
        '</div>' +
        '<div class="cmp__pane prose" data-cmp-pane="preview" hidden></div>' +
      '</div>' +
      '<span class="cmp__grip" data-cmp-resize aria-hidden="true"></span>';
    document.body.appendChild(win);

    var fields = win.querySelector("[data-cmp-fields]");
    FIELDS.forEach(function (f) {
      var l = document.createElement("label");
      l.className = "cmp__field";
      l.innerHTML = '<span class="cmp__label mono">' + esc(f[1]) + "</span>";
      var i = document.createElement("input");
      i.type = f[2]; i.dataset.cmpField = f[0];
      i.autocomplete = "off"; i.spellcheck = false;
      l.appendChild(i);
      fields.appendChild(l);
    });

    wire();
    restoreGeom();
  }

  function status(m) {
    var el = win.querySelector("[data-cmp-status]");
    if (el) el.textContent = m;
  }

  function paint() {
    win.querySelector("[data-cmp-kind]").value = cur.kind;
    win.querySelector("[data-cmp-body]").value = cur.body || "";
    win.querySelector("[data-cmp-name]").textContent = cur.title || "Untitled draft";
    win.querySelector("[data-cmp-id]").textContent = cur.id;
    win.querySelectorAll("[data-cmp-field]").forEach(function (i) {
      i.value = cur[i.dataset.cmpField] || "";
    });
    // Front matter is meaningless on a note, so those rows go away entirely
    // rather than sitting there inert.
    win.querySelector("[data-cmp-fields]").dataset.kind = cur.kind;
    // A note has no front matter, so the whole section goes rather than
    // collapsing to a single field.
    win.querySelector(".cmp__meta").hidden = cur.kind === "note";
  }

  function touch() {
    cur.updatedAt = new Date().toISOString();
    var all = read();
    var i = -1;
    for (var n = 0; n < all.length; n++) if (all[n].id === cur.id) { i = n; break; }
    if (i > -1) all[i] = cur; else all.push(cur);
    write(all);
    try { localStorage.setItem(CUR, cur.id); } catch (e) {}
    win.querySelector("[data-cmp-name]").textContent = cur.title || "Untitled draft";
    status("Saved");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { status(""); }, 1200);
  }

  function blank(kind) {
    return { id: uid(), kind: kind || "page", title: "", description: "", category: "",
             group: "", nav_order: "", tags: "", status: "", body: "",
             updatedAt: new Date().toISOString() };
  }

  function load(id) {
    var all = read();
    if (id) { for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; }
    // Most recently edited, so reopening resumes rather than starting over.
    return all.slice().sort(function (a, b) {
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    })[0] || blank();
  }

  function wire() {
    var body = win.querySelector("[data-cmp-body]");
    var debounce;
    function onEdit() {
      clearTimeout(debounce);
      debounce = setTimeout(touch, 400);
    }
    body.addEventListener("input", function () { cur.body = body.value; onEdit(); });
    win.querySelectorAll("[data-cmp-field]").forEach(function (i) {
      i.addEventListener("input", function () { cur[i.dataset.cmpField] = i.value; onEdit(); });
    });
    win.querySelector("[data-cmp-kind]").addEventListener("change", function (e) {
      cur.kind = e.target.value; paint(); touch();
    });

    win.querySelectorAll("[data-cmp-tab]").forEach(function (t) {
      t.addEventListener("click", function () {
        var name = t.dataset.cmpTab;
        win.querySelectorAll("[data-cmp-tab]").forEach(function (x) {
          x.classList.toggle("is-on", x === t);
        });
        win.querySelectorAll("[data-cmp-pane]").forEach(function (p) {
          p.hidden = p.dataset.cmpPane !== name;
        });
        if (name === "preview") {
          win.querySelector('[data-cmp-pane="preview"]').innerHTML = md(cur.body || "");
        }
      });
    });

    win.querySelector("[data-cmp-new]").addEventListener("click", function () {
      cur = blank(cur.kind); paint(); touch(); status("New draft");
    });
    win.querySelector("[data-cmp-export]").addEventListener("click", function () {
      var blob = new Blob([toMarkdown(cur)], { type: "text/markdown" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName(cur);
      a.click();
      URL.revokeObjectURL(a.href);
      status("Exported " + fileName(cur));
    });
    win.querySelector("[data-cmp-close]").addEventListener("click", hide);
    win.querySelector("[data-cmp-max]").addEventListener("click", function () {
      // The class sets left/top/width/height, but drag and restore write those
      // as INLINE styles, which always win — so toggling the class changed
      // nothing on screen. Stash the inline values and clear them while
      // maximised, then put them back.
      if (win.classList.contains("is-max")) {
        win.classList.remove("is-max");
        var g = win.dataset.cmpRestore ? JSON.parse(win.dataset.cmpRestore) : null;
        if (g) {
          win.style.left = g.l; win.style.top = g.t;
          win.style.width = g.w; win.style.height = g.h;
          win.style.right = g.r; win.style.bottom = g.b;
        }
      } else {
        win.dataset.cmpRestore = JSON.stringify({
          l: win.style.left, t: win.style.top, w: win.style.width,
          h: win.style.height, r: win.style.right, b: win.style.bottom
        });
        win.style.left = win.style.top = win.style.width =
          win.style.height = win.style.right = win.style.bottom = "";
        win.classList.add("is-max");
      }
      saveGeom();
    });

    /* overscroll-behavior covers a pane that CAN scroll and has hit its end.
       It does not cover a pane with nothing to scroll at all — the box is not
       a scrolling container in that case, so the wheel goes straight through
       to the document. That is the case being complained about: a window
       taller than its own content, scrolling the page behind it. */
    win.addEventListener("wheel", function (e) {
      var pane = e.target.closest(".cmp__pane, .cmp__text");
      if (!pane) { e.preventDefault(); return; }
      var room = pane.scrollHeight - pane.clientHeight;
      if (room <= 0) { e.preventDefault(); return; }
      var atTop = pane.scrollTop <= 0 && e.deltaY < 0;
      var atEnd = pane.scrollTop >= room - 1 && e.deltaY > 0;
      if (atTop || atEnd) e.preventDefault();
    }, { passive: false });

    drag(win.querySelector("[data-cmp-drag]"), "move");
    drag(win.querySelector("[data-cmp-resize]"), "size");

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && win && !win.hidden) hide();
    });
  }

  /* --- move and resize ---------------------------------------------------- */
  function drag(handle, mode) {
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (win.classList.contains("is-max") && mode === "move") return;
      // The bar is also the toolbar. Capturing the pointer here swallowed the
      // click that followed, so Maximise and Close did nothing — the press
      // started a drag of zero distance and the button never saw it.
      if (mode === "move" && e.target.closest("button, select, input, a")) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      var r = win.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY;

      function move(ev) {
        if (mode === "move") {
          // Clamped so the title bar can never be dragged out of reach.
          var x = Math.min(Math.max(0, r.left + ev.clientX - sx), window.innerWidth - 80);
          var y = Math.min(Math.max(0, r.top + ev.clientY - sy), window.innerHeight - 40);
          win.style.left = x + "px"; win.style.top = y + "px";
          win.style.right = "auto"; win.style.bottom = "auto";
        } else {
          win.style.width = Math.max(MIN_W, r.width + ev.clientX - sx) + "px";
          win.style.height = Math.max(MIN_H, r.height + ev.clientY - sy) + "px";
        }
      }
      function up(ev) {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        saveGeom();
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  function saveGeom() {
    try {
      localStorage.setItem(GEOM, JSON.stringify({
        l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height,
        max: win.classList.contains("is-max")
      }));
    } catch (e) {}
  }
  function restoreGeom() {
    var g;
    try { g = JSON.parse(localStorage.getItem(GEOM) || "null"); } catch (e) {}
    if (!g) return;
    if (g.l) win.style.left = g.l;
    if (g.t) win.style.top = g.t;
    if (g.w) win.style.width = g.w;
    if (g.h) win.style.height = g.h;
    if (g.l || g.t) { win.style.right = "auto"; win.style.bottom = "auto"; }
    if (g.max) {
      win.dataset.cmpRestore = JSON.stringify({
        l: win.style.left, t: win.style.top, w: win.style.width,
        h: win.style.height, r: win.style.right, b: win.style.bottom
      });
      win.style.left = win.style.top = win.style.width =
        win.style.height = win.style.right = win.style.bottom = "";
      win.classList.add("is-max");
    }
  }

  /* Is the window actually where it can be seen? Restoring a saved position
     on a smaller screen, or a window left near an edge, can put it wholly or
     mostly outside the viewport — at which point the launcher looks broken
     because pressing it appears to do nothing. */
  function onScreen() {
    if (!win || win.hidden) return false;
    var r = win.getBoundingClientRect();
    var visW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
    var visH = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    return visW > 120 && visH > 80;
  }

  function bringIn() {
    win.classList.remove("is-max");
    win.style.left = ""; win.style.top = "";
    win.style.right = ""; win.style.bottom = "";
    saveGeom();
  }

  function markState() {
    var on = !!(win && !win.hidden);
    document.querySelectorAll("[data-composer-open]").forEach(function (b) {
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
      b.title = on ? "Composer — open" : "Composer — drafts and notes";
    });
    try { localStorage.setItem(OPEN, on ? "1" : "0"); } catch (e) {}
  }

  function show(id, focus) {
    if (!win) build();
    cur = load(id || null);
    paint();
    win.hidden = false;
    if (!onScreen()) bringIn();
    markState();
    if (focus !== false) win.querySelector("[data-cmp-body]").focus();
  }
  function hide() { if (win) win.hidden = true; markState(); }

  /* --- launchers ---------------------------------------------------------- */
  document.querySelectorAll("[data-composer-open]").forEach(function (b) {
    b.addEventListener("click", function () {
      // Open but out of sight is not the same as open: pull it back rather
      // than closing something the reader cannot see they still have.
      if (win && !win.hidden && !onScreen()) { bringIn(); return; }
      win && !win.hidden ? hide() : show(b.getAttribute("data-composer-open") || null);
    });
  });

  /* The window survives navigation. Nothing here is a single-page app, so a
     link would otherwise throw away an open draft window mid-thought; the
     state is remembered and the window comes back on the next page, with the
     draft that was being edited. Focus is NOT taken on restore — the reader
     asked for the page, not the textarea. */
  (function restoreOpen() {
    var was;
    try { was = localStorage.getItem(OPEN); } catch (e) {}
    if (was === "1") show(null, false);
    else markState();
  })();

  // Opened from the manager on /review/ with a specific row.
  window.lethilComposer = { open: show, markdown: toMarkdown, render: md };
})();
