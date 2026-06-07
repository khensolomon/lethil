# me/

Scripts that run **on the operator's machine** — laptop, workstation. Not the server.

These act on the local environment: creating VMs, building ISOs, helping with local dev. Its never dispatched by GitHub Actions because it need access to the local resources (libvirt, hypervisor, USB drives, etc.).

- [fetch.py][fetch] — Fetch - a small, dependency-free file downloader.
- [netplan_static.py][netplan_static]  — Netplan Static Address Helper
- [setup.py][setup] — Docker Production Installation & Nginx Proxy Manager Setup
- [create.py][secrets] — Project-Aware GitHub Secrets Manager
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
# Download script only:
python3 -c "import urllib.request; open('fetch.py','wb').write(urllib.request.urlopen('https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/fetch.py').read())"

# Save & launch:
python3 -c "import urllib.request,os; u='https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/fetch.py'; d=urllib.request.urlopen(u).read(); open('fetch.py','wb').write(d); os.chmod('fetch.py',0o755); os.system('./fetch.py')"

# Ghost / in-memory (executes remote code without touching disk — only run code you trust):
python3 -c "import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/fetch.py').read().decode('utf-8'))"
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
[secrets]: secrets.py "Project-Aware GitHub Secrets Manager"

[vm]: vm/create.py "Ubuntu Cloud VM Manager"
[iso_build]: iso/build.py "isobuilder"
[ubuntu_desktop]: dev/ubuntu_desktop.py "isobuilder"

[media_setup]: media/setup.py "setup"
[media_disks]: media/disks.py "disks"
[media_plex]: media/plex.py "plex"
[media_transmission]: media/transmission.py "transmission"
