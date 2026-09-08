---
layout: default
permalink: /bookmarks/
title: "Bookmarks"
description: "Pages saved on this device."
sitemap: false
excerpt_separator: ""
---

<div class="bookmarks">
  <header class="bookmarks__head">
    <h1 class="bookmarks__title">Bookmarks</h1>
    <p class="bookmarks__lede">
      Saved on this device only. Nothing is sent anywhere, and clearing this
      site's browser data removes them.
    </p>
    <p class="bookmarks__count mono muted" data-bookmark-count>0 pages</p>
  </header>

  <div class="bookmarks__body" data-bookmark-list>
    <noscript>
      <p class="bookmarks__empty">Bookmarks need JavaScript — they are stored in this browser.</p>
    </noscript>
  </div>

  <section class="bookmarks__tools">
    <h2 class="bookmarks__tools-title mono">Backup</h2>
    <div class="bookmarks__actions">
      <button class="bookmarks__btn" type="button" data-bookmark-export>Export JSON</button>
      <label class="bookmarks__btn bookmarks__btn--file">
        Import JSON
        <input type="file" accept="application/json,.json" data-bookmark-import hidden>
      </label>
      <button class="bookmarks__btn bookmarks__btn--danger" type="button" data-bookmark-clear>Remove all</button>
    </div>
    <p class="bookmarks__status mono muted" role="status" data-bookmark-status></p>
  </section>
</div>
