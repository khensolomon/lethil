/* ===========================================================================
 * placeholders.js — fill <PLACEHOLDER> tokens in code blocks with your own
 * values, and copy the finished command.
 *
 * Values live in localStorage on this device. Nothing is sent anywhere and
 * clearing site data clears them. Secret-shaped names never reach this system:
 * they are filtered out at build time in placeholders.json.liquid, so a token
 * or API key cannot be stored here even deliberately.
 *
 * Two halves, each a no-op when its markup is absent:
 *   · every page   — substitute into code blocks, add copy buttons
 *   · /settings/   — the add / edit / delete form
 * ======================================================================== */
(function () {
  "use strict";

  var KEY = "lethil:placeholders";
  // Resolved from the toggle so it survives a baseurl; falls back for pages
  // rendered without one.
  var PH_SETTINGS = (document.querySelector("[data-ph-settings]") || {}).getAttribute
      ? document.querySelector("[data-ph-settings]").getAttribute("data-ph-settings")
      : "/settings/";
  var SHOW_KEY = "lethil:placeholders:show";
  var VERSION = 1;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function write(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch (e) { return false; }
  }
  function showReal() {
    try { return localStorage.getItem(SHOW_KEY) !== "off"; } catch (e) { return true; }
  }
  function setShowReal(on) {
    try { localStorage.setItem(SHOW_KEY, on ? "on" : "off"); } catch (e) {}
  }

  /* =======================================================================
     SUBSTITUTION
     Each <TOKEN> in a code block is wrapped in a span once, on first pass.
     The original text stays in a data attribute, so toggling between real
     values and placeholders is a text swap and never re-parses the DOM.
     ==================================================================== */
  var blocks = document.querySelectorAll("pre > code");

  function wrap() {
    if (!blocks.length) return;
    var values = read();

    blocks.forEach(function (code) {
      if (code.dataset.phDone) return;
      code.dataset.phDone = "1";

      // Walk text nodes only: never touch syntax-highlight markup.
      var walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach(function (node) {
        var text = node.nodeValue;
        if (text.indexOf("<") === -1) return;

        var frag = document.createDocumentFragment();
        var re = /<([A-Za-z_][A-Za-z0-9_.-]*)>/g;
        var last = 0, m;

        while ((m = re.exec(text)) !== null) {
          if (m.index > last) {
            frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          }
          // A link, not a span: an unset placeholder is the one thing on the
          // page that tells you this feature exists, so it has to be the way
          // in. Clicking it opens Settings focused on that exact row.
          var span = document.createElement("a");
          span.className = "ph";
          span.dataset.phName = m[1];
          span.textContent = m[0];
          span.href = PH_SETTINGS + "#ph-" + encodeURIComponent(m[1]);
          frag.appendChild(span);
          last = re.lastIndex;
        }
        if (!last) return;
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    });
    paint();
  }

  function paint() {
    var values = read();
    var on = showReal();
    document.querySelectorAll(".ph").forEach(function (el) {
      var name = el.dataset.phName;
      var v = values[name];
      if (on && v) {
        el.textContent = v;
        el.classList.add("is-filled");
        el.title = "<" + name + "> — your value. Click to edit in Settings.";
      } else {
        el.textContent = "<" + name + ">";
        el.classList.remove("is-filled");
        el.title = v ? "Showing the placeholder. Toggle to use your value."
                     : "No value set for <" + name + ">. Click to set one.";
      }
    });
    // The toggle is meaningless on a page with no placeholders, so it is
    // hidden rather than sitting there doing nothing.
    var anyPh = document.querySelector(".ph");
    document.querySelectorAll("[data-ph-toggle]").forEach(function (b) {
      b.hidden = !anyPh;
      b.setAttribute("aria-pressed", String(on));
      var l = b.querySelector(".phbar__label");
      if (l) l.textContent = on ? "Your values" : "Placeholders";
    });
  }

  /* --- copy button on every block ---------------------------------------- */
  function addCopy() {
    blocks.forEach(function (code) {
      var pre = code.parentNode;
      if (pre.dataset.phCopy) return;
      pre.dataset.phCopy = "1";
      pre.classList.add("has-copy");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copybtn";
      btn.textContent = "Copy";
      btn.addEventListener("click", function () {
        // code.textContent already reflects whatever is displayed, so the
        // copied command is exactly what is on screen.
        var text = code.textContent;
        var done = function () {
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = "Copy"; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
      pre.appendChild(btn);
    });
  }

  if (blocks.length) {
    wrap();
    addCopy();
    document.querySelectorAll("[data-ph-toggle]").forEach(function (b) {
      b.addEventListener("click", function () { setShowReal(!showReal()); paint(); });
    });
  }

  /* =======================================================================
     SETTINGS FORM
     ==================================================================== */
  var form = document.querySelector("[data-ph-form]");
  if (!form) return;

  var status = document.querySelector("[data-ph-status]");
  function say(m) { if (status) status.textContent = m; }

  function row(name, value, count) {
    var tr = document.createElement("tr");
    tr.className = "phform__row";
    tr.id = "ph-" + name;

    var tdName = document.createElement("td");
    var code = document.createElement("code");
    code.className = "phform__name";
    code.textContent = "<" + name + ">";
    tdName.appendChild(code);
    if (count) {
      var c = document.createElement("span");
      c.className = "phform__count mono";
      c.textContent = count + "\u00d7";
      tdName.appendChild(c);
    }
    tr.appendChild(tdName);

    var tdVal = document.createElement("td");
    var input = document.createElement("input");
    input.type = "text";
    input.className = "phform__input";
    input.value = value || "";
    input.placeholder = "not set";
    input.setAttribute("aria-label", "Value for " + name);
    input.addEventListener("input", function () {
      var all = read();
      if (input.value.trim()) all[name] = input.value.trim();
      else delete all[name];
      write(all);
      paint();
      say("Saved.");
    });
    tdVal.appendChild(input);
    tr.appendChild(tdVal);

    var tdAct = document.createElement("td");
    var del = document.createElement("button");
    del.type = "button";
    del.className = "phform__clear";
    del.textContent = "Clear";
    del.addEventListener("click", function () {
      var all = read();
      delete all[name];
      write(all);
      input.value = "";
      paint();
      say("Cleared <" + name + ">.");
    });
    tdAct.appendChild(del);
    tr.appendChild(tdAct);

    return tr;
  }

  var tbody = form.querySelector("tbody");

  function build(discovered) {
    var values = read();
    var counts = {};
    discovered.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });

    // Anything stored but no longer used in the docs still shows, so a value
    // never becomes invisible and unremovable after a page is rewritten.
    Object.keys(values).forEach(function (n) { if (!(n in counts)) counts[n] = 0; });

    var names = Object.keys(counts).sort(function (a, b) {
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return a.localeCompare(b);
    });

    tbody.textContent = "";
    names.forEach(function (n) { tbody.appendChild(row(n, values[n], counts[n])); });

    // Arriving from a clicked placeholder: jump to that row and put the cursor
    // in it, so the trip is one click and one keystroke rather than a hunt.
    var want = decodeURIComponent((window.location.hash || "").replace(/^#ph-/, ""));
    if (want) {
      var target = document.getElementById("ph-" + want);
      if (target) {
        target.classList.add("is-target");
        // Guarded: not every environment implements it, and a missing scroll
        // must not take the whole form down with it — the fetch handler's
        // catch would otherwise swallow the throw and render zero rows.
        if (target.scrollIntoView) target.scrollIntoView({ block: "center" });
        var inp = target.querySelector("input");
        if (inp) inp.focus();
      }
    }
  }

  fetch(form.dataset.phForm)
    .then(function (r) { return r.json(); })
    .then(function (list) { build(Array.isArray(list) ? list : []); })
    .catch(function () { build([]); say("Could not load the placeholder list."); });

  /* --- export / import / clear ------------------------------------------- */
  var ex = document.querySelector("[data-ph-export]");
  var im = document.querySelector("[data-ph-import]");
  var cl = document.querySelector("[data-ph-clear]");

  function syncTools() {
    var n = Object.keys(read()).length;
    if (ex) ex.disabled = n === 0;
    if (cl) cl.disabled = n === 0;
  }
  syncTools();
  form.addEventListener("input", syncTools);
  form.addEventListener("click", syncTools);

  if (ex) ex.addEventListener("click", function () {
    var blob = new Blob([JSON.stringify({ version: VERSION, values: read() }, null, 2)],
                        { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lethil-placeholders.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  if (im) im.addEventListener("change", function () {
    var f = im.files && im.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var incoming;
      try {
        var data = JSON.parse(String(reader.result));
        incoming = data && data.values ? data.values : data;
      } catch (e) { say("That file is not valid JSON."); return; }
      if (!incoming || typeof incoming !== "object") { say("No values found."); return; }

      var all = read(), n = 0;
      Object.keys(incoming).forEach(function (k) {
        if (typeof incoming[k] !== "string") return;
        all[k] = incoming[k];
        n++;
      });
      write(all);
      fetch(form.dataset.phForm).then(function (r) { return r.json(); })
        .then(function (l) { build(l); }).catch(function () { build([]); });
      paint();
      syncTools();
      say(n ? "Imported " + n + " value" + (n === 1 ? "." : "s.") : "Nothing to import.");
      im.value = "";
    };
    reader.readAsText(f);
  });

  if (cl) cl.addEventListener("click", function () {
    if (!Object.keys(read()).length) return;
    if (!window.confirm("Remove all saved values? This cannot be undone.")) return;
    write({});
    fetch(form.dataset.phForm).then(function (r) { return r.json(); })
      .then(function (l) { build(l); }).catch(function () { build([]); });
    paint();
    syncTools();
    say("All values removed.");
  });
})();
