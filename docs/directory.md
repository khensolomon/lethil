---
layout: default
permalink: /directory/
title: "Directory"
section: ""
body_class: "is-directory"
---

<div class="directory">
  <header class="directory__head">
    <h1 class="directory__title">Directory</h1>
    <p class="directory__lede mono muted">Every page, filterable by category and tag.</p>
  </header>

  <div class="directory__controls" data-directory-facets>
    <div class="directory__controls-head">
      <h2 class="directory__controls-title">Filter</h2>
      <span class="directory__controls-hint mono muted">pick any — they combine</span>
    </div>
    <div class="directory__facet-group" data-facet-group>
      <span class="directory__facet-label">Categories</span>
      <div class="directory__chips" data-directory-categories data-collapsible></div>
      <button class="directory__more" type="button" data-more hidden></button>
    </div>
    <div class="directory__facet-group" data-facet-group>
      <span class="directory__facet-label">Tags</span>
      <div class="directory__chips directory__chips--tags" data-directory-tags data-collapsible></div>
      <button class="directory__more" type="button" data-more hidden></button>
    </div>
  </div>

  <div class="directory__status">
    <p class="directory__count mono muted" data-directory-count></p>
    <button class="directory__clear" type="button" data-directory-clear hidden>Clear filters</button>
  </div>
  <div class="directory__grid" data-directory-grid></div>
  <p class="directory__empty" data-directory-empty hidden>No pages match those filters.</p>
  <nav class="directory__pager" data-directory-pager aria-label="Pagination" hidden></nav>
</div>

<script>
  window.DIRECTORY_URL = {{ '/directory.json' | relative_url | jsonify }};
</script>
<script src="{{ '/assets/js/directory.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
