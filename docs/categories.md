---
layout: default
permalink: /categories/
title: "Categories"
section: ""
body_class: "is-taxonomy"
---

{%- comment -%}
  All categories across every section, with counts, each linking to Browse
  pre-filtered. category falls back to the section label when a page omits its
  own, matching search.json/directory.json behaviour.
{%- endcomment -%}
{%- assign cat_rows = "" -%}
{%- for meta in site.data.sections -%}
  {%- assign sect_docs = site[meta.key] | where: "in_nav", true -%}
  {%- for doc in sect_docs -%}
    {%- assign c = doc.category | default: meta.label -%}
    {%- assign cat_rows = cat_rows | append: c | append: "|" -%}
  {%- endfor -%}
{%- endfor -%}
{%- assign all_cats = cat_rows | split: "|" | uniq | sort -%}

<div class="taxonomy">
  <header class="taxonomy__head">
    <h1 class="taxonomy__title">Categories</h1>
    <p class="taxonomy__lede mono muted">Each page's primary kind. Pick one to see every page in it.</p>
  </header>

  <div class="taxonomy__cloud">
    {%- for c in all_cats -%}
      {%- if c != "" -%}
        {%- assign count = 0 -%}
        {%- for meta in site.data.sections -%}
          {%- assign sd = site[meta.key] | where: "in_nav", true -%}
          {%- for doc in sd -%}
            {%- assign dc = doc.category | default: meta.label -%}
            {%- if dc == c -%}{%- assign count = count | plus: 1 -%}{%- endif -%}
          {%- endfor -%}
        {%- endfor -%}
        <a class="taxonomy__item taxonomy__item--cat" href="{{ '/directory/' | relative_url }}#category={{ c | url_encode }}">
          <span class="taxonomy__item-label">{{ c }}</span>
          <span class="taxonomy__item-count mono">{{ count }}</span>
        </a>
      {%- endif -%}
    {%- endfor -%}
  </div>

  <p class="taxonomy__foot mono muted">
    Prefer to explore visually? <a href="{{ '/directory/' | relative_url }}">the directory</a>.
  </p>
</div>
