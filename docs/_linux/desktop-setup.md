---
title: "Desktop setup"
description: "Flatpak, Ventoy install media, and the post-reinstall app checklist."
group: "Desktop"
category: "Linux"
nav_order: 8
tags: [desktop]
---

## Flatpak

```bash
sudo apt install flatpak gnome-software-plugin-flatpak
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

## Node.js

```bash
sudo apt install -y curl ca-certificates gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
sudo chmod a+r /etc/apt/keyrings/nodesource.gpg

# NODE_MAJOR: 22, 24, … whichever LTS is current
NODE_MAJOR=22
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update && sudo apt install -y nodejs
```

The distribution's `nodejs` and `npm` packages are old and split awkwardly — use
NodeSource instead.

The old one-liner (`curl … setup_current.x | sudo -E bash -`) is deprecated:
it prints a deprecation banner, waits, and is slated to stop working. The repo
is now published under the `nodistro` codename, so one source line covers every
supported distribution and the version is chosen by `NODE_MAJOR` rather than by
the script name.

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
