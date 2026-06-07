#!/usr/bin/env python3
"""
Netplan Static Address Helper
version: 26.06.07-2
Features:
  - Detects every physical wired and wireless network device on Ubuntu or Debian.
  - Hides virtual interfaces (Docker bridges, veth, libvirt, VLANs, loopback) so
    container hosts and virtualization hosts stay untouched.
  - Prompts per device whether to assign a static address; skips the address
    prompt for any device left on automatic.
  - Suggests sensible values taken from the live system (current address, gateway,
    DNS) and corrects common mistakes such as a missing prefix length or a wrong
    subnet (for example 192.169.1.50 when the network is 192.168.1.0/24).
  - Warns when the chosen address already answers on the network.
  - Writes one managed file (/etc/netplan/90-static.yaml) and updates it in place,
    so repeated runs only adjust preferences instead of duplicating entries.
  - Backs up existing netplan files before any change and restricts the managed
    file to owner-only permissions.
  - Previews changes by default and applies only with --apply, using 'netplan try'
    so a faulty setting rolls back on its own.
  - Removes or restores the managed file when an apply is not confirmed, so a
    later reboot never re-applies a rejected configuration.
Usage:
  Preview detected devices and planned changes:
    sudo python3 netplan_static.py
  Apply the chosen configuration with automatic rollback:
    sudo python3 netplan_static.py --apply
  List detected devices and exit:
    sudo python3 netplan_static.py --list
  Return a chosen device to automatic (DHCP):
    sudo python3 netplan_static.py --revert --apply
"""

import argparse
import datetime
import ipaddress
import json
import os
import shutil
import subprocess
import sys

__version__ = "26.06.07-2"

MANAGED_FILE = "/etc/netplan/90-static.yaml"
SYS_NET = "/sys/class/net"
DEFAULT_PREFIX = 24
FALLBACK_DNS = ["1.1.1.1", "9.9.9.9"]


# --------------------------------------------------------------------------- #
# Small process / IO helpers
# --------------------------------------------------------------------------- #
def run(cmd, check=False):
    """Run a command, returning (returncode, stdout, stderr) as text."""
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} failed: {proc.stderr.strip()}")
    return proc.returncode, proc.stdout, proc.stderr


def have(tool):
    """Report whether an executable exists on PATH."""
    return shutil.which(tool) is not None


def ask(prompt, default=None):
    """Prompt for a line of input, returning the default on an empty answer."""
    suffix = f" [{default}]" if default else ""
    answer = input(f"{prompt}{suffix}: ").strip()
    return answer or (default or "")


def ask_yes(prompt, default_no=True):
    """Prompt for a yes/no answer."""
    hint = "[y/N]" if default_no else "[Y/n]"
    answer = input(f"{prompt} {hint}: ").strip().lower()
    if not answer:
        return not default_no
    return answer in ("y", "yes")


# --------------------------------------------------------------------------- #
# Interface detection (sysfs based, no external parsing needed)
# --------------------------------------------------------------------------- #
def is_virtual(iface):
    """Report whether an interface is software-defined (Docker, veth, libvirt...)."""
    link = os.path.join(SYS_NET, iface)
    target = os.path.realpath(link)
    return os.sep + "virtual" + os.sep in target


def is_wireless(iface):
    """Report whether an interface is a wireless device."""
    base = os.path.join(SYS_NET, iface)
    return os.path.isdir(os.path.join(base, "wireless")) or os.path.exists(
        os.path.join(base, "phy80211")
    )


def read_first_line(path, default=""):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return default


def detect_interfaces():
    """Return physical interfaces as a list of dicts, sorted by name.

    Each dict holds: name, kind ('ethernet'/'wifi'), mac, carrier (link state),
    current address (ip/prefix or None), and gateway (or None).
    """
    devices = []
    for iface in sorted(os.listdir(SYS_NET)):
        if iface == "lo" or is_virtual(iface):
            continue
        base = os.path.join(SYS_NET, iface)
        carrier = read_first_line(os.path.join(base, "carrier"), "0") == "1"
        devices.append(
            {
                "name": iface,
                "kind": "wifi" if is_wireless(iface) else "ethernet",
                "mac": read_first_line(os.path.join(base, "address"), "??"),
                "carrier": carrier,
                "address": current_address(iface),
                "gateway": current_gateway(iface),
            }
        )
    return devices


def _ip_json(args):
    """Return parsed JSON from an 'ip -j ...' call, or None when unavailable."""
    if not have("ip"):
        return None
    code, out, _ = run(["ip", "-j"] + args)
    if code != 0 or not out.strip():
        return None
    try:
        return json.loads(out)
    except ValueError:
        return None


def current_address(iface):
    """Return the first IPv4 'address/prefix' on an interface, or None."""
    data = _ip_json(["addr", "show", "dev", iface]) or []
    for entry in data:
        for addr in entry.get("addr_info", []):
            if addr.get("family") == "inet":
                return f"{addr['local']}/{addr['prefixlen']}"
    return None


def current_gateway(iface):
    """Return the default-route gateway reachable through an interface, or None."""
    for route in _ip_json(["route", "show", "default"]) or []:
        if route.get("dev") == iface and route.get("gateway"):
            return route["gateway"]
    # Fall back to any default gateway when none is pinned to this interface.
    for route in _ip_json(["route", "show", "default"]) or []:
        if route.get("gateway"):
            return route["gateway"]
    return None


def suggested_dns():
    """Return DNS suggestions from /etc/resolv.conf, ignoring the local stub."""
    found = []
    for line in read_resolv():
        parts = line.split()
        if len(parts) >= 2 and parts[0] == "nameserver":
            ip = parts[1]
            if not ip.startswith("127."):
                found.append(ip)
    return found or FALLBACK_DNS


def read_resolv():
    try:
        with open("/etc/resolv.conf", "r", encoding="utf-8") as f:
            return f.readlines()
    except OSError:
        return []


# --------------------------------------------------------------------------- #
# Address validation, correction and suggestion
# --------------------------------------------------------------------------- #
def normalize_address(raw, gateway=None, default_prefix=DEFAULT_PREFIX):
    """Validate and tidy an entered IPv4 address.

    Returns (interface_obj, notes). interface_obj is an ipaddress.IPv4Interface
    on success or None on hard failure. notes is a list of human-readable hints,
    including a correction suggestion when the address sits outside the gateway's
    network (a common typo such as 192.169.x instead of 192.168.x).
    """
    notes = []
    text = raw.strip()
    if "/" not in text:
        text = f"{text}/{default_prefix}"
        notes.append(f"No prefix given; assuming /{default_prefix}.")
    try:
        iface = ipaddress.ip_interface(text)
    except ValueError:
        notes.append(f"'{raw}' is not a valid IPv4 address.")
        return None, notes
    if iface.version != 4:
        notes.append("Only IPv4 addresses are handled.")
        return None, notes

    net = iface.network
    if iface.ip == net.network_address and net.prefixlen < 31:
        notes.append(f"{iface.ip} is the network address and cannot be used.")
        return None, notes
    if iface.ip == net.broadcast_address and net.prefixlen < 31:
        notes.append(f"{iface.ip} is the broadcast address and cannot be used.")
        return None, notes

    if gateway:
        try:
            gw = ipaddress.ip_address(gateway)
            gw_net = ipaddress.ip_network(f"{gateway}/{net.prefixlen}", strict=False)
            if iface.ip not in gw_net:
                # Keep the host portion, move it into the gateway's network.
                host_bits = int(iface.ip) & ~int(gw_net.netmask)
                fixed = ipaddress.ip_address(int(gw_net.network_address) | host_bits)
                notes.append(
                    f"{iface.ip} is outside the gateway network "
                    f"{gw_net}. A closer match is {fixed}/{net.prefixlen}."
                )
            if iface.ip == gw:
                notes.append(f"{iface.ip} is the gateway address; choose another.")
        except ValueError:
            pass
    return iface, notes


def guess_gateway(iface_obj, detected):
    """Return a gateway suggestion: the detected one, else the first host."""
    if detected:
        return detected
    hosts = iface_obj.network.hosts()
    try:
        return str(next(hosts))
    except StopIteration:
        return ""


def address_in_use(ip, exclude_self=True):
    """Best-effort check for an address already answering on the network."""
    if exclude_self:
        # An address already on this host is not a foreign conflict.
        for dev in detect_interfaces():
            if dev["address"] and dev["address"].split("/")[0] == ip:
                return False
    if have("arping"):
        code, _, _ = run(["arping", "-c", "2", "-w", "2", ip])
        return code == 0
    if have("ping"):
        code, _, _ = run(["ping", "-c", "1", "-W", "1", ip])
        return code == 0
    return False


# --------------------------------------------------------------------------- #
# Netplan file handling
# --------------------------------------------------------------------------- #
def detect_renderer():
    """Return 'NetworkManager' when it manages the network, else 'networkd'."""
    code, out, _ = run(["systemctl", "is-active", "NetworkManager"])
    if code == 0 and out.strip() == "active":
        return "NetworkManager"
    return "networkd"


def load_managed():
    """Load the managed file as a dict. Treat unreadable content as empty."""
    if not os.path.exists(MANAGED_FILE):
        return {"network": {"version": 2}}
    try:
        with open(MANAGED_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "network" in data:
            return data
    except (OSError, ValueError):
        pass
    # An existing file that is not machine-readable is left for manual review.
    return {"network": {"version": 2}}


def static_block(iface_obj, gateway, dns):
    block = {
        "dhcp4": False,
        "addresses": [str(iface_obj)],
        "nameservers": {"addresses": dns},
    }
    if gateway:
        block["routes"] = [{"to": "default", "via": gateway}]
    return block


def apply_choice(config, device, choice):
    """Update the in-memory config for one device based on the chosen action."""
    net = config["network"]
    section = "wifis" if device["kind"] == "wifi" else "ethernets"
    net.setdefault(section, {})
    if choice["action"] == "static":
        block = static_block(choice["iface"], choice["gateway"], choice["dns"])
        if device["kind"] == "wifi":
            block["access-points"] = {choice["ssid"]: {"password": choice["psk"]}}
        net[section][device["name"]] = block
    elif choice["action"] == "dhcp":
        net[section][device["name"]] = {"dhcp4": True}


def write_managed(config, renderer):
    config["network"]["version"] = 2
    config["network"]["renderer"] = renderer
    rendered = json.dumps(config, indent=2) + "\n"
    with open(MANAGED_FILE, "w", encoding="utf-8") as f:
        f.write(rendered)
    os.chmod(MANAGED_FILE, 0o600)
    return rendered


def backup_netplan():
    """Copy every current netplan file into a timestamped backup directory."""
    src = "/etc/netplan"
    if not os.path.isdir(src):
        return None
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(src, f"backup-{stamp}")
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(src):
        path = os.path.join(src, name)
        if os.path.isfile(path) and name.endswith((".yaml", ".yml")):
            shutil.copy2(path, os.path.join(dest, name))
    return dest


# --------------------------------------------------------------------------- #
# Interactive flow
# --------------------------------------------------------------------------- #
def describe(device):
    link = "link up" if device["carrier"] else "no link"
    addr = device["address"] or "no address"
    gw = f", gw {device['gateway']}" if device["gateway"] else ""
    return f"{device['name']} ({device['kind']}, {link}) — {addr}{gw} — {device['mac']}"


def prompt_static(device):
    """Collect a static-address choice for one device, with suggestions."""
    detected_gw = device["gateway"]
    default_addr = device["address"]
    while True:
        raw = ask("Enter IPv4 address (CIDR allowed)", default_addr)
        if not raw:
            print("  No address entered; leaving device on automatic.")
            return {"action": "dhcp"}
        iface_obj, notes = normalize_address(raw, gateway=detected_gw)
        for note in notes:
            print(f"  - {note}")
        if iface_obj is None:
            continue
        gw = ask("Gateway", guess_gateway(iface_obj, detected_gw))
        dns_default = ", ".join(suggested_dns())
        dns_raw = ask("DNS servers (comma separated)", dns_default)
        dns = [d.strip() for d in dns_raw.split(",") if d.strip()]

        if address_in_use(str(iface_obj.ip)):
            if not ask_yes(f"  {iface_obj.ip} already answers on the network. Use it anyway?"):
                continue

        choice = {
            "action": "static",
            "iface": iface_obj,
            "gateway": gw or None,
            "dns": dns,
        }
        if device["kind"] == "wifi":
            choice["ssid"] = ask("Wi-Fi network name (SSID)")
            choice["psk"] = ask("Wi-Fi password")
        return choice


def interactive(devices, revert):
    config = load_managed()
    touched = False
    for device in devices:
        print("\n" + describe(device))
        if revert:
            if ask_yes(f"Return {device['name']} to automatic (DHCP)?"):
                apply_choice(config, device, {"action": "dhcp"})
                touched = True
            continue
        if not ask_yes(f"Assign a static address to {device['name']}?"):
            continue
        choice = prompt_static(device)
        apply_choice(config, device, choice)
        touched = True
    return config, touched


# --------------------------------------------------------------------------- #
# Apply
# --------------------------------------------------------------------------- #
def ensure_netplan():
    """Confirm netplan is present; offer to install it on a Debian-style host."""
    if have("netplan"):
        return True
    print("\nnetplan is not installed on this system.")
    if have("apt-get") and ask_yes("Install the netplan.io package now?"):
        code, _, err = run(["apt-get", "install", "-y", "netplan.io"])
        if code == 0:
            return have("netplan")
        print(f"Installation failed: {err.strip()}")
    print("Install netplan first, then run this helper again.")
    return False


def apply_config(timeout=180):
    """Validate, then apply with rollback. Returns True only when confirmed."""
    code, _, err = run(["netplan", "generate"])
    if code != 0:
        print(f"Configuration rejected by netplan: {err.strip()}")
        return False
    if sys.stdin.isatty():
        print(
            "\nApplying with automatic rollback.\n"
            "  - Netplan asks for confirmation and reverts on its own if none arrives.\n"
            "  - Before confirming, test connectivity: ping the gateway, or open a\n"
            "    second session to the machine.\n"
            f"  - The rollback window is {timeout} seconds.\n"
        )
        return subprocess.run(["netplan", "try", "--timeout", str(timeout)]).returncode == 0
    code, _, err = run(["netplan", "apply"])
    if code != 0:
        print(f"Apply failed: {err.strip()}")
        return False
    return True


def restore_managed(prior_existed, prior_content):
    """Undo the managed file after a rejected apply: restore prior, or remove."""
    try:
        if prior_existed and prior_content is not None:
            with open(MANAGED_FILE, "w", encoding="utf-8") as f:
                f.write(prior_content)
            os.chmod(MANAGED_FILE, 0o600)
        elif os.path.exists(MANAGED_FILE):
            os.remove(MANAGED_FILE)
    except OSError as exc:
        print(f"Warning: could not roll back {MANAGED_FILE}: {exc}")


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def build_parser():
    p = argparse.ArgumentParser(
        prog="netplan_static.py",
        description="Detect physical network devices and set static addresses via netplan.",
    )
    p.add_argument("--apply", action="store_true", help="Write and activate changes (default: preview only).")
    p.add_argument("--revert", action="store_true", help="Offer to return devices to automatic (DHCP).")
    p.add_argument("--list", action="store_true", help="List detected devices and exit.")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    devices = detect_interfaces()

    if args.list:
        for device in devices:
            print(describe(device))
        return 0

    if not devices:
        print("No physical network devices detected.")
        return 1

    if os.geteuid() != 0:
        print("Run with sudo to read network state and write netplan files.")
        return 1

    if not ensure_netplan():
        return 1

    config, touched = interactive(devices, args.revert)
    if not touched:
        print("\nNo changes selected.")
        return 0

    renderer = detect_renderer()
    rendered = json.dumps({**config, "network": {**config["network"], "version": 2, "renderer": renderer}}, indent=2)

    if not args.apply:
        print("\nPreview of " + MANAGED_FILE + " (no changes written):\n")
        print(rendered)
        print("\nRe-run with --apply to write and activate these settings.")
        return 0

    backup = backup_netplan()
    if backup:
        print(f"\nBacked up existing netplan files to {backup}")

    prior_existed = os.path.exists(MANAGED_FILE)
    prior_content = None
    if prior_existed:
        with open(MANAGED_FILE, "r", encoding="utf-8") as f:
            prior_content = f.read()

    write_managed(config, renderer)
    print(f"Wrote {MANAGED_FILE}")

    if apply_config():
        print("Configuration confirmed and active.")
        return 0

    # Rejected, timed out, or failed: restore the prior managed file (or remove a
    # freshly created one) so a later reboot will not re-apply the rejected change.
    restore_managed(prior_existed, prior_content)
    run(["netplan", "apply"])
    print(
        "Configuration not kept. The managed file has been rolled back and the\n"
        "previous settings re-applied. Nothing on disk references the rejected change."
    )
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)