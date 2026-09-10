---
title: "Cloudflare Tunnel"
description: "Outbound-only ingress with cloudflared — no open ports."
group: "Ingress"
category: "Server"
nav_order: 4
tags: [server, cloudflare, networking, tunnel]
---

The tunnel dials out to Cloudflare, so nothing needs to be exposed inbound.
Pairs with [[Docker Swarm]]. For SSH and service tokens see
[[Cloudflare Access]].

## Install

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt-get update && sudo apt-get install cloudflared
```

Or from the release package directly:

```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

## Create a tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create github-bridge
```

## Configure

`/etc/cloudflared/config.yml` — wildcard, sending everything to
[[Nginx Proxy Manager]]:

```yml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: "*.example.com"
    service: http://localhost:80

  # Mandatory catch-all, must be last
  - service: http_status:404
```

Per-subdomain instead:

```yml
ingress:
  - hostname: zaideih.example.com
    service: http://localhost:8080
  - hostname: myordbok.example.com
    service: http://localhost:9000
  - service: http_status:404
```

## Route DNS and run

```bash
cloudflared tunnel ingress validate
cloudflared tunnel route dns github-bridge "*.example.com"

sudo cloudflared service install <TUNNEL_TOKEN>
cloudflared tunnel run --token <TUNNEL_TOKEN>
sudo systemctl restart cloudflared
```

The tunnel token grants full control of the tunnel. Keep it in a secret store,
never in a config file that gets committed.

## Once the tunnel works

```bash
sudo ufw delete allow ssh
sudo ufw status
```
