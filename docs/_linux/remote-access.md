---
title: "Remote access"
description: "SSH, RDP and VNC into a desktop machine, plus Remmina permissions."
group: "Remote & VMs"
category: "Linux"
nav_order: 5
tags: [ssh, remote]
---

## SSH server

```bash
sudo apt install openssh-server
sudo systemctl enable --now ssh
sudo ufw allow ssh

ssh <user>@<host>
```

Key setup is in [[Cloudflare Access]]; for reaching a host with no open port,
use the tunnel rather than forwarding 22.

## Keys

```bash
ssh-keygen -t ed25519 -C "name@domain.com"

eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

cat ~/.ssh/id_ed25519.pub
```

## RDP

Preferred over VNC — faster over a slow link and it survives reconnects.

```bash
sudo apt install xrdp -y
sudo systemctl enable --now xrdp
sudo ufw allow from any to any port 3389 proto tcp
```

## VNC

Built into GNOME: Settings → System → Sharing → Remote Desktop. Enable
Desktop Sharing and Remote Control, then note the hostname, port, and generated
credentials.

## File sharing

```bash
sudo apt install gnome-user-share
# then browse to smb://<host>
```

## Remmina permissions

Snap confinement blocks these until connected explicitly.

```bash
sudo snap connect remmina:audio-record :audio-record
sudo snap connect remmina:avahi-observe :avahi-observe
sudo snap connect remmina:cups-control :cups-control
sudo snap connect remmina:mount-observe :mount-observe
sudo snap connect remmina:password-manager-service :password-manager-service
sudo snap connect remmina:ssh-keys :ssh-keys
sudo snap connect remmina:ssh-public-keys :ssh-public-keys
```
