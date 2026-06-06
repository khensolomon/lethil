#!/usr/bin/env python3
"""transmission.py — interactive setup & configuration for transmission-daemon.

version: 26.06.06-5

changes:
  26.06.06-5  enable the daemon on boot (systemctl enable), not just start it.
  26.06.06-4  default seeding policy is now stop-at-completion (ratio 0.0).
              Added ufw rule management: opens the RPC + peer ports when ufw is
              active (skipped if ufw is absent/inactive); toggle via manage_ufw.
  26.06.06-3  graceful termination: Ctrl-C / EOF / failed commands / permission
              errors now print a clean one-line message instead of a Python
              traceback. Added --debug to show the full traceback when wanted.
              An interrupt mid-apply no longer leaves the daemon stopped.
  26.06.06-2  dry-run is now the DEFAULT; use --apply to commit. Config values
              grouped in a DEFAULTS block at the top. Prompts are opt-in (-i).
              Watch dir keeps ingested .torrent files (renamed *.torrent.added).
              ~ in paths expands to the INVOKING user's home, with permission
              handling so the daemon can actually read/write those dirs.
  26.06.06-1  initial version.

features:
  - Installs transmission-daemon (apt) if missing.
  - Resolves the *actual* settings.json the daemon reads (running --config-dir
    -> /etc/default/transmission-daemon -> candidate paths), never assumes one.
  - Stops the daemon BEFORE editing, then starts it (the daemon overwrites
    settings.json from memory on shutdown, so editing it live or `restart`-ing
    after an edit silently loses changes).
  - Writes valid JSON via json.dump (one missing comma makes transmission
    ignore the whole file and fall back to localhost-only defaults).
  - Merges into the existing config; timestamped backup before each write.
  - RPC user/password + LAN whitelist (auto /24) so the web UI is reachable at
    http://<host-ip>:<port> instead of localhost only.
  - download / incomplete / watch dirs, with ownership/permissions fixed so the
    daemon user can use them even when they live under your home directory.
  - Seeding policy: ratio limit AND idle limit (whichever trips first).
  - Optional up/down speed caps and peer port.

usage:
  sudo ./transmission.py            # PREVIEW (dry-run) using the DEFAULTS below
  sudo ./transmission.py --dry-run  # same as above (explicit)
  sudo ./transmission.py --apply    # actually make the changes
  sudo ./transmission.py -i --apply # prompt for each value, then commit
  sudo ./transmission.py --debug    # show full tracebacks instead of clean errors

To change configuration, edit the DEFAULTS block at the top of this file.
"""

import argparse
import copy
import datetime
import getpass
import grp
import json
import os
import pwd
import re
import shutil
import socket
import subprocess
import sys

# ===========================================================================
# DEFAULTS — edit these. Every value here is what gets applied unless you run
# with -i and type something else. Paths may use ~ for the INVOKING user's
# home (the user behind sudo), which is NOT the daemon's home directory.
# ===========================================================================
DEFAULTS = {
    # --- RPC / web UI ---
    "rpc_username": "transmission",
    "rpc_port": 9091,
    # None -> auto: "127.0.0.1," + your detected /24 (e.g. 192.168.1.*).
    # Or pin it, e.g. "127.0.0.1,192.168.1.*"
    "rpc_whitelist": None,

    # --- directories ---
    "download_dir": "/mnt/d2tb3/M2TB3/260605",
    "watch_dir": "~/Downloads",
    "watch_enabled": True,
    "incomplete_dir": "~/Downloads/Transmission/Incomplete",
    "incomplete_enabled": True,
    # False -> keep ingested .torrent files, renamed to *.torrent.added.
    # True  -> delete them after adding.
    "trash_original_torrent_files": False,

    # --- seeding ---
    # ratio 0.0 with ratio_enabled True => stop seeding the instant a download
    # completes (a 0:1 ratio is already satisfied). Set e.g. 2.0 to seed to a
    # 2:1 ratio instead. With BOTH limits disabled, transmission seeds forever
    # until you remove the torrent. idle limit is moot while ratio is 0.0.
    "ratio_limit": 0.0,
    "ratio_enabled": True,
    "idle_minutes": 30,
    "idle_enabled": True,

    # --- bandwidth / network ---
    "speed_down_kbps": 0,
    "speed_down_enabled": False,
    "speed_up_kbps": 0,
    "speed_up_enabled": False,
    "peer_port": 51413,
    # open the RPC + peer ports in ufw (only acts if ufw is installed & active)
    "manage_ufw": True,

    # umask is the DECIMAL of the octal umask: 2 == 002 (group-writable),
    # 18 == 022. 002 lets users in the daemon group manage downloads.
    "umask": 2,
}
# ===========================================================================

SERVICE = "transmission-daemon"
DEFAULT_DAEMON_USER = "debian-transmission"

INTERACTIVE = False  # set by -i


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def run(cmd, check=True):
    return subprocess.run(cmd, check=check, text=True)


def info(msg):
    print(f"  {msg}")


def section(msg):
    print(f"\n== {msg}")


def require_root():
    if os.geteuid() != 0:
        sys.exit("Must run as root (installs packages, controls systemd). "
                 "Re-run with: sudo ./transmission.py")


def _die(msg, code=1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


# ---------------------------------------------------------------------------
# prompts — return the default unless -i is set
# ---------------------------------------------------------------------------

def ask(text, default):
    if not INTERACTIVE:
        return default
    shown = "" if default is None else str(default)
    resp = input(f"{text} [{shown}]: ").strip()
    return resp if resp else default


def ask_bool(text, default):
    if not INTERACTIVE:
        return default
    d = "Y/n" if default else "y/N"
    resp = input(f"{text} ({d}): ").strip().lower()
    if not resp:
        return default
    return resp in ("y", "yes", "true", "1")


def ask_int(text, default):
    while True:
        resp = ask(text, default)
        try:
            return int(resp)
        except (TypeError, ValueError):
            print("  enter a whole number.")


def ask_float(text, default):
    while True:
        resp = ask(text, default)
        try:
            return float(resp)
        except (TypeError, ValueError):
            print("  enter a number, e.g. 2.0")


def ask_password():
    """Only prompts in interactive mode; blank/None leaves it unchanged."""
    if not INTERACTIVE:
        return None
    while True:
        p1 = getpass.getpass("RPC password (blank = keep current): ")
        if not p1:
            return None
        if p1 == getpass.getpass("Confirm password: "):
            return p1
        print("  did not match, try again.")


# ---------------------------------------------------------------------------
# install / service control
# ---------------------------------------------------------------------------

def daemon_installed():
    return shutil.which("transmission-daemon") is not None


def install_daemon(dry):
    if daemon_installed():
        info("transmission-daemon already installed.")
        return
    if dry:
        info("[dry-run] would: apt-get update && apt-get install -y "
             "transmission-daemon")
        return
    info("installing transmission-daemon ...")
    run(["apt-get", "update"])
    run(["apt-get", "install", "-y", "transmission-daemon"])


def daemon_active():
    return subprocess.run(
        ["systemctl", "is-active", "--quiet", SERVICE]).returncode == 0


def stop_daemon():
    info("stopping daemon (so it cannot overwrite our edits) ...")
    run(["systemctl", "stop", SERVICE], check=False)


def start_daemon():
    info("starting daemon ...")
    run(["systemctl", "start", SERVICE], check=False)


def enable_daemon(dry):
    """Ensure the daemon starts on boot (apt usually does this, but don't
    rely on it — the box may have had it disabled previously)."""
    if dry:
        info(f"[dry-run] would: systemctl enable {SERVICE} (start on boot)")
        return
    run(["systemctl", "enable", SERVICE], check=False)
    info(f"enabled {SERVICE} to start on boot.")


# ---------------------------------------------------------------------------
# resolve the settings.json the daemon ACTUALLY reads
# ---------------------------------------------------------------------------

def _config_dir_from_process():
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as fh:
                parts = [p.decode(errors="replace")
                         for p in fh.read().split(b"\x00") if p]
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
        if not parts or not any("transmission-daemon" in p for p in parts):
            continue
        for i, tok in enumerate(parts):
            if tok in ("-g", "--config-dir") and i + 1 < len(parts):
                return parts[i + 1]
            if tok.startswith("--config-dir="):
                return tok.split("=", 1)[1]
            if tok.startswith("-g") and len(tok) > 2:
                return tok[2:]
    return None


def _config_dir_from_default():
    path = "/etc/default/transmission-daemon"
    if not os.path.exists(path):
        return None
    text = open(path).read()
    m = re.search(r'^\s*CONFIG_DIR\s*=\s*"?([^"\n]+?)"?\s*$', text, re.M)
    cfgdir = m.group(1).strip() if m else None
    m2 = re.search(r'--config-dir[ =]+"?([^"\s]+)', text)
    if m2 and m2.group(1) != "$CONFIG_DIR" and not m2.group(1).startswith("$"):
        return m2.group(1)
    return cfgdir


def resolve_settings_path():
    candidates = [
        "/etc/transmission-daemon/settings.json",
        "/var/lib/transmission-daemon/.config/transmission-daemon/settings.json",
        "/var/lib/transmission-daemon/info/settings.json",
    ]
    for getter in (_config_dir_from_process, _config_dir_from_default):
        d = getter()
        if d:
            return os.path.realpath(os.path.join(d, "settings.json"))
    for c in candidates:
        if os.path.exists(c):
            return os.path.realpath(c)
    return os.path.realpath(candidates[0])


# ---------------------------------------------------------------------------
# users / paths / permissions
# ---------------------------------------------------------------------------

def daemon_ids(settings_path):
    """(uid, gid, name) for the user that owns daemon files."""
    try:
        st = os.stat(settings_path)
        return st.st_uid, st.st_gid, pwd.getpwuid(st.st_uid).pw_name
    except (FileNotFoundError, KeyError):
        pass
    try:
        ent = pwd.getpwnam(DEFAULT_DAEMON_USER)
        return ent.pw_uid, ent.pw_gid, DEFAULT_DAEMON_USER
    except KeyError:
        return 0, 0, "root"


def invoking_user():
    """The human behind sudo, so ~ resolves to *their* home, not root's."""
    name = os.environ.get("SUDO_USER")
    if not name or name == "root":
        return None
    try:
        ent = pwd.getpwnam(name)
        return {"name": name, "uid": ent.pw_uid,
                "gid": ent.pw_gid, "home": ent.pw_dir}
    except KeyError:
        return None


def expand_path(p, inv):
    if p.startswith("~"):
        if inv:
            return inv["home"] + p[1:]
        return os.path.expanduser(p)
    return p


def _under(path, base):
    try:
        ap, ab = os.path.abspath(path), os.path.abspath(base)
        return os.path.commonpath([ap, ab]) == ab
    except ValueError:
        return False


def detect_subnet():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        a, b, c, _ = ip.split(".")
        return f"{a}.{b}.{c}.*"
    except Exception:
        return "192.168.1.*"


def host_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "<host-ip>"


def apply_ownership(path, daemon_uid, daemon_gid, inv):
    """Dirs under the user's home stay user-owned but get the daemon's group +
    setgid so the daemon can write. Dirs elsewhere are owned by the daemon."""
    if inv and _under(path, inv["home"]):
        os.chown(path, inv["uid"], daemon_gid)
        os.chmod(path, 0o2775)   # rwxrwsr-x: owner=user, group=daemon
    else:
        os.chown(path, daemon_uid, daemon_gid)
        os.chmod(path, 0o775)


def ensure_dir(path, daemon_uid, daemon_gid, inv, dry):
    missing = []
    p = path
    while p and not os.path.isdir(p):
        missing.append(p)
        parent = os.path.dirname(p)
        if parent == p:
            break
        p = parent
    if dry:
        verb = "create + set perms" if missing else "set perms on existing"
        info(f"would {verb}: {path}")
        return
    os.makedirs(path, exist_ok=True)
    targets = list(missing) or []
    if path not in targets:
        targets.append(path)  # also normalize the leaf even if it existed
    for comp in targets:
        try:
            apply_ownership(comp, daemon_uid, daemon_gid, inv)
        except PermissionError as e:
            info(f"WARN could not set perms on {comp}: {e}")


def traversal_note(path, daemon_name, daemon_gid, inv):
    """The daemon must be able to traverse (x) every ancestor down to a
    home-based dir. Home dirs are often 0750 on modern Ubuntu, which blocks it.
    """
    if not (inv and _under(path, inv["home"])):
        return
    home = inv["home"]
    try:
        st = os.stat(home)
    except OSError:
        return
    others_x = bool(st.st_mode & 0o001)
    group_x = bool(st.st_mode & 0o010) and st.st_gid == daemon_gid
    if not (others_x or group_x):
        info(f"NOTE: {home} is not traversable by daemon user "
             f"'{daemon_name}'; the daemon won't reach dirs inside it.")
        info(f"      fix with:  sudo chmod o+x {home}")


# ---------------------------------------------------------------------------
# settings load / merge / write
# ---------------------------------------------------------------------------

def load_settings(path):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def backup_settings(path):
    if not os.path.exists(path):
        return
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = f"{path}.bak.{stamp}"
    shutil.copy2(path, dst)
    info(f"backed up existing config -> {dst}")


def write_settings(path, data, uid, gid):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(data, fh, indent=4, sort_keys=True)
        fh.write("\n")
    os.chown(path, uid, gid)
    os.chmod(path, 0o600)  # holds the (soon-hashed) password
    info(f"wrote {path}")


# ---------------------------------------------------------------------------
# build the desired config
# ---------------------------------------------------------------------------

def gather(inv):
    d = DEFAULTS
    changes, dirs = {}, []

    section("RPC / web access")
    changes["rpc-enabled"] = True
    changes["rpc-authentication-required"] = True
    changes["rpc-username"] = ask("RPC username", d["rpc_username"])
    pw = ask_password()
    if pw is not None:
        changes["rpc-password"] = pw  # transmission hashes it on first start
    changes["rpc-port"] = ask_int("RPC / web UI port", d["rpc_port"])
    wl = d["rpc_whitelist"] or ("127.0.0.1," + detect_subnet())
    changes["rpc-whitelist"] = ask("RPC whitelist", wl)
    changes["rpc-whitelist-enabled"] = True
    changes["rpc-host-whitelist-enabled"] = False

    section("Directories")
    dl = expand_path(ask("Download directory", d["download_dir"]), inv)
    changes["download-dir"] = dl
    dirs.append(dl)

    if ask_bool("Enable watch directory (auto-add dropped .torrent files)?",
                d["watch_enabled"]):
        w = expand_path(ask("Watch directory", d["watch_dir"]), inv)
        changes["watch-dir"] = w
        changes["watch-dir-enabled"] = True
        changes["trash-original-torrent-files"] = d["trash_original_torrent_files"]
        dirs.append(w)
    else:
        changes["watch-dir-enabled"] = False

    if ask_bool("Use a separate incomplete directory?", d["incomplete_enabled"]):
        ic = expand_path(ask("Incomplete directory", d["incomplete_dir"]), inv)
        changes["incomplete-dir"] = ic
        changes["incomplete-dir-enabled"] = True
        dirs.append(ic)
    else:
        changes["incomplete-dir-enabled"] = False

    section("Seeding policy")
    if ask_bool("Limit by ratio?", d["ratio_enabled"]):
        changes["ratio-limit"] = ask_float("Seed ratio limit", d["ratio_limit"])
        changes["ratio-limit-enabled"] = True
    else:
        changes["ratio-limit-enabled"] = False
    if ask_bool("Limit by idle time?", d["idle_enabled"]):
        changes["idle-seeding-limit"] = ask_int(
            "Stop seeding after N idle minutes", d["idle_minutes"])
        changes["idle-seeding-limit-enabled"] = True
    else:
        changes["idle-seeding-limit-enabled"] = False

    section("Bandwidth & network")
    if ask_bool("Cap download speed?", d["speed_down_enabled"]):
        changes["speed-limit-down"] = ask_int("Download cap (KB/s)",
                                              d["speed_down_kbps"])
        changes["speed-limit-down-enabled"] = True
    else:
        changes["speed-limit-down-enabled"] = False
    if ask_bool("Cap upload speed?", d["speed_up_enabled"]):
        changes["speed-limit-up"] = ask_int("Upload cap (KB/s)",
                                            d["speed_up_kbps"])
        changes["speed-limit-up-enabled"] = True
    else:
        changes["speed-limit-up-enabled"] = False
    changes["peer-port"] = ask_int("Peer (incoming) port", d["peer_port"])

    changes["umask"] = d["umask"]
    opts = {"manage_ufw": ask_bool(
        "Open the RPC + peer ports in ufw (if active)?", d["manage_ufw"])}
    return changes, dirs, opts


def summarize(changes, dirs, settings_path, owner_name, inv,
              daemon_gid, daemon_name):
    section("Summary")
    info(f"settings file : {settings_path}")
    info(f"owned by      : {owner_name}")
    for k in sorted(changes):
        v = "******" if k == "rpc-password" else changes[k]
        info(f"{k} = {v}")
    for dpath in dirs:
        traversal_note(dpath, daemon_name, daemon_gid, inv)


def maybe_add_user_to_group(owner_name, dry):
    user = os.environ.get("SUDO_USER")
    if not user or user == "root":
        return
    try:
        if user in grp.getgrnam(owner_name).gr_mem:
            return
    except KeyError:
        return
    if not ask_bool(f"Add user '{user}' to group '{owner_name}' "
                    "(access downloads without sudo)?", True):
        return
    if dry:
        info(f"[dry-run] would: usermod -aG {owner_name} {user}")
    else:
        run(["usermod", "-aG", owner_name, user], check=False)
        info(f"added {user} to {owner_name} (re-login to take effect).")


def configure_firewall(rpc_port, peer_port, want, dry):
    """Open the RPC (web UI) and peer ports in ufw. Peer port covers TCP and
    UDP (uTP/DHT). No-op if ufw is missing or inactive (nothing to open)."""
    if not want:
        return
    if not shutil.which("ufw"):
        info("ufw not installed; skipping firewall rules.")
        return
    res = subprocess.run(["ufw", "status"], text=True, capture_output=True)
    active = res.returncode == 0 and "Status: active" in res.stdout
    if not active:
        info("ufw is inactive; not adding rules (firewall isn't blocking).")
        return
    rules = [f"{rpc_port}/tcp", f"{peer_port}/tcp", f"{peer_port}/udp"]
    for r in rules:
        if dry:
            info(f"[dry-run] would: ufw allow {r}")
        else:
            run(["ufw", "allow", r], check=False)
            info(f"ufw allow {r}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    global INTERACTIVE
    ap = argparse.ArgumentParser(
        description="Set up / configure transmission-daemon safely "
                    "(dry-run by default).")
    ap.add_argument("--apply", action="store_true",
                    help="actually make changes (default is a dry-run preview)")
    ap.add_argument("-i", "--interactive", action="store_true",
                    help="prompt for each value instead of using DEFAULTS")
    ap.add_argument("--dry-run", action="store_true",
                    help="explicit dry-run (this is already the default)")
    ap.add_argument("--debug", action="store_true",
                    help="show full tracebacks on error (for development)")
    args = ap.parse_args()
    INTERACTIVE = args.interactive
    dry = not args.apply

    require_root()
    if dry:
        print("*** DRY RUN — no changes will be made. Use --apply to commit. ***")

    section("Install")
    install_daemon(dry)

    settings_path = resolve_settings_path()  # resolve while daemon may run
    section("Config location")
    info(f"daemon reads: {settings_path}")
    uid, gid, owner_name = daemon_ids(settings_path)
    inv = invoking_user()
    if inv is None and any("~" in str(v) for v in
                           (DEFAULTS["watch_dir"], DEFAULTS["incomplete_dir"])):
        info("WARN: no SUDO_USER detected; ~ will expand to root's home. "
             "Run via sudo as your normal user.")

    changes, dirs, opts = gather(inv)
    summarize(changes, dirs, settings_path, owner_name, inv, gid, owner_name)

    if dry:
        section("Dry run — planned filesystem actions")
        for dpath in dirs:
            ensure_dir(dpath, uid, gid, inv, dry=True)
        maybe_add_user_to_group(owner_name, dry=True)
        enable_daemon(dry=True)
        configure_firewall(changes["rpc-port"], changes["peer-port"],
                           opts["manage_ufw"], dry=True)
        print("\nRe-run with --apply to perform these changes.")
        return

    section("Apply")
    was_active = daemon_active()
    stop_daemon()  # flushes & releases the file so our write survives
    try:
        current = load_settings(settings_path)
        merged = copy.deepcopy(current)
        merged.update(changes)

        backup_settings(settings_path)
        write_settings(settings_path, merged, uid, gid)
        for dpath in dirs:
            ensure_dir(dpath, uid, gid, inv, dry=False)
        maybe_add_user_to_group(owner_name, dry=False)
        enable_daemon(dry=False)
        start_daemon()
        configure_firewall(changes["rpc-port"], changes["peer-port"],
                           opts["manage_ufw"], dry=False)
    except BaseException:
        # never leave the daemon down because of an error or Ctrl-C mid-apply
        if was_active and not daemon_active():
            info("interrupted — restarting daemon to leave it running ...")
            start_daemon()
        raise

    section("Done")
    if daemon_active():
        info("daemon is running.")
    elif was_active:
        info(f"WARNING: daemon did not restart. Check: "
             f"journalctl -u {SERVICE} -n 50")
    info(f"web UI: http://{host_ip()}:{merged.get('rpc-port', 9091)}")
    info("note: the password is plaintext in settings.json until the daemon's "
         "first start, then transmission replaces it with a salted hash.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)
    except EOFError:
        print("\nAborted (no input received).")
        sys.exit(130)
    except subprocess.CalledProcessError as e:
        cmd = " ".join(e.cmd) if isinstance(e.cmd, (list, tuple)) else str(e.cmd)
        _die(f"command failed (exit {e.returncode}): {cmd}")
    except (PermissionError, FileNotFoundError, OSError) as e:
        _die(str(e))
    except Exception as e:
        if "--debug" in sys.argv:
            raise
        _die(f"{type(e).__name__}: {e}  (re-run with --debug for the traceback)")