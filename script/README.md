# script/

Scripts that act on the **repo itself** — repo plumbing. Run on the operator's machine, but their job is to manipulate the repo's metadata, secrets, GitHub config, etc.

Contrast with `me/`, which is scripts that act on the operator's local environment (VMs, ISOs, dev tools).

## What's here

| Script | Purpose |
|---|---|
| `secrets.py` | Read `.env` at the repo root, push each KEY=VALUE to GitHub Secrets via the GitHub CLI (`gh`). |

## Adding a script

Things that belong here: anything that talks to GitHub, Cloudflare's account-level settings, the repo's own metadata. Things that orchestrate workflows from the command line. Linters, formatters.

Things that don't belong here: anything that runs on a server (→ `server/`), anything that builds/deploys an app (→ workflow), anything that creates VMs (→ `me/`).
