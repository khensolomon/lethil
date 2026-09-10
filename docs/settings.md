---
layout: tool
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
      Fill in a key and every code block on the site shows the real command
      instead of a placeholder. Stored on this device only — nothing is sent
      anywhere, and clearing this site's browser data removes it.
    </p>
  </header>

  <table class="phform" data-ph-form="{{ '/placeholders.json' | relative_url }}">
    <thead>
      <tr>
        <th scope="col">
          {%- comment -%}
            The sort control lives in the column it sorts, rather than on its
            own line above the table — it was costing a full row to say one
            word.
          {%- endcomment -%}
          {%- comment -%}
            The native select is kept for the picker — it is the right control
            on a phone — but rendered transparently over a custom trigger, so
            its appearance is ours while the menu stays the platform's. Styling
            a bare select shrank it to its text and let it overrun the VALUE
            column on narrow screens.
          {%- endcomment -%}
          <span class="phsort">
            <span class="phsort__label">Key</span>
            <span class="phsort__control">
              <svg class="phsort__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 7h11M4 12h7M4 17h4"/><path d="M17 10.5 20 7l3 3.5" transform="translate(-2,3)"/>
              </svg>
              <span class="phsort__value" data-ph-sort-label>Most used</span>
              <select data-ph-sort aria-label="Sort keys">
                <option value="uses">Most used</option>
                <option value="alpha">A → Z</option>
                <option value="set">Filled first</option>
              </select>
            </span>
          </span>
        </th>
        <th scope="col">Value</th>
      </tr>
    </thead>
    <tbody data-ph-body>
      <tr><td colspan="2" class="phform__loading mono muted">Loading…</td></tr>
    </tbody>
  </table>

  <details class="phsecret">
    <summary class="phsecret__summary">
      <span class="phsecret__title">Credentials</span>
      <span class="phsecret__count mono" data-ph-secret-count>0 keys</span>
    </summary>

    <p class="phpage__warn">
      Credentials are <strong>never written into a page</strong>. Code blocks keep
      showing <code>&lt;TUNNEL_TOKEN&gt;</code>; the real value is inserted only
      on <strong>Copy</strong>, so it reaches the clipboard and nowhere else —
      not the screen, not a screenshot, not a shared window. Credentials are
      also excluded from export.
    </p>

    <label class="phsecret__session">
      <input type="checkbox" data-ph-session>
      <span>Forget when this tab closes</span>
    </label>

    <table class="phform phform--secret">
      <thead>
        <tr><th scope="col">Key</th><th scope="col">Value</th></tr>
      </thead>
      <tbody data-ph-secret-body></tbody>
    </table>
  </details>

  <noscript>
    <p class="phpage__warn">This page needs JavaScript — values are stored in this browser.</p>
  </noscript>

  <section class="bookmarks__tools">
    <h2 class="bookmarks__tools-title mono">Backup</h2>
    <div class="bookmarks__actions">
      <button class="bookmarks__btn" type="button" data-ph-export>Export values</button>
      <label class="bookmarks__btn bookmarks__btn--file">
        Import values
        <input type="file" accept="application/json,.json" data-ph-import hidden>
      </label>
      <button class="bookmarks__btn bookmarks__btn--danger" type="button" data-ph-clear>Remove all</button>
    </div>
    <p class="bookmarks__status mono muted" role="status" data-ph-status></p>
  </section>
</div>
