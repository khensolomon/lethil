---
title: "Move off Google Cloud"
description: "GCE commitment ends September 2026 — move compute, storage and domains to Cloudflare and DigitalOcean."
category: "Todo"
status: "active"
nav_order: 1
tags: [migration, gce, cloudflare, digitalocean]
---

The GCE instance runs on a three-year commitment that ends **25 September
2026**, so the instance has to be gone before then. Storage and domains are
moving at the same time.

## Compute

- [ ] Size the DigitalOcean droplet — 2 vCPU / 2 GB RAM is the working baseline
- [ ] Provision it, see [[Provisioning a host]]
- [ ] Update the GitHub environment and repository secrets
- [ ] Prove deploy over SSH
- [ ] Prove deploy over the tunnel, see [[Cloudflare Access]]
- [ ] Run the setup script end to end on a clean host
- [ ] Decommission the GCE instance

## Storage

- [x] Move object storage to Cloudflare R2
- [ ] Set up the CDN with presigned URLs
- [ ] Confirm final database snapshots restore cleanly, see [[MySQL backups]]

## Domains

- [ ] Finish the Squarespace transfers, see [[Domain names]]

## Current instance

For sizing the replacement. `us-central1`, general-purpose E2, 2 vCPU, 5 GB
memory, 20 GB disk at about 71% used, plus roughly 184 GiB of object storage.

Costs dropped noticeably after unused resources were removed on 2026.03.20.
