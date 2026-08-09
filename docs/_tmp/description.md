# Description

lethil is a personal infrastructure monorepo (github.com/khensolomon/lethil) that consolidates everything needed to provision and operate a single-developer production server: the server bootstrap script, static-site/SPA sources, GitHub Actions workflows that dispatch tasks, and operator helper scripts.

The production environment is Django + MySQL apps running in Docker Swarm behind a Cloudflare Tunnel. TLS terminates at Cloudflare's edge; the tunnel routes traffic to apps via localhost ports. A vanilla nginx container serves a catch-all landing page; the Cloudflare Tunnel runs as its own stack.

The project's purpose is to turn fragile, hand-typed provisioning commands into repeatable, dispatchable tasks — while keeping every script independently runnable by hand. Core design principles: workflows are thin dispatchers (scripts do the real work), additive design (new things added by editing one place, not rewriting), single source of truth for configuration, and loud failure over silent drift.

Secrets flow from a git-ignored `.env` at the repo root to GitHub Actions Secrets via a single generalized `secrets.py`, using a three-zone model (`#@` markers) that serves both this repo and the Django app repos.
