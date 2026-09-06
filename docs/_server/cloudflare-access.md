---
title: "Cloudflare Access"
description: "SSH through Access - interactive, CI, and short-lived certificates."
category: "Server"
nav_order: 5
tags: [server, cloudflare, ssh, access, ci]
---

Reaching a host that has no open port 22, over the tunnel from
[[Cloudflare Tunnel]].

## Interactive

`~/.ssh/config`:

```
Host ssh.example.com
    ProxyCommand cloudflared access ssh --hostname %h
    User <user>
    IdentityFile ~/.ssh/prod_server
```

```bash
cloudflared access login ssh.example.com
ssh ssh.example.com
```

## Non-interactive (CI)

A service token replaces the browser login.

```
Host ssh.example.com
    HostName ssh.example.com
    User <user>
    IdentityFile ~/.ssh/prod_server
    ProxyCommand cloudflared access ssh --hostname %h --id ${CF_ACCESS_CLIENT_ID} --secret ${CF_ACCESS_CLIENT_SECRET}
    StrictHostKeyChecking no
    UserKnownHostsFile=/dev/null
```

In a workflow the same two values come from repository secrets:

```
ProxyCommand cloudflared access ssh --hostname %h --id ${{ secrets.CF_ACCESS_CLIENT_ID }} --secret ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
```

Create the token from the API:

```bash
curl --request POST 'https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/access/service_tokens' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data-raw '{ "name": "droplet-service-token", "duration": "forever" }'
```

`duration: forever` never expires, so it has to be rotated by hand. Prefer a
fixed duration where the deploy cadence allows it.

## Short-lived certificates

Removes long-lived keys from the host entirely: Cloudflare signs a certificate
per session, and the host trusts the CA rather than individual keys.

Generate the SSH CA under Zero Trust -> Access controls -> Service credentials
-> SSH, then on the host write the CA public key to `/etc/ssh/cloudflare_ca.pub`:

```bash
sudo mkdir -p /etc/ssh
sudo nano /etc/ssh/cloudflare_ca.pub
# paste the full ssh-ed25519 CA key from the dashboard
```

Add to `/etc/ssh/sshd_config`:

```
TrustedUserCAKeys /etc/ssh/cloudflare_ca.pub
PubkeyAuthentication yes
```

```bash
sudo systemctl restart ssh
sudo grep -E "TrustedUserCAKeys|PubkeyAuthentication" /etc/ssh/sshd_config
```

## Disable password login

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

sudo sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

sudo systemctl restart ssh
```

Confirm key login works in a second terminal before closing the first.

## Deployment secrets

```
SERVER_HOSTNAME            # public IP, or `curl ifconfig.me` on the host
SERVER_USER                # `whoami` on the host
SSH_PRIVATE_KEY            # generated below
CF_SERVICE_TOKEN_ID
CF_SERVICE_TOKEN_SECRET
```

```bash
ssh-keygen -t ed25519 -C "github-actions"
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_ed25519          # paste into the SSH_PRIVATE_KEY secret
```

Use a dedicated key for CI, never a personal one, so it can be revoked on its
own.

## Copying keys to a host

```bash
ssh-copy-id -i ~/.ssh/prod_server.pub <user>@<VM_IP>
ssh -i ~/.ssh/prod_server <user>@<VM_IP>

scp -i ~/.ssh/prod_server setup.py root@<SERVER_IP>:/root/setup.py
```
