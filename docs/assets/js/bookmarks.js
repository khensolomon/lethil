/* ===========================================================================
 * bookmarks.js — local-only saved pages.
 *
 * Everything lives in localStorage under one key. No account, no network, no
 * sync: clearing site data clears bookmarks, and nothing here ever leaves the
 * device. The store is a single JSON array so import/export is the same shape
 * that is kept at rest.
 *
 * Storage can throw (private mode, quota, disabled cookies) and every call is
 * guarded — a failure degrades to "bookmarks do not work", never to a broken
 * page.
 * ======================================================================== */
(function () {
  "use strict";

  var KEY = "lethil:bookmarks";
  var VERSION = 1;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch (e) { return false; }
  }

  function has(url) {
    return read().some(function (b) { return b.url === url; });
  }

  function toggle(entry) {
    var list = read();
    var i = -1;
    for (var n = 0; n < list.length; n++) {
      if (list[n].url === entry.url) { i = n; break; }
    }
    if (i >= 0) list.splice(i, 1);
    else list.push(entry);
    write(list);
    return i < 0;   // true when it was added
  }

  /* --- the toggle on a page ---------------------------------------------- */
  var btn = document.querySelector("[data-bookmark]");
  if (btn) {
    var entry = {
      url: btn.getAttribute("data-url"),
      title: btn.getAttribute("data-title"),
      section: btn.getAttribute("data-section") || "",
      description: btn.getAttribute("data-description") || ""
    };

    var label = btn.querySelector(".bookmark__label");
    function paint(on) {
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("is-on", on);
      if (label) label.textContent = on ? "Saved" : "Save";
    }
    paint(has(entry.url));

    btn.addEventListener("click", function () {
      entry.savedAt = new Date().toISOString();
      paint(toggle(entry));
    });
  }

  /* --- the manager at /bookmarks/ ---------------------------------------- */
  var root = document.querySelector("[data-bookmark-list]");
  if (!root) return;

  var countEl = document.querySelector("[data-bookmark-count]");
  var exportBtn = document.querySelector("[data-bookmark-export]");
  var clearBtn = document.querySelector("[data-bookmark-clear]");

  /* Export and Remove all act ON the store, so they are meaningless when it is
     empty and are disabled until there is something to act on. Import is NOT
     disabled: restoring into an empty store is its main use, and disabling the
     one control that fixes an empty state would be backwards. */
  function syncTools(count) {
    if (exportBtn) exportBtn.disabled = count === 0;
    if (clearBtn) clearBtn.disabled = count === 0;
  }

  function render() {
    var list = read().sort(function (a, b) {
      return (b.savedAt || "").localeCompare(a.savedAt || "");
    });

    if (countEl) {
      countEl.textContent = list.length + (list.length === 1 ? " page" : " pages");
    }
    syncTools(list.length);

    if (!list.length) {
      root.innerHTML =
        '<p class="bookmarks__empty">Nothing saved yet. Open any page and press ' +
        '<strong>Save</strong> in its header.</p>';
      return;
    }

    // Built with DOM methods, not an HTML string: titles come out of storage,
    // which the user can edit or import, so they are untrusted input.
    root.textContent = "";
    var ul = document.createElement("ul");
    ul.className = "bookmarks__list";

    list.forEach(function (b) {
      var li = document.createElement("li");
      li.className = "bookmarks__item";

      var a = document.createElement("a");
      a.className = "bookmarks__link";
      a.href = b.url;

      var t = document.createElement("span");
      t.className = "bookmarks__title";
      t.textContent = b.title || b.url;
      a.appendChild(t);

      if (b.section) {
        var s = document.createElement("span");
        s.className = "bookmarks__section mono";
        s.textContent = b.section;
        a.appendChild(s);
      }
      li.appendChild(a);

      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "bookmarks__remove";
      rm.setAttribute("aria-label", "Remove " + (b.title || b.url));
      rm.textContent = "Remove";
      rm.addEventListener("click", function () {
        write(read().filter(function (x) { return x.url !== b.url; }));
        render();
      });
      li.appendChild(rm);

      ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  render();

  /* --- export ------------------------------------------------------------ */
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      var payload = { version: VERSION, exported: new Date().toISOString(), bookmarks: read() };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lethil-bookmarks.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /* --- import ------------------------------------------------------------ */
  var importInput = document.querySelector("[data-bookmark-import]");
  var status = document.querySelector("[data-bookmark-status]");

  function say(msg) { if (status) status.textContent = msg; }

  if (importInput) {
    importInput.addEventListener("change", function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();

      reader.onload = function () {
        var incoming;
        try {
          var data = JSON.parse(String(reader.result));
          incoming = Array.isArray(data) ? data : data.bookmarks;
        } catch (e) {
          say("That file is not valid JSON.");
          return;
        }
        if (!Array.isArray(incoming)) { say("No bookmarks found in that file."); return; }

        // Merge rather than replace, and keep only same-origin relative paths —
        // an imported file is untrusted, so it must not be able to inject a
        // link to somewhere else.
        var existing = read();
        var seen = {};
        existing.forEach(function (b) { seen[b.url] = true; });

        var added = 0;
        incoming.forEach(function (b) {
          if (!b || typeof b.url !== "string") return;
          if (b.url.charAt(0) !== "/" || b.url.indexOf("//") === 0) return;
          if (seen[b.url]) return;
          seen[b.url] = true;
          existing.push({
            url: b.url,
            title: typeof b.title === "string" ? b.title : b.url,
            section: typeof b.section === "string" ? b.section : "",
            savedAt: typeof b.savedAt === "string" ? b.savedAt : new Date().toISOString()
          });
          added++;
        });

        write(existing);
        render();
        say(added ? "Imported " + added + (added === 1 ? " bookmark." : " bookmarks.")
                  : "Nothing new to import.");
        importInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  /* --- clear all --------------------------------------------------------- */
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!read().length) return;
      if (!window.confirm("Remove all saved bookmarks? This cannot be undone.")) return;
      write([]);
      render();
      say("All bookmarks removed.");
    });
  }
})();
