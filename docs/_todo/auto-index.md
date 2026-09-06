---
title: "Drop the manual index bookkeeping"
description: "Make a page navigable and correctly ordered without hand-managed nav_order and in_nav front matter."
category: "Todo"
status: "done"
nav_order: 3
tags: [authoring, jekyll]
---

Adding a page used to mean remembering `in_nav: true`, picking a free
`nav_order`, and setting `title` and `category` by hand. Forgetting any of them
failed silently: the page still built, but disappeared from the sidebar,
search, the graph, and the directory at once.

## What changed

- **Navigable by default.** A page is in the nav unless it sets
  `in_nav: false`, or is a section index. The old rule was the inverse.
- **`nav_order` is optional.** Pages that set it come first, in that order;
  everything else follows alphabetically by title.
- **`title` and `category` are optional.** Title falls back to the URL slug,
  category to the section label.
- **One definition, not seven.** Every consumer — sidebar, search, graph,
  directory, tags, categories, the section redirect — now goes through
  `_includes/nav-docs.html` instead of walking the collections itself.

A new page needs an empty front matter block and nothing else.
