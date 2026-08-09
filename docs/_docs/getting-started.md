---
title: "Getting started"
description: "How the docs sections work and how to add pages."
category: "Guide"
nav_order: 1
in_nav: true
---

Every docs section — `docs`, `python`, `linux`, `server`, and so on — is a
Jekyll **collection**. Landing on any section shows only that section's pages
in the sidebar; the home page shows a collapsible directory of every section.

## The three moving parts

1. **`_config.yml`** registers each section as a collection (an explicit
   allow-list, so folders like `assets/` and `tmp/` are simply never included).
2. **`_data/sections.yml`** lists the sections for the home sidebar — label,
   badge, an optional blurb, and an optional `highlight` flag to pin it up top.
3. **`_<section>/`** holds the pages: an `index.md` that forwards to the first
   page, plus one markdown file per page.

## Add a page to an existing section

1. Create `_python/logging.md`.
2. Give it `title`, `category`, `nav_order`, and `in_nav: true`.
3. Write Markdown. It appears in that section's sidebar and in search.

## Add a whole new section

1. Register it in `_config.yml` under `collections:` and `defaults:`.
2. Create the `_<name>/` folder with an `index.md` and pages.
3. Add an entry to `_data/sections.yml`.

## Run it locally

```bash
bundle exec jekyll serve --livereload
```

Then open `http://localhost:4000`. Styling comes from the SCSS in `_sass/`,
compiled to `/assets/css/style.css` — no per-page CSS needed.
