# lethil

Personal infrastructure toolkit. Everything in one repo: server bootstrap scripts, static-site sources, GitHub Actions workflows for dispatching them, and helper scripts that run on the operator's machine.

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

# 3. Push secrets to GitHub
python3 script/secrets.py --push

# 4. Provision a server
# Either dispatch from GitHub Actions UI (the robotic way), or:
sudo python3 server/setup.py \
  --cf-api-token "$CF_API_TOKEN" \
  --cf-account-id "$CF_ACCOUNT_ID" \
  --cf-service-token-id "$CF_SERVICE_TOKEN_ID" \
  --cf-service-token-secret "$CF_SERVICE_TOKEN_SECRET" \
  --domain "example.com" \
  --tunnel-name "prod-server-1" \
  --app-domain "myordbok.example.com:http://localhost:3010;zaideih.example.com:http://localhost:3020"
```

## Adding things

- **A new app to deploy:** add `apps/<name>/` with source files. Add the name to `config.yml`. Dispatch `apps-deploy.yml` and pick it.
- **A new server-side task:** add `server/<task>.py`. Add a corresponding workflow under `.github/workflows/`. Document in `server/README.md`.
- **A new operator-machine script:** add `me/<script>.py` or `script/<script>.py` depending on whether it acts on the operator's environment or on the repo itself.

See each directory's `README.md` for details.
