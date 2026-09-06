---
title: "Desktop setup"
description: "Flatpak, Ventoy install media, and the post-reinstall app checklist."
category: "Linux"
nav_order: 8
tags: [flatpak, ventoy, desktop, iso]
---

## Flatpak

```bash
sudo apt install flatpak gnome-software-plugin-flatpak
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

## Node.js

```bash
sudo apt install curl -y
curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
sudo apt install nodejs -y
```

The distribution's `nodejs` and `npm` packages are old and split awkwardly — use
NodeSource instead.

## Ventoy

One USB stick, many ISOs — copy images on, no reflashing.

```bash
sudo ./VentoyGUI.x86_64
sudo bash VentoyPlugson.sh /dev/sdb

# Theme background lives at ventoy/theme/background.png (1024x768 or 1920x1080)

rsync -ah --progress /path/to/os.iso /media/<user>/Ventoy
```

## Firmware

```bash
sudo apt install firmware-b43-installer   # Broadcom wireless
```

## Post-reinstall checklist

- Editors — VS Code, Obsidian
- Graphics — Inkscape, GIMP
- Database — HeidiSQL, DBeaver CE, SQLite Browser
- Audio tagging — Picard, Kid3, EasyTag, PuddleTag, Mp3Tag
- Audio editing — Audacity, fre:ac
- Remote — Remmina
- Containers — Docker, see [[Docker installation]]
