---
title: "Authoring these docs"
description: "Conventions behind the docs site - sections, front matter, and wiki-links."
category: "Guide"
group: "Documentations"
nav_order: 10
tags: [jekyll, authoring]
---

Every docs section — `docs`, `python`, `linux`, `server`, and so on — is a
Jekyll **collection**. Landing on any section shows only that section's pages
in the sidebar; the home page shows a collapsible directory of every section.

### The three moving parts

1. **`_config.yml`** registers each section as a collection (an explicit
   allow-list, so folders like `assets/` and `tmp/` are simply never included).
2. **`_data/sections.yml`** lists the sections for the home sidebar — label,
   badge, an optional blurb, and an optional `highlight` flag to pin it up top.
3. **`_<section>/`** holds the pages: an `index.md` that forwards to the first
   page, plus one markdown file per page.

Which pages count as navigable, and what order they appear in, is decided in
exactly one place — `_includes/nav-docs.html`. The sidebar, search, the graph,
the directory, the tag and category indexes, and the section redirects all read
from it, so they can never disagree with each other.

### Add a page to an existing section

1. Create `_python/logging.md`.
2. Start it with an empty front matter block — two `---` lines and nothing
   between them.
3. Write Markdown.

That is genuinely all. The page appears in that section's sidebar, in search,
in the directory, and as a node in the graph. Its title becomes "Logging"
(from the filename) and its category becomes "Python" (from the section).

Everything else is an optional override:

| Front matter  | Default when omitted                       |
| ------------- | ------------------------------------------ |
| `title`       | the filename, de-slugified                 |
| `category`    | the section's label                        |
| `nav_order`   | sorts alphabetically, after ordered pages  |
| `description` | omitted                                    |
| `tags`        | none                                       |
| `status`      | none (Todo pages use `planned`/`active`/`blocked`/`done`) |

Set `in_nav: false` to keep a page out of the nav, search, and the graph while
still building it — useful for drafts.

The empty `---` block is the one hard requirement: Jekyll copies a file with no
front matter at all straight through as a static asset, without rendering it.

### Add a whole new section

1. Register it in `_config.yml` under `collections:` and `defaults:`.
2. Create the `_<name>/` folder with an `index.md` and pages.
3. Add an entry to `_data/sections.yml`.

### Run it locally

```bash
bundle exec jekyll serve --livereload
```

Then open `http://localhost:4000`. Styling comes from the SCSS in `_sass/`,
compiled to `/assets/css/style.css` — no per-page CSS needed.
