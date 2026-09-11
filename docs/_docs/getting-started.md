---
title: "Getting started"
description: "Take a fresh machine to a running deployment."
category: "Guide"
group: "Server"
nav_order: 1
tags: [deployment]
---

The steps below run in order on a new machine. Each block is copy-paste ready;
paths assume the monorepo is checked out at `~/dev/lethil`.

For the full provisioning story including Cloudflare, see [[Deployment guide]].

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
