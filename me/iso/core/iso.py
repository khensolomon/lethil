"""
ISO discovery, extraction, and rebuilding.

KEY DESIGN CHOICE: Never mount ISOs. xorriso can read ISO contents directly
with `-osirrox on -extract`, which means:
  - No sudo required for extraction or rebuild
  - No leftover mount points if the script crashes
  - No "device or resource busy" errors on cleanup
  - Works inside containers, CI, and unprivileged user namespaces

The full pipeline is:
  1. extract_files() — pull just the boot configs we need (~1MB) from the ISO
  2. (caller modifies extracted configs and writes new files)
  3. rebuild_iso() — xorriso copies the source ISO and overlays our changes

We never touch the bulk content of the ISO (squashfs, packages, etc) — we
just patch the bootloader and inject our autoinstall files.
"""

import hashlib
import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional

from . import ui


def discover_isos(os_hint: str = "") -> List[Path]:
    """Scan common locations for ISO files."""
    search_dirs = [
        Path.cwd(),
        Path.home() / "Downloads",
        Path("/mnt/keep/os/linux") / os_hint if os_hint else Path("/mnt/keep/os/linux"),
        Path("/var/lib/libvirt/images"),
    ]

    found = []
    for d in search_dirs:
        if d.exists() and d.is_dir():
            try:
                for entry in d.iterdir():
                    if entry.is_file() and entry.suffix.lower() == ".iso":
                        found.append(entry.resolve())
            except PermissionError:
                continue

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for p in found:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    return unique


def ask_iso_path(os_hint: str = "") -> Path:
    """Present a menu of discovered ISOs, or accept manual entry."""
    isos = discover_isos(os_hint)

    if ui.UNATTENDED:
        if isos:
            ui.print_info(f"Auto-selected ISO: {isos[0]}")
            return isos[0]
        ui.print_error("Unattended mode: no ISOs found in standard locations.")

    if not isos:
        return Path(ui.ask_input("Enter path to source ISO")).expanduser()

    labels = [str(p) for p in isos] + ["Enter custom path manually..."]
    idx = ui.ask_choice("Select source ISO", labels, default=1)

    if idx == len(isos):
        return Path(ui.ask_input("Enter custom path to source ISO")).expanduser()
    return isos[idx]


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    """Compute SHA256 of a file. Useful for verifying ISO integrity."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


def extract_files(iso_path: Path, file_pairs: List[tuple], out_dir: Path) -> List[Path]:
    """
    Extract specific files from an ISO using xorriso. NO MOUNTING.

    Args:
        iso_path: source ISO file
        file_pairs: list of (path-inside-iso, path-relative-to-out_dir) tuples
        out_dir: where to write the extracted files

    Returns:
        List of extracted file paths (those that actually existed in the ISO).

    Files that don't exist in the ISO are silently skipped — the caller is
    expected to know which files are optional (e.g. isolinux on UEFI-only ISOs).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Filter to files that actually exist in the ISO. We do this with proper
    # path lookups (xorriso -lsd), not text matching on -find output.
    existing_pairs = [
        (inside, rel_out) for inside, rel_out in file_pairs
        if file_exists_in_iso(iso_path, inside)
    ]

    if not existing_pairs:
        return []

    # Build a single xorriso command that extracts all the existing files.
    cmd = ["xorriso", "-osirrox", "on", "-indev", str(iso_path)]
    for inside, rel_out in existing_pairs:
        target = out_dir / rel_out
        target.parent.mkdir(parents=True, exist_ok=True)
        cmd.extend(["-extract", inside, str(target)])

    subprocess.run(cmd, check=True, capture_output=True, text=True)

    extracted = []
    for _, rel_out in existing_pairs:
        target = out_dir / rel_out
        if target.exists():
            # xorriso preserves ISO read-only perms; make writable for editing
            target.chmod(0o644)
            extracted.append(target)

    return extracted


def file_exists_in_iso(iso_path: Path, inside_path: str) -> bool:
    """
    Check whether a file or directory exists inside an ISO without extracting it.

    xorriso `-lsd` always exits 0, so we have to read its output. When the
    path is missing it prints "Not found in ISO image" and "Valid ISO nodes
    found: 0". When present it prints the path.
    """
    result = subprocess.run(
        ["xorriso", "-osirrox", "on", "-indev", str(iso_path),
         "-lsd", inside_path],
        capture_output=True, text=True, check=False,
    )
    combined = result.stdout + result.stderr
    if "Not found in ISO image" in combined:
        return False
    if "Valid ISO nodes found: 0" in combined:
        return False
    return True


def list_iso_contents(iso_path: Path, inside_path: str = "/") -> List[str]:
    """
    List entries directly under the given path inside the ISO.
    Used by the `inspect` command to help diagnose ISO layout issues.
    """
    result = subprocess.run(
        ["xorriso", "-osirrox", "on", "-indev", str(iso_path),
         "-ls", inside_path],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        return []
    # xorriso -ls output is one entry per line, sometimes with quotes.
    entries = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("xorriso") or line.startswith("ISO"):
            continue
        # Strip surrounding quotes if present
        if line.startswith("'") and line.endswith("'"):
            line = line[1:-1]
        entries.append(line)
    return entries


def read_iso_text_file(iso_path: Path, inside_path: str, max_bytes: int = 1024) -> str:
    """
    Read a small text file from inside an ISO. Returns "" if not found.
    Used for things like /.disk/info to detect the distro reliably.
    """
    if not file_exists_in_iso(iso_path, inside_path):
        return ""

    import tempfile
    with tempfile.NamedTemporaryFile(mode="r+b", suffix=".tmp", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        result = subprocess.run(
            ["xorriso", "-osirrox", "on", "-indev", str(iso_path),
             "-extract", inside_path, str(tmp_path)],
            capture_output=True, text=True, check=False,
        )
        if result.returncode != 0 or not tmp_path.exists():
            return ""
        return tmp_path.read_bytes()[:max_bytes].decode("utf-8", errors="replace").strip()
    finally:
        tmp_path.unlink(missing_ok=True)


def detect_iso_distro(iso_path: Path) -> str:
    """
    Identify which distro family an ISO belongs to.

    Tries multiple signals because ISO layouts evolve (Ubuntu 26.04 may have
    rearranged things compared to 22.04, etc).

    Catches the "you selected an Ubuntu ISO when you meant Debian" footgun
    *before* we waste time extracting things.
    """
    # Most reliable: /.disk/info contains a human-readable distro string.
    # This file has been on Ubuntu and Debian ISOs for many years.
    disk_info = read_iso_text_file(iso_path, "/.disk/info").lower()
    if disk_info:
        if "ubuntu" in disk_info:
            return "ubuntu"
        if "debian" in disk_info:
            return "debian"

    # Fallback: directory-based heuristics
    if file_exists_in_iso(iso_path, "/casper"):
        return "ubuntu"
    if file_exists_in_iso(iso_path, "/install.amd"):
        return "debian"
    # Newer Ubuntu Desktop ISOs (Subiquity-based) may not have /casper at the
    # root in the same way. /EFI/boot/grubx64.efi + /boot/grub indicates a
    # Linux installer ISO; we couple that with .disk presence to be safer.
    if file_exists_in_iso(iso_path, "/.disk"):
        # It's some Debian-family ISO but we couldn't read /.disk/info.
        # Be permissive: report unknown and let the per-builder validate_iso
        # do a more thorough check.
        return "unknown"
    if file_exists_in_iso(iso_path, "/images/pxeboot"):
        return "fedora"
    if file_exists_in_iso(iso_path, "/arch"):
        return "arch"
    return "unknown"


def rebuild_iso(
    source_iso: Path,
    output_iso: Path,
    file_mappings: List[tuple],
    extra_xorriso_args: Optional[List[str]] = None,
) -> None:
    """
    Build a new ISO by overlaying files onto the source ISO.

    Uses xorriso's `-boot_image any replay` to preserve all bootloader
    structures (BIOS, UEFI, El Torito) from the source. This is what makes
    the resulting ISO bootable on the same hardware as the original.

    CRITICAL: After mapping files in, we run `-chmod_r 0755 -- /` over the
    entire ISO tree. This fixes a known Subiquity bug
    (https://bugs.launchpad.net/ubuntu/+source/subiquity/+bug/1963725):
    when /cdrom on the installed system has permissions 0700, apt-get
    inside curtin's chroot can't read packages from /cdrom/pool/ and the
    install hangs forever during package installation. Default xorriso
    behavior preserves whatever permissions the host filesystem had,
    which often produces 0700 directories and silent install hangs.

    Args:
        source_iso: original ISO file
        output_iso: where to write the new ISO
        file_mappings: list of (host_path, iso_path) tuples
        extra_xorriso_args: additional xorriso arguments (rarely needed)
    """
    output_iso.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "xorriso",
        "-indev", str(source_iso),
        "-outdev", str(output_iso),
        "-boot_image", "any", "replay",
    ]

    for host_path, iso_path in file_mappings:
        cmd.extend(["-map", str(host_path), iso_path])

    # Force-set permissions on the ENTIRE ISO tree. Default xorriso
    # behavior preserves whatever permissions the host filesystem had,
    # which often produces 0700 directories and silent install hangs.
    # See the docstring for the bug reference.
    cmd.extend(["-chmod_r", "0755", "/"])

    if extra_xorriso_args:
        cmd.extend(extra_xorriso_args)

    ui.print_info(f"Building ISO with xorriso ({len(file_mappings)} file overlays)...")
    subprocess.run(cmd, check=True)


def verify_output_iso(output_iso: Path, expected_files: List[str]) -> List[str]:
    """
    Verify that all expected files made it into the output ISO.
    Returns a list of missing paths (empty list = all good).
    """
    missing = []
    for f in expected_files:
        if not file_exists_in_iso(output_iso, f):
            missing.append(f)
    return missing


# ---------------------------------------------------------------------------
# Workspace management
# ---------------------------------------------------------------------------

def setup_workspace(default_dir: str) -> Path:
    """
    Create or clean a working directory. No sudo: we use only user-owned dirs.
    """
    work_dir = Path(ui.ask_input("Working directory", default_dir)).expanduser()

    if work_dir.exists():
        if not ui.UNATTENDED:
            ui.print_warning(f"{work_dir} already exists.")
        if ui.ask_yes_no("Clean up and recreate?", default="yes"):
            ui.print_info(f"Cleaning {work_dir}...")
            shutil.rmtree(work_dir)

    work_dir.mkdir(parents=True, exist_ok=True)
    return work_dir


def check_dependencies(deps: List[str]) -> None:
    """Verify required CLI tools are installed."""
    missing = [d for d in deps if not shutil.which(d)]
    if missing:
        ui.print_error(
            f"Missing required tools: {', '.join(missing)}\n"
            f"Install on Debian/Ubuntu: sudo apt install {' '.join(missing)}\n"
            f"Install on Fedora: sudo dnf install {' '.join(missing)}"
        )