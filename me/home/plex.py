#!/usr/bin/env python3
"""
Plex Media Server install — just Plex.

version: 26.06.06-4

    ./plex.py            # DRY RUN: prints every action, changes nothing
    ./plex.py --apply    # actually do it

Run as your NORMAL user (it self-sudoes per command). Do NOT run with `sudo`.

Part of the home-lab suite. Run order:  disks.py -> setup.py -> plex.py / transmission.py
This script does ONE thing now: install + enable Plex and open its own port.
Host concerns (static IP, SSH, RDP, firewall enable) live in setup.py; the
torrent daemon lives in transmission.py. Each service opens its own port; the
ufw *enable* is owned by setup.py.

changes:
  26.06.06-4  reduced to Plex-only: removed transmission config, SSH, GNOME RDP,
              static IP, and the firewall baseline (now in setup.py /
              transmission.py). Plex opens just its own 32400 rule.
  26.06.02-3  combined Plex + Transmission + RDP/SSH + static IP (superseded).
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

PLEX_PORT = 32400                # Plex web/API port
MANAGE_UFW = True                # add Plex's own ufw allow rule (setup.py enables ufw)

# Plex APT repo (current method: repo.plex.tv + v2 signing key)
PLEX_KEY_URL = "https://downloads.plex.tv/plex-keys/PlexSign.v2.key"
PLEX_KEYRING = "/etc/apt/keyrings/plexmediaserver.v2.gpg"
PLEX_LIST = "/etc/apt/sources.list.d/plex.list"
PLEX_REPO_LINE = (f"deb [signed-by={PLEX_KEYRING}] "
                  "https://repo.plex.tv/deb/ public main\n")

# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

APPLY = False


def run(cmd: list[str], *, check: bool = True, display: str | None = None) -> int:
    """Print a mutating command (or `display`) and execute when --apply."""
    print("  + " + (display if display is not None else " ".join(shlex.quote(c) for c in cmd)))
    if not APPLY:
        return 0
    return subprocess.run(cmd, check=check).returncode


def probe(cmd: list[str]) -> subprocess.CompletedProcess:
    """Read-only command, always executed (safe in dry-run)."""
    try:
        return subprocess.run(cmd, capture_output=True, text=True)
    except OSError as e:
        return subprocess.CompletedProcess(cmd, 1, "", str(e))


def sudo_write(path: str, content: str) -> None:
    print(f"  + write {path} (via sudo tee)")
    if APPLY:
        subprocess.run(["sudo", "tee", path], input=content, text=True,
                       stdout=subprocess.DEVNULL, check=True)


def header(title: str) -> None:
    print(f"\n== {title} ==")


def host_ip() -> str:
    out = probe(["hostname", "-I"]).stdout.split()
    return out[0] if out else "<this-host>"


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    global APPLY
    ap = argparse.ArgumentParser(description="Install + enable Plex Media Server.")
    ap.add_argument("--apply", action="store_true", help="perform changes (default: dry run)")
    ap.add_argument("--dry-run", action="store_true", help="explicit dry-run (the default)")
    APPLY = ap.parse_args().apply

    if os.geteuid() == 0:
        sys.exit("ERROR: run as your normal user, not with sudo. It elevates per-command.")

    if not APPLY:
        print("#" * 56)
        print("#  DRY RUN — nothing will change. Re-run with --apply   #")
        print("#" * 56)

    if APPLY:
        subprocess.run(["sudo", "-v"], check=True)  # cache sudo up front

    # 0. Plex APT repository
    header("0. Plex APT repository")
    if Path(PLEX_LIST).exists():
        print(f"  repo already present ({PLEX_LIST}) — skipping")
    else:
        run(["sudo", "install", "-d", "-m", "0755", "/etc/apt/keyrings"])
        run(["bash", "-c", f"curl -fsSL {PLEX_KEY_URL} | sudo gpg --yes --dearmor -o {PLEX_KEYRING}"],
            display=f"curl {PLEX_KEY_URL} | sudo gpg --dearmor -o {PLEX_KEYRING}")
        sudo_write(PLEX_LIST, PLEX_REPO_LINE)

    # 1. install Plex
    header("1. Install Plex")
    if probe(["dpkg", "-s", "plexmediaserver"]).returncode == 0:
        print("  plexmediaserver already installed")
    else:
        run(["sudo", "apt-get", "update"])
        run(["sudo", "DEBIAN_FRONTEND=noninteractive", "apt-get", "install", "-y",
             "plexmediaserver"],
            display="sudo DEBIAN_FRONTEND=noninteractive apt-get install -y plexmediaserver")

    # 2. enable + start
    header("2. Enable Plex service")
    run(["sudo", "systemctl", "enable", "--now", "plexmediaserver"])

    # 3. Plex's own firewall rule (setup.py owns installing + enabling ufw)
    header("3. Firewall (Plex's own port)")
    if not MANAGE_UFW:
        print("  ufw management disabled in CONFIG")
    elif not shutil.which("ufw"):
        print("  ufw not installed yet — run setup.py first; skipping Plex rule")
    else:
        run(["sudo", "ufw", "allow", f"{PLEX_PORT}/tcp"])
        print("  (if ufw is inactive, this rule takes effect when setup.py enables it)")

    host = host_ip()
    print(f"\n=== Done ({'APPLIED' if APPLY else 'DRY RUN'}) ===")
    print(f"  Plex:  http://{host}:{PLEX_PORT}/web")
    print("  First launch: open that URL on the LAN to claim/sign in to the server.")
    if not APPLY:
        print("\nReview the '+' lines above, then re-run with --apply.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nAborted.")
        raise SystemExit(130)