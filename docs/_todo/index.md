---
layout: tool
permalink: /todo/
title: "Todo"
description: "Plans and aims — what's being built, what's queued, what's done."
section: "todo"
in_nav: false
# Flags this as a real section index rather than a redirect, which puts an
# "Overview" link at the top of the section sidebar. Any future section whose
# index is worth landing on can set the same flag.
section_overview: true
body_class: "is-todo"
sitemap: false
# The board is one big Liquid block; without this Jekyll tries to cut an
# excerpt at the first blank line inside it and warns about the unclosed tag.
excerpt_separator: ""
---

{%- comment -%}
  The Todo section index is a BOARD, not a redirect — every other section index
  bounces to its first page, but the whole point of this one is the overview,
  so it renders in full.

  Two layouts are available (kanban columns / stacked list) and the toggle in
  the header switches between them. Both are rendered from the SAME markup —
  only CSS differs — so there is no duplicated template and no flash of the
  wrong one. The choice persists in localStorage.

  Items are grouped by their EFFECTIVE status: an explicit `status:` in front
  matter, or, failing that, one derived from how many task checkboxes on the
  page are ticked. See _includes/todo-status.html.
{%- endcomment -%}
{%- include nav-docs.html key="todo" -%}

{%- comment -%}
  Flatten every item into a row once, up front. Effective status has to be
  computed per page, so it cannot be used with Liquid's `where` filter — and
  recomputing it inside each of the four groups would mean reading every
  page's content four times over. Fields, split on "‖":
      [0] status  [1] title  [2] url  [3] description
      [4] tasks done  [5] tasks total  [6] tags, ";"-joined
{%- endcomment -%}
{%- assign todo_rows = "" -%}
{%- for item in nav_docs -%}
  {%- include todo-status.html doc=item -%}
  {%- include doc-title.html doc=item -%}
  {%- assign item_tags = item.tags | join: ";" -%}
  {%- capture t_row -%}
{{ todo_status }}‖{{ doc_title }}‖{{ item.url }}‖{{ item.description }}‖{{ task_done }}‖{{ task_total }}‖{{ item_tags }}
  {%- endcapture -%}
  {%- if todo_rows == "" -%}
    {%- assign todo_rows = t_row -%}
  {%- else -%}
    {%- assign todo_rows = todo_rows | append: "¶" | append: t_row -%}
  {%- endif -%}
{%- endfor -%}
{%- if todo_rows == "" -%}
  {%- assign todo_rows = "" | split: "" -%}
{%- else -%}
  {%- assign todo_rows = todo_rows | split: "¶" -%}
{%- endif -%}

{%- comment -%} Totals for the header: items done, and tasks ticked across all items. {%- endcomment -%}
{%- assign total_count = todo_rows | size -%}
{%- assign done_count = 0 -%}
{%- assign tasks_done = 0 -%}
{%- assign tasks_total = 0 -%}
{%- for r in todo_rows -%}
  {%- assign f = r | split: "‖" -%}
  {%- if f[0] == "done" -%}{%- assign done_count = done_count | plus: 1 -%}{%- endif -%}
  {%- assign tasks_done = tasks_done | plus: f[4] -%}
  {%- assign tasks_total = tasks_total | plus: f[5] -%}
{%- endfor -%}
{%- if total_count > 0 -%}
  {%- assign pct = done_count | times: 100 | divided_by: total_count -%}
{%- else -%}
  {%- assign pct = 0 -%}
{%- endif -%}

<div class="todo" data-board data-board-view="kanban">
  <header class="todo__head">
    <div class="todo__head-row">
      <div>
        <h1 class="todo__title">Todo</h1>
        <p class="todo__lede mono muted">Where this is heading, and how far along it is.</p>
      </div>

      {%- comment -%}
        Rendered as real buttons rather than a link pair: this changes a view
        preference, not the page, so it should not push a history entry.
      {%- endcomment -%}
      <div class="todo__views" role="group" aria-label="Board layout">
        <button class="todo__view" type="button" data-board-set="kanban" aria-pressed="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><rect x="16" y="4" width="5" height="16" rx="1"/>
          </svg>
          <span>Columns</span>
        </button>
        <button class="todo__view" type="button" data-board-set="list" aria-pressed="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16"/>
          </svg>
          <span>List</span>
        </button>
      </div>
    </div>

    <div class="todo__progress" role="img"
         aria-label="{{ done_count }} of {{ total_count }} items done">
      <div class="todo__progress-bar">
        <span class="todo__progress-fill" style="width: {{ pct }}%"></span>
      </div>
      <p class="todo__progress-text mono muted">
        {{ done_count }} / {{ total_count }} done
        {%- if tasks_total > 0 %} · {{ tasks_done }} / {{ tasks_total }} tasks{% endif -%}
      </p>
    </div>
  </header>

  {%- comment -%}
    Group list as a split string — Liquid has no array literal.
    Each entry is "key|label|blurb".
  {%- endcomment -%}
  {%- assign groups = "active|In progress|Being worked on now§planned|Planned|Queued, not started§blocked|Blocked|Waiting on something else§done|Done|Shipped" | split: "§" -%}

  <div class="todo__groups">
  {%- for group in groups -%}
    {%- assign g = group | split: "|" -%}
    {%- assign g_key = g[0] -%}

    {%- assign g_count = 0 -%}
    {%- for r in todo_rows -%}
      {%- assign f = r | split: "‖" -%}
      {%- if f[0] == g_key -%}{%- assign g_count = g_count | plus: 1 -%}{%- endif -%}
    {%- endfor -%}

    {%- comment -%}
      Empty groups still render, so the columns layout keeps a stable four-lane
      shape. The list layout hides them in CSS instead — an empty heading in a
      vertical list is just noise.
    {%- endcomment -%}
    <section class="todo__group{% if g_count == 0 %} is-empty{% endif %}" data-status="{{ g_key }}">
      <header class="todo__group-head">
        <h2 class="todo__group-title">
          <span class="todo__pip" aria-hidden="true"></span>
          {{ g[1] }}
          <span class="todo__group-count mono">{{ g_count }}</span>
        </h2>
        <p class="todo__group-blurb mono muted">{{ g[2] }}</p>
      </header>

      <ul class="todo__list">
        {%- for r in todo_rows -%}
          {%- assign f = r | split: "‖" -%}
          {%- if f[0] == g_key -%}
        <li class="todo__item">
          <a class="todo__item-link" href="{{ f[2] | relative_url }}">
            <span class="todo__item-title">{{ f[1] }}</span>
            {%- if f[3] != "" %}
            <span class="todo__item-desc">{{ f[3] }}</span>
            {%- endif -%}
          </a>

          {%- comment -%} Per-item task progress, only when the page has tasks. {%- endcomment -%}
          {%- assign i_total = f[5] | plus: 0 -%}
          {%- if i_total > 0 -%}
            {%- assign i_pct = f[4] | times: 100 | divided_by: i_total -%}
          <span class="todo__item-tasks" title="{{ f[4] }} of {{ f[5] }} tasks done">
            <span class="todo__item-taskbar"><span class="todo__item-taskfill" style="width: {{ i_pct }}%"></span></span>
            <span class="todo__item-taskcount mono">{{ f[4] }}/{{ f[5] }}</span>
          </span>
          {%- endif -%}

          {%- if f[6] != "" -%}
          <span class="todo__item-tags">
            {%- assign i_tags = f[6] | split: ";" -%}
            {%- for t in i_tags -%}
            <a class="todo__item-tag mono" href="{{ '/directory/' | relative_url }}#tag={{ t | url_encode }}">{{ t }}</a>
            {%- endfor -%}
          </span>
          {%- endif -%}
        </li>
          {%- endif -%}
        {%- endfor -%}
        {%- if g_count == 0 -%}
        <li class="todo__item todo__item--placeholder mono muted">Nothing here</li>
        {%- endif -%}
      </ul>
    </section>
  {%- endfor -%}
  </div>

  {%- if total_count == 0 -%}
  <p class="todo__empty">Nothing on the board yet.</p>
  {%- endif -%}
</div>

<script src="{{ '/assets/js/todo.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
