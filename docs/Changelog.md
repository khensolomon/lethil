---
layout: docs
permalink: /changelog/
in_nav: true
title: "Changelog"
description: "Notable changes, newest first."
category: "Reference"
nav_order: 99
---

Versions use `yy.mm.dd` — the date the change shipped. Newest at the top.

## 26.08.03b

- Redesigned the menu button to match the supplied design. The hamburger is
  now three left-aligned bars of varied length (full, short, medium) with a
  ragged right edge, rather than three equal lines. On hover the lengths
  redistribute — the top shrinks, the middle becomes the shortest, and the
  bottom grows to full — so the icon animates by changing bar lengths instead
  of fanning or sliding. Open, the bars collapse into a clean centred X; on
  hovering the X it settles with a calm 8° tilt rather than the previous spin.
  All of it respects reduced-motion.

## 26.08.03a

- Restructured into a cross-repo setup. The Jekyll source now lives in the
  main `lethil` repository under `docs/`, and a GitHub Actions workflow builds
  it and deploys the generated site to the separate `khensolomon.github.io`
  repository, which keeps serving the free GitHub Pages URL. Publishing is
  gated on the commit message: a push whose message starts with `docs update:`
  triggers a deploy, while any other commit pushes without touching the live
  site. A one-time deploy-key setup (documented in the root README) gives the
  workflow permission to write into the Pages repo.
- Repointed the site's own-repo reference. The activity ticker that keeps the
  site's own source repository out of its visible rotation now points at
  `lethil` (where the docs source lives) instead of `khensolomon.github.io`.

## 26.07.28j

- Reworked the menu button's hover motion to be more legible. Closed, the bars
  no longer fan out into an uneven ladder — they stay a clean, equal, aligned
  hamburger that simply scales up a touch and warms to the accent, the plain
  "this is interactive" cue. Open, the X now pulls inward with a small pinch
  (arms shortening, icon contracting) that reads as "close / dismiss" instead
  of the previous abstract spin. Both still respect reduced-motion.

## 26.07.28i

- The collapsible sections in the home and graph sidebars now show a file-tree
  guide. A vertical rail drops from directly beneath each section's arrow, and
  every sub-page hangs off it with a short connector — so the nesting reads at
  a glance. The rail lines up exactly with the arrow's centre, and the active
  page's connector picks up the accent colour.
- Fixed the feature banner on phones. The star was stranded as a full-width
  bar at the bottom with empty space beside it, and the label sat cramped
  against the body. Now the label pill, the body, and a compact star chip
  stack with proper spacing, and the star no longer stretches across an empty
  gutter.
- The profile links now animate on entrance. They already faded in on scroll,
  but as one block — now each item cascades up in turn with a short stagger,
  matching the assembled-in-sequence feel of the hero.

## 26.07.28h

- Reworked the close (X) hover on the menu button. Instead of shrinking the
  arms, the whole X now spins a smooth 90° in place and scales up slightly —
  because a symmetric X looks identical at 0° and 90°, it reads as a deliberate
  spin that lands back on a perfect X. Much more satisfying than the old nudge.
- Overhauled the home page on phones, where it felt loosely composed. The
  headline no longer stays oversized on narrow screens (its size floor was too
  high, forcing it to wrap) — it now scales down to fit one line. The big empty
  gap above the first content at the top is reduced. And the spacing between
  the hero, activity ticker, showcase, and links — previously an uneven mix of
  cramped and loose gaps — now follows one consistent rhythm.
- Bumped the two smallest touch targets up to the 44px comfort minimum on
  touch devices: the menu button and the activity ticker link now have larger
  tap areas (the visible size is unchanged; only the hit area grows), while
  desktop keeps the compact sizes.
- Updated the site logo.

## 26.07.28g

- Reworked the menu button. It no longer uses a hover background or border at
  all; instead it expresses itself entirely through its bars. On hover while
  closed, the three bars warm to the accent colour and fan out with a small
  spring — the middle one shortening — a friendly "reach" gesture. Open, it's
  a clean X that tightens slightly and deepens in colour on hover, so the two
  states feel distinct under the cursor. All of it respects reduced-motion.
- Made the search shortcut hint non-selectable, since it's a decorative
  affordance rather than text meant to be copied.
- Updated the site logo.

## 26.07.28f

- Graph View's intro is now one continuous motion. Previously the layout
  settled at one scale and then the camera snapped to its final framing, which
  felt disconnected. Now the camera eases toward the framing throughout the
  settle — starting gently zoomed out and gliding into the fitted view — so the
  unfolding and the zoom-to-frame are a single smooth movement that ends
  exactly where it should. Panning, zooming, or dragging during the intro hands
  control to you immediately, and Reset replays the smooth frame-in.
- Tightened the vertical centring of the legend dot against its label.
- The theme button is now two clicks instead of three. From auto it applies a
  single manual override to the opposite of whatever the device prefers (so on
  a dark device it flips to light, on a light device it flips to dark), and a
  second click returns to auto. If the device preference later changes to match
  a manual override, it quietly reverts to auto so the next click still behaves.

## 26.07.28e

- Removed the theme switch from the header now that it lives in the sidebar.
  It's the single theme control across the site; clicking it still cycles
  light, dark, and auto, and the sidebar is always one tap away on phones via
  the nav button.
- Dimmed the footer text a little further. Both footer lines now use a
  dedicated dimmer colour (a new token per theme) rather than the standard
  muted colour, so they recede more at the very bottom of the page. The Jekyll
  mark still brightens to the accent colour on hover.

## 26.07.28d

- Fixed a serious URL bug: docs section pages were generating enormous URLs
  containing the repository's full filesystem path (e.g. a getting-started
  page appearing under a long /docs/home/.../getting-started/ address). The
  cause was the collection permalink using the path token together with
  collections living at the repository root; switching to the name token
  produces the intended clean /section/slug/ URLs. This affected every docs
  link, graph navigation, sidebar link, and search result, so it's the most
  important fix here.
- The search shortcut hint is now hidden on iPad and smaller, showing only at
  desktop widths where a physical keyboard shortcut actually applies.
- The footer now shows a small Jekyll mark (linked to the Jekyll site) in
  place of the plain "built with jekyll" text. It's an inline SVG that adapts
  to light and dark themes.
- Profile links now stretch to full width and stack as rows on small screens,
  matching how the showcase cards behave, instead of wrapping centered.
- The theme switch moved from the sidebar foot up into the sidebar head, as an
  icon-only button beside the brand (a two-column head). The foot is kept as
  an empty, reserved slot for future use.
- Graph View now uses all available space. The header on top is gone; the
  stage fills the viewport below the site header, and a compact bar at the
  bottom carries the title, a one-line hint, and the section legend.

## 26.07.28c

- Graph View is now fully interactive and "natural". You can drag empty space
  to pan, scroll to zoom (centred on the cursor), use the on-screen plus,
  minus, and reset buttons, drag a node to reposition it, and click a node to
  open its page — click and drag are told apart by a small movement threshold.
  The boxed white background is gone; the graph floats on a faint dotted
  texture that blends into the page in both light and dark themes, and it
  auto-frames itself once the layout settles. In fixing this I found and
  removed a real bug: the empty-state overlay was covering the canvas and
  silently swallowing every mouse event, which would have made the graph
  non-interactive.
- The section groups in the home sidebar are cleaner. The letter badge is
  gone, replaced by a chevron on the left that rotates open like a file tree.
  The one-line blurb (the snap info) and the accent highlight dot both stay.
- The activity ticker lost its pipe separator. Instead of the event text
  fading in as one block, the dot, verb, connector, repo, and time now animate
  in as one orchestrated cascade on each rotation, with the dot giving a small
  synchronised ping — layered on top of its continuous tier pulse rather than
  replacing it. All of it collapses to a plain static line under reduced-motion.

## 26.07.28b

- The home sidebar is now Obsidian-style. Gone are the "Highlighted" and "All
  sections" captions; instead the top holds two fixed items — Graph View and
  Documentation — then a thin divider, then every section as a collapsible
  group. Each group keeps its badge and one-line blurb (the snap info). The
  `highlight` flag no longer pins a section to a separate group; it now paints
  a small accent dot on the item.
- Added wiki-links. Writing a page's title in double square brackets in any
  docs page now becomes a real link at build time, resolved against every
  page's title or path. An optional pipe gives custom display text, and a
  section-slug path form is supported too. Unresolved links render muted and
  dashed, like Obsidian's broken links.
- Added a Graph View at `/graph/`: an interactive, force-directed map of every
  documentation page, connected by the wiki-links between them. Drag a node to
  reposition it, hover to trace and highlight its links, click to open the
  page. Nodes are coloured by section, sized by how many connections they
  have, and highlighted sections use the accent colour. The connection data is
  computed at build time; the page itself is a small canvas physics simulation
  with no external library, and it honours reduced-motion by settling
  immediately instead of animating.

## 26.07.28a

- Migrated all styling from a single hand-written CSS file to Sass. The source
  now lives as partials in `_sass/` plus one entry file, `assets/css/style.scss`,
  which Jekyll compiles to `/assets/css/style.css` — so every existing
  reference keeps working and the `_sass/` sources are excluded from the built
  site. The `assets/css/` folder holds only the entry file now. Verified the
  compiled output is byte-for-byte equivalent to the old CSS once Sass's
  cosmetic formatting (leading zeros, quote-stripping) is accounted for.
  Breakpoints and the z-index scale are now named Sass variables in one place.

- Docs are now multi-section. Each top-level area — docs, python, linux,
  server, plex, note, quote, sql — is its own section, registered explicitly
  in `_config.yml` (so folders like assets and tmp are simply never included).
  Landing on any section shows only that section's pages in the sidebar. The
  home sidebar instead shows a collapsible directory of every section, with a
  pinned "Highlighted" group up top, driven by `_data/sections.yml`. Section
  and page order both come from front matter. Search now spans every section.
  Adding a section is three steps: register the collection, create the folder,
  add a registry entry — all documented on the Getting started page.

## 26.07.27c

- Removed `prefix` from the links list in index.md — it was leftover from an
  earlier design and nothing reads it anymore.
- The profile-link badge now accepts an optional image URL. Provide one and
  it fills the badge, clipped to the same circle; leave it off and the
  label's first letter is used instead, same as before. Both are the exact
  same box, so a mix of image and letter badges lines up perfectly — measured
  at identical dimensions either way. Added the MyOrdbok logo as a live
  example, reusing the same image already used for its showcase card.

## 26.07.27b

- The activity dot now has six tiers instead of three, and — this is the key
  change — each one is computed from the age of whichever event is currently
  showing, not a separate overall status. That means the dot's colour, pulse
  speed, and the count can never disagree with the "x ago" text beside it,
  since they always describe the same event: a vivid, fast pulse and the
  label "Contribution" within the last half hour, cooling through calmer,
  paler greens out to a week, then grey out to a month, and finally a still
  grey dot with no pulse beyond that. Every tier past the first is dot-only,
  since a repeated text label would just restate what "x ago" already says.
- The connector word ("to", "in") between the verb and the repo name is now
  its own element, styled distinctly muted and never underlined — only the
  repo name itself gets the link-style underline on hover. The row is still
  one large click target for a comfortable hit area; only the visual
  treatment changed, so a connector word no longer reads as if it were itself
  a clickable, separately-linked word.

## 26.07.27a

- Fixed the search-dim overlay for real: the search box's own stacking rank
  never mattered, because the header uses sticky positioning, and that always
  creates its own layering boundary no matter what z-index a child has. The
  header itself now sits above the dim layer, and its other buttons (logo,
  nav toggle, theme toggle) dim directly since they can no longer be covered
  by the overlay once the header as a whole is elevated. Confirmed with pixel
  and computed-style checks: the search box stays fully visible, everything
  else — sidebar, header buttons, and the page — dims correctly.
- The keyboard shortcut hint now shows both real shortcuts as separate keys,
  slash or the platform's command-plus-K combo (detected automatically), with
  a hover tooltip spelling it out.
- Fixed the star button linking to the wrong GitHub page — the list of who
  has already starred a repo has no star button on it at all; it now opens
  the repo's real page. Also removed a detail that didn't hold up: the star
  used to visually mark itself as given after any click, which claimed
  something we can't actually know. It now instead quietly re-checks the real
  count when the visitor returns to the tab, and only celebrates if the count
  genuinely went up.
- Every stylesheet, script, and the search index now carries a build-time
  version stamp in its URL. Without this, a browser can keep serving an old
  cached copy of these files indefinitely, completely independent of whether
  the site rebuilt correctly — restarting the server does nothing for that,
  since the problem lives in the browser, not the build. Each rebuild now
  produces a new URL for every one of these files, so a stale cached copy can
  no longer be served no matter what.

## 26.07.26d

- Fixed a third build failure, same root cause as the last two but in a new
  spot: an explanatory comment inside default.html described a tag by typing
  it out directly, and Jekyll's Liquid still checks the syntax of anything
  written inside a comment block even though it never runs it or shows it —
  unlike a true raw-text block, a comment is not a safe place to type out
  tag syntax as an example. Swept every comment in every template and
  Markdown file in the repo for the same pattern using a check built
  specifically to catch this, since the general syntax checker used earlier
  does not look inside comments the way Jekyll's actual engine does; two more
  instances were found and rewritten as plain descriptions, and the whole
  repository now has zero literal tag examples anywhere outside of code that
  is meant to run.

## 26.07.26c

- Fixed a second build failure caused by the entry just below this one: it
  quoted a Liquid tag as a literal code example inside backticks, but Jekyll
  runs Liquid over every Markdown file's raw text before Markdown ever sees
  the backticks — so the quoted tag was parsed as a real, invalid one and
  broke the build. My first attempt at a fix made it worse: I tried escaping
  it with Liquid's own raw-text tag, written *unescaped*, which Liquid then
  paired with an unrelated closing tag later in this same file and silently
  swallowed everything in between — no crash, just missing content. The
  actual fix is this: this changelog no longer quotes literal Liquid tag
  syntax anywhere, full stop — only prose descriptions of what each tag does.
  Every Liquid-processed file in the repo was swept for the same mistake
  (none found elsewhere) and parse-tested against an independent Liquid
  engine multiple times to confirm this file itself is now safe.

## 26.07.26b

- Fixed a real Jekyll build failure in the `/docs/` redirect: Liquid doesn't
  support grouping a filter chain in parentheses and then reading a property
  off the result — parentheses are reserved for range values — so that line
  failed to parse. Because Jekyll parses a layout's branches up front
  regardless of which one runs, the failure broke every page using the
  default layout, not just `/docs/`. Fixed by giving the filter chain its own
  assignment step before reading `.url` off it, and confirmed against an
  independent Liquid engine: the old line fails to parse there too, and the
  fixed version now correctly resolves for `/docs/`, `/docs/getting-started/`,
  and the home page.

## 26.07.26a

- `/docs/` no longer 404s: it redirects to whichever page is first in the
  sidebar (by `nav_order`), so it stays correct as docs pages are added.
- `index.md` front matter rewritten in pure block YAML — no more `{ }` flow
  mappings for `links` or `stores`.
- Profile links (moved to the page foot previously) are now small bordered
  cards with an initial-letter badge and an animated arrow, matching the
  site's existing card/feature visual language instead of plain text rows.
- Search can be focused from anywhere with `/` or `Ctrl`/`Cmd`+`K`, and
  unfocused with `Escape` — with a small `/` hint chip that disappears once
  you start typing. Typing `/` inside any other field still types a literal
  slash.
- The rest of the page now dims behind the search box while results are
  showing on desktop, so the open state reads as clearly in-focus.
- The feature banner gained a second, independent star button showing a live,
  cached star count for the linked GitHub repo, and opens the repo's real
  star page on click (GitHub has no one-click "star from off-site" API, so
  this is an honest fast-path rather than a fake in-page action). Hidden
  entirely if the repo can't be parsed or the API is unreachable/rate-limited.

## 26.07.25p

- Fixed the activity status for good: any word-based freshness claim ("Active
  today", "Recent activity") next to a cycling event risks contradicting it the
  moment an older item shows. The label is now a plain category, "GitHub
  activity", which is always true regardless of which event is on screen; the
  colour-coded dot carries the freshness signal, with the precise "Last active
  X ago" available on hover.

## 26.07.25o

- Reworked the activity line so it reads sensibly: the status no longer makes a
  time claim ("Active today") that clashed with older ticker items. The left
  now reads "Recent activity" / "Quiet lately" with the live/quiet state carried
  by the pulsing dot (exact last-active time on hover), and each event gets a
  "·" before its relative time.

## 26.07.25n

- Search placeholder is now just "Search".
- Dropped the mono `[+]` marks from the footer profile links.
- Home footer reads "Lethil © 2026", and now shows when the site was last
  updated — derived from the newest push to the portfolio's own repo (the same
  events kept out of the activity ticker).
- Added an SVG favicon from assets/logo.svg (adapts to light/dark).

## 26.07.25m

- The hero eyebrow (date line) now appears only when today matches a `dates`
  override in hero.yml — normal weekdays show no date line.
- The hero headline gained a soft accent-tinted text gradient with a slow ~26s
  sheen loop (disabled under reduced-motion; falls back to solid text where
  background-clip:text isn't supported).
- Lightened font weights across the site (headings, headline, and bold accents)
  for an airier overall feel.

## 26.07.25l

- Moved the profile links out of the hero to the foot of the page (after
  Extensions & packages), laid out inline — centred on phones.
- Added a live GitHub activity ticker between the hero and the first showcase.
  It reads recent public events, shows an "alive" status dot from the most
  recent activity, and cycles one event at a time (consecutive pushes are
  grouped with a count). The portfolio's own repo is kept out of the rotation
  so the site doesn't highlight itself, but still counts toward the status.
  It stays hidden if the API is unreachable or rate-limited.

## 26.07.25k

- Narrowed the hero art split so it pairs the art with the subject only: the
  eyebrow, caption, and slogan stay full-width above, art and subject share the
  two columns, and the links run full-width below. Stacks (art above subject)
  on small screens.

## 26.07.25j

- Search input background set to the surface colour; the leading search icon
  stays on the left of the box.
- Hero days gained two optional fields. `art` now splits the hero into two
  columns (art left, text right) that stack on small screens, with a very soft
  hover on the image. `link` adds either a single ↗ inline at the end of the
  subject, or a row of labelled ↗ links — arrows animate on hover.

## 26.07.25i

- Rebuilt the search as one component identical on home and docs: an
  always-visible box (leading icon + input) on desktop, a single icon that
  opens the full-screen overlay on phones.
- Input and results now share the same background and read as one connected
  box — flat where they meet, rounded outer corners, matched width, one shadow.
- The box width is fluid (wider on large screens, clamped so it never fights
  the layout on resize) rather than a fixed size.
- Placeholder nudged to "Search to navigate…" to signal it doubles as nav.

## 26.07.25h

- Feature banner now stacks label-above-body, left-aligned, on phones instead
  of splitting to opposite edges.
- Startup fade-up slowed from 0.55s to 0.7s for a smoother entrance.
- Search: the input and results now read as one connected box (no gap, matched
  width, merged corners, single shadow) — the loud accent focus border is gone
  in favour of a neutral one. On phones the input border is removed entirely.
- Search remembers the last term (same tab) and, on reopening, shows its
  results instantly instead of starting blank.

## 26.07.25g

- Cards: dropped the `[+]` mark before each name and lightened the name weight.
- Hero entries can now carry an optional `art` (logo/image) shown above the
  headline; omit it for none. A "symbolic" filename is painted in the text
  colour so it adapts to light/dark, like the extension icons. Added the
  MyOrdbok logo to the Dictionary day and the Lesion mark to the desktop day
  as live examples.

## 26.07.25f

- Both showcases now use the hero's startup animation (staggered fade-up on
  load) instead of the scroll reveal, and "Projects" is renamed to "Apps".
- The feature banner content moved to `_data/feature.yml` so highlighting a
  current focus no longer touches the project list; its label is now "Working".
- Homepage `title` is now "ZOMI.developer".
- Recurring hero date overrides use `mm.dd` (e.g. `every: "01.01"`), documented
  in `_data/hero.yml`.
- Missing or empty data files degrade to defaults instead of erroring: the hero
  falls back to the site title, and the feature banner simply doesn't render.

## 26.07.25e

- Fixed the hero slogan and subject not appearing: the weekday index used a
  filter inside the array subscript, which Liquid can't evaluate, so the
  build-day entry came back empty and the optional fields were dropped. The
  index is now computed first, and the fields are always emitted (hidden when a
  day genuinely has none) so the client-side swap can fill them per weekday.
- Simplified the eyebrow: removed the `[*]` mark and dimmed the text.
- Sidebar cross-link now reads "Home" with a house icon instead of "Lethil".

## 26.07.25d

- The hero now rotates by weekday, driven by `_data/hero.yml` (index 1 = Monday
  … 7 = Sunday; fewer entries mean the last one fills the remaining days).
- Optional per-date overrides (`on:` a fixed date or `every:` a yearly month-day)
  can replace the day's content or reuse another day via `use:`.
- Selection runs in the browser so it changes day to day without a rebuild; the
  build-day copy is still rendered server-side (works with JS off, no flash).
- Renamed `hero__name` / `hero__role` / `hero__tagline` to `hero__caption` /
  `hero__slogan` / `hero__subject`; the eyebrow now shows the weekday and date.

## 26.07.25c

- Renamed the hero banner class from `.highlight` to `.feature` so it no longer
  collides with Rouge's `.highlight` on code blocks in the docs.
- Moved this changelog to the repo root as `Changelog.md` (still shown in the
  sidebar and search).
- On phones the theme switch moves into the sidebar and search opens as a
  full-screen overlay with a back button.
- Bumped the base text size a little, more so on phones.
- Cards reflow on phones: art pairs with the name on the top row, with the
  blurb and links full width beneath — no more empty space under the icon.

## 26.07.25b

- Added an optional top highlight in the hero for a current/recent focus
  ("Now building"). It renders only when set in `index.md` — no gap otherwise.
- New "Extensions & packages" section (Lesion) using the same card include;
  images are now optional and GNOME symbolic SVGs adapt to the theme.
- Softened hover borders from the loud accent to a gentle neutral.
- Rebuilt the menu button icon as three flush bars so it centers on whole
  pixels at any DPI.
- Fixed the hero name showing the filename (`page.name` collided with a Jekyll
  built-in; renamed to `fullname`).
- Reworded the role and tagline to be about language, scripts, and music
  generally, without naming a country.

## 26.07.25

- Home now shows real project cards (MyOrdbok, Lai Siangtho, Zaideih) with
  short descriptions and store links, driven by front-matter data — no raw
  HTML in `index.md`.
- Header and sidebar drop the `[*]` / `[>]` prefixes; "Docs" is now
  capitalized in both places.
- Hero links point at `myordbok.com` and `zaideih.com`.
- Added this changelog.

## 26.07.22

- Reworked the header and navigation: one global full-height sidebar shared by
  Home and Docs, hidden by default on Home and open by default on Docs.
- Opening the sidebar resizes the content on desktop/tablet (no horizontal
  scrollbar) and pushes it on mobile.
- Search is a single collapsible box on Home (icon expands into the input) and
  always visible on Docs. Its radius matches the theme toggle.
- Icon buttons unified at 35×35 with an 8px radius; the menu button animates
  between a hamburger and an X.
- Added a Pages workflow that deploys only on commits starting with `deploy:`.

## 26.06.20

- Initial site: portfolio Home + docs, pure-CSS theming (light/dark/auto),
  client-side search, left-anchored layout.
