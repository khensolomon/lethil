---
title: "Provisioning a host"
description: "First-boot setup script, hosts entries, and bridge checks."
category: "Server"
nav_order: 10
tags: [server, provisioning, networking]
---

## Setup script

```bash
curl -O https://raw.githubusercontent.com/<owner>/<repo>/master/setup_server.sh
nano setup_server.sh          # read it before running it
chmod +x setup_server.sh
sudo ./setup_server.sh
```

Piping a remote script straight into a shell runs whatever the URL serves at
that moment. Download, read, then run.

```bash
python ~/dev/lethil/server/setup.py --show-command
sudo python3 setup.py --cloudflare-token <TUNNEL_TOKEN>
```

## Local hostnames

```bash
sudo nano /etc/hosts
```

```
127.0.0.1        zaideih.local
<VM_IP>          zaideih.test
<VM_IP>          admin.local
```

## Bridge checks

```bash
ip link show
bridge link
ip addr show br0
```

## Deployment directories

```bash
mkdir -p /opt/bucket/storage
mkdir -p /opt/bucket/media
```
