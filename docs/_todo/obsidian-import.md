---
title: "Import the Obsidian vault"
description: "Bring the existing .obsidian notes into the site's collections without losing links, tags, or history."
category: "Todo"
nav_order: 2
tags: [obsidian, import, migration]
---

Move the working notes out of the Obsidian vault and into this site, so a single
source of truth serves both editing and publishing.

## Tasks

- [x] Survey the site's front matter schema and indexing rules
- [x] Remove the manual index bookkeeping that the import would have inherited
- [ ] Receive and unpack the vault export
- [ ] Inventory front matter keys actually in use
- [ ] Check filename / title divergence across every note
- [ ] Decide the attachment strategy
- [ ] Run the import

## Open questions

- **Folder mapping.** Obsidian wants a flat vault; Jekyll wants `_`-prefixed
  collection folders. Decide whether the vault root becomes the repo root
  (collections appear as `_docs`, `_linux`, … in the file tree) or whether an
  import step rewrites paths.
- **Front matter.** Obsidian properties are arbitrary YAML. Map them onto the
  fields this site actually reads — `title`, `description`, `category`, `tags`,
  `nav_order`, `status` — and drop the rest rather than carrying dead keys.
- **Link resolution.** Obsidian resolves `[[links]]` against note filenames;
  this site resolves them against page titles or `section/slug` paths. Any note
  whose filename and title differ needs checking. See [[Getting started]].
- **Attachments.** Decide where images land and how they are referenced, since
  Obsidian's default embed syntax (`![[file.png]]`) is not Markdown.

## Not in scope

Obsidian plugins, canvas files, and vault-local settings stay in the vault —
only the notes themselves are published.
