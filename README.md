# lethil

Personal infrastructure toolkit. Everything in one repo: server bootstrap scripts, static-site sources, GitHub Actions workflows for dispatching them, and helper scripts that run on the operator's machine.

## 1. VM

```bash
> ~/.ssh/known_hosts
sudo python ~/dev/lethil/me/vm/create.py
```

## 2. Secrets

Push secrets to GitHub

```bash
python3 ~/dev/lethil/script/secrets.py --push
```

## 3. Setup

Provision a server, Either dispatch from GitHub Actions UI (the robotic way), or:

```bash
python3 ~/dev/lethil/server/setup.py --show-command

cd ~/
wget https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py
curl -O https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py

python3 -c "import urllib.request as r,os,sys;u=sys.argv[1];r.urlretrieve(u,os.path.basename(u))" https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py

python3 -c "import sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],u.split('/')[-1])" https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py
```

## 4. rclone config

```bash
rclone copy r2:storage/zaideih/mysql/ /opt/bucket/storage/zaideih/mysql/
rclone copy r2:storage/zaideih/store/ /opt/bucket/storage/zaideih/store/
rclone copy r2:storage/myordbok/mysql/ /opt/bucket/storage/myordbok/mysql/
# see more at rclone.md
```

> For local VM the "rclone config" is not needed, as the "vm/create.py" done linking it.

## Export and Import DB

```bash
python3 /opt/apps/swarm/db.py export zaideih
python3 /opt/apps/swarm/db.py import zaideih
cd zaideih
python3 /opt/apps/swarm/db.py list

cd ~/dev/zaideih
python3 ~/dev/lethil/apps/swarm/db.py list
python3 ~/dev/lethil/apps/swarm/db.py exec ~/dev/zaideih/assets/queries/test.v01.sql
```

## Management command

```bash
cd ~/
python3 ~/dev/lethil/apps/swarm/django.py ~/dev/zaideih healthcheck
cd ~/dev/zaideih
python3 ~/dev/lethil/apps/swarm/django.py healthcheck

```

## What's here

| Path | What it is | Where it runs |
| --- | --- | --- |
| `server/` | Scripts that run on a remote server (bootstrap, backup, restart, etc.). The `setup.py` is the main one. | Server |
| `apps/` | Source for static sites / SPAs that get deployed to a server. Each subdirectory is one app. | Deployed to server |
| `me/` | Scripts for the operator's machine — VM creation, ISO building, local-dev helpers. | Operator's machine |
| `script/` | Repo plumbing — scripts that act on the repo itself (e.g. syncing `.env` to GitHub Secrets). | Operator's machine |
| `docs/` | Documentation for the things in this repo. | (Read in browser) |
| `.github/workflows/` | GitHub Actions workflows. Each one is a thin dispatcher around a script. | GitHub Actions |
| `config.yml` | Non-sensitive indexing — list of apps, list of server profiles. Read by workflows. | (Read by tools) |
| `.env` | Secrets, gitignored. Source of truth for credentials. Synced to GitHub Secrets via `script/secrets.py`. | (Not committed) |
| `.env.example` | Template showing what `.env` should contain. Committed. | — |

## The contract

Every workflow is a thin dispatcher. The script it calls does the actual work. Hand-runnable. Same arguments, same result.

The exception: deploying static apps from `apps/` is a generic operation (build → rsync), so the workflow handles it directly. Task-specific work (Cloudflare API calls in `setup.py`, future `backup-db`, etc.) lives in scripts.


## Quick start

```bash
# 1. Clone
git clone https://github.com/khensolomon/lethil
cd lethil

# 2. Fill in secrets
cp .env.example .env
$EDITOR .env

```

## Adding things

- **A new app to deploy:** add `apps/<name>/` with source files. Add the name to `config.yml`. Dispatch `apps-deploy.yml` and pick it.
- **A new server-side task:** add `server/<task>.py`. Add a corresponding workflow under `.github/workflows/`. Document in `server/README.md`.
- **A new operator-machine script:** add `me/<script>.py` or `script/<script>.py` depending on whether it acts on the operator's environment or on the repo itself.

See each directory's `README.md` for details.
