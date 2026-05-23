#!/usr/bin/env python3
"""
=================================================================
                  Ubuntu Cloud VM Manager
=================================================================

A helper script for creating "golden" Ubuntu cloud VMs with
libvirt / KVM, and cloning them on demand.

The workflow it supports:

    1. Pick (or auto-detect) an Ubuntu cloud image, e.g.
       "ubuntu-26.04-server-cloudimg-amd64.img" or
       "ubuntu-25.10-server-cloudimg-amd64.img".

    2. Build a *golden image* from that base + cloud-init user-data.
       The golden image is your reusable template — provisioned once,
       cloned many times.

    3. Clone lightweight VMs from the golden image whenever you need
       a fresh, ready-to-go Ubuntu machine.

-----------------------------------------------------------------
USAGE
-----------------------------------------------------------------

    # Create / refresh the golden image (interactive prompts)
    python3 create.py

    # Create the golden image non-interactively with defaults
    python3 create.py --yes

    # Pick a specific base image explicitly
    python3 create.py --image ubuntu-25.10-server-cloudimg-amd64.img

    # List available base images in the libvirt image dir
    python3 create.py --list-images

    # List existing libvirt domains (VMs)
    python3 create.py --list-vms

    # Clone a new VM from the golden image (interactive)
    python3 create.py --clone

    # Clone with a specific name + custom resources
    python3 create.py --clone my-vm-01 --memory 4096 --vcpus 2 --disk 20

    # Delete a VM (and its disks)
    python3 create.py --delete my-vm-01

-----------------------------------------------------------------
REQUIREMENTS
-----------------------------------------------------------------

    * Linux host with KVM + libvirt + virt-install + virt-clone + virsh
    * Sudo privileges (libvirt usually needs root for /var/lib/libvirt)
    * A cloud-init user-data file (see USER_DATA below)
    * The Ubuntu cloud image .img file in IMAGE_DIR

You can download Ubuntu cloud images from:
    https://cloud-images.ubuntu.com/

-----------------------------------------------------------------
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# =====================================================================
# CONFIGURATION
# =====================================================================
# Change these to match your environment.
# =====================================================================

# Where libvirt stores its disk images on this host.
IMAGE_DIR: Path = Path("/var/lib/libvirt/images")


def _invoking_user_home() -> Path:
    """
    Return the home directory of the user who *invoked* the script,
    even when running under sudo.

    Under sudo, Path.home() returns /root, which is almost never what
    we want for user-owned config files. SUDO_USER is set by sudo to
    the original username, so we resolve that user's home instead.
    """
    sudo_user = os.environ.get("SUDO_USER")
    if sudo_user and sudo_user != "root":
        try:
            import pwd
            return Path(pwd.getpwnam(sudo_user).pw_dir)
        except (KeyError, ImportError):
            pass
    return Path.home()


# Path to the cloud-init user-data YAML used when provisioning the
# golden image. Resolves to the invoking user's home dir even under sudo.
# Override priority (highest first):
#   1. --user-data CLI flag
#   2. VM_USER_DATA environment variable
#   3. This default
USER_DATA: Path = Path(
    os.environ.get("VM_USER_DATA")
    or _invoking_user_home() / "dev/lethil/me/vm/user-data.yaml"
)

# Default base image filename (used when --image is not supplied and
# auto-detection finds multiple candidates). Set to None to always
# auto-detect / prompt.
DEFAULT_BASE_IMAGE: Optional[str] = "ubuntu-26.04-server-cloudimg-amd64.img"

# Default resources for the GOLDEN image.
DEFAULT_GOLDEN_MEMORY_MB: int = 8192   # 8 GB RAM
DEFAULT_GOLDEN_VCPUS: int = 6
DEFAULT_GOLDEN_DISK_GB: int = 40

# Default resources for CLONED VMs (smaller than golden by design —
# clones are usually disposable workers).
DEFAULT_CLONE_MEMORY_MB: int = 4096    # 4 GB RAM
DEFAULT_CLONE_VCPUS: int = 2
DEFAULT_CLONE_DISK_GB: int = 20

# Virtiofs shared host directories mounted into the VM.
# Each tuple is (host_path, mount_tag). The mount_tag is what the
# guest sees in its fstab. user-data.yaml must mount these tags.
VIRTIOFS_MOUNTS: list[tuple[str, str]] = [
    ("/opt/bucket/storage", "bucket_storage"),
    ("/opt/bucket/media",   "bucket_media"),
]

# =====================================================================
# Small visual helpers — used only for readable console output.
# =====================================================================

class C:
    """ANSI color helpers. Disabled automatically when stdout is not a TTY."""

    _enabled = sys.stdout.isatty()

    @classmethod
    def _wrap(cls, code: str, text: str) -> str:
        return f"\033[{code}m{text}\033[0m" if cls._enabled else text

    @classmethod
    def bold(cls, t):   return cls._wrap("1", t)
    @classmethod
    def green(cls, t):  return cls._wrap("32", t)
    @classmethod
    def yellow(cls, t): return cls._wrap("33", t)
    @classmethod
    def red(cls, t):    return cls._wrap("31", t)
    @classmethod
    def cyan(cls, t):   return cls._wrap("36", t)
    @classmethod
    def dim(cls, t):    return cls._wrap("2", t)


def info(msg: str)    -> None: print(f"{C.cyan('ℹ')}  {msg}")
def success(msg: str) -> None: print(f"{C.green('✅')} {msg}")
def warn(msg: str)    -> None: print(f"{C.yellow('⚠')}  {msg}")
def error(msg: str)   -> None: print(f"{C.red('❌')} {msg}", file=sys.stderr)
def header(msg: str)  -> None: print(f"\n{C.bold(C.cyan('=== ' + msg + ' ==='))}")


# =====================================================================
# Generic helpers
# =====================================================================

def run_command(cmd: list[str], *, check: bool = True,
                capture: bool = False) -> subprocess.CompletedProcess:
    """
    Run an external command.

    Args:
        cmd: argv list (NOT a shell string — safer, no quoting bugs).
        check: raise SystemExit on non-zero return.
        capture: capture stdout/stderr instead of streaming them.

    Returns:
        The CompletedProcess. stdout/stderr only populated if capture=True.
    """
    print(C.dim(f"   $ {' '.join(cmd)}"))
    try:
        return subprocess.run(
            cmd,
            check=check,
            text=True,
            capture_output=capture,
        )
    except FileNotFoundError:
        error(f"Command not found: {cmd[0]}")
        error("Is it installed and on your PATH?")
        sys.exit(127)
    except subprocess.CalledProcessError as e:
        error(f"Command failed (exit {e.returncode}): {' '.join(cmd)}")
        if capture and e.stderr:
            error(e.stderr.strip())
        sys.exit(e.returncode)


def require_tools(*tools: str) -> None:
    """Bail out early if a required binary is missing."""
    missing = [t for t in tools if shutil.which(t) is None]
    if missing:
        error("Missing required tool(s): " + ", ".join(missing))
        error("Install them and re-run. On Ubuntu/Debian:")
        error("    sudo apt install libvirt-clients libvirt-daemon-system "
              "virtinst qemu-kvm")
        sys.exit(1)


def prompt(label: str, default: Optional[str] = None,
           *, allow_empty: bool = False, non_interactive: bool = False) -> str:
    """
    Prompt the user for a value with an optional default.

    In non_interactive mode the default is returned directly (or the
    program aborts if there is no default and empty input is not allowed).
    """
    if non_interactive:
        if default is not None:
            return default
        if allow_empty:
            return ""
        error(f"--yes given but no default for '{label}'.")
        sys.exit(2)

    suffix = f" [{C.green(default)}]" if default is not None else ""
    while True:
        try:
            raw = input(f"{C.bold(label)}{suffix}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            error("Aborted.")
            sys.exit(130)
        if raw:
            return raw
        if default is not None:
            return default
        if allow_empty:
            return ""
        warn("Value cannot be empty.")


def prompt_int(label: str, default: int, *, minimum: int = 1,
               non_interactive: bool = False) -> int:
    """Prompt for a positive integer, with validation and a default."""
    while True:
        raw = prompt(label, str(default), non_interactive=non_interactive)
        try:
            value = int(raw)
        except ValueError:
            warn(f"'{raw}' is not a number, try again.")
            continue
        if value < minimum:
            warn(f"Value must be >= {minimum}.")
            continue
        return value


def confirm(question: str, *, default: bool = False,
            non_interactive: bool = False) -> bool:
    """Yes/no confirmation prompt."""
    if non_interactive:
        return True
    suffix = "[Y/n]" if default else "[y/N]"
    try:
        raw = input(f"{C.yellow('?')} {question} {suffix}: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    if not raw:
        return default
    return raw in ("y", "yes")


# =====================================================================
# Domain-specific helpers (libvirt, images, naming)
# =====================================================================

VALID_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$")


def is_valid_vm_name(name: str) -> bool:
    """
    libvirt domain names: keep it sane.
    Allow letters, digits, dot, underscore, hyphen. Must start with
    alphanumeric. Max 63 chars (matches typical hostname limits).
    """
    return bool(VALID_NAME_RE.match(name))


def list_base_images(image_dir: Path) -> list[Path]:
    """Find candidate Ubuntu cloud base images in the image directory."""
    if not image_dir.exists():
        return []
    # Heuristic: cloud images are .img files containing "cloudimg" in
    # the name. Fall back to all .img files if that finds nothing.
    cloud = sorted(image_dir.glob("*cloudimg*.img"))
    if cloud:
        return cloud
    return sorted(image_dir.glob("*.img"))


def check_image_dir_readable(image_dir: Path) -> None:
    """
    /var/lib/libvirt/images is typically root:root mode 0711, meaning
    a non-root user can't even list it — Path.glob() silently returns
    nothing, which looks identical to "no images present".

    Detect that case explicitly so the user gets a useful error.
    """
    if not image_dir.exists():
        error(f"Image directory does not exist: {image_dir}")
        sys.exit(1)
    if not os.access(image_dir, os.R_OK | os.X_OK):
        error(f"Cannot read {image_dir} as {os.environ.get('USER', 'this user')}.")
        error("libvirt's image directory is usually root-only. Fix one of:")
        error("  1. Run this script with sudo:  sudo python3 create.py")
        error("  2. Or add yourself to the libvirt group:")
        error("       sudo usermod -aG libvirt,kvm $USER")
        error("       sudo chmod g+rx /var/lib/libvirt/images")
        error("       newgrp libvirt   # (or log out + back in)")
        sys.exit(1)


def derive_golden_name(base_image: Path) -> str:
    """
    Build a golden-image name from the base image filename.

    Examples:
        ubuntu-26.04-server-cloudimg-amd64.img -> ubuntu-26.04-golden
        ubuntu-25.10-server-cloudimg-amd64.img -> ubuntu-25.10-golden
    """
    stem = base_image.stem  # filename without .img
    # Try to extract "ubuntu-<version>"
    m = re.match(r"(ubuntu-\d+\.\d+)", stem, re.IGNORECASE)
    if m:
        return f"{m.group(1).lower()}-golden"
    # Fallback: <stem>-golden (still deterministic)
    return f"{stem}-golden"


def domain_exists(name: str) -> bool:
    """Return True if a libvirt domain with this name exists."""
    result = subprocess.run(
        ["virsh", "dominfo", name],
        capture_output=True, text=True,
    )
    return result.returncode == 0


def list_domains() -> list[tuple[str, str]]:
    """
    Return list of (name, state) for all defined libvirt domains.
    """
    result = subprocess.run(
        ["virsh", "list", "--all", "--name"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        return []
    names = [n for n in result.stdout.splitlines() if n.strip()]
    out = []
    for n in names:
        st = subprocess.run(
            ["virsh", "domstate", n],
            capture_output=True, text=True, check=False,
        )
        out.append((n, st.stdout.strip() or "unknown"))
    return out


# =====================================================================
# Settings dataclass — bundles per-run configuration in one place
# =====================================================================

@dataclass
class GoldenSettings:
    """Configuration for building the golden image."""
    base_image: Path
    golden_name: str
    golden_disk: Path
    memory_mb: int = DEFAULT_GOLDEN_MEMORY_MB
    vcpus: int = DEFAULT_GOLDEN_VCPUS
    disk_gb: int = DEFAULT_GOLDEN_DISK_GB
    user_data: Path = USER_DATA
    virtiofs_mounts: list[tuple[str, str]] = field(
        default_factory=lambda: list(VIRTIOFS_MOUNTS)
    )


@dataclass
class CloneSettings:
    """Configuration for cloning a VM from the golden image."""
    new_name: str
    source_golden: str
    memory_mb: int = DEFAULT_CLONE_MEMORY_MB
    vcpus: int = DEFAULT_CLONE_VCPUS
    disk_gb: int = DEFAULT_CLONE_DISK_GB


# =====================================================================
# Interactive configuration builders
# =====================================================================

def choose_base_image(args, *, non_interactive: bool) -> Path:
    """
    Decide which base image to use, based on (in order of priority):
      1. --image CLI flag
      2. DEFAULT_BASE_IMAGE if it exists on disk
      3. Auto-detection / interactive prompt among found images
    """
    # 1. CLI flag wins.
    if args.image:
        # Allow either a bare filename (resolved against IMAGE_DIR) or
        # an absolute / relative path.
        candidate = Path(args.image)
        if not candidate.is_absolute():
            candidate = IMAGE_DIR / candidate
        if not candidate.exists():
            error(f"Image not found: {candidate}")
            sys.exit(1)
        return candidate

    # Diagnose permission issues before pretending the dir is empty.
    check_image_dir_readable(IMAGE_DIR)

    available = list_base_images(IMAGE_DIR)

    # 2. Configured default, if it's actually on disk.
    if DEFAULT_BASE_IMAGE:
        default_path = IMAGE_DIR / DEFAULT_BASE_IMAGE
        if default_path.exists() and non_interactive:
            return default_path

    if not available:
        error(f"No cloud images found in {IMAGE_DIR}.")
        error("Download one from https://cloud-images.ubuntu.com/ first.")
        sys.exit(1)

    # Single candidate? Use it.
    if len(available) == 1:
        return available[0]

    # 3. Interactive choice.
    header("Available base images")
    for idx, p in enumerate(available, 1):
        marker = ""
        if DEFAULT_BASE_IMAGE and p.name == DEFAULT_BASE_IMAGE:
            marker = C.green(" (default)")
        print(f"  {idx}) {p.name}{marker}")

    default_idx = 1
    if DEFAULT_BASE_IMAGE:
        for idx, p in enumerate(available, 1):
            if p.name == DEFAULT_BASE_IMAGE:
                default_idx = idx
                break

    while True:
        raw = prompt("Pick an image (number)", str(default_idx),
                     non_interactive=non_interactive)
        try:
            idx = int(raw)
            if 1 <= idx <= len(available):
                return available[idx - 1]
        except ValueError:
            pass
        warn("Invalid choice, try again.")


def build_golden_settings(args, *, non_interactive: bool) -> GoldenSettings:
    """Walk the user through the golden-image config."""
    base_image = choose_base_image(args, non_interactive=non_interactive)
    default_name = derive_golden_name(base_image)

    header("Golden image configuration")
    info(f"Base image: {C.bold(str(base_image))}")

    golden_name = prompt(
        "Golden image name",
        args.name or default_name,
        non_interactive=non_interactive,
    )
    while not is_valid_vm_name(golden_name):
        warn("Invalid name. Use letters/digits/._- only, start alphanumeric, "
             "max 63 chars.")
        golden_name = prompt("Golden image name", default_name)

    memory = prompt_int(
        "Memory (MB)",
        args.memory or DEFAULT_GOLDEN_MEMORY_MB,
        minimum=512,
        non_interactive=non_interactive,
    )
    vcpus = prompt_int(
        "vCPUs",
        args.vcpus or DEFAULT_GOLDEN_VCPUS,
        minimum=1,
        non_interactive=non_interactive,
    )
    disk = prompt_int(
        "Disk size (GB)",
        args.disk or DEFAULT_GOLDEN_DISK_GB,
        minimum=5,
        non_interactive=non_interactive,
    )

    return GoldenSettings(
        base_image=base_image,
        golden_name=golden_name,
        golden_disk=IMAGE_DIR / f"{golden_name}.qcow2",
        memory_mb=memory,
        vcpus=vcpus,
        disk_gb=disk,
        user_data=Path(args.user_data) if args.user_data else USER_DATA,
    )


def find_golden_domains() -> list[str]:
    """
    Return the names of all libvirt domains that look like golden
    images. We use a naming convention (ending in '-golden') because
    libvirt doesn't have any concept of "this is a template".
    """
    return [name for name, _state in list_domains() if name.endswith("-golden")]


def build_clone_settings(args, *, non_interactive: bool) -> CloneSettings:
    """Walk the user through the clone config."""
    header("Clone configuration")

    # ----- Figure out the source golden -----
    # Priority:
    #   1. --source flag (explicit)
    #   2. Exactly one *-golden domain exists -> use it
    #   3. Multiple exist -> prompt (or fail in --yes mode)
    #   4. None exist -> fail with a helpful message
    source = args.source
    if not source:
        goldens = find_golden_domains()

        if not goldens:
            error("No golden image found (no libvirt domain ending in "
                  "'-golden').")
            error("Create one first with:  sudo python3 create.py")
            sys.exit(1)

        if len(goldens) == 1:
            source = goldens[0]
            info(f"Using the only available golden: {C.bold(source)}")
        else:
            # Multiple goldens — must choose.
            if non_interactive:
                error("Multiple golden images exist; --yes can't guess which "
                      "to use.")
                error("Pass --source <name> explicitly. Found:")
                for g in goldens:
                    error(f"  • {g}")
                sys.exit(2)

            header("Available golden images")
            for idx, g in enumerate(goldens, 1):
                marker = ""
                # Mark the one that matches DEFAULT_BASE_IMAGE, if any.
                if DEFAULT_BASE_IMAGE:
                    expected = derive_golden_name(Path(DEFAULT_BASE_IMAGE))
                    if g == expected:
                        marker = C.green(" (default)")
                print(f"  {idx}) {g}{marker}")

            # Default selection = the one matching DEFAULT_BASE_IMAGE,
            # else the first.
            default_idx = 1
            if DEFAULT_BASE_IMAGE:
                expected = derive_golden_name(Path(DEFAULT_BASE_IMAGE))
                for idx, g in enumerate(goldens, 1):
                    if g == expected:
                        default_idx = idx
                        break

            while True:
                raw = prompt("Pick a golden (number)", str(default_idx))
                try:
                    idx = int(raw)
                    if 1 <= idx <= len(goldens):
                        source = goldens[idx - 1]
                        break
                except ValueError:
                    pass
                warn("Invalid choice, try again.")

    info(f"Source golden: {C.bold(source)}")

    # ----- New VM name -----
    default_new = args.name or "ubuntu-clone-01"
    new_name = prompt("New VM name", default_new,
                      non_interactive=non_interactive)
    while not is_valid_vm_name(new_name):
        warn("Invalid name. Use letters/digits/._- only.")
        new_name = prompt("New VM name", default_new)
    while domain_exists(new_name):
        warn(f"A VM named '{new_name}' already exists.")
        new_name = prompt("Choose a different name", default_new)

    memory = prompt_int("Memory (MB)", args.memory or DEFAULT_CLONE_MEMORY_MB,
                        minimum=512, non_interactive=non_interactive)
    vcpus = prompt_int("vCPUs", args.vcpus or DEFAULT_CLONE_VCPUS,
                       minimum=1, non_interactive=non_interactive)
    disk = prompt_int("Disk size (GB) — informational only for clones",
                      args.disk or DEFAULT_CLONE_DISK_GB,
                      minimum=5, non_interactive=non_interactive)

    return CloneSettings(
        new_name=new_name,
        source_golden=source,
        memory_mb=memory,
        vcpus=vcpus,
        disk_gb=disk,
    )


# =====================================================================
# Actions
# =====================================================================

def action_create_golden(args, *, non_interactive: bool) -> None:
    """Build (or rebuild) the golden image with virt-install."""
    require_tools("virt-install", "virsh")

    s = build_golden_settings(args, non_interactive=non_interactive)

    if not s.user_data.exists():
        error(f"cloud-init user-data not found: {s.user_data}")
        error("Fix one of:")
        error(f"  • Create the file at that path")
        error(f"  • Pass a different path:  --user-data /path/to/user-data.yaml")
        error(f"  • Set the env var:        VM_USER_DATA=/path/to/user-data.yaml")
        error(f"  • Edit USER_DATA at the top of this script")
        if os.environ.get("SUDO_USER"):
            error("(Note: running under sudo. The script resolves the path "
                  f"relative to {os.environ['SUDO_USER']}'s home, not /root.)")
        sys.exit(1)

    # Refuse to silently clobber an existing domain.
    if domain_exists(s.golden_name):
        warn(f"A libvirt domain named '{s.golden_name}' already exists.")
        if not confirm("Destroy + undefine it and rebuild?",
                       default=False, non_interactive=non_interactive):
            info("Aborting — keeping existing golden.")
            sys.exit(0)
        # Best-effort cleanup. Ignore failures (e.g. already shut down).
        subprocess.run(["virsh", "destroy", s.golden_name],
                       capture_output=True, text=True)
        subprocess.run(
            ["virsh", "undefine", s.golden_name,
             "--remove-all-storage", "--nvram"],
            capture_output=True, text=True,
        )

    header(f"Creating golden image: {s.golden_name}")
    info(f"Base image : {s.base_image}")
    info(f"Golden disk: {s.golden_disk}")
    info(f"Resources  : {s.memory_mb} MB RAM, {s.vcpus} vCPUs, {s.disk_gb} GB disk")
    info(f"User-data  : {s.user_data}")

    cmd: list[str] = [
        "virt-install",
        "--name", s.golden_name,
        "--memory", str(s.memory_mb),
        "--vcpus", str(s.vcpus),
        "--disk",
        f"path={s.golden_disk},size={s.disk_gb},"
        f"backing_store={s.base_image},format=qcow2,bus=virtio",
        "--memorybacking", "source.type=memfd,access.mode=shared",
        "--cloud-init", f"user-data={s.user_data}",
        "--network", "network=default,model=virtio",
        "--osinfo", "detect=on,require=off",
        "--graphics", "none",
        "--console", "pty,target_type=serial",
        "--import",
        "--noautoconsole",
    ]

    # Inject virtiofs mounts.
    for host_path, tag in s.virtiofs_mounts:
        cmd += ["--filesystem", f"{host_path},{tag},driver.type=virtiofs"]

    run_command(cmd)
    success(f"Golden image '{s.golden_name}' defined and started.")
    print()
    warn("The VM is now booting and running cloud-init INSIDE the guest.")
    warn("This typically takes 5–15 minutes (apt update + package_upgrade).")
    warn("Until cloud-init finishes, the golden image is NOT ready to clone.")
    print()
    info("Watch progress with any of:")
    info(f"  • Live console:    sudo virsh console {s.golden_name}")
    info(f"                     (Ctrl+] to detach)")
    info(f"  • Domain stats:    sudo virt-top")
    info(f"  • Disk growth:     watch -n 2 'sudo ls -lh {s.golden_disk}'")
    info(f"  • Wait for done:   sudo virsh console {s.golden_name}")
    info(f"                     then inside VM: cloud-init status --wait")
    print()
    info("Once cloud-init reports 'done', shut down the golden before cloning:")
    info(f"  sudo virsh shutdown {s.golden_name}")
    info(f"Then clone with:  sudo python3 create.py --clone")
    print()

    # Offer to attach to the console right now.
    if confirm("Attach to the serial console now to watch it boot?",
               default=True, non_interactive=non_interactive):
        info("Attaching... (press Ctrl+] to detach without stopping the VM)")
        # subprocess.run, NOT run_command — we want streaming I/O and we
        # don't want to bail out on the exit code of an interactive session.
        subprocess.run(["virsh", "console", s.golden_name])


def action_clone(args, *, non_interactive: bool) -> None:
    """Clone a new VM from the golden image."""
    require_tools("virt-clone", "virsh")

    s = build_clone_settings(args, non_interactive=non_interactive)

    if not domain_exists(s.source_golden):
        error(f"Source golden domain not found: {s.source_golden}")
        sys.exit(1)

    # Soft warning if the source doesn't follow the *-golden convention.
    # Cloning a non-golden is valid but usually a mistake.
    if not s.source_golden.endswith("-golden"):
        warn(f"'{s.source_golden}' doesn't look like a golden image "
             "(name doesn't end in '-golden').")
        if not confirm("Clone from it anyway?", default=False,
                       non_interactive=non_interactive):
            info("Aborted.")
            sys.exit(0)

    header(f"Cloning '{s.source_golden}' -> '{s.new_name}'")

    cmd = [
        "virt-clone",
        "--original", s.source_golden,
        "--name",     s.new_name,
        "--auto-clone",
        "--mac",      "RANDOM",
    ]
    run_command(cmd)

    # Adjust resources on the clone (virt-clone copies the source specs).
    info("Adjusting clone resources...")
    # setmaxmem requires the domain to be shut off, which it is right
    # after virt-clone. --config writes to the persistent definition.
    run_command([
        "virsh", "setmaxmem", s.new_name, f"{s.memory_mb}M", "--config",
    ])
    run_command([
        "virsh", "setmem", s.new_name, f"{s.memory_mb}M", "--config",
    ])
    run_command([
        "virsh", "setvcpus", s.new_name, str(s.vcpus),
        "--maximum", "--config",
    ])
    run_command([
        "virsh", "setvcpus", s.new_name, str(s.vcpus), "--config",
    ])

    success(f"Clone '{s.new_name}' created (not yet started).")
    print()
    info("Start and watch it:")
    info(f"  sudo virsh start {s.new_name}")
    info(f"  sudo virsh console {s.new_name}     # Ctrl+] to detach")
    info(f"  sudo virsh domifaddr {s.new_name}   # find its IP once networking is up")
    print()

    if confirm("Start the clone and attach to console now?",
               default=True, non_interactive=non_interactive):
        run_command(["virsh", "start", s.new_name])
        info("Attaching... (press Ctrl+] to detach)")
        subprocess.run(["virsh", "console", s.new_name])


def action_list_images() -> None:
    header(f"Base images in {IMAGE_DIR}")
    check_image_dir_readable(IMAGE_DIR)
    images = list_base_images(IMAGE_DIR)
    if not images:
        warn("None found.")
        return
    for p in images:
        size_mb = p.stat().st_size / (1024 * 1024)
        marker = C.green(" (default)") if (
            DEFAULT_BASE_IMAGE and p.name == DEFAULT_BASE_IMAGE
        ) else ""
        print(f"  • {p.name}  ({size_mb:,.0f} MB){marker}")


def action_list_vms() -> None:
    header("libvirt domains")
    domains = list_domains()
    if not domains:
        warn("No domains defined.")
        return
    name_w = max(len(n) for n, _ in domains)
    for name, state in domains:
        color = C.green if state == "running" else C.dim
        print(f"  • {name.ljust(name_w)}   {color(state)}")


def action_delete(name: str, *, non_interactive: bool) -> None:
    require_tools("virsh")
    if not domain_exists(name):
        error(f"No such domain: {name}")
        sys.exit(1)
    warn(f"This will permanently delete VM '{name}' and ALL its disks.")
    if not confirm("Proceed?", default=False, non_interactive=non_interactive):
        info("Aborted.")
        return
    subprocess.run(["virsh", "destroy", name], capture_output=True, text=True)
    run_command([
        "virsh", "undefine", name, "--remove-all-storage", "--nvram",
    ])
    success(f"VM '{name}' deleted.")


# =====================================================================
# Argument parsing & dispatch
# =====================================================================

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="create.py",
        description="Create + clone Ubuntu cloud VMs with libvirt.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("USAGE", 1)[1] if "USAGE" in __doc__ else None,
    )

    # Mode flags (mutually exclusive). Default mode = build golden image.
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--clone", "-c", nargs="?", const="__PROMPT__",
                      metavar="NAME",
                      help="Clone a new VM from the golden image. "
                           "Optionally supply the new VM name.")
    mode.add_argument("--list-images", action="store_true",
                      help="List available base cloud images and exit.")
    mode.add_argument("--list-vms", action="store_true",
                      help="List existing libvirt domains and exit.")
    mode.add_argument("--delete", metavar="NAME",
                      help="Delete a VM (and its disks).")

    # Tunables — apply to both create-golden and clone where relevant.
    p.add_argument("--image", "-i", metavar="FILENAME_OR_PATH",
                   help="Base cloud image filename (in IMAGE_DIR) "
                        "or full path. e.g. "
                        "ubuntu-25.10-server-cloudimg-amd64.img")
    p.add_argument("--name", "-n",
                   help="Golden image name (or clone target name).")
    p.add_argument("--source",
                   help="Name of the golden domain to clone from "
                        "(used with --clone).")
    p.add_argument("--memory", "-m", type=int, metavar="MB",
                   help="Memory in MB.")
    p.add_argument("--vcpus", "-v", type=int,
                   help="Number of vCPUs.")
    p.add_argument("--disk", "-d", type=int, metavar="GB",
                   help="Disk size in GB.")
    p.add_argument("--user-data", "-u", metavar="PATH",
                   help="Path to cloud-init user-data.yaml "
                        "(overrides USER_DATA / $VM_USER_DATA).")
    p.add_argument("--yes", "-y", action="store_true",
                   help="Non-interactive mode: accept all defaults, "
                        "skip confirmations.")

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    non_interactive: bool = args.yes

    # --list-images
    if args.list_images:
        action_list_images()
        return

    # --list-vms
    if args.list_vms:
        action_list_vms()
        return

    # --delete NAME
    if args.delete:
        action_delete(args.delete, non_interactive=non_interactive)
        return

    # --clone [NAME]
    if args.clone is not None:
        # If a name came in positionally (--clone foo), use it as default.
        if args.clone != "__PROMPT__" and not args.name:
            args.name = args.clone
        action_clone(args, non_interactive=non_interactive)
        return

    # Default action: build the golden image.
    action_create_golden(args, non_interactive=non_interactive)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        error("Interrupted.")
        sys.exit(130)