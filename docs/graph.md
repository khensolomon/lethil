---
layout: default
permalink: /graph/
title: "Graph View"
section: ""
sitemap: false
body_class: "is-graph"
---

<div class="graph">
  <div class="graph__stage" data-graph>
    <canvas class="graph__canvas" data-graph-canvas></canvas>
    <div class="graph__empty" data-graph-empty hidden>No connections yet.</div>
    <div class="graph__tooltip" data-graph-tooltip hidden></div>
    <div class="graph__controls" aria-label="Zoom controls">
      <button class="graph__ctrl" data-graph-zoom-in type="button" aria-label="Zoom in">+</button>
      <button class="graph__ctrl" data-graph-zoom-out type="button" aria-label="Zoom out">&minus;</button>
      <button class="graph__ctrl" data-graph-zoom-reset type="button" aria-label="Reset view">⟳</button>
    </div>
  </div>

  {%- comment -%}
    The info + legend sit in a compact bar at the BOTTOM so the graph stage
    gets all the vertical space. On wide screens it's a single row; it wraps
    on narrow ones.
  {%- endcomment -%}
  <div class="graph__bar">
    <div class="graph__info">
      <span class="graph__title">Graph View</span>
      <span class="graph__hint">Drag to pan · scroll to zoom · click a node to open it</span>
    </div>
    <div class="graph__legend" data-graph-legend></div>
  </div>
</div>

<script>
  window.GRAPH_URL = {{ '/graph.json' | relative_url | jsonify }};
</script>
<script src="{{ '/assets/js/graph.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
