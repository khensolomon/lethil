/* ===========================================================================
 * placeholders.js — fill <KEY> tokens in code blocks with stored values.
 *
 * Two stores, treated very differently:
 *
 *   values       ordinary keys (user, VM_IP, ACCOUNT_ID …). Substituted into
 *                the page and into the clipboard.
 *   credentials  secret-shaped keys (…TOKEN, …SECRET, …KEY, password …).
 *                NEVER written into the page. The block keeps showing
 *                <TUNNEL_TOKEN>; the real value is injected only on
 *                Copy, so it lands in the clipboard and nowhere else.
 *
 * That split is the point: it removes the copy-paste tedium without putting a
 * live credential on screen, in a screenshot, or in a shared window.
 *
 * At rest both stores are obfuscated — see obscure(). That is NOT encryption
 * and is not claimed to be: it stops a plain token being readable at a glance
 * in devtools. Anything with access to this origin can still decode it.
 * ======================================================================== */
(function () {
  "use strict";

  var VKEY = "lethil:values";
  var CKEY = "lethil:credentials";
  var SHOW_KEY = "lethil:placeholders:show";
  var SESSION_KEY = "lethil:credentials:session";
  var VERSION = 2;

  var SETTINGS_URL = (function () {
    var el = document.querySelector("[data-ph-settings]");
    return el ? el.getAttribute("data-ph-settings") : "/settings/";
  })();

  /* --- which names count as credentials --------------------------------- */
  var DENY = ["TOKEN", "SECRET", "KEY", "PASSWORD", "PASSWD", "CREDENTIAL", "PRIVATE", "AUTH"];
  function isSecret(name) {
    var up = String(name).toUpperCase();
    for (var i = 0; i < DENY.length; i++) if (up.indexOf(DENY[i]) !== -1) return true;
    return false;
  }

  /* --- obfuscation at rest ----------------------------------------------
     XOR against a fixed pad, then base64. Reversible by design and by anyone
     who reads this file — the goal is only that the stored blob is not a
     legible token list to a passing glance. Real secrecy is not achievable in
     a browser store and is not implied here.                              */
  var PAD = "lethil/v2/obscure";
  function xor(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) ^ PAD.charCodeAt(i % PAD.length));
    }
    return out;
  }
  function obscure(obj) {
    try { return btoa(unescape(encodeURIComponent(xor(JSON.stringify(obj))))); }
    catch (e) { return ""; }
  }
  function reveal(raw) {
    if (!raw) return {};
    try {
      // v1 stored plain JSON; accept it once so nothing is lost on upgrade.
      if (raw.charAt(0) === "{") return JSON.parse(raw);
      var o = JSON.parse(xor(decodeURIComponent(escape(atob(raw)))));
      return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }

  function store(forCreds) {
    if (!forCreds) return localStorage;
    var sessionOnly = false;
    try { sessionOnly = localStorage.getItem(SESSION_KEY) === "1"; } catch (e) {}
    return sessionOnly ? sessionStorage : localStorage;
  }

  function readV() { try { return reveal(localStorage.getItem(VKEY)); } catch (e) { return {}; } }
  function writeV(o) { try { localStorage.setItem(VKEY, obscure(o)); return true; } catch (e) { return false; } }
  function readC() { try { return reveal(store(true).getItem(CKEY)); } catch (e) { return {}; } }
  function writeC(o) { try { store(true).setItem(CKEY, obscure(o)); return true; } catch (e) { return false; } }

  function showReal() {
    try { return localStorage.getItem(SHOW_KEY) !== "off"; } catch (e) { return true; }
  }
  function setShowReal(on) { try { localStorage.setItem(SHOW_KEY, on ? "on" : "off"); } catch (e) {} }

  /* =======================================================================
     SUBSTITUTION
     ==================================================================== */
  var blocks = document.querySelectorAll("pre > code");

  function wrap() {
    blocks.forEach(function (code) {
      if (code.dataset.phDone) return;
      code.dataset.phDone = "1";

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
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          var a = document.createElement("a");
          a.className = "ph" + (isSecret(m[1]) ? " ph--secret" : "");
          a.dataset.phName = m[1];
          a.textContent = m[0];
          a.href = SETTINGS_URL + "#ph-" + encodeURIComponent(m[1]);
          frag.appendChild(a);
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
    var values = readV();
    var creds = readC();
    var on = showReal();

    document.querySelectorAll(".ph").forEach(function (el) {
      var name = el.dataset.phName;

      if (isSecret(name)) {
        // Never rendered. Shown as the placeholder always; the value reaches
        // the clipboard only, via the copy button.
        el.textContent = "<" + name + ">";
        el.classList.toggle("is-armed", !!creds[name]);
        el.title = creds[name]
          ? "Credential set. Stays hidden here — Copy inserts it."
          : "No credential set for " + name + ". Click to set one.";
        return;
      }

      var v = values[name];
      if (on && v) {
        el.textContent = v;
        el.classList.add("is-filled");
        el.title = name + " — stored value. Click to edit.";
      } else {
        el.textContent = "<" + name + ">";
        el.classList.remove("is-filled");
        el.title = v ? "Showing the placeholder. Toggle to use the stored value."
                     : "No value set for " + name + ". Click to set one.";
      }
    });

    var anyPh = document.querySelector(".ph:not(.ph--secret)");
    document.querySelectorAll("[data-ph-toggle]").forEach(function (b) {
      b.hidden = !anyPh;
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("is-on", on);
      b.title = on ? "Showing stored values — switch to placeholders"
                   : "Showing placeholders — switch to stored values";
      var l = b.querySelector(".phbar__label");
      if (l) l.textContent = on ? "Stored values" : "Placeholders";
    });
  }

  /* --- copy: the only place a credential is ever emitted ------------------ */
  function addCopy() {
    blocks.forEach(function (code) {
      var pre = code.parentNode;
      if (pre.dataset.phCopy) return;
      pre.dataset.phCopy = "1";
      pre.classList.add("has-copy");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copybtn";
      btn.title = "Copy, with stored values filled in";
      btn.textContent = "Copy";

      btn.addEventListener("click", function () {
        var text = code.textContent;
        var creds = readC();
        Object.keys(creds).forEach(function (k) {
          if (creds[k]) text = text.split("<" + k + ">").join(creds[k]);
        });

        var done = function () {
          btn.textContent = "Copied";
          btn.classList.add("is-done");
          setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("is-done"); }, 1400);
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
  } else {
    document.querySelectorAll("[data-ph-toggle]").forEach(function (b) { b.hidden = true; });
  }

  /* =======================================================================
     SETTINGS FORM
     ==================================================================== */
  var form = document.querySelector("[data-ph-form]");
  if (!form) return;

  var status = document.querySelector("[data-ph-status]");
  function say(m) { if (status) status.textContent = m; }

  var DATA = [];

  function icon(path, cls) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    if (cls) svg.setAttribute("class", cls);
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
  }

  function row(name, secret, uses) {
    var values = secret ? readC() : readV();

    var tr = document.createElement("tr");
    tr.className = "phrow" + (secret ? " phrow--secret" : "");
    tr.id = "ph-" + name;

    /* key — the key itself is the disclosure, with its use count as a badge.
       A separate "N pages" summary beside it was a second thing to read and a
       second thing to aim at for the same action. */
    var tdKey = document.createElement("td");
    tdKey.className = "phrow__keycell";

    var key = document.createElement("code");
    key.className = "phrow__key";
    key.textContent = name;

    if (uses.length) {
      var det = document.createElement("details");
      det.className = "phuses";

      var sum = document.createElement("summary");
      sum.className = "phuses__summary";
      sum.appendChild(key);

      var badge = document.createElement("sup");
      badge.className = "phrow__count";
      badge.textContent = uses.length;
      badge.title = uses.length + (uses.length === 1 ? " page uses this" : " pages use this");
      sum.appendChild(badge);
      det.appendChild(sum);

      // Ordered so the numbering is real, not decoration: the list is a
      // numbered set of pages, and an <ol> says so to a screen reader too.
      var ol = document.createElement("ol");
      ol.className = "phuses__list";
      uses.forEach(function (u) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = u.url;
        a.textContent = u.title;
        li.appendChild(a);
        ol.appendChild(li);
      });
      det.appendChild(ol);
      tdKey.appendChild(det);
    } else {
      // Stored but unused: nothing to expand, so no disclosure affordance.
      tdKey.appendChild(key);
      var zero = document.createElement("sup");
      zero.className = "phrow__count is-zero";
      zero.textContent = "0";
      zero.title = "Not used on any page";
      tdKey.appendChild(zero);
    }
    tr.appendChild(tdKey);

    /* value */
    var tdVal = document.createElement("td");
    var wrapEl = document.createElement("div");
    wrapEl.className = "phinput";

    var input = document.createElement("input");
    input.type = secret ? "password" : "text";
    input.className = "phinput__field";
    input.value = values[name] || "";
    input.placeholder = secret ? "not set — stays hidden on pages" : "not set";
    input.setAttribute("aria-label", "Value for " + name);
    input.autocomplete = "off";
    input.spellcheck = false;

    function save() {
      var all = secret ? readC() : readV();
      if (input.value.trim()) all[name] = input.value.trim();
      else delete all[name];
      (secret ? writeC : writeV)(all);
      paint();
      syncTools();
      tr.classList.toggle("is-set", !!input.value.trim());
      say("Saved.");
    }
    input.addEventListener("input", save);
    wrapEl.appendChild(input);

    if (secret) {
      var eye = document.createElement("button");
      eye.type = "button";
      eye.className = "phinput__btn";
      eye.title = "Show or hide this value";
      eye.setAttribute("aria-label", "Show or hide value for " + name);
      eye.appendChild(icon("M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"));
      eye.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        eye.classList.toggle("is-on", input.type === "text");
      });
      wrapEl.appendChild(eye);
    }

    var clr = document.createElement("button");
    clr.type = "button";
    clr.className = "phinput__btn phinput__btn--clear";
    clr.title = "Clear this value";
    clr.setAttribute("aria-label", "Clear value for " + name);
    clr.appendChild(icon("M18 6 6 18M6 6l12 12"));
    clr.addEventListener("click", function () {
      input.value = "";
      save();
      say("Cleared " + name + ".");
    });
    wrapEl.appendChild(clr);

    tdVal.appendChild(wrapEl);
    tr.appendChild(tdVal);

    tr.classList.toggle("is-set", !!input.value);
    return tr;
  }

  var tbodyMain = form.querySelector("[data-ph-body]");
  var tbodySec = document.querySelector("[data-ph-secret-body]");
  var sortSel = document.querySelector("[data-ph-sort]");

  function build() {
    var counts = {}, uses = {}, secretOf = {};
    DATA.forEach(function (o) {
      counts[o.name] = (counts[o.name] || 0) + 1;
      secretOf[o.name] = !!o.secret;
      (uses[o.name] = uses[o.name] || []).push({ url: o.url, title: o.title });
    });
    // Keys with a saved value but no longer used anywhere still show, so a
    // value can never become invisible and unremovable.
    Object.keys(readV()).forEach(function (n) { if (!(n in counts)) { counts[n] = 0; secretOf[n] = false; } });
    Object.keys(readC()).forEach(function (n) { if (!(n in counts)) { counts[n] = 0; secretOf[n] = true; } });

    var mode = sortSel ? sortSel.value : "uses";
    function order(a, b) {
      if (mode === "alpha") return a.localeCompare(b);
      if (mode === "set") {
        var av = (secretOf[a] ? readC() : readV())[a] ? 0 : 1;
        var bv = (secretOf[b] ? readC() : readV())[b] ? 0 : 1;
        if (av !== bv) return av - bv;
        return a.localeCompare(b);
      }
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return a.localeCompare(b);
    }

    var names = Object.keys(counts);
    var plain = names.filter(function (n) { return !secretOf[n]; }).sort(order);
    var secret = names.filter(function (n) { return secretOf[n]; }).sort(order);

    tbodyMain.textContent = "";
    plain.forEach(function (n) { tbodyMain.appendChild(row(n, false, uses[n] || [])); });

    if (tbodySec) {
      tbodySec.textContent = "";
      secret.forEach(function (n) { tbodySec.appendChild(row(n, true, uses[n] || [])); });
    }
    var cnt = document.querySelector("[data-ph-secret-count]");
    if (cnt) cnt.textContent = secret.length + (secret.length === 1 ? " key" : " keys");

    var want = decodeURIComponent((window.location.hash || "").replace(/^#ph-/, ""));
    if (want) {
      var target = document.getElementById("ph-" + want);
      if (target) {
        var host = target.closest("details");
        if (host) host.open = true;
        target.classList.add("is-target");
        if (target.scrollIntoView) target.scrollIntoView({ block: "center" });
        var inp = target.querySelector("input");
        if (inp) inp.focus();
      }
    }
    syncTools();
  }

  if (sortSel) {
    var sortLabel = document.querySelector("[data-ph-sort-label]");
    sortSel.addEventListener("change", function () {
      // The visible text is ours, so it has to follow the hidden select.
      if (sortLabel) sortLabel.textContent = sortSel.options[sortSel.selectedIndex].text;
      build();
    });
  }

  /* session-only credentials */
  var sessToggle = document.querySelector("[data-ph-session]");
  if (sessToggle) {
    try { sessToggle.checked = localStorage.getItem(SESSION_KEY) === "1"; } catch (e) {}
    sessToggle.addEventListener("change", function () {
      var existing = readC();
      try { localStorage.setItem(SESSION_KEY, sessToggle.checked ? "1" : "0"); } catch (e) {}
      // Move what is already stored into the newly chosen store, then clear
      // the old one, so toggling never silently loses or duplicates values.
      try { localStorage.removeItem(CKEY); sessionStorage.removeItem(CKEY); } catch (e) {}
      writeC(existing);
      build();
      say(sessToggle.checked
        ? "Credentials now clear when this tab closes."
        : "Credentials now persist on this device.");
    });
  }

  fetch(form.getAttribute("data-ph-form"))
    .then(function (r) { return r.json(); })
    .then(function (list) { DATA = Array.isArray(list) ? list : []; build(); })
    .catch(function () { DATA = []; build(); say("Could not load the key list."); });

  /* --- export / import / clear ------------------------------------------- */
  var ex = document.querySelector("[data-ph-export]");
  var im = document.querySelector("[data-ph-import]");
  var cl = document.querySelector("[data-ph-clear]");

  function syncTools() {
    var n = Object.keys(readV()).length + Object.keys(readC()).length;
    if (ex) ex.disabled = n === 0;
    if (cl) cl.disabled = n === 0;
  }

  if (ex) ex.addEventListener("click", function () {
    // Credentials are NOT exported. An export is a file that gets emailed,
    // synced and forgotten; that is the last place a live token should be.
    var blob = new Blob([JSON.stringify({ version: VERSION, values: readV() }, null, 2)],
                        { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lethil-values.json";
    a.click();
    URL.revokeObjectURL(a.href);
    say("Exported values. Credentials were not included.");
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

      var all = readV(), n = 0;
      Object.keys(incoming).forEach(function (k) {
        if (typeof incoming[k] !== "string") return;
        if (isSecret(k)) return;      // never import into the credential store
        all[k] = incoming[k]; n++;
      });
      writeV(all);
      build();
      paint();
      say(n ? "Imported " + n + " value" + (n === 1 ? "." : "s.") : "Nothing to import.");
      im.value = "";
    };
    reader.readAsText(f);
  });

  if (cl) cl.addEventListener("click", function () {
    if (!window.confirm("Remove all saved values and credentials? This cannot be undone.")) return;
    writeV({}); writeC({});
    build(); paint();
    say("Everything removed.");
  });
})();
