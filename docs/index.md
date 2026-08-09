---
layout: portfolio
title: "ZOMI.developer"

# Hero content (caption / slogan / subject / eyebrow) rotates by weekday and is
# edited in _data/hero.yml. The "current focus" banner is in _data/feature.yml.
# Neither lives here anymore.

# Elsewhere. `image` is optional — a URL to show in the badge instead of the
# label's first letter, at the exact same size either way. Leave it off and
# the letter badge is used automatically.
links:
  - label: "GitHub"
    url: "https://github.com/khensolomon"
  - label: "MyOrdbok"
    url: "https://myordbok.com"
    image: "https://raw.githubusercontent.com/laisiangtho/dictionary/master/myordbok.png"
  - label: "Zaideih"
    url: "https://zaideih.com"

# Shipped apps. Each renders as a card via _includes/showcase.html — no raw
# HTML in this file. Add a store only if the app is actually listed there.
apps_heading: "Apps"
apps:
  - name:  "MyOrdbok"
    blurb: "A comprehensive online Myanmar dictionary, making learning and reference accessible to everyone."
    repo:  "https://github.com/laisiangtho/dictionary"
    image: "https://raw.githubusercontent.com/laisiangtho/dictionary/master/myordbok.png"
    stores:
      - label: "App Store"
        url: "https://apps.apple.com/us/app/myordbok/id1570959654"
      - label: "Play Store"
        url: "https://play.google.com/store/apps/details?id=com.myordbok.app"

  - name:  "Lai Siangtho"
    blurb: "Organizes and sorts the Bible in tribal scripts, so communities can read and share it more easily."
    repo:  "https://github.com/laisiangtho/scripture"
    image: "https://raw.githubusercontent.com/laisiangtho/scripture/master/bible.png"
    stores:
      - label: "App Store"
        url: "https://apps.apple.com/us/app/lai-siangtho/id600127635"
      - label: "Play Store"
        url: "https://play.google.com/store/apps/details?id=com.laisiangtho.bible"

  - name:  "Zaideih"
    blurb: "A volunteer effort to stream and preserve tribal music from the 70s, 80s, and 90s — a fading heritage kept alive."
    repo:  "https://github.com/laisiangtho/music"
    image: "https://raw.githubusercontent.com/laisiangtho/music/master/music.png"
    stores:
      - label: "Play Store"
        url: "https://play.google.com/store/apps/details?id=com.zaideih.app"

# Extensions, packages, smaller tools. Same card include; `image` is optional
# (falls back to a monospace mark) and there are no stores — the name links to
# the source. Symbolic SVGs (filename contains "symbolic") adapt to the theme.
tools_heading: "Extensions & packages"
tools:
  - name:  "Lesion"
    blurb: "A GNOME Shell extension."
    repo:  "https://github.com/khensolomon/lesion"
    image: "https://raw.githubusercontent.com/khensolomon/lesion/refs/heads/master/icon/hornbill-symbolic.svg"
---
