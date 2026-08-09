# Summary (Handoff)

## What this project is

A personal infrastructure monorepo (`github.com/khensolomon/lethil`) that consolidates server-provisioning scripts, static-site/SPA sources, GitHub Actions dispatch workflows, and operator helper scripts into one place. The goal is to replace hand-typed terminal commands (error-prone, inconsistent across machines) with dispatchable, repeatable tasks — while every script remains independently runnable by hand.

The owner is a solo developer (`khensolomon`). Production runs Django + MySQL apps in Docker Swarm behind a Cloudflare Tunnel, on a server reached via that tunnel.

---

## Architecture decisions (LOCKED)

### Reverse-proxy / landing

- **Nginx Proxy Manager (NPM) removed entirely.** It was doing nothing useful: TLS terminates at Cloudflare's edge, and the tunnel routes host→app via `localhost:<port>`. Its only remaining role (a landing page) was fragile.
- Replaced by **vanilla `nginx:alpine`** at `/opt/landing/`, serving `/opt/bucket/html` as the catch-all landing page (port 80). One server block, `try_files $uri $uri/ /index.html`. No admin UI, no DB, no template-injection fragility.
- **Cloudflare Tunnel** is its own compose stack at `/opt/cloudflare-tunnel/`, `network_mode: host` (so `localhost` inside the container is the Docker host). Routes: specific hostnames → app ports; catch-all → `localhost:80` (landing).

### setup.py (server bootstrap)

- The CORE. Workflows/runner are dumb dispatchers — they pass parameters and report done/error/why. Same script runs identically by hand.
- `admin_subdomains` dict in `main()` is the **single source of truth** for admin subdomains. Each entry: `{"service": ..., "protect_with_access_app": bool, "app_name": ...}`. Drives DNS + tunnel ingress + Cloudflare Access app + post-install summary. Rename a key → everything follows.
- `--app-domain` accepts BOTH repeated flags AND one semicolon-separated value (`"a.com:http://localhost:80;b.com:http://localhost:81"`) for CI use from a single secret.
- rclone installed unconditionally; R2 remote written to `~/.config/rclone/rclone.conf` (owner `SUDO_USER`, mode 600) only if R2 creds supplied.
- `usermod -aG docker` added; `newgrp docker` documented (cannot run from inside the script — only affects the shell that calls it).
- Firewall: 22 (closed after tunnel verified), 80 (landing), 443 (no host service; Cloudflare terminates TLS; kept as no-op).

### secrets.py (.env → GitHub Secrets) — GENERALIZED & MERGED ✅

- ONE script now serves both lethil AND the Django app repos (previously two separate scripts; merged per owner's requirement).
- Git-root aware: run from anywhere inside a repo, finds that repo's `.env`.
- **Zone model** via marker lines of the form `#@ <mode>`:
  - **Bundle** (content before first marker) → concatenated, pushed as ONE secret `ENV_BASE` (name is LOAD-BEARING — consumed by `action.yml`/`deploy.yml` in app repos; do not rename).
  - **`#@ individual`** → each key pushed as its own secret. **Path-1 generalization**: pushes WHATEVER keys are in the zone — no hardcoded allowlist. `SSH_PRIVATE_KEY_PATH` is special-cased: the file it points to is read and its CONTENTS pushed as `SSH_PRIVATE_KEY` (path itself never pushed).
  - **`#@ local`** → never pushed; read by script only (`REPO_OWNER`, `REPO_NAME`).
- Markers must appear in order (bundle → individual → local); any may be absent. Unknown mode after `#@` = fatal error (catches typos). Marker regex: `^#@\s*([A-Za-z][A-Za-z0-9_-]*)\s*$`. House style uses a space: `#@ individual`.
- Sensitive masking is pattern-based (`_PWD`, `_PASSWORD`, `_SECRET`, `_KEY`, `_TOKEN`, `_PAT`) plus always-mask `ENV_BASE`, `SSH_PRIVATE_KEY`.
- All original commands preserved & adapted: `--push` (+ `--only`, `--dry-run`, `--force`, stale detection), `--status`, `--diff`, `--restore`, `--rotate`, `--check`, `--list`, `--env-preview`, `--init` (rewritten to scaffold the generic three-zone skeleton), `--env`, `--repo`.
- **VERIFIED**: produces identical secrets for a Django-shape `.env` (ENV_BASE + SSH_PRIVATE_KEY + individual CF tokens) — backward compatible, won't break live deploys. Also verified for lethil shape and for error cases (typo'd marker, out-of-order markers).

### Repo conventions

- `apps/<name>/` = static-site/SPA source. Deploy is GENERIC (build if `package.json` present → `dist/`, else rsync as-is). The workflow owns build-and-deploy logic; no per-app `build.py`. `default` → `/opt/bucket/html`; others → `/opt/bucket/<name>/`.
- A committed `config.yml` holds non-sensitive indexing (apps list, server profiles). No hardcoding in workflows; free-text inputs validated against the repo.
- `me/` directory was MERGED into `script/` (single helper-scripts dir).
- Workflows v1 support SSH method only; `self-hosted` and `tunnel` appear in dispatch forms as placeholders that error cleanly until implemented.

---

## Repo structure (current state in the delivered zip)

```
lethil/
├── README.md                      ✅ front door
├── config.yml                     ✅ non-sensitive index
├── .env.example                   ✅ #@ marker format, canonical names
├── .gitignore                     ✅ ignores .env, dist/, node_modules, pycache
├── server/
│   ├── README.md                  ✅
│   └── setup.py                   ✅ current (NPM removed; tunnel+landing split;
│                                     admin_subdomains dict; ;-separated app-domain;
│                                     rclone; docker group)
├── apps/
│   ├── README.md                  ✅
│   └── default/                   ✅ index.html, style.css, script.js (placeholders), README
├── script/
│   ├── README.md                  ✅ documents the merged secrets.py + zone model
│   └── secrets.py                 ✅ GENERALIZED, MERGED, VERIFIED
├── docs/
│   └── setup.md                   ✅ moved here; paths updated; GH Actions option added
│                                     (still needs pronoun/hype sweep + new flow section)
└── .github/workflows/
    ├── server-setup.yml           ✅ SSH only; tunnel/self-hosted = placeholders
    └── apps-deploy.yml            ✅ SSH only; tunnel/self-hosted = placeholders
```

Delivered as `lethil.zip` in outputs.

---

## DEFERRED to a separate future session (NOT now)

- **Config-model naming rethink**: `ENV_BASE` / `VAR_BASE` / `ENV_OVERRIDES` (the three-layer merge in app-repo `action.yml`) → toward "one CONFIG, per-environment override (default/ssh/tunnel/self-hosted)". This touches `action.yml` + `deploy.yml` in the APP repos (live production deploys) — needs its own focused session with app-repo context loaded. `VAR_BASE`/`ENV_OVERRIDES` are currently managed by hand in the GitHub UI.
- **Container-cleanup workflows** (`clean-containers.yml`, `bulk-delete-containers.yml`, `DELETE_PACKAGES_TOKEN`) stay in the APP repos, NOT lethil. (`DELETE_PACKAGES_TOKEN` is a write-only GitHub PAT with `delete:packages` scope; its value can't be read back.)

---

## OUTSTANDING tasks (remaining Path A work)

1. **Implement `tunnel` + `self-hosted` methods** in both workflows (`server-setup.yml`, `apps-deploy.yml`). Currently placeholders that error. SSH method already works.
2. **Pronoun + hype-register sweep** across ALL comments and docs: remove personal pronouns (you/your/we/I/my/they → impersonal: "the project", "working directory", "the Cloudflare account ID"); remove hype register (must/absolutely/100%/guarantee/tutorial-voice).
3. **New docs section**: how `.env` values flow to GitHub Secrets, which script reads what (the secrets.py zone model end-to-end).
4. **Apply workflow display names**: `name: Server · Provision`, `name: App · Deploy` (Noun · Verb form chosen for sidebar legibility as workflows grow).

---

## NEXT IMMEDIATE STEP

Implement the `tunnel` and `self-hosted` methods in `server-setup.yml` and `apps-deploy.yml`. Decisions still needed before writing:

- **self-hosted**: assumes a runner already registered on the target server (chicken-and-egg — only valid for re-provisioning an existing server, not first bootstrap). Repo-scoped runners only (owner uses a personal GitHub account, not an org).
- **tunnel**: SSH through `cloudflared access ssh` with the service token; requires the tunnel + Access app to already exist (so also not valid for first bootstrap). Needs the service-token-id / service-token-secret available to the runner from secrets.
- Confirm: which methods are valid for which workflow, and whether each workflow should refuse invalid method+context combos.

---

## Key working-file locations

- Repo skeleton (authoritative current state): `lethil.zip` in outputs; working copy at `/home/claude/lethil/`
- Latest standalone `setup.py` + `setup.md`: also in outputs (mirror of `lethil/server/setup.py` and `lethil/docs/setup.md`)
- Original `secrets.py` that was adopted/generalized: was at `/mnt/project/secrets.py`
- App-repo reference workflows (for the deferred config-model work): `deploy.yml`, `action.yml`, `clean-containers.yml`, `bulk-delete-containers.yml` (were uploaded)

---

## Verification commands (for the current secrets.py)

```bash
cd lethil
python3 -m py_compile script/secrets.py        # compiles
python3 script/secrets.py --check              # validates .env structure + gh auth
python3 script/secrets.py --push --dry-run     # preview without pushing
```

A Django-shape `.env` (bundle content + `#@ individual` + `#@ local`) and a lethil-shape `.env` (no bundle, only individual + local) both parse and resolve correctly. `SSH_PRIVATE_KEY_PATH` → file contents as `SSH_PRIVATE_KEY` confirmed.
