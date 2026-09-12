---
layout: tool
permalink: /review/
title: "Review"
description: "Page notes and automatic findings for this site."
sitemap: false
excerpt_separator: ""
---

<div class="review" data-review-page="{{ '/' | relative_url }}">
  <header class="review__head">
    <h1 class="review__title">Review</h1>
    <p class="review__lede">
      What needs fixing on the site itself — separate from the
      <a href="{{ '/todo/' | relative_url }}">project board</a>, which tracks
      the work rather than the writing.
    </p>
  </header>

  <section class="review__block">
    <h2 class="review__block-title mono">Findings</h2>
    <p class="review__block-note">
      Computed from the site's own indexes on each visit, so they are always
      current and need no upkeep.
    </p>
    <div data-review-findings>
      <p class="review__empty mono">Loading…</p>
    </div>
  </section>

  <section class="review__block">
    <h2 class="review__block-title mono">
      Drafts
      <span class="review__count mono" data-draft-count>0 drafts</span>
    </h2>
    <p class="review__block-note">
      Written in the composer, identified by row id. Stored on this device;
      export writes a markdown file with its front matter already in place.
    </p>
    <div data-draft-list></div>
  </section>

  <section class="review__block">
    <h2 class="review__block-title mono">
      Page notes
      <span class="review__count mono" data-review-count>0 notes</span>
    </h2>
    <p class="review__block-note">
      Stored on this device only. Export writes markdown, so a note can be
      pasted straight into a commit or a board item.
    </p>
    <div data-review-notes></div>

    <div class="bookmarks__actions review__actions">
      <button class="bookmarks__btn" type="button" data-review-export>Export markdown</button>
      <label class="bookmarks__btn bookmarks__btn--file">
        Import JSON
        <input type="file" accept="application/json,.json" data-review-import hidden>
      </label>
      <button class="bookmarks__btn bookmarks__btn--danger" type="button" data-review-clear>Remove all</button>
    </div>
    <p class="bookmarks__status mono muted" role="status" data-review-status></p>
  </section>
</div>
