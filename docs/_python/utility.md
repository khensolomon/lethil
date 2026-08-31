---
title: "Utility"
description: "Shipping small CLI tools."
category: "Python"
nav_order: 1
in_nav: true
tags: [python, packaging, cli]
---

## XYZ

```bash
# Make the Python XYZ executable:
chmod +x XYZ.py

# Run it as a normal user:
./XYZ.py
```

## placing XYZ.py into system binary path (/usr/local/bin) so it runs anywhere as 'XYZ'?

```bash
# Move the XYZ to /usr/local/bin and rename it:
sudo cp XYZ.py /usr/local/bin/XYZ

# Grant execution permissions:
sudo chmod +x /usr/local/bin/XYZ

# Verify ownership:
sudo chown root:root /usr/local/bin/XYZ
# Now run XYZ from any directory in terminal.
```

---
thank you. lets make the script for actual requirement.
lets prompt,
if user want to change logo wallpaper or both then lets show the default path/file and provide input for a new file
check these new configuration like is the file exist, if it can be use, then apply accordingly like if no file or not an image file skip applying..

and its important that we have docstring of version (v{yy.mm.dd.change}) a short description, usage. and these content are also reflected as h, --help content..

do not use term like you, you, i, me, we, they, them etc... in the anywhere..