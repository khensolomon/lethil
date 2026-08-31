---
title: "Utility"
description: "guide"
category: "linux"
nav_order: 4
in_nav: true
tags: [utility, customization, UI]
---

## ABC

```bash
# Make the Python ABC executable:
chmod +x ABC.py

# Run it as a normal user:
./ABC.py
```

## placing ABC.py into system binary path (/usr/local/bin) so it runs anywhere as 'ABC'?

```bash
# Move the ABC to /usr/local/bin and rename it:
sudo cp ABC.py /usr/local/bin/ABC

# Grant execution permissions:
sudo chmod +x /usr/local/bin/ABC

# Verify ownership:
sudo chown root:root /usr/local/bin/ABC
# Now run ABC from any directory in terminal.
```

## Clickable Desktop Shortcut for non-terminal users

```bash
[Desktop Entry]
Type=Application
Name=GDM ABC Customizer
Comment=Customize Ubuntu Login Logo and Wallpaper
Exec=gnome-terminal -- /usr/local/bin/ABC
Icon=preferences-desktop-wallpaper
Terminal=false
Categories=Utility;Settings;
```
