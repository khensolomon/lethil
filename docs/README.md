# Lethil — docs site

The Jekyll source for **https://khensolomon.github.io/** (portfolio Home +
documentation). This folder is the source of truth; it's built and deployed by
the workflow at the repository root. See the top-level
[`../README.md`](../README.md) for the deploy setup and the `docs update:`
publishing flow.

## Local

```bash
sudo apt update
sudo apt install ruby-full ruby-bundler build-essential

bundle install
bundle exec jekyll serve --livereload
# http://localhost:4000
```

## Layout behavior

- One global sidebar (`_includes/sidebar.html`), full viewport height, never
  under the header. Hidden by default on Home; open by default on Docs at
  desktop/tablet width (the choice is remembered per tab while browsing docs).
- Opening the sidebar **resizes** the content at >= 700px (no horizontal
  scrollbar) and **pushes** it off-canvas below 700px.
- Search: always-visible input in the left header cluster on Docs; icon-only
  on Home until clicked. Escape or clicking away (empty query) collapses it.
- Nav state lives on `body[data-nav]`; theme on `html[data-theme]`. Both are
  resolved by inline scripts before first paint, so nothing flashes or
  animates on load.

## Adding a docs page

Add a markdown file under the relevant section folder (`_docs/`, `_server/`,
`_python/`, ...) with `title`, `description`, `category`, `nav_order` front
matter — layout, sidebar entry, and search index all follow automatically. To
add a whole new section, register a collection in `_config.yml`, create the
`_<name>/` folder, and add an entry to `_data/sections.yml`.
