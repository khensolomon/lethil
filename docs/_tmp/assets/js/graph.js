/* graph.js — a small force-directed graph of the docs, drawn on canvas.
   Nodes are pages, edges are [[wiki-links]] (data from /graph.json, built by
   Jekyll). No external library: the physics is a light spring/charge model.
   Degrades gracefully — if the data can't load, it shows an empty message. */
(function () {
  "use strict";

  var stage = document.querySelector("[data-graph]");
  if (!stage) return;

  var canvas = stage.querySelector("[data-graph-canvas]");
  var emptyEl = stage.querySelector("[data-graph-empty]");
  var tipEl = stage.querySelector("[data-graph-tooltip]");
  var legendEl = document.querySelector("[data-graph-legend]");
  var ctx = canvas.getContext("2d");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // section -> colour, pulled from CSS custom props so it tracks the theme
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  // a fixed hue per section, stable regardless of theme; accent for highlighted
  var SECTION_HUES = {};
  var HUE_POOL = [210, 145, 30, 280, 0, 190, 50, 330, 100, 260];

  var nodes = [], edges = [], adj = {};
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var hoverId = null, dragNode = null, dragging = false;
  var raf = null, alpha = 1;
  var pointer = { x: 0, y: 0, down: false };

  // camera: world -> screen is  screen = world * cam.k + (cam.x, cam.y)
  var cam = { k: 1, x: 0, y: 0 };
  var MIN_K = 0.3, MAX_K = 4;
  // pan vs. node-drag vs. click bookkeeping
  var panning = false, downAt = null, movedFar = false;

  function toWorld(sx, sy) { return { x: (sx - cam.x) / cam.k, y: (sy - cam.y) / cam.k }; }
  function clampK(k) { return Math.max(MIN_K, Math.min(MAX_K, k)); }

  function color(section, highlight) {
    if (highlight) return cssVar("--accent", "#3457e0");
    if (!(section in SECTION_HUES)) {
      var i = Object.keys(SECTION_HUES).length % HUE_POOL.length;
      SECTION_HUES[section] = HUE_POOL[i];
    }
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return "hsl(" + SECTION_HUES[section] + (dark ? ", 55%, 62%)" : ", 60%, 48%)");
  }

  function size() {
    var r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // compute the camera that frames the whole graph (bounding box + margin),
  // but don't apply it directly — return the target so the tick loop can EASE
  // toward it, keeping the intro one continuous motion instead of a snap.
  function fitTarget() {
    if (!nodes.length) return null;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    nodes.forEach(function (n) {
      minx = Math.min(minx, n.x); maxx = Math.max(maxx, n.x);
      miny = Math.min(miny, n.y); maxy = Math.max(maxy, n.y);
    });
    var pad = 60;
    var gw = Math.max(maxx - minx, 1), gh = Math.max(maxy - miny, 1);
    var k = clampK(Math.min((W - pad * 2) / gw, (H - pad * 2) / gh));
    return { k: k, x: (W - (minx + maxx) * k) / 2, y: (H - (miny + maxy) * k) / 2 };
  }

  // snap the camera straight to the fit (used by reset + resize, where an
  // instant reframe is expected rather than an intro animation)
  function fitToView() {
    var t = fitTarget();
    if (t) { cam.k = t.k; cam.x = t.x; cam.y = t.y; }
  }

  function seed() {
    // start nodes on a circle so the layout unfolds tidily, not from a clump
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32;
    nodes.forEach(function (n, i) {
      var a = (i / nodes.length) * Math.PI * 2;
      n.x = cx + Math.cos(a) * R + (Math.random() - 0.5) * 20;
      n.y = cy + Math.sin(a) * R + (Math.random() - 0.5) * 20;
      n.vx = 0; n.vy = 0;
      n.deg = adj[n.id] ? adj[n.id].length : 0;
    });
    // start a touch zoomed-out and centred, so the intro reads as a gentle
    // "unfold and zoom to frame" that ends exactly on the fitted view
    cam.k = 0.82;
    cam.x = W / 2 - cx * cam.k;
    cam.y = H / 2 - cy * cam.k;
  }

  function step() {
    var REPULSE = 2600, SPRING = 0.02, LINK_LEN = 92, CENTER = 0.008, DAMP = 0.86;
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy || 0.01;
        var d = Math.sqrt(d2);
        var f = REPULSE / d2;
        var ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      }
    }
    edges.forEach(function (e) {
      var a = e.s, b = e.t;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      var f = (d - LINK_LEN) * SPRING;
      var ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f;
      b.vx -= ux * f; b.vy -= uy * f;
    });
    var cx = W / 2, cy = H / 2;
    nodes.forEach(function (n) {
      n.vx += (cx - n.x) * CENTER;
      n.vy += (cy - n.y) * CENTER;
      if (n === dragNode) { n.x = pointer.x; n.y = pointer.y; n.vx = 0; n.vy = 0; return; }
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx * alpha; n.y += n.vy * alpha;
      var pad = 26;
      n.x = Math.max(pad, Math.min(W - pad, n.x));
      n.y = Math.max(pad, Math.min(H - pad, n.y));
    });
  }

  function nodeRadius(n) { return 5 + Math.min(n.deg, 6) * 1.6; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.k, cam.k);

    var hoverSet = null;
    if (hoverId != null && adj[hoverId]) {
      hoverSet = {}; hoverSet[hoverId] = true;
      adj[hoverId].forEach(function (id) { hoverSet[id] = true; });
    }

    // edges
    edges.forEach(function (e) {
      var lit = hoverSet && (e.s.id === hoverId || e.t.id === hoverId);
      ctx.beginPath();
      ctx.moveTo(e.s.x, e.s.y);
      ctx.lineTo(e.t.x, e.t.y);
      ctx.strokeStyle = lit ? cssVar("--accent", "#3457e0")
        : (hoverSet ? cssVar("--border", "#e6e6e0") : cssVar("--border-hover", "#d3d3ca"));
      ctx.globalAlpha = hoverSet && !lit ? 0.35 : 1;
      ctx.lineWidth = (lit ? 1.8 : 1) / cam.k;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // nodes
    nodes.forEach(function (n) {
      var dim = hoverSet && !hoverSet[n.id];
      var r = nodeRadius(n);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color(n.section, n.highlight);
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.fill();
      if (n.id === hoverId) {
        ctx.lineWidth = 2 / cam.k;
        ctx.strokeStyle = cssVar("--bg", "#fff");
        ctx.stroke();
      }
      var showLabel = n.id === hoverId || (hoverSet && hoverSet[n.id]) || (!hoverSet && n.deg >= 3);
      if (showLabel) {
        ctx.globalAlpha = dim ? 0.4 : 1;
        ctx.fillStyle = cssVar("--text", "#16181d");
        ctx.font = (12 / cam.k) + "px -apple-system, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.title, n.x, n.y - r - 6 / cam.k);
      }
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  var introDone = false;      // becomes true once the intro settle+frame finishes
  var userMoved = false;      // set once the user pans/zooms/drags — stops auto-framing

  function tick() {
    if (!reduce && !introDone && !dragging && !userMoved) {
      // INTRO: keep stepping the physics AND continuously ease the camera
      // toward the live fit target, so the "zoom to frame" is woven into the
      // settling motion rather than snapped on at the end.
      step();
      alpha *= 0.965;
      var t = fitTarget();
      if (t) {
        // ease ramps up as the layout calms (alpha shrinks): follow the early
        // wide motion loosely, then settle into the final frame gently
        var ease = 0.06 + (1 - Math.min(alpha, 1)) * 0.10;
        cam.k += (t.k - cam.k) * ease;
        cam.x += (t.x - cam.x) * ease;
        cam.y += (t.y - cam.y) * ease;
      }
      // done when the layout is calm AND the camera has essentially reached it
      if (alpha < 0.04 && t &&
          Math.abs(t.k - cam.k) < 0.005 &&
          Math.abs(t.x - cam.x) < 0.5 &&
          Math.abs(t.y - cam.y) < 0.5) {
        cam.k = t.k; cam.x = t.x; cam.y = t.y;   // land exactly on target
        introDone = true;
      }
    } else if (dragging) {
      step();
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  function nodeAt(wx, wy) {
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      var r = nodeRadius(n) + 4;
      if ((wx - n.x) * (wx - n.x) + (wy - n.y) * (wy - n.y) <= r * r) return n;
    }
    return null;
  }

  function screenPos(ev) {
    var r = canvas.getBoundingClientRect();
    var t = ev.touches ? ev.touches[0] : ev;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function onMove(ev) {
    var s = screenPos(ev);
    pointer.sx = s.x; pointer.sy = s.y;
    var w = toWorld(s.x, s.y);
    pointer.x = w.x; pointer.y = w.y;

    if (downAt) {
      var dist = Math.hypot(s.x - downAt.sx, s.y - downAt.sy);
      if (dist > 4) movedFar = true;      // past this, it's a drag/pan, not a click
    }

    if (dragging && dragNode) { alpha = Math.max(alpha, 0.3); tipEl.hidden = true; return; }
    if (panning) {
      cam.x = downAt.camx + (s.x - downAt.sx);
      cam.y = downAt.camy + (s.y - downAt.sy);
      tipEl.hidden = true;
      return;
    }

    var n = nodeAt(w.x, w.y);
    hoverId = n ? n.id : null;
    canvas.style.cursor = n ? "pointer" : "grab";
    if (n) {
      tipEl.hidden = false;
      tipEl.textContent = n.title + " · " + n.sectionLabel;
      tipEl.style.left = s.x + "px";
      tipEl.style.top = (s.y - 14) + "px";
    } else { tipEl.hidden = true; }
  }

  function onDown(ev) {
    var s = screenPos(ev);
    var w = toWorld(s.x, s.y);
    var n = nodeAt(w.x, w.y);
    movedFar = false;
    downAt = { sx: s.x, sy: s.y, camx: cam.x, camy: cam.y, node: n };
    if (n) { dragNode = n; dragging = true; userMoved = true; canvas.style.cursor = "grabbing"; }
    else { panning = true; userMoved = true; canvas.style.cursor = "grabbing"; }
  }

  function onUp(ev) {
    // click (no meaningful movement) on a node -> navigate
    if (downAt && downAt.node && !movedFar) { window.location.href = downAt.node.id; return; }
    dragging = false; dragNode = null; panning = false; downAt = null;
    canvas.style.cursor = "grab";
  }

  function onWheel(ev) {
    ev.preventDefault();
    userMoved = true;
    var s = screenPos(ev);
    var before = toWorld(s.x, s.y);
    var factor = Math.exp(-ev.deltaY * 0.0015);
    cam.k = clampK(cam.k * factor);
    // keep the point under the cursor fixed while zooming
    cam.x = s.x - before.x * cam.k;
    cam.y = s.y - before.y * cam.k;
    draw();
  }

  function zoomBy(factor) {
    var cx = W / 2, cy = H / 2;
    var before = toWorld(cx, cy);
    cam.k = clampK(cam.k * factor);
    cam.x = cx - before.x * cam.k;
    cam.y = cy - before.y * cam.k;
    draw();
  }

  function resetView() {
    // re-run the smooth frame-in rather than snapping
    userMoved = false; introDone = false; alpha = Math.max(alpha, 0.12);
  }

  function buildLegend(sectionsSeen) {
    if (!legendEl) return;
    legendEl.innerHTML = "";
    sectionsSeen.forEach(function (s) {
      var item = document.createElement("span");
      item.className = "graph__legend-item";
      var dot = document.createElement("span");
      dot.className = "graph__legend-dot";
      dot.style.background = color(s.key, false);
      item.appendChild(dot);
      item.appendChild(document.createTextNode(s.label));
      legendEl.appendChild(item);
    });
  }

  function build(data) {
    var byId = {};
    nodes = data.nodes.map(function (n) {
      var o = { id: n.id, title: n.title, section: n.section, sectionLabel: n.sectionLabel, highlight: n.highlight };
      byId[n.id] = o; return o;
    });
    adj = {};
    edges = [];
    data.edges.forEach(function (e) {
      var s = byId[e.source], t = byId[e.target];
      if (!s || !t) return;
      edges.push({ s: s, t: t });
      (adj[s.id] = adj[s.id] || []).push(t.id);
      (adj[t.id] = adj[t.id] || []).push(s.id);
    });

    if (!nodes.length) { emptyEl.hidden = false; return; }

    // legend: unique sections in node order
    var seen = [], seenKeys = {};
    data.nodes.forEach(function (n) {
      if (!seenKeys[n.section]) { seenKeys[n.section] = true; seen.push({ key: n.section, label: n.sectionLabel }); }
    });
    buildLegend(seen);

    size(); seed();
    if (reduce) {
      // no animation allowed — settle the layout synchronously, then snap-fit
      for (var i = 0; i < 300; i++) step();
      fitToView(); introDone = true;
    }
    if (raf) cancelAnimationFrame(raf);
    tick();
  }

  // events
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", function (e) { onDown(e); }, { passive: true });
  canvas.addEventListener("touchmove", function (e) { onMove(e); }, { passive: true });
  window.addEventListener("touchend", onUp);
  window.addEventListener("resize", function () { size(); fitToView(); alpha = Math.max(alpha, 0.2); });
  // redraw on theme change so colours track light/dark
  new MutationObserver(function () { draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // optional zoom controls (rendered by the page)
  var zoomIn = document.querySelector("[data-graph-zoom-in]");
  var zoomOut = document.querySelector("[data-graph-zoom-out]");
  var zoomReset = document.querySelector("[data-graph-zoom-reset]");
  if (zoomIn) zoomIn.addEventListener("click", function () { zoomBy(1.25); });
  if (zoomOut) zoomOut.addEventListener("click", function () { zoomBy(0.8); });
  if (zoomReset) zoomReset.addEventListener("click", function () { resetView(); });

  fetch(window.GRAPH_URL)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(build)
    .catch(function () { emptyEl.hidden = false; emptyEl.textContent = "Couldn't load the graph."; });
})();
