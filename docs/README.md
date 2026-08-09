# khensolomon.github.io

Portfolio (Home) + documentation (Docs), one Jekyll site.

## Local

```bash
sudo apt update
sudo apt install ruby-full ruby-bundler build-essential

bundle install
bundle exec jekyll serve --livereload
# http://localhost:4000
```

## Deploy

Pushes to `main` deploy **only** when the commit message starts with `deploy:`:

```bash
git commit -m "deploy: header + sidebar rework"
git push
```

Any other commit message pushes without touching the live site. A manual
deploy is also available from the Actions tab (`workflow_dispatch`).

One-time repo setting: **Settings → Pages → Source → "GitHub Actions"**.

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

`docs/*.md` with `title`, `description`, `category`, `nav_order` front
matter — layout, sidebar entry, and search index all follow automatically.
