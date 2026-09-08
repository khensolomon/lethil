---
layout: default
permalink: /settings/
title: "Settings"
description: "Values substituted into code blocks on this device."
sitemap: false
excerpt_separator: ""
---

<div class="phpage">
  <header class="phpage__head">
    <h1 class="phpage__title">Settings</h1>
    <p class="phpage__lede">
      Fill in the values you use, and every code block on the site shows your
      command instead of a placeholder. Stored on this device only — nothing is
      sent anywhere, and clearing this site's browser data removes it.
    </p>
    <p class="phpage__warn">
      API tokens, secret keys and passwords are deliberately not listed here.
      Values entered on this page are kept in the browser, which is the wrong
      place for a live credential — commands that need one show a shell
      variable such as <code>"$TUNNEL_TOKEN"</code> instead.
    </p>
  </header>

  <table class="phform" data-ph-form="{{ '/placeholders.json' | relative_url }}">
    <thead>
      <tr>
        <th scope="col">Placeholder</th>
        <th scope="col">Your value</th>
        <th scope="col"><span class="visually-hidden">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      <tr><td colspan="3" class="phform__loading mono muted">Loading…</td></tr>
    </tbody>
  </table>

  <noscript>
    <p class="phpage__warn">This page needs JavaScript — values are stored in this browser.</p>
  </noscript>

  <section class="bookmarks__tools">
    <h2 class="bookmarks__tools-title mono">Backup</h2>
    <div class="bookmarks__actions">
      <button class="bookmarks__btn" type="button" data-ph-export>Export JSON</button>
      <label class="bookmarks__btn bookmarks__btn--file">
        Import JSON
        <input type="file" accept="application/json,.json" data-ph-import hidden>
      </label>
      <button class="bookmarks__btn bookmarks__btn--danger" type="button" data-ph-clear>Remove all</button>
    </div>
    <p class="bookmarks__status mono muted" role="status" data-ph-status></p>
  </section>
</div>
