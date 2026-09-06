---
title: "Disposable Linux subsystems"
description: "Finding a WSL-like workflow on a Linux desktop — isolated, disposable, easy to tear down."
category: "Todo"
status: "planned"
nav_order: 4
tags: [containers, vm, tooling]
---

The goal is a WSL-style workflow on an Ubuntu or Debian desktop: an isolated,
disposable environment that is quick to create, inspect, update, and remove.
The shell is already Linux, so the missing part is isolation and lifecycle
management, not the terminal.

## Options to compare

- [ ] **Distrobox / Toolbx** — containers that feel like a normal shell, with
      home directory passthrough
- [ ] **systemd-nspawn** — lighter than a VM, heavier isolation than a container
- [ ] **LXD system containers** — full init, closest to a small VM
- [ ] **[[Multipass]]** — already in use, but a real VM per environment
- [ ] **Plain Docker** — fine for services, awkward as a workspace

## Deciding on

- [ ] Startup cost and disk footprint per environment
- [ ] Whether GUI applications need to work
- [ ] How cleanly an environment can be destroyed and recreated
