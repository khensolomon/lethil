#!/usr/bin/env python3
"""
Host setup — base server layer: static IP (netplan), SSH, GNOME RDP, firewall.

version: 26.06.06-1

    ./setup.py            # DRY RUN: prints every action, changes nothing
    ./setup.py --apply    # prompt for each value (Enter = default), then commit

Run as your NORMAL user (it self-sudoes per command). Do NOT run with `sudo`.

Part of the home-lab suite. Run order:  disks.py -> setup.py -> plex.py / transmission.py
This script is the HOST layer only: it does NOT install Plex or Transmission.
Each service script opens its own firewall ports; setup.py owns the risky bit
(allow SSH first, then enable ufw) plus the RDP rule.

What it does, in order:
  1. install base packages (ssh, gnome-remote-desktop, winpr-utils, ufw)
  2. enable SSH
  3. firewall baseline: allow SSH + RDP, then enable ufw
  4. GNOME Remote Desktop (system / headless RDP)
  5. LAST: static IP via netplan — detects every physical NIC + wifi, prompts
     per device, applies with `netplan try` (auto-reverts if you get locked out)

Tested target: Ubuntu 24.04 / GNOME 46. Stdlib only (no PyYAML dependency).
"""

from __future__ import annotations

import argparse
import getpass
import os
import secrets
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIG — defaults; on --apply each is offered as a prompt (Enter accepts it)
# ---------------------------------------------------------------------------

# Network -------------------------------------------------------------------
PREFIX = 24                      # /24 = 255.255.255.0
GATEWAY = ""                     # blank = auto-detect from the default route
DNS = ""                         # blank = auto (gateway + 1.1.1.1)
NETPLAN_FILE = "/etc/netplan/90-setup.yaml"
NETPLAN_RENDERER = ""            # blank = auto-detect (NetworkManager vs networkd)

# Packages (host layer only — no plex, no transmission) ----------------------
APT_PACKAGES = [
    "openssh-server",
    "gnome-remote-desktop",
    "winpr-utils",               # winpr-makecert for the RDP TLS cert
    "ufw",
]

# Remote Desktop (GNOME native RDP) -----------------------------------------
GRD_DIR = "/var/lib/gnome-remote-desktop/.local/share/gnome-remote-desktop"
# In GNOME's --system (remote-login) mode the RDP user/password are a fixed
# "door code" to reach the GDM greeter — NOT your account login. You log in as
# your real user at the greeter afterward.
#   "prompt"   -> ask once via getpass
#   "generate" -> random strong code, saved to RDP_CRED_FILE (mode 600)
#   "env"      -> read RDP_PASSWORD from the environment
RDP_PASSWORD_MODE = "prompt"
RDP_CRED_FILE = os.path.expanduser("~/rdp-credentials.txt")

# Firewall ------------------------------------------------------------------
ENABLE_FIREWALL = True
# Ports OWNED by this host script. Plex (32400) and Transmission (9091 + peer)
# are opened by their own scripts, by design.
PORTS = {"ssh": 22, "rdp": 3389}

# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

APPLY = False
INTERACTIVE = False  # set True on --apply: prompts; else uses CONFIG defaults


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


def ts() -> str:
    from datetime import datetime
    return datetime.now().strftime("%Y%m%d%H%M%S")


def header(title: str) -> None:
    print(f"\n== {title} ==")


# ---- prompts (return the default unless --apply) ---------------------------

def ask(text, default):
    if not INTERACTIVE:
        return default
    shown = "" if default is None else str(default)
    r = input(f"{text} [{shown}]: ").strip()
    return r if r else default


def ask_bool(text, default):
    if not INTERACTIVE:
        return default
    d = "Y/n" if default else "y/N"
    r = input(f"{text} ({d}): ").strip().lower()
    if not r:
        return default
    return r in ("y", "yes", "true", "1")


def ask_secret(text):
    if not INTERACTIVE:
        return ""
    return getpass.getpass(text + ": ")


# ---- network discovery -----------------------------------------------------

def list_net_devices() -> list[tuple[str, str]]:
    """Physical interfaces only: [(name, 'ethernet'|'wifi'), ...].
    Skips lo and virtual devices (docker/veth/bridges have no /device link)."""
    devs = []
    base = Path("/sys/class/net")
    if not base.is_dir():
        return devs
    for p in sorted(base.iterdir()):
        name = p.name
        if name == "lo" or not (p / "device").exists():
            continue
        kind = "wifi" if (p / "wireless").exists() else "ethernet"
        devs.append((name, kind))
    return devs


def current_ip(dev: str) -> str:
    out = probe(["ip", "-4", "-o", "addr", "show", "dev", dev]).stdout
    for tok in out.split():
        if "/" in tok and tok.count(".") == 3:
            return tok  # e.g. "192.168.1.50/24"
    return ""


def default_route_dev() -> str:
    out = probe(["ip", "-4", "route", "show", "default"]).stdout.split()
    return out[out.index("dev") + 1] if "dev" in out else ""


def detect_gateway() -> str:
    if GATEWAY:
        return GATEWAY
    out = probe(["ip", "-4", "route", "show", "default"]).stdout.split()
    if "via" in out:
        return out[out.index("via") + 1]
    return ""


def detect_renderer() -> str:
    if NETPLAN_RENDERER:
        return NETPLAN_RENDERER
    if probe(["systemctl", "is-active", "NetworkManager"]).stdout.strip() == "active":
        return "NetworkManager"
    return "networkd"


def gather_network():
    """Ask per device whether to give it a static IP. Returns
    (configured_list, gateway, dns). One device is 'primary' and carries the
    default route + DNS (avoids multiple default routes on one subnet)."""
    primary_dev = default_route_dev()
    gw = detect_gateway()
    dns = DNS or (f"{gw},1.1.1.1" if gw else "1.1.1.1")
    configured = []

    for dev, kind in list_net_devices():
        cur = current_ip(dev)
        # default to configuring the device that currently has the default route
        if not ask_bool(f"Configure a static IP for {dev} ({kind})?", dev == primary_dev):
            print(f"  {dev}: left as-is (DHCP / unmanaged)")
            continue
        suggested = cur.split("/")[0] if cur else None
        addr = ask(f"  {dev} IPv4 address", suggested)
        if not addr:
            print(f"  {dev}: no address given — skipping")
            continue
        prefix = ask(f"  {dev} prefix", PREFIX)
        entry = {"dev": dev, "kind": kind, "addr": f"{addr}/{prefix}"}
        if kind == "wifi":
            entry["ssid"] = ask(f"  {dev} Wi-Fi SSID", None)
            entry["psk"] = ask_secret(f"  {dev} Wi-Fi password")
        configured.append(entry)

    if configured:
        default_primary = (primary_dev
                           if any(c["dev"] == primary_dev for c in configured)
                           else configured[0]["dev"])
        primary = (ask("Which device carries the default route + DNS?", default_primary)
                   if len(configured) > 1 else configured[0]["dev"])
        gw = ask("Gateway (for the primary device)", gw)
        dns = ask("DNS servers (comma-separated)", dns)
        for c in configured:
            c["primary"] = (c["dev"] == primary)
    return configured, gw, dns


def render_netplan_yaml(configured, gw, dns, renderer) -> str:
    """Hand-rendered netplan YAML (stdlib only — no PyYAML on the target)."""
    lines = ["network:", "  version: 2", f"  renderer: {renderer}"]

    def emit(devs, section):
        lines.append(f"  {section}:")
        for c in devs:
            lines.append(f"    {c['dev']}:")
            lines.append("      dhcp4: false")
            lines.append("      addresses:")
            lines.append(f"        - {c['addr']}")
            if c["kind"] == "wifi" and c.get("ssid"):
                lines.append("      access-points:")
                lines.append(f'        "{c["ssid"]}":')
                lines.append(f'          password: "{c.get("psk", "")}"')
            if c.get("primary"):
                lines.append("      routes:")
                lines.append("        - to: default")
                lines.append(f"          via: {gw}")
                addrs = ", ".join(d.strip() for d in dns.split(",") if d.strip())
                lines.append("      nameservers:")
                lines.append(f"        addresses: [{addrs}]")

    eth = [c for c in configured if c["kind"] == "ethernet"]
    wifi = [c for c in configured if c["kind"] == "wifi"]
    if eth:
        emit(eth, "ethernets")
    if wifi:
        emit(wifi, "wifis")
    return "\n".join(lines) + "\n"


# ---- RDP -------------------------------------------------------------------

def resolve_rdp_password() -> str:
    if RDP_PASSWORD_MODE == "env":
        return os.environ.get("RDP_PASSWORD", "")
    if RDP_PASSWORD_MODE == "prompt":
        return getpass.getpass("  RDP door password: ") if APPLY else ""
    return secrets.token_urlsafe(18) if APPLY else "<generated-on-apply>"


def set_rdp_credentials(user: str, password: str) -> None:
    """Feed username+password to grdctl via stdin so they never hit argv/ps."""
    print("  + sudo grdctl --system rdp set-credentials  (username+password via stdin)")
    if APPLY:
        subprocess.run(["sudo", "grdctl", "--system", "rdp", "set-credentials"],
                       input=f"{user}\n{password}\n", text=True, check=True)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    global APPLY, INTERACTIVE
    ap = argparse.ArgumentParser(description="Host setup: static IP, SSH, RDP, firewall.")
    ap.add_argument("--apply", action="store_true",
                    help="prompt for each value (Enter = default), then commit")
    ap.add_argument("--dry-run", action="store_true", help="explicit dry-run (the default)")
    APPLY = ap.parse_args().apply
    INTERACTIVE = APPLY  # applying walks the prompts; bare run is a quiet preview

    if os.geteuid() == 0:
        sys.exit("ERROR: run as your normal user, not with sudo. It elevates per-command.")

    if not APPLY:
        print("#" * 56)
        print("#  DRY RUN — nothing will change. Re-run with --apply   #")
        print("#" * 56)

    user = os.environ.get("USER") or getpass.getuser()
    rdp_user = user  # door username = current user (you log in as yourself at GDM)

    header("0. Overview")
    print(f"  User: {user}")
    print("  Network devices detected:")
    droute = default_route_dev()
    for dev, kind in list_net_devices():
        tag = "  [default route]" if dev == droute else ""
        print(f"    {dev} ({kind})  current: {current_ip(dev) or 'none'}{tag}")
    print(f"  Packages: {', '.join(APT_PACKAGES)}")

    if APPLY:
        subprocess.run(["sudo", "-v"], check=True)  # cache sudo up front

    # 1. base packages
    header("1. Install base packages")
    missing = [p for p in APT_PACKAGES if probe(["dpkg", "-s", p]).returncode != 0]
    if not missing:
        print("  all base packages already installed")
    else:
        print(f"  installing: {', '.join(missing)}")
        run(["sudo", "apt-get", "update"])
        run(["sudo", "DEBIAN_FRONTEND=noninteractive", "apt-get", "install", "-y", *missing],
            display="sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "
                    + " ".join(missing))

    # 2. SSH
    header("2. SSH")
    run(["sudo", "systemctl", "enable", "--now", "ssh"])

    # 3. firewall baseline (allow SSH FIRST so enable can't lock you out)
    header("3. Firewall (allow SSH + RDP, then enable)")
    if ENABLE_FIREWALL:
        run(["sudo", "ufw", "allow", f"{PORTS['ssh']}/tcp"])
        run(["sudo", "ufw", "allow", f"{PORTS['rdp']}/tcp"])
        run(["sudo", "ufw", "--force", "enable"])
        print("  (Plex/Transmission open their own ports from their own scripts.)")
    else:
        print("  firewall management disabled in CONFIG")

    # 4. GNOME Remote Desktop (system / headless)
    header("4. GNOME Remote Desktop (RDP)")
    rdp_pass = resolve_rdp_password()
    run(["sudo", "-u", "gnome-remote-desktop", "mkdir", "-p", GRD_DIR])
    run(["sudo", "-u", "gnome-remote-desktop", "winpr-makecert",
         "-silent", "-rdp", "-path", GRD_DIR, "tls"])
    run(["sudo", "grdctl", "--system", "rdp", "set-tls-cert", f"{GRD_DIR}/tls.crt"])
    run(["sudo", "grdctl", "--system", "rdp", "set-tls-key", f"{GRD_DIR}/tls.key"])
    set_rdp_credentials(rdp_user, rdp_pass)
    run(["sudo", "grdctl", "--system", "rdp", "enable"])
    run(["sudo", "systemctl", "enable", "--now", "gnome-remote-desktop.service"])
    print("  verify later with:  sudo grdctl --system status")

    if RDP_PASSWORD_MODE == "generate":
        note = (f"RDP door credentials (outer gate to the GDM greeter):\n"
                f"  username: {rdp_user}\n  password: {rdp_pass}\n"
                f"At the greeter, log in as your real account '{user}'.\n")
        print(f"  + write {RDP_CRED_FILE} (mode 600) with the generated door code")
        if APPLY:
            Path(RDP_CRED_FILE).write_text(note)
            os.chmod(RDP_CRED_FILE, 0o600)
            print("  ---- generated RDP door code (saved to "
                  f"{RDP_CRED_FILE}) ----")
            print("  " + note.replace("\n", "\n  "))

    # 5. static IP via netplan — LAST (disruptive)
    header("5. Static IP via netplan (LAST — network may briefly drop)")
    configured, gw, dns = gather_network()
    primary_addr = ""
    if not configured:
        print("  no interfaces selected for static IP — networking left unchanged")
    else:
        renderer = detect_renderer()
        yaml_text = render_netplan_yaml(configured, gw, dns, renderer)
        primary_addr = next((c["addr"].split("/")[0] for c in configured
                             if c.get("primary")), configured[0]["addr"].split("/")[0])
        print(f"  netplan config ({NETPLAN_FILE}, renderer {renderer}):")
        for ln in yaml_text.splitlines():
            print(f"      {ln}")
        run(["sudo", "cp", "-a", "/etc/netplan", f"/etc/netplan.bak.{ts()}"])
        sudo_write(NETPLAN_FILE, yaml_text)
        run(["sudo", "chmod", "600", NETPLAN_FILE])  # netplan rejects world-readable
        run(["sudo", "netplan", "generate"])
        if APPLY and sys.stdin.isatty():
            print("  applying with `netplan try`: press ENTER to KEEP changes;")
            print("  if you get locked out, do nothing and it auto-reverts (~120s).")
            run(["sudo", "netplan", "try"])
        else:
            run(["sudo", "netplan", "apply"])

    host = primary_addr or "<this-host>"
    print(f"\n=== Done ({'APPLIED' if APPLY else 'DRY RUN'}) ===")
    print("Reach this host at:")
    print(f"  SSH:  ssh {user}@{host}")
    print(f"  RDP:  {host}:{PORTS['rdp']}   (door user '{rdp_user}')")
    print("Then run plex.py / transmission.py for the services.")
    if not APPLY:
        print("\nReview the '+' lines above, then re-run with --apply.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nAborted.")
        raise SystemExit(130)
    except EOFError:
        print("\nAborted (no input received).")
        raise SystemExit(130)