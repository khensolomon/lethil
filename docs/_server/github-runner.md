---
title: "Self-hosted runner"
description: "Running the GitHub Actions runner on the VM, with Docker access."
group: "Automation"
category: "Server"
nav_order: 9
tags: [server, ci, docker]
---

Lets a workflow deploy without exposing SSH, since the runner dials out.

## Install as a service

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

## Give the runner Docker access

The runner usually runs as its own user, not the account used to log in.

```bash
# Find the user the runner runs as
ps aux | grep Runner.Listener | head -1 | awk '{print $1}'

sudo usermod -aG docker <that-user>

# Restart so the new group membership is picked up
sudo systemctl restart actions.runner.*.service
```

Group membership is only re-read at process start — restarting the runner is
what actually applies it.
