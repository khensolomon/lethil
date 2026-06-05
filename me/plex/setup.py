#!/usr/bin/env python3
"""
Media-server setup — Plex + Transmission, static IP, remote desktop (RDP) + SSH.

    ./setup.py            # DRY RUN: prints every action, changes nothing
    ./setup.py --apply    # actually do it

Run as your NORMAL user (it self-sudoes). Do NOT run with `sudo`.

Companion to disks.py (run disks.py first so the media pool exists).

What it does, in order:
  Phase 0  Add the Plex APT repo (fast, no lock).
  Phase 1  Kick off ONE background apt install: plex, transmission, ssh, GNOME RDP.
  Phase 2  CONCURRENTLY (no apt, no live network disruption):
             - detect the active NetworkManager connection + gateway
             - WRITE the static-IP profile (does NOT activate it yet)
             - add firewall rules
  Phase 3  Wait for the install to finish.
  Phase 4  Enable services that needed the new packages: SSH, Plex, Transmission.
  Phase 5  Configure + enable GNOME Remote Desktop (system/headless RDP).
  Phase 6  LAST: activate the static IP (the one disruptive step) + verify.

Tested target: Ubuntu 24.04 / GNOME 46 (matches your `lsblk`/snap layout).
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import secrets
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIG — edit to taste
# ---------------------------------------------------------------------------

# Networking ----------------------------------------------------------------
STATIC_IP = "192.168.1.50"      # must be OUTSIDE the router's DHCP pool
PREFIX = 24                     # /24 = 255.255.255.0
GATEWAY = ""                    # blank = auto-detect from default route
DNS = ""                        # blank = auto (gateway + 1.1.1.1)

# Packages ------------------------------------------------------------------
# transmission-daemon = headless daemon + web UI on :9091 (right choice for a
# media box). Swap for "transmission-gtk" if you want the desktop GUI instead.
APT_PACKAGES = [
    "plexmediaserver",
    "transmission-daemon",
    "openssh-server",
    "gnome-remote-desktop",
    "winpr-utils",       # provides winpr-makecert for the RDP TLS cert
    "ufw",
]

# Remote Desktop (GNOME native RDP) -----------------------------------------
GRD_DIR = "/var/lib/gnome-remote-desktop/.local/share/gnome-remote-desktop"
# In GNOME's --system (remote-login) mode the RDP username/password are a fixed
# "door code" to reach the GDM greeter -- they are NOT your account login and
# CANNOT be derived from your system password (the stored hash isn't reversible,
# and GRD doesn't authenticate the door against PAM). You log in at the greeter
# as your real user afterwards. So the door username is set to the CURRENT USER
# automatically, and the door password is, by default, GENERATED once.
#   RDP_PASSWORD_MODE: "generate" -> random strong code, saved to RDP_CRED_FILE
#                      "prompt"   -> ask once via getpass
#                      "env"      -> read RDP_PASSWORD from the environment
RDP_PASSWORD_MODE = "prompt"
RDP_CRED_FILE = os.path.expanduser("~/rdp-credentials.txt")

# Transmission --------------------------------------------------------------
TRANSMISSION_LAN_ACCESS = True                 # allow the LAN to reach :9091
TRANSMISSION_WHITELIST = "127.0.0.1,192.168.1.*"
TRANSMISSION_DOWNLOAD_DIR = ""                 # e.g. "/mnt/virtual_pool/Downloads"

# Firewall ------------------------------------------------------------------
ENABLE_FIREWALL = True          # allow rules added first, then `ufw enable`
PORTS = {                       # service -> tcp port (for ufw + docs)
    "ssh": 22,
    "plex": 32400,
    "rdp": 3389,
    "transmission": 9091,
}

# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

APPLY = False


def run(cmd: list[str], *, check: bool = True, display: str | None = None) -> int:
    """Print a mutating command (or `display` override) and execute when --apply."""
    print("  + " + (display if display is not None else " ".join(shlex.quote(c) for c in cmd)))
    if not APPLY:
        return 0
    return subprocess.run(cmd, check=check).returncode


def background(cmd_str: str):
    """Start a long command in the background; return Popen (or None in dry-run)."""
    print("  & " + cmd_str + "   (runs in the background)")
    if not APPLY:
        return None
    return subprocess.Popen(["bash", "-c", cmd_str])


def probe(cmd: list[str]) -> subprocess.CompletedProcess:
    """Read-only command, always executed (safe in dry-run)."""
    try:
        return subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        return subprocess.CompletedProcess(cmd, 1, "", "not found")


def sudo_write(path: str, content: str) -> None:
    print(f"  + write {path} (via sudo tee)")
    if APPLY:
        subprocess.run(["sudo", "tee", path], input=content, text=True,
                       stdout=subprocess.DEVNULL, check=True)


def header(title: str) -> None:
    print(f"\n== {title} ==")


def detect_connection() -> tuple[str, str]:
    """Return (nm_connection_name, device) for the active wired/wifi link."""
    out = probe(["nmcli", "-t", "-f", "NAME,DEVICE,TYPE,STATE",
                 "connection", "show", "--active"]).stdout
    wired, other = None, None
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) < 4:
            continue
        name, dev, ctype, state = parts[0], parts[1], parts[2], parts[3]
        if state != "activated":
            continue
        if "ethernet" in ctype:
            wired = (name, dev)
        elif "wireless" in ctype or "wifi" in ctype:
            other = (name, dev)
    return wired or other or ("", "")


def detect_gateway() -> str:
    if GATEWAY:
        return GATEWAY
    out = probe(["ip", "-4", "route", "show", "default"]).stdout.split()
    if "via" in out:
        return out[out.index("via") + 1]
    # fallback: assume .1 on the same /24 as STATIC_IP
    return ".".join(STATIC_IP.split(".")[:3] + ["1"])


def resolve_rdp_password() -> str:
    """Return the door-code password according to RDP_PASSWORD_MODE."""
    if RDP_PASSWORD_MODE == "env":
        return os.environ.get("RDP_PASSWORD", "")
    if RDP_PASSWORD_MODE == "prompt":
        return getpass.getpass("  RDP door password: ") if APPLY else ""
    # default: generate
    return secrets.token_urlsafe(18) if APPLY else "<generated-on-apply>"


def set_rdp_credentials(user: str, password: str) -> None:
    """Feed username+password to grdctl via stdin so they never hit argv/ps."""
    print("  + sudo grdctl --system rdp set-credentials  (username+password via stdin)")
    if APPLY:
        subprocess.run(["sudo", "grdctl", "--system", "rdp", "set-credentials"],
                       input=f"{user}\n{password}\n", text=True, check=True)


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def main() -> int:
    global APPLY
    ap = argparse.ArgumentParser(description="Set up Plex + Transmission + RDP/SSH + static IP.")
    ap.add_argument("--apply", action="store_true", help="perform changes (default: dry run)")
    APPLY = ap.parse_args().apply

    if os.geteuid() == 0:
        sys.exit("ERROR: run as your normal user, not with sudo. It elevates per-command.")

    if not APPLY:
        print("#" * 56)
        print("#  DRY RUN — nothing will change. Re-run with --apply   #")
        print("#" * 56)

    user = os.environ.get("USER") or getpass.getuser()
    conn, dev = detect_connection()
    gw = detect_gateway()
    dns = DNS or f"{gw},1.1.1.1"
    rdp_user = user   # door username = current user (cosmetic; you log in as yourself at GDM)

    print(f"\nUser:          {user}")
    print(f"Connection:    {conn or '??? (could not detect — set it in CONFIG)'} on {dev or '???'}")
    print(f"Static IP:     {STATIC_IP}/{PREFIX}  gw {gw}  dns {dns}")
    print(f"Packages:      {', '.join(APT_PACKAGES)}")

    if APPLY:
        # cache sudo once so background + foreground don't fight over prompts
        subprocess.run(["sudo", "-v"], check=True)

    # --- Phase 0: Plex repo (current method per Plex support: repo.plex.tv + v2 key)
    header("Phase 0: Plex APT repository")
    if Path("/etc/apt/sources.list.d/plex.list").exists():
        print("  Plex repo already present — skipping")
    else:
        run(["sudo", "install", "-d", "-m", "0755", "/etc/apt/keyrings"])
        run(["bash", "-c",
             "curl -fsSL https://downloads.plex.tv/plex-keys/PlexSign.v2.key "
             "| sudo gpg --yes --dearmor -o /etc/apt/keyrings/plexmediaserver.v2.gpg"],
            display="curl PlexSign.v2.key | sudo gpg --dearmor -o /etc/apt/keyrings/plexmediaserver.v2.gpg")
        sudo_write("/etc/apt/sources.list.d/plex.list",
                   "deb [signed-by=/etc/apt/keyrings/plexmediaserver.v2.gpg] "
                   "https://repo.plex.tv/deb/ public main\n")

    # --- Phase 1: kick off the install in the background
    header("Phase 1: install packages (background)")
    install_cmd = ("sudo apt-get update && "
                   "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "
                   + " ".join(APT_PACKAGES))
    proc = background(install_cmd)

    # --- Phase 2: concurrent, non-apt, non-disruptive prep
    header("Phase 2: network profile + firewall (concurrent with install)")
    if conn:
        # con mod only WRITES the profile; the live IP does not change yet.
        run(["sudo", "nmcli", "connection", "modify", conn,
             "ipv4.addresses", f"{STATIC_IP}/{PREFIX}",
             "ipv4.gateway", gw,
             "ipv4.dns", dns,
             "ipv4.method", "manual"])
    else:
        print("  !! No active connection detected — set the name in CONFIG and re-run.")

    if ENABLE_FIREWALL:
        # allow SSH FIRST so enabling ufw can't lock you out
        run(["sudo", "ufw", "allow", f"{PORTS['ssh']}/tcp"])
        for svc in ("plex", "rdp", "transmission"):
            run(["sudo", "ufw", "allow", f"{PORTS[svc]}/tcp"])
        run(["sudo", "ufw", "--force", "enable"])

    # --- Phase 3: wait for the install to finish
    header("Phase 3: wait for install to complete")
    if proc is not None:
        rc = proc.wait()
        if rc != 0:
            sys.exit(f"apt install failed (exit {rc}); aborting before service config.")
        print("  install finished OK")
    else:
        print("  (dry run — install would be awaited here)")

    # --- Phase 4: services that needed the packages
    header("Phase 4: enable SSH / Plex / Transmission")
    run(["sudo", "systemctl", "enable", "--now", "ssh"])
    run(["sudo", "systemctl", "enable", "--now", "plexmediaserver"])

    # Transmission: the daemon rewrites settings.json on stop, so STOP, edit, START.
    if TRANSMISSION_LAN_ACCESS or TRANSMISSION_DOWNLOAD_DIR:
        settings = "/etc/transmission-daemon/settings.json"
        run(["sudo", "systemctl", "stop", "transmission-daemon"], check=False)
        changes = {}
        if TRANSMISSION_LAN_ACCESS:
            changes.update({
                "rpc-whitelist": TRANSMISSION_WHITELIST,
                "rpc-whitelist-enabled": True,
                "rpc-host-whitelist-enabled": False,
            })
        if TRANSMISSION_DOWNLOAD_DIR:
            changes["download-dir"] = TRANSMISSION_DOWNLOAD_DIR
        if APPLY:
            raw = subprocess.run(["sudo", "cat", settings], capture_output=True, text=True)
            data = json.loads(raw.stdout) if raw.returncode == 0 and raw.stdout.strip() else {}
            data.update(changes)
            sudo_write(settings, json.dumps(data, indent=4) + "\n")
        else:
            print(f"  + edit {settings}: {json.dumps(changes)}")
        run(["sudo", "systemctl", "enable", "--now", "transmission-daemon"])
    else:
        run(["sudo", "systemctl", "enable", "--now", "transmission-daemon"])

    # --- Phase 5: GNOME Remote Desktop (system / headless RDP, GNOME 46+)
    header("Phase 5: GNOME Remote Desktop (RDP)")
    rdp_pass = resolve_rdp_password()
    # TLS cert/key generated as the gnome-remote-desktop user
    run(["sudo", "-u", "gnome-remote-desktop", "mkdir", "-p", GRD_DIR])
    run(["sudo", "-u", "gnome-remote-desktop", "winpr-makecert",
         "-silent", "-rdp", "-path", GRD_DIR, "tls"])
    run(["sudo", "grdctl", "--system", "rdp", "set-tls-cert", f"{GRD_DIR}/tls.crt"])
    run(["sudo", "grdctl", "--system", "rdp", "set-tls-key", f"{GRD_DIR}/tls.key"])
    set_rdp_credentials(rdp_user, rdp_pass)
    run(["sudo", "grdctl", "--system", "rdp", "enable"])
    run(["sudo", "systemctl", "enable", "--now", "gnome-remote-desktop.service"])
    print("  verify later with:  sudo grdctl --system status")

    # If we generated the door code, stash it (0600) so it isn't lost.
    if RDP_PASSWORD_MODE == "generate":
        note = (f"RDP door credentials (the outer gate to the GDM greeter):\n"
                f"  host:     {STATIC_IP}:{PORTS['rdp']}\n"
                f"  username: {rdp_user}\n"
                f"  password: {rdp_pass}\n"
                f"At the greeter, log in as your real account '{user}'.\n")
        print(f"  + write {RDP_CRED_FILE} (mode 600) with the generated door code")
        if APPLY:
            Path(RDP_CRED_FILE).write_text(note)
            os.chmod(RDP_CRED_FILE, 0o600)
            print("\n  ---- RDP door code (also saved to "
                  f"{RDP_CRED_FILE}) ----")
            print("  " + note.replace("\n", "\n  "))

    # --- Phase 6: activate the static IP LAST (disruptive)
    header("Phase 6: activate static IP (connection will briefly drop)")
    if conn:
        print("  !! If you are connected remotely, your session will drop now and")
        print(f"     you must reconnect at {STATIC_IP}.")
        run(["sudo", "nmcli", "connection", "up", conn])
        if APPLY:
            print("  current addresses:")
            subprocess.run(["ip", "-4", "-br", "addr", "show", dev], check=False)
    else:
        print("  skipped (no connection detected)")

    print(f"\n=== Done ({'APPLIED' if APPLY else 'DRY RUN'}) ===")
    print("Reach your services at:")
    print(f"  Plex:          http://{STATIC_IP}:{PORTS['plex']}/web")
    print(f"  Transmission:  http://{STATIC_IP}:{PORTS['transmission']}/")
    print(f"  RDP:           {STATIC_IP}:{PORTS['rdp']}   (user '{rdp_user}')")
    print(f"  SSH:           ssh {user}@{STATIC_IP}")
    if not APPLY:
        print("\nReview the '+' / '&' lines above, then re-run with --apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())