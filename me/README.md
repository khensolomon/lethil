# me/

Scripts that run **on the operator's machine** — laptop, workstation. Not the server.

These act on the local environment: creating VMs, building ISOs, helping with local dev. Its never dispatched by GitHub Actions because it need access to the local resources (libvirt, hypervisor, USB drives, etc.).

- [fetch.py][fetch] — Fetch - a small, dependency-free file downloader.
- [netplan_static.py][netplan_static]  — Netplan Static Address Helper
- [setup.py][setup] — Docker Production Installation & Nginx Proxy Manager Setup
- VM
  - [vm/create.py][vm] — create a local libvirt VM for testing
  - `user-data.yaml`
- ISO
  - [iso/build.py][iso_build] — isobuilder — unified autoinstall ISO builder for Linux distros.
  - `README.md`
- Media — Media server (plex, storage, backup)
  - [media/setup.py][media_setup] — Host setup — base server layer: static IP (netplan), SSH, GNOME RDP, firewall.
  - [media/disks.py][media_disks] — Plex media pool setup (MergerFS) — hardened, dry-run-first, extensible.
  - [media/plex.py][media_plex] — Plex Media Server install — just Plex.
  - [media/transmission.py][media_transmission] — interactive setup & configuration for transmission-daemon.
- DEV
  - [dev/ubuntu_desktop.py][ubuntu_desktop]  — Ubuntu Environment Interactive Setup Script

## How to

... `python3 me/<script>.py --help`

### Self-bootstrap one-liners

```bash

# 1. Download only:
python3 -c "import sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],u.split('/')[-1])" https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py

# 2. Save & launch:
python3 -c "import sys,os,urllib.request as r;r.urlretrieve(u:=sys.argv[1],f:=u.split('/')[-1]);os.system('python3 '+f)" https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py
# Save & launch — forwards argv[2:] to the saved file:
python3 -c "import os,sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],f:=u.split('/')[-1]);os.execv(sys.executable,[sys.executable,f,*sys.argv[2:]])" https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py --default --yes --output-dir ./bin

# 3. Ghost / in-memory (runs trusted code only):
python3 -c "import sys,urllib.request as r;exec(r.urlopen(sys.argv[1]).read())" https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py
# Ghost / in-memory — rewrites sys.argv, then exec:
python3 -c "import sys,urllib.request as r;c=r.urlopen(u:=sys.argv[1]).read();sys.argv=[u.split('/')[-1],*sys.argv[2:]];exec(c)" https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py https://example.com/a.py https://example.com/b.py



```

### Symlink to /usr/local/bin (Recommended for single scripts)

```bash
sudo ln -s /opt/scripts/test.py /usr/local/bin/pytest
# then "pytest" from anywhere to trigger the scripts.
```

### Add the folder to your PATH (Recommended for many scripts)

```bash
nano ~/.bashrc
export PATH="$PATH:/opt/scripts"
source ~/.bashrc
```

> The automation is run by hand, some scripts might need `sudo`.

## Why no workflows?

GitHub Actions runners are remote machines. They can't reach the local libvirt socket, the local hypervisor, or the local USB drives. Scripts in `me/` are the operator's responsibility — keep them in the repo for consistency, but don't try to wrap them in CI.

[fetch]: fetch.py "Fetch"
[netplan_static]: netplan_static.py "Netplan Static Address Helper"
[setup]: setup.py "Setup"

[vm]: vm/create.py "Ubuntu Cloud VM Manager"
[iso_build]: iso/build.py "isobuilder"
[ubuntu_desktop]: dev/ubuntu_desktop.py "isobuilder"

[media_setup]: media/setup.py "setup"
[media_disks]: media/disks.py "disks"
[media_plex]: media/plex.py "plex"
[media_transmission]: media/transmission.py "transmission"
