---
title: "Docker installation"
description: "Installing Docker Engine from the official repository, plus production hardening."
group: "Containers"
category: "Server"
nav_order: 1
tags: [server, docker, install]
---

Always install from Docker's own repository. Distribution packages lag badly
and conflict with the official ones.

## Remove conflicting packages

```bash
sudo apt-get update
sudo apt-get remove docker docker-engine docker.io containerd runc docker-compose
```

## Add the repository

```bash
sudo apt-get install ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

## Install

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## Service management

```bash
sudo systemctl start docker
sudo systemctl restart docker      # applies changes to daemon.json
sudo systemctl status docker
sudo systemctl enable docker       # must survive a reboot

journalctl -u docker -f            # first place to look when containers won't start
```

## Log rotation

Container logs grow until the disk fills. Set this before the server sees real
traffic, not after.

`/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

Then `sudo systemctl restart docker`.

## Running without sudo

```bash
sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker                      # apply without logging out

# If permission is still denied and Docker came from snap
sudo snap disable docker && sudo snap enable docker && newgrp docker
```

Group membership is equivalent to root on the host. On a production box, prefer
`sudo` per command, or rootless mode, so a container escape does not become
host root.

Docker also writes its own iptables rules and bypasses UFW, so a port published
with `-p` is reachable from the internet even when UFW claims to deny it.
