---
title: "GNOME"
description: "GNOME guide"
group: "Desktop"
category: "Linux"
nav_order: 4
tags: [gnome]
---

## logo and wallpaper

```bash
# 1. Change/Remove the logo via native GSettings
sudo gsettings set org.gnome.login-screen logo '/path/to/logo.png'

# 2. Update system dconf database
sudo dconf update
```

## GNOME extensions cli

```bash
gnome-extensions enable uuid
gnome-extensions disable uuid
gnome-extensions uninstall uuid
gnome-extensions prefs uuid

gnome-extensions install --force hornbill@lethil.me.shell-extension.zip
```
