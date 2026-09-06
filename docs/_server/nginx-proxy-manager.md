---
title: "Nginx Proxy Manager"
description: "One proxy in front of every stack, on a shared external network."
category: "Server"
nav_order: 6
tags: [server, nginx, proxy, networking, ssl]
---

Several stacks need port 80. A shared external network lets NPM own the port
and route by hostname, so the same compose files work in development and under
[[Docker Swarm]].

## Create the shared network

```bash
# Development
docker network create gateway

# Swarm
docker network create --driver overlay --attachable gateway
```

## The proxy stack

```yaml
services:
  app:
    image: jc21/nginx-proxy-manager:latest
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
      - '127.0.0.1:81:81'   # admin UI stays on loopback
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - gateway

networks:
  gateway:
    external: true
```

```bash
docker compose up -d                      # development
docker stack deploy -c docker-compose.yml proxy   # swarm
```

Binding the admin UI to `127.0.0.1` keeps it off the internet. Reach it over an
SSH tunnel: `ssh -L 8081:localhost:81 <user>@<host>`.

## App side

Remove `ports:` from each app's nginx service — apps talk to NPM over the
gateway, not to the host.

```yaml
services:
  nginx:
    image: ghcr.io/${REPO}/nginx:latest
    networks:
      - default   # to reach the app's own web service
      - gateway   # to reach NPM

networks:
  gateway:
    external: true
```

## Adding a proxy host

Admin UI → Proxy Hosts → Add Proxy Host. Forward hostname is the service name
under Swarm (`zaideih_nginx`) or the container name under Compose
(`zaideih-nginx-1`); forward port is `80`.

## SSL

- **HTTP-01** — one click, but needs port 80 reachable from the internet.
- **DNS-01** — works behind a firewall or on a local VM, and needs an API token
  from the DNS provider. This is the one to use with [[Cloudflare Tunnel]],
  since no port is open.

## Removing it

```bash
docker service update --network-rm gateway zaideih_nginx
docker stack rm proxy
docker network rm gateway

docker network inspect gateway    # if "network is in use"
```
