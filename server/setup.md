# Production Deployment Guide

**Stack:** Django · MySQL · Nginx · Docker Swarm · Nginx Proxy Manager · Cloudflare Tunnel · GitHub Actions

This guide covers the complete setup of a production server from a fresh Ubuntu/Debian droplet to a fully automated deployment pipeline. Follow each section in order on a first-time setup.

The bootstrap is robotic. `setup.py` provisions the VM, creates the Cloudflare Tunnel, ingress rules, DNS records, the Access application protecting SSH, and attaches a Service Auth policy that lets the GitHub Actions deploy pipeline authenticate. You supply credentials; the script wires them up.

---

## Todo

- [x] mkdir -p /opt/bucket/storage
- [x] mkdir -p /opt/bucket/media
- [x] mkdir -p /opt/bucket/html
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
   - [6.2 Add an Access policy for the NPM admin UI](#62-add-an-access-policy-for-the-npm-admin-ui)
7. [Nginx Proxy Manager Configuration](#7-nginx-proxy-manager-configuration)
   - [7.1 First login](#71-first-login)
   - [7.2 Create proxy host for Django](#72-create-a-proxy-host-for-the-django-application)
   - [7.3 Test SSH through the tunnel](#73-test-ssh-through-the-tunnel-before-closing-port-22)
   - [7.4 Close port 22](#74-close-port-22)
   - [7.5 SSL for additional hosts](#75-configure-ssl-for-additional-proxy-hosts)
   - [7.6 Customise the default landing page](#76-customise-the-default-landing-page)
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
  R2_SECRET_ACCESS_KEY      bbbb...
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

`setup.py` does almost everything: installs Docker, configures UFW, creates application directories, brings up Nginx Proxy Manager + Cloudflare Tunnel, creates DNS records, and configures the Access application that gates SSH.

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

If you've already created the tunnel in the Cloudflare dashboard and just want to install Docker + NPM on the server, pass the tunnel token directly:

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

### What the script does

| Step | What happens |
|---|---|
| Python alias | Links `python3` → `python` |
| Swap | Allocates a 2 GB swap file at `/swapfile` (configurable) |
| Security | Installs `fail2ban`, `unattended-upgrades`, `jq`, `python3-boto3` |
| Firewall | Configures UFW: allows SSH, 80, 443. Port 81 stays closed |
| Directories | Creates `/opt/bucket`, `/opt/bucket/html`, `/opt/myordbok`, `/opt/zaideih`, `/opt/django/media`, `/opt/mysql/data` |
| rclone | Installs the rclone binary via the official installer; writes an R2 remote to `~/.config/rclone/rclone.conf` (600) if R2 credentials were supplied |
| Docker CE | Installs Docker Engine + Compose plugin + Buildx; configures log rotation |
| Docker Swarm | Initialises a single-node swarm; creates the `gateway` overlay network |
| NPM + Tunnel | Deploys Nginx Proxy Manager and Cloudflare Tunnel via Docker Compose; mounts `/opt/bucket/html` (ro) and writes `server_dead.conf` so the default landing page serves from that directory |
| Cloudflare API | Validates token, verifies the supplied service token exists in this account |
| Tunnel | Creates the named tunnel and returns its connection token |
| Ingress | Pushes ingress routing rules for `ssh.<domain>`, `npm.<domain>`, and each `--app-domain` |
| DNS | Upserts proxied CNAMEs in each domain's zone, pointing at the tunnel |
| Access app | Creates a self-hosted Access application bound to `ssh.<domain>` |
| Access policy | Attaches a Service Auth policy referencing the supplied service token |

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
├── nginx-proxy-manager/       # NPM stack (docker-compose.yml + data)
│   ├── docker-compose.yml
│   ├── .env                   # Cloudflare tunnel token (chmod 600)
│   ├── data/
│   │   └── nginx/custom/
│   │       └── server_dead.conf  # Override for the default landing page
│   └── letsencrypt/
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
│   └── html/                  # Default landing page (mounted ro into NPM)
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

---

## 6. Manual Cloudflare steps still required

Robotic mode handles SSH-related Access configuration end-to-end. Two things still need a couple of dashboard clicks:

### 6.1 Verify the tunnel is healthy

Zero Trust → **Networks → Tunnels** — find the tunnel named in `--tunnel-name`. Status should read **Healthy** with one connector. If it reads **Inactive**, check the cloudflared container on the server:

```bash
docker logs --tail 50 cloudflare-tunnel
```

The most common cause of an inactive tunnel after `setup.py` finishes is a wrong tunnel token in `/opt/nginx-proxy-manager/.env` — usually because robotic mode was bypassed and the manual `--cloudflare-token` value didn't match the named tunnel.

### 6.2 Add an Access policy for the NPM admin UI

The script protects `ssh.<domain>` automatically (Service Auth policy for the deploy pipeline). It does **not** auto-protect `npm.<domain>` because that hostname is for human access — the appropriate policy depends on who should reach it.

1. Zero Trust → **Access → Applications**
2. Click **Add an application** → **Self-hosted**
3. **Application domain:** `npm.<your-admin-domain>`
4. **Application name:** `NPM Admin`
5. Click **Next**, then **Add a policy**:
   - **Policy name:** `owner-only`
   - **Action:** `Allow`
   - **Include** rule: `Emails` → your email address
6. Save → **Add application**

After this, visiting `npm.<your-admin-domain>` will show a Cloudflare Access login that emails a one-time PIN.

> Don't add a Service Auth policy to the NPM admin app. Service Auth bypasses identity verification — appropriate for the deploy pipeline's SSH access, but the NPM admin UI should require a human login.

---

## 7. Nginx Proxy Manager Configuration

Port 81 is bound to `127.0.0.1` only and is not reachable from the public internet. Access the NPM admin UI exclusively through the `npm.<your-admin-domain>` hostname configured by `setup.py`.

### 7.1 First login

> If you haven't yet added the NPM admin Access policy from [6.2](#62-add-an-access-policy-for-the-npm-admin-ui), use an SSH port-forward from the local machine for the first login:
> ```bash
> ssh -i ~/.ssh/prod_server -L 8181:127.0.0.1:81 root@<server-ip>
> ```
> Then open `http://localhost:8181` in the browser.

Once `npm.<your-admin-domain>` is reachable through the tunnel and the Access policy is in place:

1. Open `https://npm.<your-admin-domain>`
2. Cloudflare Access prompts for an email — enter the address set in the Access policy
3. Check that email for a one-time PIN
4. The NPM login screen appears

Default credentials:
```
Email:    admin@example.com
Password: changeme
```

**Change both immediately after first login.**

### 7.2 Create a proxy host for the Django application

The tunnel routes `<your-app-domain>` traffic to NPM on port 80. NPM forwards that traffic to the per-stack **nginx** service inside Docker Swarm. NPM and the stack's nginx both join the shared external `gateway` overlay network created by `setup.py`.

1. NPM → **Hosts → Proxy Hosts → Add Proxy Host**
2. Fill in the **Details** tab:

| Field | Value |
|---|---|
| Domain names | e.g. `myordbok.com` |
| Scheme | `http` |
| Forward hostname / IP | Per-stack nginx service name (e.g. `myordbok_nginx`) |
| Forward port | Port nginx listens on inside the container (typically `80`) |
| Block common exploits | ✅ enabled |
| Websockets support | enable if the app uses websockets |

3. **SSL** tab:
   - Select **Request a new SSL Certificate**
   - Enable **Force SSL**, **HTTP/2 Support**, and **HSTS**

4. Save.

> To find the exact service name, run `docker service ls` on the server. The nginx service appears in the `NAME` column as `<stack>_nginx`.

### 7.3 Test SSH through the tunnel (before closing port 22)

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

### 7.4 Close port 22

> Only close port 22 after the tunnel-based SSH test above succeeds.

From an active SSH session on the server:

```bash
sudo ufw delete allow ssh
sudo ufw status
```

Port 22 is now closed. Future terminal access goes through the tunnel. The DigitalOcean web console remains as an emergency fallback (see Section 14).

### 7.5 Configure SSL for additional proxy hosts

Same SSL pattern for any additional domain or subdomain in NPM:

1. **SSL** tab → **Request a new SSL Certificate**
2. Enable **Force SSL**, **HTTP/2 Support**, **HSTS**

### 7.6 Customise the default landing page

When a request arrives at the server with a `Host:` header that doesn't match any configured proxy host, NPM serves a "dead host" — by default a built-in *Congratulations! You're connected to Nginx Proxy Manager!* page. That's fine to leave in place if the server is private behind a tunnel, but for any host with port 80/443 open to the internet (mainly for cert renewal here, but still), it gives away more than it should.

`setup.py` handles this without any UI clicks:

- `/opt/bucket/html` is created on the host and mounted **read-only** into the NPM container at the same path.
- `/data/nginx/custom/server_dead.conf` is written with a `location /` that serves files from `/opt/bucket/html` with `try_files` falling back to `/index.html`.
- A placeholder `index.html` is seeded on first install only if the directory is empty — re-runs never clobber operator content.

To replace the page, drop files into `/opt/bucket/html/` on the host:

```bash
# Single file
sudo cp my-landing.html /opt/bucket/html/index.html

# Or a whole site (static export, etc.)
sudo rsync -av ./dist/ /opt/bucket/html/
```

No container restart needed — nginx reads files from the bind mount on every request.

If you change `server_dead.conf` itself (e.g. to add custom headers or rewrites), reload NPM to pick it up:

```bash
docker exec $(docker ps -q -f name=nginx-proxy-manager) nginx -s reload
```

> Per-app proxy hosts created in the NPM UI are unaffected by this — they have their own server blocks and take priority over the dead host. The custom landing page only shows for hostnames NPM doesn't know about.

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
| `SERVER_USER` | `.env` Zone 3 | `deploy_via_tunnel`, `deploy_via_ssh` |
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
| 80 | TCP | Open | NPM HTTP + Let's Encrypt cert renewal |
| 443 | TCP | Open | NPM HTTPS |
| 81 | TCP | **Closed** | NPM admin — accessible only via tunnel |

```bash
sudo ufw status verbose
sudo ufw allow <port>/tcp
sudo ufw delete allow <port>/tcp
sudo ufw reload
```

---

## 16. Re-running setup.py

`setup.py` is a one-shot bootstrap, but most steps are idempotent — apt installs, swap, UFW rules, directory creation, Docker install, swarm init, NPM compose. Running it again is safe for picking up incremental fixes.

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
| `server_dead.conf` | Always (re-)written to the version this `setup.py` ships with. Edit by hand only if you understand the version stamp will be lost on next run. |

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

### NPM admin UI is unreachable at `npm.<your-admin-domain>`

**1.** Tunnel healthy? See above.

**2.** In the Cloudflare Tunnel config, public hostname `npm.<your-admin-domain>` is mapped to `http://localhost:81`. `localhost` is correct — the tunnel container runs with `network_mode: host`, so its `localhost` is the Docker host where NPM has port 81 bound to `127.0.0.1`.

**3.** NPM running?
```bash
docker ps | grep nginx-proxy-manager
```

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

### Custom landing page doesn't show

Default landing page at `/opt/bucket/html/index.html` should appear when you hit the server with a hostname NPM doesn't know about (e.g. `curl -H "Host: nothing.invalid" http://<server-ip>/`).

**1.** Confirm `server_dead.conf` exists inside the NPM data dir:

```bash
cat /opt/nginx-proxy-manager/data/nginx/custom/server_dead.conf
```

**2.** Confirm `/opt/bucket/html` is mounted into the container:

```bash
docker exec $(docker ps -q -f name=nginx-proxy-manager) ls /opt/bucket/html
```

If empty inside the container, check the host directory exists and has files. If the mount itself is missing, re-run `setup.py --force` to rewrite `docker-compose.yml`.

**3.** If you edited `server_dead.conf` by hand and nginx didn't pick it up, reload:

```bash
docker exec $(docker ps -q -f name=nginx-proxy-manager) nginx -s reload
```

A syntax error in the file will fail the reload; check `docker logs $(docker ps -q -f name=nginx-proxy-manager)` for the nginx error message.

**4.** If a hostname is configured as a proxy host in NPM, the dead-host config doesn't apply — proxy hosts take priority. The landing page only serves for unmatched hostnames.