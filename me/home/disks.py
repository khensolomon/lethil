#!/usr/bin/env python3
"""
Plex media pool setup (MergerFS) — hardened, dry-run-first, extensible.

version: 26.06.06-9

    ./disks.py            # DRY RUN: prints every action, changes nothing
    ./disks.py --apply    # actually do it

Run as your NORMAL user (it self-sudoes per command). Do NOT run with `sudo`.

changes:
  26.06.06-9  disks are now declarative + extensible: edit the single DISKS
              list (add/remove/repool a drive in one line). /etc/fstab is now a
              delimited block that is REGENERATED each run, so removals and
              option changes take effect — not just additions. Old raw entries
              for managed mountpoints are migrated into the block. Auto-mounts
              are released by UUID (no fragile /dev/sdX names). Permission step
              targets POSIX filesystems generically.
  26.06.06-8  ext4 branches group-writable (2775+setgid / 664) + pool writers.

Mutating actions are still real shell commands (apt/mount/chown/tee/ln); Python
gives structure, idempotency checks, and a readable dry-run transcript.
"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIG — edit DISKS to match your machine. Everything else derives from it.
# ---------------------------------------------------------------------------


@dataclass
class Disk:
    label: str                  # display name (also helps you read `lsblk -f`)
    uuid: str                   # from `lsblk -f` / `blkid`
    mount: str                  # where to mount it
    fstype: str                 # "ext4" | "exfat" | "xfs" | "btrfs" | ...
    pool: bool = False          # include this drive in the MergerFS pool?
    options: str | None = None  # fstab options override; None = derive by fstype


# Add a drive: append one Disk(...). Remove a drive: delete its line.
# Pool/unpool a drive: flip pool=. That single edit is the whole change —
# mount points, fstab, auto-mount release, and permissions all follow.
DISKS = [
    Disk("Media", "5BDA-A6A3",                            "/mnt/exfat_media", "exfat"),
    Disk("D2TB3", "a5c37594-6942-475d-a119-3344f3d80d8c", "/mnt/d2tb3", "ext4", pool=True),
    Disk("D3TB2", "96fe502c-e1c3-412c-afff-237466a4aed3", "/mnt/d3tb2", "ext4", pool=True),
]

# MergerFS pool
POOL = "/mnt/virtual_pool"
POOL_MINFREE = "20G"
POOL_NAME = "mergerfsPool"

# Filesystems that store real Unix ownership/permissions (get chown/chmod).
# exfat/vfat/ntfs can't, so their perms come from mount options instead.
POSIX_FSTYPES = {"ext4", "ext3", "ext2", "xfs", "btrfs"}

# Group that owns pool content. Plex reads through it; writers write through it.
POOL_GROUP = "plex"
# Service users that must WRITE into the pool (added to POOL_GROUP if present).
# Missing users are skipped, so listing one before it's installed is safe.
POOL_WRITERS = ["debian-transmission"]

# Home "clean" folder -> source path in the pool. Missing targets are reported,
# never linked as dangling symlinks. Fix the right-hand paths to REAL folders.
LINKS = {
    "Movies": f"{POOL}/Movies",
    "Music": f"{POOL}/Music",
    "TV-Series": f"{POOL}/TV-Series",
}

# Our managed section of /etc/fstab (regenerated each run from DISKS).
FSTAB = "/etc/fstab"
FSTAB_BEGIN = "# >>> disks.py managed (regenerated each run; edit DISKS) >>>"
FSTAB_END = "# <<< disks.py managed <<<"

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


def ts() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def header(title: str) -> None:
    print(f"== {title} ==")


# ---- derivations from DISKS ------------------------------------------------

def pool_branches() -> list[str]:
    return [d.mount for d in DISKS if d.pool]


def posix_branches() -> list[Disk]:
    return [d for d in DISKS if d.fstype in POSIX_FSTYPES]


def all_mountpoints() -> list[str]:
    return [d.mount for d in DISKS] + [POOL]


def unit_for(path: str) -> str:
    return path.strip("/").replace("/", "-") + ".mount"


def uuid_present(uuid: str) -> bool:
    return Path(f"/dev/disk/by-uuid/{uuid}").exists()


def default_options(fstype: str, uid: int, gid: int) -> str:
    if fstype in ("exfat", "vfat", "ntfs", "ntfs3"):
        return f"uid={uid},gid={gid},dmask=022,fmask=133,nofail"
    return "defaults,nofail"


def disk_fstab_line(d: Disk, uid: int, gid: int) -> str:
    opts = d.options or default_options(d.fstype, uid, gid)
    passno = "2" if d.fstype in POSIX_FSTYPES else "0"
    return f"UUID={d.uuid} {d.mount} {d.fstype} {opts} 0 {passno}"


def pool_fstab_line() -> str:
    branches = pool_branches()
    # The MergerFS (FUSE) line must NOT carry `nofail`: mount passes it to the
    # FUSE helper, which rejects it ("fuse: unknown option `nofail'"). For boot
    # ordering we use x-systemd.requires= per branch (consumed by systemd, never
    # passed to FUSE), so the pool mounts AFTER its disks.
    requires = ",".join(f"x-systemd.requires={unit_for(b)}" for b in branches)
    src = ":".join(branches)
    return (f"{src} {POOL} mergerfs "
            f"defaults,allow_other,use_ino,category.create=mfs,"
            f"minfreespace={POOL_MINFREE},fsname={POOL_NAME},{requires} 0 0")


def build_managed_block(uid: int, gid: int) -> str:
    lines = [disk_fstab_line(d, uid, gid) for d in DISKS]
    if pool_branches():
        lines.append(pool_fstab_line())
    return FSTAB_BEGIN + "\n" + "\n".join(lines) + "\n" + FSTAB_END


def reconcile_fstab(uid: int, gid: int):
    """Build new fstab content: drop our old managed block AND any raw lines for
    mountpoints we now manage (migrates pre-managed installs), then append a
    fresh block. Returns (new_content, removed_raw_lines)."""
    try:
        current = Path(FSTAB).read_text()
    except FileNotFoundError:
        current = ""
    current = re.sub(re.escape(FSTAB_BEGIN) + r".*?" + re.escape(FSTAB_END) + r"\n?",
                     "", current, flags=re.S)
    managed = set(all_mountpoints())
    kept, removed = [], []
    for raw in current.splitlines():
        s = raw.strip()
        if s and not s.startswith("#"):
            fields = s.split()
            if len(fields) >= 2 and fields[1] in managed:
                removed.append(raw)
                continue
        kept.append(raw)
    body = "\n".join(kept).rstrip("\n")
    block = build_managed_block(uid, gid)
    new = (body + "\n\n" if body else "") + block + "\n"
    return new, removed


def write_fstab(content: str) -> None:
    print(f"  + (rewrite {FSTAB} via sudo tee — managed block regenerated)")
    if APPLY:
        subprocess.run(["sudo", "tee", FSTAB], input=content, text=True,
                       stdout=subprocess.DEVNULL, check=True)


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
    print(f"Pool:        {POOL}  <=  {' '.join(pool_branches()) or '(none)'}")
    print()

    # 0. disk inventory (so the config is self-documenting and portable)
    header("0. Configured disks")
    for d in DISKS:
        present = "present" if uuid_present(d.uuid) else "NOT FOUND (nofail keeps boot safe)"
        tag = " [pool]" if d.pool else ""
        print(f"  {d.label:8} {d.fstype:6} -> {d.mount}{tag}   {present}")
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

    # 2. pool group + write access (the original script's silent killer)
    header("2. pool group + write access")
    if probe(["getent", "group", POOL_GROUP]).returncode == 0:
        print(f"  group '{POOL_GROUP}' exists")
    else:
        print(f"  group '{POOL_GROUP}' missing — creating it (Plex install would too)")
        run(["sudo", "groupadd", "-r", POOL_GROUP])
    for u in POOL_WRITERS:
        if probe(["id", u]).returncode != 0:
            print(f"  writer '{u}' not present yet — skipping (add it after install)")
            continue
        if POOL_GROUP in probe(["id", "-nG", u]).stdout.split():
            print(f"  '{u}' already in group '{POOL_GROUP}'")
        else:
            print(f"  adding '{u}' to '{POOL_GROUP}' (restart that service afterward)")
            run(["sudo", "usermod", "-aG", POOL_GROUP, u])
    print()

    # 3. mount points
    header("3. Mount points")
    for mp in all_mountpoints():
        if Path(mp).is_dir():
            print(f"  exists: {mp}")
        else:
            run(["sudo", "mkdir", "-p", mp])
    print()

    # 4. fstab — managed block, regenerated from DISKS each run
    header("4. /etc/fstab (managed block)")
    new, removed = reconcile_fstab(uid, gid)
    try:
        current = Path(FSTAB).read_text()
    except FileNotFoundError:
        current = ""
    if new.strip() == current.strip():
        print("  fstab already up to date")
    else:
        if removed:
            print("  superseding existing lines for managed mountpoints:")
            for r in removed:
                print(f"      - {r.strip()}")
        print("  managed block to write:")
        for ln in build_managed_block(uid, gid).splitlines():
            print(f"      {ln}")
        run(["sudo", "cp", FSTAB, f"{FSTAB}.bak.{ts()}"])
        write_fstab(new)
    # systemd caches fstab via a generator; reload so `mount -a` and boot agree.
    run(["sudo", "systemctl", "daemon-reload"])
    print()

    # 5. release desktop auto-mounts (by UUID — no fragile /dev names)
    header("5. Release /run/media auto-mounts")
    for d in DISKS:
        res = probe(["findmnt", "-rnS", f"UUID={d.uuid}", "-o", "TARGET"])
        targets = [t for t in res.stdout.split("\n") if t.strip()]
        if not targets:
            print(f"  not mounted: {d.label}")
            continue
        tgt = targets[0]
        if tgt == d.mount:
            print(f"  already at {d.mount}: {d.label}")
            continue
        print(f"  {d.label} auto-mounted at {tgt} — releasing")
        run(["sudo", "umount", tgt], check=False)
    print()

    # 6. mount + verify
    header("6. mount -a + verify")
    run(["sudo", "mount", "-a"])
    if APPLY:
        print("  findmnt --verify:")
        subprocess.run(["sudo", "findmnt", "--verify"], check=False)
        if pool_branches():
            if probe(["findmnt", POOL]).returncode != 0:
                print(f"  WARNING: pool not mounted at {POOL}")
            else:
                print(f"  pool mounted at {POOL}")
    print()

    # 7. permissions on posix branches (shared rw via the pool group)
    header("7. Permissions (posix branches: shared rw via the pool group)")
    # dirs 2775 = setgid + group-writable: writers (transmission) can create
    # files/folders inheriting POOL_GROUP; Plex reads through the group. 664 files.
    for d in posix_branches():
        print(f"  {d.mount} -> {user}:{POOL_GROUP}, dirs 2775 (setgid) / files 664 "
              f"(recursive; can be slow)")
        run(["sudo", "chown", "-R", f"{user}:{POOL_GROUP}", d.mount])
        run(["sudo", "find", d.mount, "-type", "d", "-exec", "chmod", "2775", "{}", "+"])
        run(["sudo", "find", d.mount, "-type", "f", "-exec", "chmod", "664", "{}", "+"])
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