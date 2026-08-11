---
layout: default
permalink: /tags/
title: "Tags"
section: ""
body_class: "is-taxonomy"
---

{%- comment -%}
  All tags across every section, with a count, each linking to the Browse page
  pre-filtered to that tag. Built with a plain collection walk (no plugin): we
  gather tags into a pipe-delimited string, then de-duplicate while counting.
{%- endcomment -%}
{%- assign tag_rows = "" -%}
{%- for meta in site.data.sections -%}
  {%- assign sect_docs = site[meta.key] | where: "in_nav", true -%}
  {%- for doc in sect_docs -%}
    {%- for t in doc.tags -%}
      {%- assign tag_rows = tag_rows | append: t | append: "|" -%}
    {%- endfor -%}
  {%- endfor -%}
{%- endfor -%}
{%- assign all_tags = tag_rows | split: "|" | uniq | sort -%}

<div class="taxonomy">
  <header class="taxonomy__head">
    <h1 class="taxonomy__title">Tags</h1>
    <p class="taxonomy__lede mono muted">Cross-cutting topics. Pick one to see every page that uses it.</p>
  </header>

  <div class="taxonomy__cloud">
    {%- for t in all_tags -%}
      {%- if t != "" -%}
        {%- assign count = 0 -%}
        {%- for meta in site.data.sections -%}
          {%- assign sd = site[meta.key] | where: "in_nav", true -%}
          {%- for doc in sd -%}
            {%- if doc.tags contains t -%}{%- assign count = count | plus: 1 -%}{%- endif -%}
          {%- endfor -%}
        {%- endfor -%}
        <a class="taxonomy__item" href="{{ '/directory/' | relative_url }}#tag={{ t | url_encode }}">
          <span class="taxonomy__item-label">{{ t }}</span>
          <span class="taxonomy__item-count mono">{{ count }}</span>
        </a>
      {%- endif -%}
    {%- endfor -%}
  </div>

  <p class="taxonomy__foot mono muted">
    Prefer to explore visually? <a href="{{ '/directory/' | relative_url }}">the directory</a>.
  </p>
</div>
