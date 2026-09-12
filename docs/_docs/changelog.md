---
# Lives in the _docs collection so it is indexed by search, the graph, and the
# directory like any other page — but keeps its own permalink, so the public
# URL stays /changelog/ rather than moving to /docs/changelog/.
permalink: /changelog/
title: "Changelog"
description: "Notable changes, newest first."
group: "Documentations"
category: "Reference"
# Indexed by title only. The changelog describes changes to the site itself, so
# its text matches almost every query and crowds out the pages being searched
# for — every entry mentioning "search" or "tunnel" is noise to someone looking
# for the search or tunnel docs.
search_content: false
nav_order: 99
tags: [jekyll, authoring]
---

Versions use `yy.mm.dd` — the date the change shipped. Newest at the top.

## 26.09.11f

- Both lists on `/review/` now follow changes as they happen. The `storage`
  event only fires in OTHER tabs, so a page editing its own localStorage gets
  no notification — which is why the drafts list sat stale while the composer,
  open on that very page, had already saved, and why resolving a page note
  needed a reload to disappear.
- Every writer now announces itself and every list listens. Saving in the
  composer, starting a new draft, or resolving a note repaints the affected
  list immediately; the cross-tab `storage` event is still handled, so two
  windows stay in step too.
- Resolve no longer repaints only the surface it was pressed on. It used to
  refresh the in-page markers whether or not that was the view being looked at,
  and never the collected list. The listener repaints whichever views are
  present, so the markers, the page count and the collected list cannot
  disagree.

## 26.09.11e

- The composer no longer scrolls the page behind it. `overscroll-behavior:
  contain` covers a pane that can scroll and has reached its end, but not a
  pane with nothing to scroll at all — that box is not a scrolling container,
  so the wheel passes straight through to the document. That was the case being
  hit: a window taller than its own content, sliding the page away underneath.
  A wheel handler now stops the gesture at the window edge, while still letting
  a scrollable pane scroll normally.
- Fixed the preview being narrower than its window. `.prose` caps at the site's
  reading measure and that cap landed on the pane, which is also the scroll
  container — so the preview sat inboard of the frame with its scrollbar
  floating in the middle of the window. The pane fills the window now; a
  reading measure belongs to a page, not to a panel already sized by hand.

## 26.09.11d

- The composer launcher now shows whether the window is open, and pressing it
  while the window is off screen pulls it back instead of closing it. A window
  dragged past an edge — or restored from a position saved on a larger display
  — was indistinguishable from no window at all, so the button appeared to do
  nothing.
- The composer survives navigation. Nothing here is a single-page app, so
  following a link used to throw away an open draft window mid-thought; the
  state is remembered and the window returns on the next page with the draft
  that was being edited. Focus is deliberately not taken on restore — the
  reader asked for the page, not the textarea.
- Added a layer registry, so the surfaces coordinate instead of each guessing.
  Two kinds: the composer is a persistent window, while search, tools, the page
  actions and the note form are transient.
- A transient surface is raised above the composer for as long as it is open,
  since it was just asked for; hiding it behind a window that happens to
  overlap the header would be the wrong answer. Raising the whole topbar is
  what does it — a popover anchored inside a sticky header is capped at that
  header's rank whatever z-index the panel itself carries.
- Opening one transient surface now closes any other. Two popovers at once has
  no meaning, and stale ones are how a header ends up with three panels hanging
  off it. The composer is never closed by any of them.

## 26.09.11c

- **Fixed Maximise.** The class sets left, top, width and height, but drag and
  restore write those as inline styles, which always win — so toggling it
  changed the class and nothing on screen. The inline geometry is now stashed
  and cleared while maximised, and put back on restore.
- **Fixed the overflow menu not restoring on a wider window.** Each moved
  button remembered the node that followed it, but those buttons are siblings
  of each other, so the remembered node had itself been moved into the panel
  and `insertBefore` threw "child not found in parent". A placeholder left in
  the original position cannot go stale.
- Write, Preview, New and Export are icons. The title bar holds nine controls,
  and four words of button text were most of the width the draft name needed.
- The kind selector moved to the left of the title, where it reads as what the
  draft *is* rather than as another action.
- Title and save message now shrink and truncate; the controls never do. Both
  were taking their natural width, so a long draft name or an "Exported …"
  message pushed the buttons off the end of the bar.
- "Page settings" is now "Meta".

## 26.09.11b

- Fixed Maximise and Close doing nothing. The title bar is also the drag
  handle, and its pointer capture swallowed the click that followed — the press
  started a zero-distance drag and the button never saw it. A press that starts
  on a control inside the bar no longer begins a drag.
- Fixed Preview appearing not to work. The write pane sets `display: flex`,
  which beats the `hidden` attribute's user-agent rule, so it stayed on screen
  underneath the preview. `[hidden]` now wins.
- Consolidated the composer into one title bar: name, save state, kind,
  Write/Preview, New, Export, Maximise and Close all on a single line. The
  separate toolbar and footer rows are gone, which is roughly 70px of height
  returned to the writing area.
- Front matter is collapsed behind a disclosure, since it is set once and the
  body is written for the rest of the session. A note has none at all, so the
  section is removed rather than collapsed.
- Added an overflow menu for the page actions below 600px. The bar had grown to
  Save, note, values, composer, tools and search, which is fine on a tablet and
  too much at 360px.
- The buttons are MOVED into the overflow panel rather than copied. Every
  script here binds with `querySelector`, so a duplicate would look live and do
  nothing — the first match would keep the handler. Moving keeps one element,
  one handler, one state, and the note form travels with its button. Rows are
  tappable across their full width, and a disabled action reads as unavailable
  there the same way it does in the bar.

## 26.09.11

- Moved the reading progress indicator to the very top of the window, above the
  header, where it reads as a property of the page rather than of the topbar.
- **Fixed the topbar scrolling away on phones.** `overflow-x: hidden` on
  `html`/`body` makes them a scroll container, and a sticky descendant then
  sticks to a scrollport that never scrolls — which is why it held on desktop
  and failed on mobile. `overflow-x: clip` clips without creating that scroll
  container, so the off-screen shell stays hidden and sticky works.
- **Fixed the tools popover refusing to close on a second tap.** A touch tap
  moves focus to nothing, so `focusout` fired with a null `relatedTarget` on
  the way to the button's own click: the panel closed, then the click reopened
  it. Focus going nowhere is not focus leaving; real outside taps were already
  covered by the document handler.
- Added the **composer**: a movable, resizable window available from every
  page, with a maximise that leaves the page visible around it rather than
  going full screen. On phones it becomes a sheet, since moving and resizing a
  window there is meaningless.
- One form, two kinds of draft. A page carries the front matter fields and
  exports a ready-to-save `.md` with them already written; a note keeps a title
  and a body, and the front matter rows are removed rather than shown inert.
- Markdown preview from a small built-in renderer rather than a library —
  headings, fenced and inline code, lists, task boxes, quotes, rules, links,
  emphasis and `[[wiki-links]]`. Input is escaped before anything else runs, so
  a draft cannot inject markup into its own preview.
- Drafts autosave and are listed on `/review/` by row id, with open, export and
  delete. Opening the composer resumes the most recently edited draft; opening
  a row from the manager loads that one.

## 26.09.10i

- The note form adapts below 560px the way the tools popover already did: a
  full-width sheet under the header rather than an anchored box, with the arrow
  dropped since there is nothing left to point at. A 16rem panel pinned to the
  right of a 360px viewport was most of the width anyway, and this one contains
  a textarea — the control that most wants room to type in. Its fields get
  larger targets and a taller writing area at that size.
- Note rows under a heading wrap on narrow screens instead of pushing the
  article sideways.

## 26.09.10h

- Dimmed the reading progress indicator. At full accent it competed with the
  active sidebar item and the links in the prose for the one colour the page
  uses to mean "this matters"; it is ambient feedback, not a control.
- Removed the page count from the context bar on section indexes. The page
  already prints its own count under the title, so the same figure appeared
  twice a few pixels apart. Tool pages keep their blurb there, which is not
  repeated anywhere else.
- The note form now points at its button with the same arrow as the tools
  popover, so the two read as one kind of object.
- **Every heading can be noted against.** "The last heading scrolled past"
  could never reach the final headings of a short page: once the document
  bottom is on screen scrolling stops, and those headings never cross the
  threshold. At the end of the document the last heading now wins outright,
  and otherwise the topmost heading still visible is used.
- The section is a select rather than a label, listing every heading with H3s
  indented, so anything auto-detection cannot reach can still be chosen. On the
  deployment guide that is 77 headings.
- It follows the page while the form is open, updating on scroll so the section
  shown is the one being looked at rather than the one in view when the form
  opened. Choosing by hand stops the tracking, so a deliberate pick is never
  overridden.

## 26.09.10g

- Graph hover eases instead of flashing. Every node and edge switched between
  two fixed alphas on the same frame the pointer crossed a circle, so moving
  across the graph read as flickering rather than as focus moving. Each node
  and edge now carries a focus value eased toward its target every frame, and
  nothing in the draw call tests hover directly — colour, width, alpha and
  labels all read from that one value, so an edge brightens and thickens
  together. Labels crossfade rather than appearing outright.
- Fade-in runs faster than fade-out (about 430ms against 820ms), which keeps a
  hover feeling responsive while settling gently when the pointer leaves. The
  largest single-frame change is now 0.22 where it used to be a full 1.0 jump.
- **Cut the tag vocabulary from 89 to 32, with none used only once** — it was
  65 single-use tags before. A tag on one page groups nothing; it only adds
  rows to the tag index and noise to the directory.
- Removed tags that restated the page title (`multipass` on Multipass, `gnome`
  on GNOME, `git` on Git, `mariadb` on MariaDB setup, `netplan` on Static
  networking) and tags that restated the section.
- Merged synonyms into the concept they share: `kvm`/`qemu`/`virtualization`
  into `vm`, `rdp`/`vnc`/`remmina` into `remote`, `r2`/`rclone`/`virtiofs`
  into `storage`, `flatpak`/`ventoy`/`iso` into `desktop`, `java`/`sdk`/
  `emulator`/`dart` into `toolchain`, `github-actions` into `ci`.
- Added tags where a genuinely cross-cutting one was missing from pages that
  share the subject — `secrets` now spans the secrets manager, Access service
  tokens and the deployment guide; `dns` spans the tunnel and domain pages;
  `backup` spans the database dumps and the storage they sync to.
- Three pages had no tags at all and now do.

## 26.09.10f

- Page actions that do not apply to the current page are disabled and labelled
  rather than left live. The note button needs an article to anchor to, so on a
  board, an index or a tool page it did nothing while still hovering and
  clicking — which reads as a bug. Interaction is removed outright, and the
  reason is in the title.
- The values toggle behaves the same way instead of hiding itself. A control
  that appears and disappears between pages makes the header change shape as
  navigation moves; a stable header with a clearly unavailable button is
  steadier.
- Redesigned the sidebar tree. No hover fill anywhere in it: a filled row is
  how the ACTIVE page is marked, so using the same device for "the cursor is
  here" made the two compete, and on an already-open parent it implied the row
  itself was a target. Hover now moves colour only — nothing fills, nothing
  shifts, so no item changes position or size under the pointer.
- The rail ends at its last entry. Each item has a short tick into the rail,
  and the last one masks the rail below itself, so the tree stops instead of
  running on into empty space.
- The chevron became a smaller, lighter caret that reads as a disclosure rather
  than a navigation arrow, and its rotation is the animation. Expanding animates
  where the browser can size a `<details>` content box, and snaps elsewhere,
  which is the previous behaviour.
- The active page is marked by colour and a filled tick rather than a
  background, which keeps the tree quiet.
- Moved Review from `/todo/review/` to `/review/`. The nested path implied it
  was part of the project board, while its breadcrumb read "Home / Review" —
  the URL and the page disagreed. Review is site maintenance, not project work,
  and every other tool sits at the top level. The board keeps its link across.

## 26.09.10e

- Added **page notes**: marking what needs fixing, on the page where it needs
  fixing. A flag in the header captures a kind (outdated, unclear, missing,
  typo) and a note, anchored to the nearest heading — so a note reads as
  "Cloudflare Tunnel › Configure is outdated" rather than "the cloudflare page
  needs work". Flagged headings carry a marker showing their count.
- Collected at **`/todo/review/`**, a sibling of the board rather than a part
  of it. The project board is untouched: same items, same statuses, same
  progress. It gains only a quiet link across. Merging the two would have made
  "fix a typo" count the same as "migrate off GCE".
- Notes survive their heading being renamed. Anchors derive from heading text,
  so an edit changes the id and would orphan every note on it — which is
  exactly when the note matters. The heading text is stored alongside the id: a
  renamed-but-recognisable heading re-attaches silently, and a note matching
  neither is surfaced at the top of the page rather than dropped.
- **Findings** on the same page, computed from the site's own indexes on each
  visit, so they need no upkeep: pages with no description, duplicate titles
  (which silently break wiki-links), pages with no inbound links, and tags used
  exactly once. Currently 22 pages with no inbound links and 65 single-use
  tags.
- Export writes **markdown, not JSON** — a checkbox list grouped by page, with
  the deep link under each item. A note that never leaves the browser never
  becomes a commit, and this is the form that pastes straight into a board item
  or a commit message.

## 26.09.10d

- Replaced the category eyebrow with a reading estimate and the page's group.
  The breadcrumb already names the section, so the eyebrow was repeating it as
  a link.
- The estimate counts command blocks, not just prose. Measured first: most
  pages here run two to three hundred words, so a plain words-per-minute figure
  rounded almost everything to "1 min" and said nothing. Each block is weighted
  at roughly thirty words of effort, which tracks what running one costs.
- Headings gained anchor links, revealed on hover or keyboard focus. Kramdown
  was already emitting the ids; there was simply no way to reach one without
  reading the markup. Clicking copies the full URL.
- Added a reading-progress bar under the topbar on long pages, throttled to
  animation frames rather than firing on every scroll event.
- Added a print stylesheet. Navigation, search, the tool menu, backlinks and
  copy buttons are dropped; headings avoid breaking away from the text that
  follows; command blocks avoid splitting across sheets and wrap instead of
  being cut off at the margin; external links have their destination written
  out, internal ones do not, since a bare path helps nobody holding paper.

## 26.09.10c

- Rewrote the README without first- or second-person pronouns, and swept the
  same rule through page copy, interface strings, and code comments. Roughly
  forty instances across includes, layouts, scripts, and Sass.
- Interface labels changed with it: the code-block toggle reads "Stored values"
  rather than "Your values", and the settings and bookmarks copy describes what
  happens rather than addressing the reader.
- Older changelog entries were corrected too, so the convention holds
  throughout the file rather than only from this point.

## 26.09.10b

- Rewrote the README: what the site does, how to add a page or a section, what
  is needed to run it locally, and the logo situation.
- Documented that `_config.yml` is read once at startup — `serve --livereload`
  watches content, not configuration, so a new collection or `defaults` entry
  needs a restart. This has cost real time more than once.
- Recorded that Jekyll cannot read files outside its `source` directory, so
  `docs/assets/logo.svg` cannot be sourced from the repository root. Symlinks
  do not work either: a normal build copies the link into `_site` where it
  dangles, and a `--safe` build — which is what GitHub Pages uses — drops it
  silently. Both were tested rather than assumed. The README gives a `Makefile`
  recipe that makes the copy a prerequisite of serving and updating, so a stale
  logo cannot ship.

## 26.09.10

- Fixed long section blurbs overflowing the home sidebar. `.sidebar__sections`
  is a grid, and a grid item's default `min-width` is `auto` — it refuses to
  shrink below its own content. Each row was therefore as wide as its longest
  blurb and ran past the panel, so the text was clipped by the sidebar's
  overflow instead of truncating inside its own box: a hard cut, no ellipsis.
  The tracks are `minmax(0, 1fr)` now, and the same fix went to the section nav
  and the page lists, which had the same latent problem.
- Grouped the remaining sections the way Docs already was. Server splits into
  Containers, Ingress, Serving & storage and Automation; Linux into System,
  Desktop and Remote & VMs; Python into Environment and Building; SQL into
  Reference and Operations. Groups come from the same `group:` front matter, so
  the section landing pages picked them up with no extra work.
- Left Mobile, Notes, Quotes and Plex ungrouped: with one to three pages each,
  a heading per group would outnumber the pages under it.

## 26.09.09e

- Lightened the search scrim, and moved it behind a `--scrim` token instead of
  a hardcoded rgba dimmed by an opacity multiplier. The two dim layers — page
  and topbar — have to agree exactly or the seam between them shows, and the
  right strength differs per theme: a dark UI needs a heavier veil to read as
  dimmed at all, so light and dark carry different values rather than sharing
  one and being scaled.
- Added `--radius-xs` (5px) for chips and badges. `--radius-sm` is tuned for
  panels; on a 20px badge it rounds away most of the shape.
- Moved the result rounding from the `<li>` to the `<a>`. The anchor is the
  hover target, so the radius on the row wrapper rounded nothing visible.
  The list gained a little padding so the rounded hover clears the panel edge.
- Section chips are filled with no outline: eleven bordered pills in one strip
  read as a row of empty boxes. Escalation is by fill alone — quiet, hover,
  selected.
- Kept the tint on the SELECTED chip rather than on the resting ones. Tinting
  every chip by default and greying the active one inverts the signal; the
  state that matters should be the state that stands out.
- New Tools glyph: three rounded squares and a circle — a set of different
  things, which is what the menu holds. The old bulleted-list mark was generic
  and confusable with the Directory icon listed inside the menu itself. It
  leans in slightly on hover and turns 45° while open.

## 26.09.09d

- Fixed sidebar labels being chopped mid-word. The cause was the bold-width
  reservation added earlier: it rendered a hidden bold copy of the label inside
  the label, and that copy was a block-level child, which silently disables
  `text-overflow: ellipsis` on a box's inline content. Long titles therefore
  had no ellipsis to fall back on.
- Replaced the reservation with a faux bold. A `text-shadow` offset by a
  fraction of a pixel thickens the strokes while leaving every metric
  untouched, so the active row still stands out, still cannot reflow, and needs
  nothing reserved. The `data-text` attributes are gone from the markup.
- Sidebar page titles now wrap to two lines before truncating. They are the one
  label whose tail carries meaning — "Lai Siangtho — e-book & presentation
  suite" has no useful prefix to cut to.
- Reworked the search field. It was an outlined white box inside a white
  topbar, which reads as a form control bolted on. It is now a soft filled
  well that lifts to a real surface, border and shadow only once focused.
- The results panel detaches from the field by a small gap and is fully
  rounded, instead of being welded to it with flattened corners. Joined, the
  two read as one tall control; separated, the field stays a field and the
  panel is clearly a surface floating over the page.
- The shortcut hint is one chip instead of four. "/ or Ctrl + K" spelled out
  every option inside the field; a single shortcut is hint enough, and "/"
  still works.

## 26.09.09c

- Fixed the bright hairline between the header and the breadcrumb while search
  is open. The topbar's dim overlay used `inset: 0`, which stops at the padding
  box — the topbar's own `border-bottom` sat outside it and stayed lit. The
  overlay now extends 1px past the bottom.
- Removed the reserved scrollbar space from the section chip strip, which was
  what pushed the chips up and left dead space beneath them. Styling
  `::-webkit-scrollbar` forces the classic space-reserving scrollbar; in a
  strip one line tall the track is thicker than the gap it lives in. The
  scrollbar is gone entirely there — wheel, trackpad and drag still scroll it,
  and a partly visible chip at the edge does the work of saying "more this
  way". Chips are vertically centred.
- Chip corners are `--radius-sm` (9px) instead of fully round.
- The result count in the panel foot is vertically centred with symmetric
  padding; it had been sitting against the top of its band.
- Scrollbar thumbs elsewhere are inset by a transparent border so they read as
  slim overlay pills, and arrow buttons stay removed.
- The changelog is indexed by **title only**. It describes changes to the site
  itself, so its text matched almost every query — every entry mentioning
  "search" or "tunnel" crowded out the pages actually being looked for.
  Searching "changelog" still finds the page. Added a `search_content: false`
  front matter flag for any page that should behave the same way. The index
  dropped from 363 records at 211KB to 297 at 149KB.

## 26.09.09b

- **Fixed the search index fusing words together.** It did
  `strip_html | strip_newlines`, but stripping tags from `<p>a</p><p>b</p>`
  yields "ab" with no separator, and strip_newlines removed the only thing
  keeping blocks apart. The index literally contained "healthcheckcd" and
  "hash.pyp". That broke snippets and matching alike: "healthcheck" and "cd"
  no longer existed as separate words. A space before each tag before
  stripping is the whole fix.
- Also stripped raw `[[wikilinks]]` and decoded HTML entities, which were
  reaching snippets as "[[Docker Swarm]]" and "ssh.&lt;ID&gt;" — `doc.content`
  is the page before wikilinks.html runs.
- **The index is now per heading**, not per page. Each `<h2>`/`<h3>` gets its
  own record and anchor, so a result points at the section rather than the top
  of a long runbook — 363 records, 211KB. Searching "hash" now returns one
  result, Getting started › Hash, linking to `#hash`.
- A page-level record is still emitted and ranked above heading records, so
  searching a page by name finds the page, not one of its sections. At most
  three rows come from any one page.
- Snippets trim to word boundaries instead of a fixed ±40 characters, which
  routinely cut through a path.
- Result rows adopt the tools-menu rhythm: the section badge from
  `sections.yml` as a leading mark, then "Page › Heading", then the snippet.
- The panel uses `--border` and the same shadow as the tools card. Against the
  dim, the heavier `--border-hover` read as a hard outline rather than an edge.
- **The dim now covers the topbar.** The topbar sits above the dim layer, so
  while the page darkened it stayed lit and looked like the selected element.
  It gets its own overlay in the same colour, under the search box's z-index,
  so the box and panel stay bright and the dim reads as one continuous surface.

## 26.09.09

- Opening a page from a search result now jumps to the match. The term travels
  on the link as `?q=`, and the destination marks every occurrence, scrolls the
  first into view, and shows a small bar to step between them or clear. A
  query parameter rather than a `#:~:text=` fragment: the fragment syntax is
  not supported everywhere, and a parameter survives being copied or reloaded.
  Clearing also strips `?q=` so a shared link stays clean.
- The highlighter skips placeholder spans. Their text is rewritten by
  placeholders.js, so anything wrapped inside one would be discarded on the
  next repaint.
- Rebuilt the sort control on the settings page. A bare styled `<select>`
  shrank to its own text and overran the VALUE column on narrow screens, and
  its open menu sat over the heading. The native select is kept for the picker
  — it is the right control on a phone — but rendered transparently over a custom
  own trigger, so the appearance is ours and the menu stays the platform's.
- Below 620px that trigger is icon-only: the chosen order is already visible in
  the rows, and a two-word label had nowhere to go.

## 26.09.08f

- Fixed clicking a section chip closing the search panel. The click handler
  rebuilt the whole chip strip, which removed the very button that had been
  clicked; the document-level outside-click listener then ran, asked
  `box.contains(e.target)` about a node no longer in the document, concluded
  the click was outside, and closed the panel. Chips are now repainted in
  place. The outside-click listener also ignores detached targets, so
  re-rendering anything inside the panel cannot resurface this.
- Fixed refocusing an empty search box showing nothing, which made a page
  reload the only way to get the panel back. The focus handler still had the
  old `if (input.value.trim())` guard from when an empty box meant "close" —
  it browses now.
- Added a thin scrollbar to the chip strip and the result list. No track, no
  arrow buttons, and the thumb only appears on hover or while the pane has
  keyboard focus. The thumb is transparent rather than absent when idle, so
  revealing it does not reflow the content.
- The chip strip scrolls with a plain mouse wheel. Wheels have no horizontal
  axis, so past the fifth chip the rest were unreachable for anyone not on a
  trackpad.

## 26.09.08e

- The search panel now browses as well as searches, so the directory is
  reachable from every page without leaving the current one. An empty box
  used to close the panel and show nothing; it now lists every page, with
  section chips above it. Type and the same list filters; the active chip
  keeps constraining the results.
- Chips are the only control in the panel, deliberately. The point was to make
  browsing available everywhere, not to grow a search form with options.
- Both indexes load in parallel on first use — `search.json` for text matching
  and snippets, `directory.json` for the section, description and tags that
  browsing needs. Neither is fetched until the box is used.
- The chosen section persists for the tab, so moving between pages keeps the
  filter last browsed under.
- Browsing can list every page, so the result area scrolls; search results are
  capped at eight and never reach that height. In the phone overlay the cap is
  removed and the list owns the screen.
- Wrote the height as an interpolated `min()` so Sass emits it literally —
  libsass rejects mixing `vh` and `rem` inside its own `min()`, the same
  limitation already worked around in the hero.

## 26.09.08d

- Settings rows: the key itself is now the disclosure, with its use count as a
  superscript badge. A separate "N pages" summary beside it was a second thing
  to read and a second thing to aim at for the same action.
- The usage list is an `<ol>` rendered inline and wrapped, with the number
  drawn by a CSS counter inside each link's hit area. A handful of short titles
  reads better as a wrapped run than as a column of one-item lines.
- Fixed the row rule breaking across the two columns. The border was on each
  `td`, so the columns drew their own line at their own content height and an
  expanded key cell left the two halves at different heights. It belongs to the
  row.
- The values toggle now shows its state the way Save does — a filled accent
  chip when on — plus a slash across the icon when off, so the two states
  differ in shape and not only in colour. Dimming alone read as disabled rather
  than off.
- Redrew the tool icons. Directory was four equal tiles that said "grid" rather
  than "catalogue"; Graph was three loose circles with no anchor; Todo could
  have been a checklist or a slider; Settings used a gear where the page is
  really a list of named values. Now: a tile beside list rows, a rooted node
  tree, a clipboard with a tick, and sliders.
- Renamed placeholders in the deployment guide: `YOUR_TOKEN_ID` to `TOKEN_ID`,
  `YOUR_TOKEN_SECRET` to `TOKEN_SECRET`, `TUNNEL_TOKEN_FROM_DASHBOARD` to
  `TUNNEL_TOKEN`.

## 26.09.08c

- Replaced the tool tab strip with a **context bar**, keeping the band under
  the topbar but giving it something the popover does not already do. The strip
  listed the tools; the Tools popover now does that from every page, so the
  strip was a second copy on six of them.
- The band now carries a **breadcrumb** on the left and **previous / next
  within the section** on the right, in the same order the sidebar lists. The
  section link was the piece genuinely missing: from a page there was no
  one-click route back to its section index.
- Tool pages show the tool's blurb instead of steps — they have no sequence.
  Section indexes show their page count, and are excluded from the step walk:
  a section index is not in its own sequence, and without the exclusion it
  offered the section's last page as "previous".
- Under 720px only the direction arrows remain; two truncated titles in a
  narrow bar read as noise, and the arrow plus its title still says enough.
- Lightened the sidebar. Section labels drop from 550 weight at full size to
  500 at .82rem, blurbs and the chevron shrink to match, and page links are
  explicitly normal weight. With a topbar carrying the brand, search and the
  tools popover, a heavy label in the sidebar was competing with chrome that
  already outranks it — the sidebar is a list to scan, not a set of headings.

## 26.09.08b

- Replaced the sidebar tool rail with a **Tools popover in the topbar**. The
  rail duplicated the tab strip already at the top of every tool page — the
  same menu twice, in two visual languages. One button costs a fixed 30px
  on any page, so the sidebar keeps its full height for the section's
  pages, and the menu itself can afford labels and blurbs again.
- Header contents are now: Tools and search everywhere, plus Save and the
  values toggle on documentation pages.
- The popover is a disclosure, not an ARIA menu: its contents are ordinary
  links, so `aria-expanded` is the honest description and there is no
  arrow-key model to learn. Escape closes it and returns focus to the button;
  clicking outside or tabbing past the last link closes it without stealing
  focus back from wherever navigation was headed.
- On screens under 560px it becomes a full-width sheet under the header rather
  than a narrow anchored box, which on a 360px viewport would have taken most
  of the width anyway while being harder to hit.
- The tab strip on tool pages is unchanged; both still come from
  `_data/tools.yml`.

## 26.09.08

Corrected instructions that had gone stale. Verified against current package
sources rather than from memory.

- `qemu-kvm` no longer exists on Ubuntu 24.04 or Debian 11 and later — it was a
  transitional package and has been removed. Replaced with `qemu-system-x86`,
  noted `qemu-system-x86-hwe` for hardware enablement kernels, and mentioned
  `qemu-system` for the architecture-agnostic case.
- Dropped `bridge-utils` from the same install. It is deprecated, `brctl` is
  superseded by `ip link` and `bridge link`, and libvirt does not need it — the
  provisioning page already uses the replacements.
- The NodeSource `setup_current.x` one-liner is deprecated: it prints a banner,
  waits, and is slated to stop working. Replaced with the current keyring and
  `nodistro` repo setup, where the version is chosen by `NODE_MAJOR` rather
  than by the script name.
- `python-is-python3` instead of hand-symlinking `/usr/bin/python`. An
  unmanaged symlink survives upgrades that move its target and conflicts with
  the package.
- Noted that MariaDB's tools are `mariadb`, `mariadb-dump` and `mariadb-admin`
  since 10.5; the `mysql*` names are legacy symlinks.
- Flagged the pinned Flutter and Android SDK download URLs as version-pinned,
  since both 404 once rotated out.

## 26.09.07f

- The tool pages are one workspace rather than six unrelated URLs. Directory,
  Tags, Graph, Todo, Bookmarks and Settings share a layout and carry a tab
  strip listing all six with the current one marked, so arriving at any tool
  shows the way to the others.
- Added a **tool rail** to the sidebar on every page — a single icon row under
  the brand. The tool links previously existed only on the home sidebar, so
  reaching Bookmarks or Settings from a doc page meant navigating home first.
  It sits outside the scrolling body, so it stays put however far the page list
  below it scrolls.
- Icons rather than a labelled list in the rail: seven labelled rows would have
  pushed a section's page list off screen. The labels live on the tab strip,
  with a title and an accessible name on each icon.
- Both are generated from `_data/tools.yml`, so the rail and the strip cannot
  list different things.
- On narrow screens the tab labels drop away and only the active tab keeps
  its label, so all six stay reachable without horizontal scrolling.

## 26.09.07e

- Settings rows are one line again. The key and its page-count collapsible sit
  in a two-column grid rather than stacking, so an expandable list no longer
  costs a second line on every row whether it is opened or not. Expanding still
  grows the list under its own summary.
- Dropped the key background tint — with 48 rows it read as a wall of chips.
  The mono face and accent colour already mark it as a key.
- Dropped the per-row "credential" tag. The section's left border says it once;
  repeating the word on all nine rows was noise.
- Moved the sort control into the header of the column it sorts, which was
  otherwise costing a whole row to say one word. Rendered transparent and
  unbordered so the header still reads as a header.

## 26.09.07d

- Moved the Save and values/placeholders controls into the sticky topbar, as
  icons. They stay reachable at any scroll position and cost the same width on
  a phone as on a desktop. Each keeps a visually-hidden label and a title, so
  the icon is never the only cue.
- **Credentials are now listed**, in their own section, instead of being hidden
  from the form. Excluding them meant the tedious half of the job stayed
  tedious. They are handled differently rather than refused: a credential is
  never written into the page — the block keeps showing `<TUNNEL_TOKEN>` — and
  the real value is inserted only when Copy is pressed, so it reaches the
  clipboard and nothing else. Not the screen, not a screenshot, not a shared
  window. They are excluded from export, and can be set to clear when the tab
  closes.
- Settings columns are Key and Value; keys lost their angle brackets and are
  styled as keys. Clear is an icon inside the field, with a reveal toggle
  beside it on credential rows.
- Each key lists the pages using it, collapsed by default.
- Added sorting: most used, A→Z, or filled first.
- Stored values are obfuscated at rest — XOR against a fixed pad, then base64 —
  so the blob is not a legible key list at a glance. This is deliberately not
  encryption and is not claimed to be; anything with access to this origin can
  still decode it. Existing plain values are read once and re-saved obfuscated.

## 26.09.07c

- Made placeholders discoverable. Substitution worked, but nothing on a page
  said the feature existed until a value was already set — so an untouched site
  looked identical to a broken one. An unset `<PLACEHOLDER>` is now a link:
  clicking it opens Settings scrolled to that exact row with the cursor in the
  field. Filled ones lose the dashed underline and read as content.
- Every token carries a title explaining its state — no value set, showing the stored
  value, or showing the placeholder because the toggle is off.
- The values/placeholders toggle is hidden on pages that contain no
  placeholders, instead of sitting there doing nothing.
- Guarded `scrollIntoView`: where it is unimplemented the throw was caught by
  the fetch handler's own catch, which then rendered the settings form with
  zero rows.

## 26.09.07b

- Added **Referenced by** to the foot of every page with inbound links — the
  reverse of the wiki-links already written by hand. Writing `[[Docker Swarm]]`
  on the Compose page said nothing when standing on the Swarm page; it now
  lists all five pages pointing at it. Build-time, no plugin, no new front
  matter. 24 of 46 pages show one. Matching accepts the raw token, the
  `section/slug` form, and the rendered anchor, so the result does not depend
  on build order.
- Added **placeholder values**. `/settings/` lists every `<PLACEHOLDER>` used
  in the docs — discovered at build time and ordered by how often it appears,
  so the form arrives filled in rather than empty — and any value entered is
  substituted into code blocks across the site. Stored in localStorage on the
  device; nothing is sent anywhere.
- Every code block gained a copy button, revealed on hover or keyboard focus.
  It copies exactly what is on screen, so a filled command copies filled.
- A toggle in the page header switches code blocks between stored values and
  raw placeholders, for reading the docs as written.
- Secret-shaped names (`TOKEN`, `SECRET`, `KEY`, `PASSWORD`, `CREDENTIAL`,
  `PRIVATE`, `AUTH`) are excluded from discovery, so a live credential cannot
  be stored through this system even deliberately. Commands needing one show a
  shell variable such as `"$TUNNEL_TOKEN"` instead.
- Bookmarks: Export and Remove all are disabled while the store is empty.
  Import stays enabled — restoring into an empty store is its main use.

## 26.09.07

- Added bookmarks. A Save toggle in each page header, a manager at
  `/bookmarks/`, and JSON import/export. Everything is one key in
  localStorage: no account, no network, no sync, and clearing site data clears
  it. Every storage call is guarded, so private mode or a full quota degrades
  to "bookmarks do not work" rather than a broken page.
- The manager builds its list with DOM methods rather than an HTML string, and
  import merges instead of replacing while rejecting any URL that is not a
  same-origin relative path. Titles and URLs in the store are user-editable and
  importable, so they are treated as untrusted input.

## 26.09.06e

- Fixed the menu button's close animation. `.navbtn__icon` had no `transition`
  declared, so the open-state hover transform applied instantly — the closed
  state sprang its bar widths while the open state simply snapped, which is why
  one felt considered and the other did not. The reduced-motion block was
  already disabling a transition that never existed.
- Reworked that hover into a quarter turn inward. An X is symmetric under 90°,
  so the mark lands exactly on itself and the motion reads as complete rather
  than stopping at an arbitrary angle, as the previous 8° tilt did. A slight
  scale-down carries the "collapse" half of the gesture, on the same spring as
  the closed state.
- Added the GitHub avatar to the home page links.
- Removed the status stripe from Todo board items. Items already sit under a
  status heading with a coloured pip, so a coloured edge on every row repeated
  what position had already said, and it ran a ragged colour column down the
  left of otherwise flush text. In columns it also fought the card border it
  sat inside. Status still appears where it carries new information: the group
  heading and the per-item task bar.

## 26.09.06d

- Sidebar page links are a step smaller than the brand above them, so the
  brand reads as the column's heading and the pages as its contents.
- The active page is bold again, without the label reflowing when it changes.
  Weighting every item highlights nothing; weighting only the active one moves
  the text, because bold glyphs are wider. Each label now carries its own text
  in `data-text`, and a zero-height hidden copy is rendered at the bold weight
  inside the same box — it contributes width but no height, so the box is
  always as wide as its bold version and toggling the weight moves nothing.
- Fixed the connector ticks disappearing from the home sidebar. Truncating long
  titles needs `overflow: hidden`, which clipped the ticks because they were
  drawn in a negative margin outside the box. They are left padding now, inside
  it.
- Leaving home for a section page starts the destination with the sidebar
  collapsed. The home sidebar is a directory of the whole site and a section
  sidebar is a list of one section's pages; carrying the open state across that
  boundary landed the reader in a different-looking panel mid-navigation. The state is
  written before navigating and read before the next page paints, so there is
  no flash. Moving between section pages still remembers the choice.
- Search sits in the trailing topbar cluster on every page. It was in the
  leading cluster on docs pages, so the same control was left-aligned there and
  right-aligned on home.
- Reworded the Todo section blurb.

## 26.09.06c

- Section indexes are now real landing pages instead of redirects. `/server/`,
  `/linux/` and the rest list every page in the section with its description,
  grouped the same way the sidebar groups them. The listing is generated from
  the same include the sidebar uses, so the two cannot disagree.
- Removed the redirect indexes. A redirect meant a section URL existed but
  could never be looked at: the back button bounced forward again, a shared
  link always landed somewhere other than intended, and there was no way to see
  what a section held without opening a page first. The `redirect_to_first_doc`
  mechanism is still supported for any page that wants it; nothing uses it now.
- Every section index gained the sidebar "Overview" link, since every one is
  now worth landing on.
- Fixed the sidebar's horizontal scrollbar. Long page titles were wider than
  the column: flex and grid children default to `min-width: auto` and refuse to
  shrink below their content, so they overflowed instead of truncating. Text
  nodes now shrink and ellipse, with `overflow-x` on the body as a backstop.
- Renamed the docs groups to "Server" and "Documentations".
- The header brand on the home page is text only again, and the sidebar brand
  uses distinct icons: a house for Home, a book for Library. Nothing referenced
  the inlined hornbill symbol afterwards, so the sprite include was removed —
  `assets/logo.svg` is still the favicon, and re-adding the sprite is one line.
- Deleted `docs/Makefile`; the repository root Makefile covers it.

## 26.09.06b

- Split `getting-started.md` in two. It held a server bring-up runbook and the
  conventions for authoring this site under one title, which is why the Docs
  section read as though it were about one specific deployment. The site half
  is now "Authoring these docs".
- Section sidebars can group their pages. A page may declare `group:` in front
  matter; the sidebar renders each group under a heading, so a section holding
  several unrelated tracks reads as separate things. Group order follows the
  nav_order of each group's first page, so no separate registry is needed, and
  pages with no group render first without a heading.
- Removed the section title from the sidebar. The brand above it already names
  the section, so the same word appeared twice in the same column.
- Reworked the section page list to match the home sidebar rather than use a
  second visual language. The leading dot markers are gone; the active page is
  marked by a rail on the left edge, which keeps every label starting on the
  same vertical line and lets the list read as a column of text. The rail is a
  pseudo-element, so text does not shift when a page becomes active.
- Added Todo to the home sidebar's Overview list, under Graph View.
- Added a `check` target to the Makefile, and moved `check-install.sh` into the
  repository so it runs from a checkout.
- Excluded `Makefile`, `check-install.sh`, `README.md`, `LICENSE` and the
  Gemfiles from the build. Jekyll had been copying repo tooling into `_site`.

## 26.09.06

- Imported 43 notes from the old Obsidian vault, reorganised into sections and
  rewritten as short descriptions with commands rather than prose. Overlapping
  notes were merged: four Docker notes became installation, Compose and Swarm
  pages; four Cloudflare notes became tunnel and Access pages; `commands.md`,
  which was 324 lines of six unrelated topics, was split across the pages each
  part belonged to.
- **Redacted two live credentials** that were in the vault unmasked: a GitHub
  personal access token and a Cloudflare API token. Both must be treated as
  compromised and rotated. Also replaced a home public IP, a droplet public IP,
  a tunnel UUID, an Access client ID, container IDs and personal usernames with
  placeholders.
- Added a **Mobile** section for the Android and Flutter toolchain, which fit
  neither infrastructure nor Linux desktop.
- Added an "Overview" link to the top of the section sidebar for sections whose
  index is a real page rather than a redirect. Driven by a `section_overview`
  flag, so it stays general instead of naming Todo.
- Notes that were plans became Todo items (the GCE migration, domain transfers,
  disposable subsystems); notes that were history became `_note/` pages (the
  infrastructure log, running costs). Empty stubs were dropped.

## 26.09.05b

- Fixed section indexes being unreachable. The "All N pages →" link in the home
  sidebar only rendered for sections with more than six pages, so every smaller
  section had no route to its own index at all. Harmless while every index was
  a redirect to the first page — and invisible until the Todo board became an
  index worth landing on. It now always links, reading "Open <section> →" for
  short sections.
- Todo items now carry real task progress, counted from the `- [ ]` checkboxes
  in the page itself. Kramdown renders these as real checkbox inputs, so both
  the board and the item page can count them with no plugin.
- Status is now derived when not stated. An explicit `status:` still wins; with
  none set, a page is `done` when every task is ticked, `active` when some are,
  and `planned` otherwise. `blocked` stays manual — no checkbox can express
  waiting on something else. This keeps the board honest without reintroducing
  the hand-maintained bookkeeping removed earlier today.
- The board now offers two layouts, columns and list, toggled in its header and
  remembered in localStorage. Both render from identical markup with only CSS
  differing, so they cannot drift apart and the toggle needs no reload. With
  JavaScript off the board stays on columns and remains fully usable.
- Todo items get their own layout instead of borrowing the docs one: a link
  back to the board, the status as a tinted header band rather than a small
  pill, a task progress bar, and previous/next in board order.

## 26.09.05

- Pages no longer need index bookkeeping. `in_nav` is now opt-OUT rather than
  opt-in, `nav_order` is optional, and `title` and `category` fall back to the
  filename and the section label. A new page needs an empty front matter block
  and nothing else; it still lands in the sidebar, search, the graph, and the
  directory. Pages that set `nav_order` sort first in that order, and
  everything else follows alphabetically, so ordering is total and never
  depends on filesystem order. Set `in_nav: false` to hide a draft.
- Consolidated the seven copies of "which pages are navigable, and in what
  order" into one include, `_includes/nav-docs.html`. The sidebar, search feed,
  graph feed, directory feed, tag and category indexes, and the section
  redirects all read from it, so they can no longer disagree. Removed
  `_includes/all-docs.html`, which nothing referenced.
- Added a **Todo** section. Unlike every other section index, `/todo/` renders
  a board: items grouped by a `status` of `active`, `planned`, `blocked`, or
  `done`, with a completion bar. Anything with a missing or unrecognised status
  falls into "planned" rather than disappearing. Any page can now carry a
  `status`, which shows as a pill under its title.
- Moved the e-book and presenter project spec out of `_note/` and onto the Todo
  board. It had no front matter, so Jekyll had been treating it as a static
  file — it was never published, and appeared in no index.
- Fixed the Linux category splitting in two. Two pages used `category: "linux"`
  and two used `"Linux"`, which the directory showed as separate facets.
- Renamed the two pages both titled "Utility" to "Python utilities" and "Linux
  utilities". Beyond being ambiguous to read, a `[[Utility]]` wiki-link
  silently resolved to whichever page the resolver reached first. Also replaced
  the Python page's description and tags, which were copied verbatim from the
  packaging page, and the Linux page's placeholder description.
- Moved the changelog into the `_docs` collection so it is indexed by search,
  the graph, and the directory like any other page. It keeps its own permalink,
  so the URL is still `/changelog/`.
- Resolved colliding `nav_order` values in the docs, python, and linux
  sections. These are now harmless anyway, since ties break alphabetically.
- Fixed wiki-links being resolved inside code. The resolver runs on rendered
  HTML, so a page that *wrote about* the syntax — `[[Some page]]` in backticks,
  or a fenced block showing Obsidian markup — had its examples silently
  rewritten into real links or broken-link spans. Text inside `<code>` is now
  passed through verbatim. This will matter during the Obsidian import, where
  notes about linking are likely.
- Fixed a build failure on the `github-pages` gem. The Todo board grouped its
  "planned" items with a single `where_exp` using `and`, which needs Jekyll 4;
  on Jekyll 3.10 the expression parser stops after the first comparison and
  raises "Expected end_of_string but found id". Chained single-comparison
  filters instead, which are equivalent and build on both.
- Known limitation: the graph feed still scans raw page content for `[[…]]`
  without the same code guard, so a link inside a code block can add a phantom
  edge. Nothing in the current content triggers it.
- The hornbill mark from `assets/logo.svg` replaces the generic house and book
  icons in the sidebar, and now sits beside the site name in the header. It is
  defined once per page as an SVG `<symbol>` and referenced with `<use>`, since
  the path is ~6KB and appears more than once. The file itself gained a
  `viewBox` — it had only `width`/`height`, so it could not be scaled
  reliably — and `fill="currentColor"` so it flips with the theme.

## 26.08.03k

- Renamed the Directory page's internals from "browse" to "directory" so the
  naming is consistent end to end. The script (directory.js), the styles
  (_directory.scss), and the data feed (/directory.json) are renamed, along
  with every CSS class (.directory__*), the data- hooks (data-directory-*), and
  the DIRECTORY_URL global. No behaviour or visual change — purely a rename for
  clarity.

## 26.08.03j

- Reworked the Directory filter chips. Category and tag chips now look
  different — tag chips are smaller and lighter, giving the two facets a clear
  visual hierarchy. Chip counts are abbreviated for large numbers (1200 shows
  as "1.2k", with the full value on hover), so busy facets stay tidy.
- The filter panel stays compact. Each facet group collapses to about two rows
  with a "Show all (N)" toggle that only appears when the chips actually
  overflow — so a section with dozens of tags no longer makes the panel huge,
  but everything is one click away.
- Removed border-colour hover effects throughout the Directory. Chips, cards,
  tags, the pager, and the clear button now respond to hover with a background
  or lift instead of a border tint.

## 26.08.03i

- Renamed the Browse page to Directory. The page heading, the sidebar entry,
  and the URL are now "Directory" / /directory/ — a plainer, more fitting name.
  The category and tag deep-links from doc pages and the tag/category index
  pages all point at the new path. (The internal data feed keeps its name.)
- Cleaned up the filter panel copy. It repeated "Filter by" and "pick any" for
  both facets; now there's a single "Filter" heading with the hint once, then
  plain "Categories" and "Tags" labels.
- Eased the facet chip label weight back to normal — the count badge already
  carries the label/count distinction, so the label no longer needs to be bold.

## 26.08.03h

- Redesigned the facet chips so the label and count read as different things.
  The label (the thing filtered by) is now the prominent text, and the count (how
  many pages have it) sits in its own small rounded badge beside it — on a
  selected chip the badge inverts to a translucent capsule. No more "Guide 1"
  reading as one run-on token.
- Added numbered pagination to Browse. Results render 36 per page with a
  Prev / 1 2 3 / Next control that collapses to ellipses for long ranges
  (e.g. "1 … 6 7 8 … 12"). Changing a filter returns to page 1, and the pager
  hides itself whenever everything fits on one page. This keeps the page fast
  even when the library grows to hundreds of docs, since only the current
  page's cards are in the DOM.
- Updated the Browse subtitle, which still mentioned search, to "Every page,
  filterable by category and tag."

## 26.08.03g

- Reworked the Browse page layout and filtering. Removed the search box and
  the awkward two-column split; the category and tag facets now sit together in
  one full-width panel with proper phrase labels ("Filter by category", "Filter
  by tag") instead of bare words. Both facets are multi-select now — it is possible to
  pick Plex and Server together (categories combine with OR to broaden; tags
  combine with AND to narrow). A "Clear filters" button appears once anything is
  selected, and the current filters are reflected in the URL so a filtered view
  can be shared or bookmarked.
- Tags and categories are clickable everywhere now. On a Browse card, clicking a
  tag adds it to the filter (rather than opening the page). On a doc page, the
  category eyebrow links to a pre-filtered Browse, and a "Tagged" row of the
  page's tags sits beneath the article, each linking into Browse.

## 26.08.03f

- Added a taxonomy and an interactive index. Pages keep two kinds of metadata:
  a single `category` (the page's primary kind) and many `tags` (cross-cutting
  topics). A new Browse page at /browse/ lists every page as a filterable card
  grid — filter by a live search box, one category, or any number of tags (tags
  combine with AND). New /tags/ and /categories/ index pages list every tag and
  category with counts, each deep-linking into a pre-filtered Browse. Browse,
  Browse-all, and Tags are now in the sidebar overview nav. All of it is
  client-side over a generated /browse.json, no build plugins.
- Redesigned the section links in the sidebar. The [*]/[+] brackets and the
  filled active background are gone; each item now leads with a small marker
  that is a hollow ring at rest, fills on hover, and becomes a solid accent dot
  for the current page — a calmer, clearer status cue.
- Fixed the sidebar "Library" link, which pointed at Home; it now opens the
  documentation index.
- The deploy commit message on khensolomon.github.io is now trimmed: a source
  commit "docs update: testing" deploys as just "testing".

## 26.08.03e

- The deploy now also copies docs/LICENSE and docs/README.md to the root of the
  khensolomon.github.io repo, as plain files. Both are excluded from the Jekyll
  build (they aren't page content), so a step after the build drops them into
  the published output verbatim. If either file is absent the step skips it
  rather than failing.

## 26.08.03d

- Hardened the docs deploy against a hang. When the deploy step froze at
  `ssh-add`, the cause was the deploy-key secret (a passphrase on the key, or a
  truncated / newline-stripped paste makes `ssh-add` wait forever). Added an
  8-minute job timeout so a bad key fails fast instead of running for hours,
  rewrote the key-setup instructions to prevent both causes (no-passphrase
  check, clipboard-piped paste), and documented a token-based alternative that
  deploys over HTTPS and skips SSH entirely.

## 26.08.03c

- Fixed the docs deploy build failure. When CI installed gems into
  docs/vendor/bundle and built from docs/, Jekyll was scanning that folder and
  trying to render the gems' own Liquid test fixtures as site pages — which
  failed with "Unknown tag 'when'" pointing into the liquid gem. The build
  directories (vendor, node_modules, and the caches) are now excluded in
  _config.yml so only the real site is built.
- Renamed the deploy secret from DEPLOY_KEY to PAGES_DEPLOY_KEY in the workflow
  and setup instructions.

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
  control back immediately, and Reset replays the smooth frame-in.
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

- Graph View is now fully interactive and "natural". Dragging empty space
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
  something not actually knowable. It now instead quietly re-checks the real
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
  broke the build. A first attempt at a fix made it worse: I tried escaping
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
  typing starts. Typing `/` inside any other field still enters a literal
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
