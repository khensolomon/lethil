#!/usr/bin/env python3
"""
Plex media pool setup (MergerFS) — hardened, dry-run-first.

    ./disks.py            # DRY RUN: prints every action, changes nothing
    ./disks.py --apply    # actually do it

Run as your NORMAL user (it self-sudoes per command). Do NOT run with `sudo`.

This is a port of disks.sh. All mutating actions are still real shell
commands (apt/mount/chown/tee/ln); Python just gives us structure, argument
parsing, idempotency checks and a readable dry-run transcript.
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIG — edit to match what you actually want
# ---------------------------------------------------------------------------

# Drives by UUID (from your `lsblk -f`)
UUID_EXFAT_MEDIA = "5BDA-A6A3"                              # sda2, exfat, label "Media"
UUID_D2TB3 = "a5c37594-6942-475d-a119-3344f3d80d8c"        # sdb1, ext4,  label "D2TB3"
UUID_D3TB2 = "96fe502c-e1c3-412c-afff-237466a4aed3"        # sdc1, ext4,  label "D3TB2"

MNT_EXFAT = "/mnt/exfat_media"
MNT_D2TB3 = "/mnt/d2tb3"
MNT_D3TB2 = "/mnt/d3tb2"
POOL = "/mnt/virtual_pool"

# Branches that go into the MergerFS pool.
# exfat can't store Unix ownership/permissions and behaves oddly inside a pool,
# so by default we pool only the two ext4 drives. Add MNT_EXFAT if you really
# want it merged.
POOL_BRANCHES = [MNT_D2TB3, MNT_D3TB2]

# Devices that the desktop (udisks) tends to auto-mount under /run/media.
AUTO_MOUNTED_DEVS = ["/dev/sda2", "/dev/sdb1", "/dev/sdc1"]

# ext4 branches that get chown/chmod for Plex.
EXT4_BRANCHES = [MNT_D2TB3, MNT_D3TB2]

# Home "clean" folder -> source path. The source is checked for existence
# before a symlink is created; missing targets are reported, never linked as a
# dangling symlink. Fix the right-hand paths to the REAL folder names on disk.
LINKS = {
    "Movies": f"{POOL}/Movies",
    "Music": f"{POOL}/Music",
    "TV-Series": f"{POOL}/TV-Series",
}

# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

APPLY = False


def run(cmd: list[str], *, check: bool = True) -> int:
    """Print a mutating command and execute it only when --apply is set."""
    print("  + " + " ".join(shlex.quote(c) for c in cmd))
    if not APPLY:
        return 0
    return subprocess.run(cmd, check=check).returncode


def probe(cmd: list[str]) -> subprocess.CompletedProcess:
    """Read-only command, always executed (not part of the apply gate)."""
    return subprocess.run(cmd, capture_output=True, text=True)


def append_fstab(line: str) -> None:
    print(f"  + echo {shlex.quote(line)} | sudo tee -a /etc/fstab")
    if APPLY:
        subprocess.run(
            ["sudo", "tee", "-a", "/etc/fstab"],
            input=line + "\n",
            text=True,
            stdout=subprocess.DEVNULL,
            check=True,
        )


def ts() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def fstab_has_mountpoint(mountpoint: str) -> bool:
    """True if /etc/fstab already has an entry for this mount point."""
    try:
        for raw in Path("/etc/fstab").read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            fields = line.split()
            if len(fields) >= 2 and fields[1] == mountpoint:
                return True
    except FileNotFoundError:
        pass
    return False


def header(title: str) -> None:
    print(f"== {title} ==")


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def main() -> int:
    global APPLY

    parser = argparse.ArgumentParser(description="Set up a MergerFS media pool for Plex.")
    parser.add_argument("--apply", action="store_true",
                        help="actually perform changes (default is a dry run)")
    args = parser.parse_args()
    APPLY = args.apply

    if os.geteuid() == 0:
        sys.exit("ERROR: run as your normal user, not with sudo. It elevates per-command.")

    if not APPLY:
        print("#" * 56)
        print("#  DRY RUN — nothing will change. Re-run with --apply   #")
        print("#" * 56)
    print()

    user = os.environ.get("USER") or Path("~").expanduser().name
    home = Path.home()
    media_root = home / "Media"
    uid, gid = os.getuid(), os.getgid()

    print(f"User:        {user}")
    print(f"Home:        {home}")
    print(f"Media root:  {media_root}")
    print(f"Pool:        {POOL}  <=  {' '.join(POOL_BRANCHES)}")
    print()

    # 1. mergerfs
    header("1. MergerFS")
    if shutil.which("mergerfs"):
        ver = probe(["mergerfs", "--version"]).stdout.splitlines()
        print(f"  mergerfs already installed ({ver[0] if ver else 'unknown version'})")
    else:
        print("  mergerfs NOT installed:")
        run(["sudo", "apt-get", "update"])
        run(["sudo", "apt-get", "install", "-y", "mergerfs"])
    print()

    # 2. plex group (the original script's silent killer)
    header("2. plex group")
    if probe(["getent", "group", "plex"]).returncode == 0:
        print("  group 'plex' exists")
    else:
        print("  group 'plex' missing — creating it (Plex install would also do this)")
        run(["sudo", "groupadd", "-r", "plex"])
    print()

    # 3. mount points
    header("3. Mount points")
    for d in [MNT_EXFAT, MNT_D2TB3, MNT_D3TB2, POOL]:
        if Path(d).is_dir():
            print(f"  exists: {d}")
        else:
            run(["sudo", "mkdir", "-p", d])
    print()

    # 4. fstab — idempotent
    header("4. /etc/fstab")
    # The MergerFS (FUSE) line must NOT carry `nofail`: mount passes it to the
    # FUSE helper, which rejects it ("fuse: unknown option `nofail'"). For boot
    # safety/ordering we instead use x-systemd.requires= per branch (consumed by
    # systemd, never passed to FUSE), so the pool mounts AFTER its disks.
    def unit_for(path: str) -> str:
        return path.strip("/").replace("/", "-") + ".mount"

    pool_requires = ",".join(f"x-systemd.requires={unit_for(b)}" for b in POOL_BRANCHES)
    fstab_lines = [
        f"UUID={UUID_EXFAT_MEDIA} {MNT_EXFAT} exfat "
        f"uid={uid},gid={gid},dmask=022,fmask=133,nofail 0 0",
        f"UUID={UUID_D2TB3} {MNT_D2TB3} ext4 defaults,nofail 0 2",
        f"UUID={UUID_D3TB2} {MNT_D3TB2} ext4 defaults,nofail 0 2",
        f"{':'.join(POOL_BRANCHES)} {POOL} mergerfs "
        f"defaults,allow_other,use_ino,category.create=mfs,"
        f"minfreespace=20G,fsname=mergerfsPool,{pool_requires} 0 0",
    ]

    missing = []
    for line in fstab_lines:
        mp = line.split()[1]
        if fstab_has_mountpoint(mp):
            print(f"  already in fstab (mountpoint {mp}) — skipping")
        else:
            print(f"  will add: {line}")
            missing.append(line)

    if missing:
        run(["sudo", "cp", "/etc/fstab", f"/etc/fstab.bak.{ts()}"])
        for line in missing:
            append_fstab(line)

    # Self-heal: a previous run may have written ',nofail' onto the FUSE line.
    try:
        if any("mergerfs" in ln and "nofail" in ln
               for ln in Path("/etc/fstab").read_text().splitlines()):
            print("  repairing: removing invalid ',nofail' from the mergerfs line")
            run(["sudo", "sed", "-i", "/mergerfsPool/ s/,nofail//", "/etc/fstab"])
    except FileNotFoundError:
        pass

    # systemd caches fstab via a generator; reload so `mount -a` and boot agree.
    run(["sudo", "systemctl", "daemon-reload"])
    print()

    # 5. release desktop auto-mounts
    header("5. Unmount any /run/media auto-mounts")
    for dev in AUTO_MOUNTED_DEVS:
        if probe(["findmnt", "-S", dev]).returncode == 0:
            run(["sudo", "umount", dev], check=False)
        else:
            print(f"  not mounted: {dev}")
    print()

    # 6. mount + verify
    header("6. mount -a + verify")
    run(["sudo", "mount", "-a"])
    if APPLY:
        print("  findmnt --verify:")
        subprocess.run(["sudo", "findmnt", "--verify"], check=False)
        if probe(["findmnt", POOL]).returncode != 0:
            print(f"  WARNING: pool not mounted at {POOL}")
        else:
            print(f"  pool mounted at {POOL}")
    print()

    # 7. permissions on ext4 branches (dirs 755, files 644)
    header("7. Permissions (ext4 branches only; exfat perms come from mount opts)")
    for d in EXT4_BRANCHES:
        print(f"  {d} -> {user}:plex, dirs 755 / files 644 (recursive; can be slow)")
        run(["sudo", "chown", "-R", f"{user}:plex", d])
        run(["sudo", "find", d, "-type", "d", "-exec", "chmod", "755", "{}", "+"])
        run(["sudo", "find", d, "-type", "f", "-exec", "chmod", "644", "{}", "+"])
    print()

    # 8. build ~/Media with symlinks — only to targets that EXIST
    header("8. Home media folders")
    if media_root.exists() and not media_root.is_symlink():
        run(["mv", str(media_root), f"{media_root}.bak.{ts()}"])
    run(["mkdir", "-p", str(media_root)])

    pool_path = Path(POOL)
    print(f"  Top-level folders currently visible in the pool ({POOL}):")
    if pool_path.is_dir():
        for entry in sorted(p.name for p in pool_path.iterdir()):
            print(f"    {entry}")

    for name, target in LINKS.items():
        link = media_root / name
        if Path(target).is_dir():
            run(["ln", "-sfn", target, str(link)])
            print(f"  linked: {link} -> {target}")
        else:
            print(f"  SKIP (target missing): {link} -> {target}")
            print("         create the folder or fix LINKS in this script, then re-run.")
    print()

    mode = "APPLIED" if APPLY else "DRY RUN"
    print(f"=== Done ({mode}) ===")
    if not APPLY:
        print("Review the '+' lines above, then re-run with --apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())