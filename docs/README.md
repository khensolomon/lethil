# Lethil docs

Source for the Lethil documentation site — notes on infrastructure, tooling,
and self-hosted systems. Jekyll, no build plugins: everything below is Liquid,
vanilla JS, and Sass, so GitHub Pages builds it unchanged.

---

## What the site does

**Ten sections, generated.** Content lives in collections (`_docs`, `_server`,
`_linux`, `_python`, `_sql`, `_mobile`, `_plex`, `_note`, `_quote`, `_todo`).
Each gets a landing page listing its contents, a sidebar, and an entry in every
index — none of it written by hand.

**Search that browses.** The topbar box lists every page while empty and
filters as a term is typed. Section chips narrow either mode. The index is
built per heading, so a result points at the section that matched, and opening
one highlights the term and scrolls to it.

**Wiki-links and backlinks.** `[[Page title]]` or `[[section/slug]]` resolves at
build time. Each page then lists what links *to* it — the reverse of the links
already written by hand.

**A graph** of those links, a **directory** with category and tag filters, and a
**tag index**.

**A Todo board** at `/todo/`, grouped by status, where progress can be derived
from the `- [ ]` checkboxes on the page itself.

**Bookmarks** and **placeholder values**, both stored only in the browser.
Filling in a key on `/settings/` substitutes it into every code block on the
site; credential-shaped keys are never written into the page and are inserted
only on Copy.

---

## Adding a page

Drop a markdown file into the relevant section folder. It needs an empty front
matter block — two `---` lines — and nothing else:

```markdown
---
---

Anything here.
```

That page then appears in its sidebar, on the section landing page, in search,
in the directory, and in the graph. Its title comes from the filename and its
category from the section.

Everything else is an optional override:

| Front matter     | Default when omitted                                       |
| ---------------- | ---------------------------------------------------------- |
| `title`          | the filename, de-slugified                                  |
| `description`    | omitted — worth setting, as it becomes the search snippet   |
| `category`       | the section's label                                         |
| `group`          | ungrouped, listed before any groups                         |
| `nav_order`      | sorts alphabetically, after pages that set one              |
| `tags`           | none                                                        |
| `status`         | none — Todo uses `planned` / `active` / `blocked` / `done`  |
| `in_nav`         | `true` — set `false` to build a draft without listing it    |
| `search_content` | `true` — set `false` to index by title only                 |

**Groups** produce headed blocks in the sidebar and on the landing page. Pages
sharing a `group:` value are listed together, and group order follows the
`nav_order` of each group's first page — no registry to maintain.

The empty `---` block is the one hard requirement: a file with no front matter
at all is copied through as a static asset without being rendered.

### Adding a section

1. Register the collection in `_config.yml` (`output: true` and a permalink).
2. Add a `defaults` entry mapping it to `layout: docs`.
3. Create `_<name>/` with an `index.md` using `layout: section`.
4. Add an entry to `_data/sections.yml` — key, label, badge, blurb.

Step 4 is the one that matters: every index walks `site.data.sections`, so a
collection missing from it stays invisible everywhere.

---

## Running it locally

Requires Ruby with bundler:

```bash
cd docs
bundle install
bundle exec jekyll serve --livereload
```

The `Gemfile` pins `github-pages`, which mirrors the exact gem set GitHub Pages
builds with, so local output matches production — including the Jekyll version
(3.x, not 4.x, which matters for Liquid features such as `where_exp`).

**`_config.yml` is read once at startup.** `serve --livereload` watches content,
not configuration, so any change to `_config.yml` — a new collection, a
`defaults` entry, an `exclude` — requires stopping and restarting the server.
Content, layouts, includes, data files, and Sass all reload normally.

Before pushing:

```bash
make check     # verifies the install is complete
```

---

## The logo

`assets/logo.svg` at the repository root is the source; `docs/assets/logo.svg`
is what the site serves.

**Jekyll cannot read the root copy.** Its `source` directory is a hard
boundary: `include:` only whitelists paths inside it, and symlinks are no help
either. Both cases were tested — a normal build copies the symlink itself into
`_site`, where it dangles because the target was never copied, and a `--safe`
build (what GitHub Pages uses) drops it silently. The file has to be copied.

Making the copy part of the build beats remembering it. In the root `Makefile`:

```make
logo:
	cp assets/logo.svg docs/assets/logo.svg

serve: logo
	cd docs && bundle exec jekyll serve --livereload

update: logo
	git add -A && git commit -m "docs: update" && git push
```

With `logo` as a prerequisite, neither `make serve` nor `make update` can ship a
stale copy. The same `cp` belongs in the deploy workflow ahead of its build
step, if that workflow builds from a fresh checkout.

The alternative — pointing Jekyll's `source` at the repository root — works, but
requires excluding everything that is not the site, and shifts every path in
the project. Not worth it for one file.
