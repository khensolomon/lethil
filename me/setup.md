# Production Deployment Guide

**Stack:** Django · MySQL · Nginx · Docker Swarm · Cloudflare Tunnel · GitHub Actions

This guide covers the complete setup of a production server from a fresh Ubuntu/Debian droplet to a fully automated deployment pipeline. Follow each section in order on a first-time setup.

The bootstrap is robotic. `setup.py` provisions the VM, creates the Cloudflare Tunnel, ingress rules, DNS records, the Access application protecting SSH, and attaches a Service Auth policy that lets the GitHub Actions deploy pipeline authenticate. You supply credentials; the script wires them up.

---

## Todo

- [ ] mkdir -p /opt/bucket/storage
- [ ] mkdir -p /opt/bucket/media
- [x] install rclone and config — now handled by `setup.py` (see [Section 4](#4-running-the-setup-script))

---


## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [One-time Cloudflare credentials](#2-one-time-cloudflare-credentials)
3. [Server Provisioning](#3-server-provisioning)
4. [Running the Setup Script](#4-running-the-setup-script)
5. [Directory Structure](#5-directory-structure)
6. [Manual Cloudflare Steps Still Required](#6-manual-cloudflare-steps-still-required)
   - [6.1 Verify the tunnel is healthy](#61-verify-the-tunnel-is-healthy)
7. [Post-install: SSH cutover and landing page](#7-post-install-ssh-cutover-and-landing-page)
   - [7.1 Test SSH through the tunnel](#71-test-ssh-through-the-tunnel-before-closing-port-22)
   - [7.2 Close port 22](#72-close-port-22)
   - [7.3 Customise the landing page](#73-customise-the-landing-page)
8. [GitHub Actions Self-Hosted Runner](#8-github-actions-self-hosted-runner)
9. [GitHub Repository Secrets (via secrets.py)](#9-github-repository-secrets-via-secretspy)
10. [Triggering a Deployment](#10-triggering-a-deployment)
11. [Deployment Methods Explained](#11-deployment-methods-explained)
12. [Monitoring & Logs](#12-monitoring--logs)
13. [Rollback Procedure](#13-rollback-procedure)
14. [Emergency Server Access](#14-emergency-server-access)
15. [Firewall Reference](#15-firewall-reference)
16. [Re-running setup.py](#16-re-running-setuppy)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Prerequisites

### Accounts and services required

| Service | Purpose | Where to create |
|---|---|---|
| DigitalOcean (or any VPS) | Production server | [digitalocean.com](https://digitalocean.com) |
| GitHub | Repository + Actions runner + GHCR image registry | [github.com](https://github.com) |
| Cloudflare | DNS + Zero Trust tunnel | [cloudflare.com](https://cloudflare.com) |

### Local machine requirements

- `ssh` and `ssh-keygen` available in the terminal
- `git` installed
- A domain pointed to Cloudflare nameservers
- A password manager — for storing the credentials gathered in [Section 2](#2-one-time-cloudflare-credentials)

---

## 2. One-time Cloudflare credentials

These are gathered once, stored in your password manager, and reused for every `setup.py` run. They are **never** committed to a repo or pushed to GitHub.

### 2.1 API Token

Cloudflare → **My Profile → API Tokens → Create Token → Custom token**.

Required permissions:

| Resource | Permission |
|---|---|
| Zone — DNS | Edit |
| Account — Cloudflare Tunnel | Edit |
| Account — Access: Apps and Policies | Edit |

Set zone resources to **All zones** (or list each zone explicitly). Copy the token at the end of the creation flow — it is shown only once. This is `--cf-api-token`.

### 2.2 Account ID

Cloudflare dashboard → any zone → right sidebar → **Account ID**. Permanent; doesn't change. This is `--cf-account-id`.

### 2.3 Service Token

Zero Trust → **Access → Service Auth → Service Tokens → Create Service Token**.

- Name it something memorable, e.g. `deploy-pipeline`
- Set an expiry (1 year recommended; set a calendar reminder)
- Copy both the **Client ID** (ends in `.access`) and **Client Secret** — the secret is shown only once

These become `--cf-service-token-id` and `--cf-service-token-secret` for `setup.py`, and the matching `CF_SERVICE_TOKEN_ID` / `CF_SERVICE_TOKEN_SECRET` in each app's `.env`. **Same token in both places.** It identifies the deploy pipeline as a whole — bootstrap and deploy are the same actor.

> Why is the service token created by hand and not by `setup.py`?
>
> Cloudflare returns the secret exactly once, at creation. If `setup.py` generated it, the secret would have to be captured to a file or printed to stdout, and lost values would force a rotation that invalidates every app's GitHub secret simultaneously. By creating the token once in the dashboard and storing it in a password manager, the same value can be reused across VM rebuilds, multiple `setup.py` runs, and every app repo's deploy pipeline — with no irrecoverable state on the VM.

### 2.4 R2 API Token (for rclone)

`setup.py` installs `rclone` unconditionally and writes a pre-configured R2 remote at `~/.config/rclone/rclone.conf` whenever R2 credentials are passed. This is what powers ad-hoc bucket copies, restore drills, and the project's backup tooling.

Cloudflare dashboard → **R2 → Manage R2 API Tokens → Create API Token**:

- **Permissions:** *Object Read & Write* (or read-only if this VM should never push to buckets)
- **Specify bucket(s):** scope to the buckets the server actually needs, not "Apply to all buckets"
- **TTL:** open-ended is fine; rotate when team changes

Cloudflare returns three values:

| Field | Used as |
|---|---|
| Access Key ID | `--r2-access-key-id` |
| Secret Access Key | `--r2-secret-access-key` |
| Endpoint | Constructed from your account ID — no flag needed |

Both the Access Key ID and Secret Access Key are shown only once. Store them in your password manager alongside the other bootstrap credentials.

The endpoint URL is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. `setup.py` builds it from `--cf-account-id` automatically; pass `--r2-account-id` only if you want to use a different account for R2 than for the tunnel (rare).

### Stash these somewhere safe

Suggested entry in your password manager:

```
Production server bootstrap
  CF_API_TOKEN              cfut_...
  CF_ACCOUNT_ID             f47...
  CF_SERVICE_TOKEN_ID       xxxx.access
  CF_SERVICE_TOKEN_SECRET   yyyy
  R2_ACCESS_KEY_ID          aaaa...
  R2_ACCESS_SECRET      bbbb...
```

---

## 3. Server Provisioning

### Create the droplet

Provision a fresh **Ubuntu 22.04 LTS** or **Debian 12** server. Minimum recommended specs:

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 25 GB SSD | 50 GB SSD |

### Generate an SSH key pair

On the local machine:

```bash
ssh-keygen -t ed25519 -C "prod-server-deploy" -f ~/.ssh/prod_server
```

This produces two files:
- `~/.ssh/prod_server` — **private key** (never shared, added to GitHub secrets later via `secrets.py`)
- `~/.ssh/prod_server.pub` — **public key** (added to the server)

### Add the public key to the server

When provisioning through DigitalOcean, paste the contents of `~/.ssh/prod_server.pub` into the SSH key field. Alternatively, after the server is running:

```bash
ssh-copy-id -i ~/.ssh/prod_server.pub root@<server-ip>
```

### Verify SSH access

```bash
ssh -i ~/.ssh/prod_server root@<server-ip>
```

---

## 4. Running the Setup Script

`setup.py` does almost everything: installs Docker, configures UFW, creates application directories, brings up the Cloudflare Tunnel and the landing-page nginx, creates DNS records, and configures the Access application that gates SSH.

### Transfer the script to the server

```bash
scp -i ~/.ssh/prod_server setup.py root@<server-ip>:/root/setup.py
```

### Robotic mode — recommended

Run with all five required credentials. `--app-domain` is repeatable; supply one per public hostname your apps need. `--r2-access-key-id` and `--r2-secret-access-key` are optional — supply them to have `setup.py` write a pre-configured rclone remote for R2.

```bash
sudo python3 setup.py \
  --cf-api-token             "cfut_..." \
  --cf-account-id            "f47..." \
  --cf-service-token-id      "xxxx.access" \
  --cf-service-token-secret  "yyyy" \
  --domain                   "example.com" \
  --tunnel-name              "prod-server" \
  --app-domain               "myordbok.com:http://localhost:8000" \
  --app-domain               "zaideih.com:http://localhost:8080" \
  --r2-access-key-id         "aaaa..." \
  --r2-secret-access-key     "bbbb..."
```

`rclone` itself is installed even when the R2 flags are omitted — the binary is useful for ad-hoc work regardless. Only the `[r2]` remote in `~/.config/rclone/rclone.conf` is gated on the credentials being present.

### Manual-tunnel mode (legacy)

If you've already created the tunnel in the Cloudflare dashboard and just want `setup.py` to handle the server-side install (Docker, tunnel container, landing nginx), pass the tunnel token directly:

```bash
sudo python3 setup.py --cloudflare-token <TUNNEL_TOKEN_FROM_DASHBOARD>
```

This skips all robotic steps. You then have to add public hostnames, the Access application, the Access policy, and the DNS records by hand. **Robotic mode is strongly preferred** — manual mode exists for migration cases where the tunnel and DNS already exist.

### Other options

| Flag | Effect |
|---|---|
| `--swap 4G` | Override the default 2 GB swap allocation |
| `--dry-run` | Print every action without making changes |
| `--force` | Recreate an existing tunnel (destroys connections; use cautiously) |

### Adding or renaming admin subdomains

Every admin subdomain (DNS record + tunnel ingress + optional Access app) is declared in a single dict named `admin_subdomains` near the top of `main()` in `setup.py`. Edit one place and DNS, ingress, Access wiring, and the post-install summary all follow.

```python
admin_subdomains = {
    "ssh": {
        "service": "ssh://localhost:22",
        "protect_with_access_app": True,
        "app_name": f"SSH — {admin_domain}",
    },
    "npm": {
        "service": "http://localhost:81",
    },
    # Add new internal proxies here, e.g.:
    # "grafana":   {"service": "http://localhost:3000"},
    # "portainer": {"service": "https://localhost:9443"},
}
```

To rename `ssh` to something else (e.g. `access`), just change the dict key — `setup.py` will create a DNS record, ingress rule, Access app, and Service Auth policy on the new hostname. The old Cloudflare resources at the previous hostname stay in place and need manual cleanup in the dashboard.

### What the script does

| Step | What happens |
|---|---|
| Python alias | Links `python3` → `python` |
| Swap | Allocates a 2 GB swap file at `/swapfile` (configurable) |
| Security | Installs `fail2ban`, `unattended-upgrades`, `jq`, `python3-boto3` |
| Firewall | Configures UFW: allows SSH, 80, 443 |
| Directories | Creates `/opt/bucket`, `/opt/bucket/html`, `/opt/myordbok`, `/opt/zaideih`, `/opt/django/media`, `/opt/mysql/data` |
| rclone | Installs the rclone binary via the official installer; writes an R2 remote to `~/.config/rclone/rclone.conf` (600) if R2 credentials were supplied |
| Docker CE | Installs Docker Engine + Compose plugin + Buildx; configures log rotation; adds the invoking user to the `docker` group so `docker` works without `sudo` (run `newgrp docker` in your shell after install to activate it without re-login) |
| Docker Swarm | Initialises a single-node swarm; creates the `gateway` overlay network |
| Cloudflare Tunnel | Deploys the cloudflared container as its own Docker Compose stack at `/opt/cloudflare-tunnel/` (network_mode: host so the tunnel reaches every service via `localhost:<port>`) |
| Landing nginx | Deploys an `nginx:alpine` container at `/opt/landing/` listening on port 80, serving `/opt/bucket/html` as a static site with SPA `try_files` fallback. This is the catch-all for any request the tunnel ingress doesn't route somewhere specific |
| Cloudflare API | Validates token, verifies the supplied service token exists in this account |
| Tunnel | Creates the named tunnel and returns its connection token |
| Ingress | Pushes tunnel ingress routing rules for every entry in `admin_subdomains` (default: `ssh.<domain>` and `npm.<domain>`), every `--app-domain`, and a catch-all to `localhost:80` (the landing nginx) |
| DNS | Upserts proxied CNAMEs in each domain's zone, pointing at the tunnel |
| Access app | For every `admin_subdomains` entry flagged `protect_with_access_app: True` (default: `ssh.<domain>` only), creates a self-hosted Access application and attaches a Service Auth policy referencing the supplied service token |

### Verify the install completed

```bash
docker info
docker compose version
docker service ls
ufw status
```

Setup logs are written to `/var/log/setup.log`.

---

## 5. Directory Structure

```
/opt/
├── landing/                   # Vanilla nginx landing-page stack
│   ├── docker-compose.yml     # nginx:alpine, port 80, mounts the two below
│   └── conf/
│       └── nginx.conf         # The server block (try_files, root, etc.)
│
├── cloudflare-tunnel/         # Cloudflare Tunnel as its own stack
│   ├── docker-compose.yml     # cloudflared:latest, network_mode: host
│   └── .env                   # TUNNEL_TOKEN (chmod 600)
│
├── myordbok/                  # Application deployment directory
│   ├── docker.production.yml  # Copied here by deploy.yml on each deploy
│   └── .env                   # Recreated from GitHub secret on each deploy
│
├── zaideih/                   # Second application — same shape
│   ├── docker.production.yml
│   └── .env
│
├── bucket/                    # Shared persistent storage
│   ├── storage/
│   ├── media/
│   └── html/                  # Landing page document root (mounted ro into landing nginx)
│
├── django/
│   └── media/                 # Django media file uploads
│
└── mysql/
    └── data/                  # MySQL data directory (owned by uid 999)

~/.config/rclone/
└── rclone.conf                # R2 remote, mode 600, owned by SUDO_USER
```

> `/opt/<app>/.env` is **not** a manually managed file. It is recreated from the `ENV_FILE_CONTENT` GitHub secret on every deployment run. The marker that an app has been deployed to this host is the existence of `/opt/<app>/.env`.

> `~/.config/rclone/rclone.conf` is owned by the user who invoked `sudo python3 setup.py` (resolved via `$SUDO_USER`), not root — so `rclone lsd r2:` works without sudo from the operator's shell.

> **If you're upgrading from a previous version of this setup that used Nginx Proxy Manager:** the new layout uses `/opt/landing/` and `/opt/cloudflare-tunnel/` instead of `/opt/nginx-proxy-manager/`. Re-running `setup.py` creates the new directories but does **not** clean up the old NPM stack. To migrate, stop and remove NPM by hand: `cd /opt/nginx-proxy-manager && sudo docker compose down -v && sudo rm -rf /opt/nginx-proxy-manager`, then re-run `setup.py`. Otherwise both stacks will fight over port 80.

---

## 6. Manual Cloudflare steps still required

Robotic mode handles SSH-related Access configuration end-to-end. One thing still benefits from a quick dashboard check:

### 6.1 Verify the tunnel is healthy

Zero Trust → **Networks → Tunnels** — find the tunnel named in `--tunnel-name`. Status should read **Healthy** with one connector. If it reads **Inactive**, check the cloudflared container on the server:

```bash
docker logs --tail 50 cloudflare-tunnel
```

The most common cause of an inactive tunnel after `setup.py` finishes is a wrong tunnel token in `/opt/cloudflare-tunnel/.env` — usually because robotic mode was bypassed and the manual `--cloudflare-token` value didn't match the named tunnel.

---

## 7. Post-install: SSH cutover and landing page

With `setup.py` complete, the Cloudflare tunnel is up, ingress rules are routing, and a placeholder landing page is serving on port 80. Two things still want attention before declaring the server done.

### 7.1 Test SSH through the tunnel (before closing port 22)

Install `cloudflared` on the **local machine**:

```bash
# macOS
brew install cloudflared

# Linux (Debian/Ubuntu)
wget -q https://github.com/cloudflare/cloudflared/releases/download/2025.4.0/cloudflared-linux-amd64.deb
sudo dpkg -i --force-overwrite cloudflared-linux-amd64.deb
```

Add to `~/.ssh/config` on the local machine:

```
Host ssh.<your-admin-domain>
    ProxyCommand cloudflared access ssh --hostname %h
    User root
    IdentityFile ~/.ssh/prod_server
```

Test:

```bash
ssh ssh.<your-admin-domain>
```

For interactive (browser) login, Cloudflare opens a tab the first time. For service-token-based testing (matching what the deploy pipeline does), use:

```bash
ssh -o ProxyCommand="cloudflared access ssh \
    --hostname %h \
    --service-token-id <YOUR_TOKEN_ID> \
    --service-token-secret <YOUR_TOKEN_SECRET>" \
    root@ssh.<your-admin-domain> -i ~/.ssh/prod_server
```

If this connects without prompting for a browser login, the Service Auth policy created by `setup.py` is working correctly and the deploy pipeline will authenticate the same way.

### 7.2 Close port 22

> Only close port 22 after the tunnel-based SSH test above succeeds.

From an active SSH session on the server:

```bash
sudo ufw delete allow ssh
sudo ufw status
```

Port 22 is now closed. Future terminal access goes through the tunnel. The DigitalOcean web console remains as an emergency fallback (see Section 14).

### 7.3 Customise the landing page

Anything not matched by a specific tunnel ingress rule falls through the catch-all to `localhost:80`, where the landing-page nginx serves whatever is in `/opt/bucket/html/`. This is the lightweight nginx container at `/opt/landing/` — not Nginx Proxy Manager. There is no admin UI, no DB, no template injection points. The container does one thing: serve `/opt/bucket/html` as a static site.

To replace the placeholder, drop files into `/opt/bucket/html/` on the host:

```bash
# Single file
sudo cp my-landing.html /opt/bucket/html/index.html

# Or a whole SPA / static-site build output
sudo rsync -av ./dist/ /opt/bucket/html/
```

No restart, no reload — nginx reads files from the bind mount on every request. The server block uses `try_files $uri $uri/ /index.html =404;`, which means:

- Concrete files (`style.css`, `script.js`, `favicon.ico`, `assets/logo.png`, etc.) resolve via `$uri` and serve as static files directly from disk.
- Requests for client-side-routed SPA paths (e.g. `/about`, `/users/42`) don't match a file or directory, so they fall back to `/index.html` — the SPA shell — which then handles routing in the browser.
- Genuinely missing paths with no SPA shell to fall back to return 404, not an infinite loop.

To change the nginx server block itself (custom headers, gzip, additional locations), edit `/opt/landing/conf/nginx.conf` on the host and recreate the container:

```bash
cd /opt/landing && sudo docker compose up -d --force-recreate landing
```

> **What hits this landing page?** Three things:
> - `http://<server-ip>/` — direct HTTP to the server's public IP
> - `https://<server-ip>/` — direct HTTPS won't reach here (no TLS on the host); Cloudflare's edge handles HTTPS for domains pointed at this server
> - Any unknown-hostname request that reaches the tunnel — Cloudflare routes via the catch-all ingress rule to `localhost:80`
>
> Per-app domains (`myordbok.example.com`, `zaideih.example.com`) and admin domains (`ssh.<domain>`, `npm.<domain>`) bypass the landing page entirely — they match specific tunnel ingress rules that route to their app/SSH ports directly.

> **Why a vanilla nginx container and not NPM?** Earlier versions of this setup used Nginx Proxy Manager. With Cloudflare doing TLS at the edge and the tunnel doing host-to-app routing via `localhost:<port>`, NPM was doing nothing useful — except acting as a default-host server for the landing page, which it did poorly (its shipped `default.conf` includes a regex `assets.conf` that intercepts CSS/JS asset requests and 502s them). Replacing NPM with vanilla nginx made the landing-page concern trivial: one server block, one root, one try_files. See the comments in `setup.py`'s `setup_landing()` function for the full history.

---

## 8. GitHub Actions Self-Hosted Runner

The `deploy_local_vm` job in `deploy.yml` runs directly on the production server using a self-hosted runner. This runner is **not installed by `setup.py`** and must be registered manually.

### Register the runner

1. GitHub repository → **Settings → Actions → Runners**
2. Click **New self-hosted runner** → **Linux** / **x64**
3. Run the displayed commands on the production server:

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.x.x.tar.gz -L \
    https://github.com/actions/runner/releases/download/...
tar xzf ./actions-runner-linux-x64-2.x.x.tar.gz
./config.sh --url https://github.com/<org>/<repo> --token <RUNNER_TOKEN>
```

### Install as a system service

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

The runner should show as **Idle** at **Settings → Actions → Runners** in GitHub.

### Create the PAT for runner status checks

`check_local_vm_runner` polls the GitHub API to detect whether the runner is online before attempting a local deploy.

1. GitHub → **Settings (account) → Developer settings → Personal access tokens → Fine-grained tokens**
2. Repository access: the deployment repository
3. Grant **read-only** permission for **Actions**
4. Copy the token. It goes into each app's `.env` as `VM_RUNNER_STATUS_PAT` and `secrets.py --push` ships it to GitHub.

---

## 9. GitHub Repository Secrets (via secrets.py)

Repository secrets are managed by `secrets.py`, which lives alongside (or inside) each app repo. The source of truth is each app's `.env`. See **secrets.md** for the full reference.

### How values flow

```
Password manager        Each app's .env (Zone 3)        GitHub Actions Secrets
────────────────        ────────────────────────        ──────────────────────
SERVER_HOSTNAME    ──→  SERVER_HOSTNAME           ──→  SERVER_HOSTNAME
                        SSH_PRIVATE_KEY_PATH      ──→  SSH_PRIVATE_KEY  (file contents)
                        VM_RUNNER_STATUS_PAT      ──→  VM_RUNNER_STATUS_PAT
CF_SERVICE_TOKEN_ID──→  CF_SERVICE_TOKEN_ID       ──→  CF_SERVICE_TOKEN_ID
CF_SERVICE_TOKEN_SECRET→ CF_SERVICE_TOKEN_SECRET  ──→  CF_SERVICE_TOKEN_SECRET
                        (Zone 1 lines bundled)    ──→  ENV_FILE_CONTENT
```

`CF_SERVICE_TOKEN_ID` / `CF_SERVICE_TOKEN_SECRET` are the same values you pass to `setup.py`. One credential, three locations: password manager (durable), `.env` (per-app local working copy), GitHub Secret (consumed by the runner).

### Push secrets

In each app repo:

```bash
secrets.py --check                # confirm gh CLI auth + .env parses
secrets.py --status               # see what would change
secrets.py --push --dry-run       # preview
secrets.py --push                 # ship to GitHub
```

### Required secrets

| Secret | Source | Used by |
|---|---|---|
| `ENV_FILE_CONTENT` | Zone 1 of app `.env` | All deploy paths |
| `SSH_PRIVATE_KEY` | File pointed to by `SSH_PRIVATE_KEY_PATH` in `.env` | `deploy_via_tunnel`, `deploy_via_ssh` |
| `SERVER_HOSTNAME` | `.env` Zone 3 — usually `ssh.<your-admin-domain>` | `deploy_via_tunnel`, `deploy_via_ssh` |
| `SERVER_USERNAME` | `.env` Zone 3 | `deploy_via_tunnel`, `deploy_via_ssh` |
| `VM_RUNNER_STATUS_PAT` | `.env` Zone 3 — fine-grained PAT, Actions read-only | `check_local_vm_runner` |
| `CF_SERVICE_TOKEN_ID` | `.env` Zone 3 | `deploy_via_tunnel` |
| `CF_SERVICE_TOKEN_SECRET` | `.env` Zone 3 | `deploy_via_tunnel` |
| `GITHUB_TOKEN` | Auto-provided by GitHub | Build phase — never set manually |

### GitHub environments

Tunnel and SSH deploy jobs are scoped to named environments. Create these once per repo:

**Repository → Settings → Environments → New environment**

| Environment name | Used by |
|---|---|
| `production-tunnel` | `deploy_via_tunnel` |
| `production-ssh` | `deploy_via_ssh` |

Environments support deployment gates (required reviewers, wait timers, environment-scoped secrets).

### Verify secrets are set

```bash
secrets.py --list
```

Prints all secret names currently on the repo. Values are never shown.

---

## 10. Triggering a Deployment

Deployments are triggered by pushing to the `master` branch with a commit message starting with `deploy:`.

### Commit message format

```
deploy: <description> [optional-tag]
```

### Deployment method selection

| Commit message | What runs |
|---|---|
| `deploy: fix login bug` | Local VM runner only (if online) |
| `deploy: fix login bug [tunnel]` | Cloudflare Tunnel deploy |
| `deploy: fix login bug [ssh]` | Native SSH deploy |
| `deploy: fix login bug [tunnel] [ssh]` | `[tunnel]` wins, `[ssh]` is suppressed |

> `[tunnel]` and `[ssh]` are mutually exclusive. If both appear in the same commit, `[tunnel]` takes priority and `[ssh]` is ignored.

### Example

```bash
git add .
git commit -m "deploy: update homepage layout [tunnel]"
git push origin master
```

### Watch the pipeline

Repository → **Actions** tab → most recent run.

---

## 11. Deployment Methods Explained

### Method 1 — Local VM (self-hosted runner)

**When it runs:** automatically, whenever the self-hosted runner is detected as online and no `[tunnel]`/`[ssh]` tag is present.

**How:** the runner process on the production server executes the deploy locally. No SSH or network tunnelling involved.

**Best for:** day-to-day deployments.

### Method 2 — Cloudflare Tunnel (`[tunnel]`)

**When:** `[tunnel]` in the commit message and `[ssh]` not present.

**How:** the GitHub-hosted runner installs `cloudflared` (currently pinned to `2025.4.0`), establishes an authenticated SSH session through the Cloudflare tunnel using the Service Token configured by `setup.py`, copies the compose file and `.env` over SCP, and executes the deploy. Port 22 stays closed.

**Best for:** remote servers behind closed firewalls.

### Method 3 — Native SSH (`[ssh]`)

**When:** `[ssh]` in the commit message and `[tunnel]` not present.

**How:** uses `appleboy/scp-action` and `appleboy/ssh-action` over standard SSH. Requires port 22 reachable from GitHub Actions IP ranges.

**Best for:** environments without Cloudflare Tunnel, or initial setup before the tunnel is configured.

### Docker image tagging

Every build pushes two tags per image:

```
ghcr.io/<repo>/django-app:latest
ghcr.io/<repo>/django-app:<commit-sha>
```

`:latest` is what the running stack uses. The SHA tag stays in the registry for rollbacks.

---

## 12. Monitoring & Logs

### GitHub Actions deployment summary

After each successful deploy, a summary is written to the job page: **Actions → \<run\> → \<job\> → Summary**.

### Docker service status

```bash
docker service ls
docker service ls --filter name=myordbok_web
docker service ps myordbok_web
```

### Application logs

```bash
docker service logs myordbok_web --follow
docker service logs myordbok_nginx --follow
docker service logs myordbok_db --follow
docker service logs myordbok_web --tail 100
```

### Cloudflare Tunnel logs

```bash
docker logs -f cloudflare-tunnel
docker exec cloudflare-tunnel cloudflared tunnel info
```

### System resource usage

```bash
free -h
df -h
docker system df
```

---

## 13. Rollback Procedure

Every build tags images with the commit SHA. To roll back:

1. **Find the target SHA** — from the Actions deploy summary, or `git log --oneline`.
2. **Pull the tagged image:**
   ```bash
   docker pull ghcr.io/<repo>/django-app:<target-sha>
   ```
3. **Pin the tag:** edit `/opt/<app>/docker.production.yml` to replace `:latest` with `:<target-sha>` for the django-app service, then redeploy:
   ```bash
   cd /opt/<app>
   docker stack deploy -c docker.production.yml --with-registry-auth --detach=false <app>
   ```
4. **Verify:**
   ```bash
   docker service ls --filter name=<app>_web
   docker service logs <app>_web --tail 50
   ```

---

## 14. Emergency Server Access

### Via Cloudflare Tunnel SSH (primary remote method)

Once the `~/.ssh/config` entry from [Section 7.3](#73-test-ssh-through-the-tunnel-before-closing-port-22) is in place:

```bash
ssh ssh.<your-admin-domain>
```

If the config entry isn't there:

```bash
ssh -o ProxyCommand="cloudflared access ssh --hostname %h" \
    root@ssh.<your-admin-domain> -i ~/.ssh/prod_server
```

### Via DigitalOcean Web Console (no network required)

Connects directly through the hypervisor — bypasses UFW, closed ports, and broken networking.

1. **Droplets → \<name\> → Access**
2. **Launch Droplet Console**

### Re-opening port 22 if needed

```bash
sudo ufw allow ssh
sudo ufw status
```

---

## 15. Firewall Reference

UFW is configured by `setup.py`. Rules in effect after setup:

| Port | Protocol | Status | Reason |
|---|---|---|---|
| 22 | TCP | Open (initially) | SSH access — close after tunnel is verified |
| 80 | TCP | Open | Landing-page nginx; also useful for direct debugging |
| 443 | TCP | Open | No service listens here on the host; Cloudflare terminates TLS at the edge and the tunnel forwards plain HTTP to localhost:80. Kept open as a no-op escape valve |

```bash
sudo ufw status verbose
sudo ufw allow <port>/tcp
sudo ufw delete allow <port>/tcp
sudo ufw reload
```

---

## 16. Re-running setup.py

`setup.py` is a one-shot bootstrap, but most steps are idempotent — apt installs, swap, UFW rules, directory creation, Docker install, swarm init, compose stacks. Running it again is safe for picking up incremental fixes.

The Cloudflare-side operations are partly idempotent:

| Operation | On re-run |
|---|---|
| Tunnel | **Aborts** if a tunnel with the same name already exists. Use `--force` to delete and recreate (drops all current connections). |
| DNS records | Updates in place if a CNAME at the hostname already exists; replaces only A/AAAA conflicts under `--force`. |
| Access app for `ssh.<domain>` | Reused if one already exists for that hostname. |
| Service Auth policy | Reused if one already references this service token. |
| Service token | Never created — it's an input, not an output. |
| rclone config | Skipped if `~/.config/rclone/rclone.conf` already contains an `[r2]` section, unless `--force` is passed. |
| `/opt/bucket/html/index.html` | Seeded only if `/opt/bucket/html` is empty. Existing content is never overwritten. |
| Cloudflare Tunnel stack | `/opt/cloudflare-tunnel/.env` and `docker-compose.yml` are rewritten on every run. `--force` brings the container down first; otherwise `docker compose up -d` is a no-op if nothing changed. |
| Landing nginx stack | `/opt/landing/conf/nginx.conf` and `docker-compose.yml` are rewritten on every run. The `landing` service is always force-recreated so a freshly written nginx.conf takes effect. |

> **The service token is durable.** Its credentials are inputs to `setup.py`, stored in your password manager and reused across runs. There is no secret on the VM that gets lost on reinstall. Tearing down the VM and provisioning a fresh one with the same flags reattaches the same service token to a fresh Access policy on a fresh tunnel — your apps' GitHub secrets continue to work without rotation.

### Rotating the service token (when you actually need to)

Service tokens expire (or you might want to rotate proactively after team changes). The flow:

1. Cloudflare dashboard → **Zero Trust → Access → Service Auth → Service Tokens** → **Create Service Token** (or **Refresh** an existing one — same effect, secret returned once)
2. Update your password manager with the new ID and secret
3. Update each app's `.env` (Zone 3): new `CF_SERVICE_TOKEN_ID` and `CF_SERVICE_TOKEN_SECRET`
4. In each app repo: `secrets.py --push` (use `--only CF_SERVICE_TOKEN` to scope it)
5. Re-run `setup.py` with the new credentials so the Access policy is re-pointed at the new token
6. Delete the old token in the dashboard

The order matters: don't delete the old token until step 5 succeeds, or in-flight deploys will fail.

---

## 17. Troubleshooting

### Build job does not start

The commit message must start with `deploy:` (lowercase, colon, space). The `build` job has this condition:

```yaml
if: startsWith(github.event.head_commit.message, 'deploy:')
```

A message like `Deploy: ...` or `deploy ...` (no colon) will not trigger.

### `check_local_vm_runner` reports runner as offline

**Check 1:** verify the runner service:
```bash
cd ~/actions-runner && sudo ./svc.sh status
sudo ./svc.sh start    # if stopped
```

**Check 2:** verify `VM_RUNNER_STATUS_PAT` is set and not expired. A missing or expired token causes the API call to return an error, treated as offline.

### Cloudflare Tunnel deploy fails with `websocket: bad handshake`

This is the auth layer — Cloudflare Access rejected the service token at the WebSocket handshake. Check, in order:

**1.** The Access application for `ssh.<domain>` exists (Zero Trust → Access → Applications). It should — `setup.py` creates it. If it's missing, re-run `setup.py`.

**2.** The Access app has a **Service Auth** policy (not "Allow") referencing your service token. Click the app → Policies tab. The policy's **Action** must be **Service Auth**; **Action: Allow** with a service token in the include rule will produce this exact error.

**3.** The token in GitHub Secrets matches the one attached to the policy. `CF_SERVICE_TOKEN_ID` ends in `.access`. If they drifted (e.g. the token was rotated in the dashboard but `secrets.py --push` wasn't run), redeploys fail until they're resynced.

**4.** Tunnel is healthy:
```bash
docker logs --tail 50 cloudflare-tunnel
```

### MySQL readiness check times out

The pipeline waits up to 100 seconds for MySQL to accept connections.

```bash
docker service logs <app>_db --tail 100
```

Common causes: wrong `MYSQL_ROOT_PASSWORD` in `ENV_FILE_CONTENT`, or insufficient disk space at `/opt/mysql/data`.

### Deployment health check fails (`Replicas: 0/2` or `1/2`)

```bash
docker service logs <app>_web --tail 100
```

The `Dump Service Logs on Failure` step in the pipeline captures these automatically and displays them in the Actions run output.

### `cp` fails when installing cloudflared in CI

If you see `cp: '/usr/bin/cloudflared' and '/usr/local/bin/cloudflared' are the same file` in the GitHub Actions run, the runner image already has `cloudflared` preinstalled as a symlink. Use `dpkg -i --force-overwrite` and drop any manual `cp` step — `dpkg` will manage the binary location itself.

### Service token verification fails at the start of `setup.py`

> Service token with client_id 'xxxx.access' was not found in account ...

`setup.py` looks up the token in the supplied account before doing anything else. Causes:

- `--cf-service-token-id` is wrong (typo, or you copied the token name/UUID instead of the Client ID — Client ID always ends in `.access`)
- `--cf-account-id` is wrong (wrong account, or token created in a different account)
- The token was deleted in the dashboard

Fix any of those and re-run.

### `rclone lsd r2:` returns `NoSuchBucket` or `InvalidAccessKeyId`

The remote is configured but the credentials aren't matching what Cloudflare expects.

**1.** Check the config file exists and is owned by the user running rclone (not root):

```bash
ls -l ~/.config/rclone/rclone.conf
# Expected: -rw------- 1 <you> <you> ...
cat ~/.config/rclone/rclone.conf
```

**2.** Confirm the endpoint matches your account ID. The line should read `endpoint = https://<account-id>.r2.cloudflarestorage.com`. Account ID is the same one in the Cloudflare dashboard sidebar, not the zone ID.

**3.** Confirm the R2 API token has access to the bucket you're listing. R2 tokens can be scoped per-bucket — `Apply to all buckets` is permissive but auditable; per-bucket scoping is safer but easier to misconfigure.

**4.** Verify with a one-shot call:

```bash
rclone --config ~/.config/rclone/rclone.conf lsd r2:
```

To rewrite the config, re-run `setup.py --force` with the R2 flags. Without `--force`, the existing `[r2]` section is preserved.

### `docker: permission denied while trying to connect to the docker API`

```
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

`setup.py` adds the invoking user to the `docker` group, but Linux only refreshes group memberships when a process starts. The shell you're typing in started before `setup.py` ran, so it still has the old groups.

Two options:

```bash
# Activate the group in the current shell only:
newgrp docker

# Or pick it up everywhere by re-logging in:
exit       # then SSH back in
```

After either of those, `docker ps` works without `sudo`. Confirm with:

```bash
groups | grep -o docker
```

If you see `docker` in the output, you're good. If `setup.py` ran but didn't add you to the group (e.g. you ran it as root directly, with no `SUDO_USER` set), do it manually:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

The watch-out: shell scripts and command substitutions like `$(docker ps -q -f name=...)` run in *subshells*, which inherit the parent shell's groups. So `sudo docker exec $(docker ps -q ...)` runs the outer command as root but the inner one as your normal user — and the inner one fails with the permission error you saw, leaving the outer `docker exec` with no container ID to operate on. Fix the group membership instead of sprinkling `sudo` inside command substitutions.

### Landing page doesn't show, or assets return 502

The landing page should appear when you hit the server over plain HTTP, with or without a hostname header:

```bash
curl -sI http://<server-ip>/
curl -sI -H "Host: nothing.invalid" http://<server-ip>/
```

Both should return `200 OK` with `Server: nginx/...` and a `Content-Length` matching your `/opt/bucket/html/index.html` file size.

**Container running?**

```bash
docker ps --filter name=landing
# Expected: STATUS shows 'Up <duration>'
```

If it's not running, check the logs:

```bash
docker logs --tail 50 landing
```

The most common reason for the container failing to start is a syntax error in `/opt/landing/conf/nginx.conf`. `nginx -t` runs at startup and the error will be in the logs verbatim.

**Wrong files served (or empty 403 Forbidden)?**

```bash
# What's on the host?
ls -la /opt/bucket/html/

# What does the container see?
docker exec landing ls -la /usr/share/nginx/html/
```

The two listings should match. If the container is empty or shows different files, the bind mount didn't apply — `docker compose up -d --force-recreate landing` from `/opt/landing/` will rebuild with the mount.

**Port conflict?**

If `docker logs landing` shows `bind() to 0.0.0.0:80 failed (98: Address already in use)`, something else is already listening on port 80. The usual suspect on an upgraded server is a leftover NPM container:

```bash
sudo lsof -i :80
# or
sudo ss -tlnp | grep ':80'
```

If you see `nginx-proxy-manager` in the output, follow the upgrade-cleanup note in Section 5.

**SPA deep links return 404?**

The server block uses `try_files $uri $uri/ /index.html =404;`. Deep links work as long as `/opt/bucket/html/index.html` exists. If it doesn't, deep links 404 because the fallback target doesn't exist. Drop a real `index.html` into the directory and reload the browser.