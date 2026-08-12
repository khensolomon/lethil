---
title: "Getting started"
description: "Bring the stack up, then learn how these docs are built."
category: "Guide"
nav_order: 1
in_nav: true
---

Two things live under this heading: the commands that take a fresh machine to a
running deployment, and the conventions behind the docs site itself. Start at the
top for a working stack; skip to the second half to add or edit pages.

## Bring up the stack

The steps below run in order on a new machine. Each block is copy-paste ready;
paths assume the monorepo is checked out at `~/dev/lethil`.

### 1. VM

Reset known hosts, then provision the virtual machine:

```bash
> ~/.ssh/known_hosts
sudo python ~/dev/lethil/me/vm/create.py
```

### 2. Secrets

Push the repository secrets, then render the app `.env` from `origin.env`. Full
reference in the [[Secrets manager]].

```bash
cd /app?
python3 ~/dev/lethil/script/secrets.py --push
python3 ~/dev/lethil/script/secrets.py --update
```

### 3. Setup

Provision the server. Full reference in the [[Deployment guide]].

```bash
python3 ~/dev/lethil/server/setup.py --show-command

cd ~/
wget https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py
curl -O https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py

python3 -c "import urllib.request as r,os,sys;u=sys.argv[1];r.urlretrieve(u,os.path.basename(u))" https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py

python3 -c "import sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],u.split('/')[-1])" https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py
```

### 4. rclone config

Seed local storage from the R2 buckets:

```bash
rclone copy r2:storage/zaideih/mysql/ /opt/bucket/storage/zaideih/mysql/
rclone copy r2:storage/zaideih/store/ /opt/bucket/storage/zaideih/store/
rclone copy r2:storage/myordbok/mysql/ /opt/bucket/storage/myordbok/mysql/
# see more at rclone.md
```

A local VM needs no rclone config — `vm/create.py` already links it.

### Export and import the database

```bash
python3 /opt/apps/swarm/db.py export zaideih
python3 /opt/apps/swarm/db.py import zaideih
cd zaideih
python3 /opt/apps/swarm/db.py list

cd ~/dev/zaideih
python3 ~/dev/lethil/apps/swarm/db.py list
python3 ~/dev/lethil/apps/swarm/db.py exec ~/dev/zaideih/assets/queries/test.v01.sql
```

### Management commands

```bash
cd ~/
python3 ~/dev/lethil/apps/swarm/django.py ~/dev/zaideih healthcheck
cd ~/dev/zaideih
python3 ~/dev/lethil/apps/swarm/django.py healthcheck
```

### Hash

```bash
python3 ~/dev/lethil/script/hash.py
python3 ~/dev/lethil/script/hash.py -s "test"
python3 ~/dev/lethil/script/hash.py -s "test" -t 21
```

## How these docs are built

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

### Add a page to an existing section

1. Create `_python/logging.md`.
2. Give it `title`, `category`, `nav_order`, and `in_nav: true`.
3. Write Markdown. It appears in that section's sidebar and in search.

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
