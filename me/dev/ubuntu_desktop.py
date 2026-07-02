#!/usr/bin/env python3

"""
Ubuntu Environment Interactive Setup Script

version: v26.07.02-1

Highlight:
    - Interactive, data-driven setup for fresh Ubuntu/Debian desktop
      environments. Designed to be executed directly from a URL or locally.
    - Dry-run by default: audits system state and reports what would change.
      No modification is made until '--apply' is passed.
    - External JSON task injection via '--tasks' (local path or HTTPS URL).
      Remote task files are pinned with trust-on-first-use SHA-256 hashing
      and validated against a task schema before merging.
    - Pre-flight checks: OS family, internet reachability, and system clock
      synchronization. An out-of-sync clock (common in fresh VMs) is repaired
      immediately via 'date -s' and long-term via systemd-timesyncd.
    - Installs core applications (git, MariaDB Server, media tools), the
      virtualization stack (QEMU/KVM, libvirt, virt-manager, GNOME Boxes),
      and Docker CE from the upstream Docker repository, including required
      group memberships (docker, libvirt, kvm).
    - GNOME extensions are cloned under '~/dev/' and symlinked into the
      local extensions directory, so future updates are a plain 'git pull'.
    - Configures autostart applications and the GNOME dock position.
    - Every change is logged to '~/.ubuntu_setup_history.json' with previous
      values where applicable, for review and manual rollback.

Usage:
    Audit only (default, no changes are made):
        python3 ubuntu_desktop.py

    Apply changes interactively:
        python3 ubuntu_desktop.py --apply

    Non-interactive apply (accept all defaults, suitable for VM provisioning):
        python3 ubuntu_desktop.py --apply --yes

    Merge custom tasks from a local file or HTTPS URL:
        python3 ubuntu_desktop.py --apply --tasks ./tasks.json
        python3 ubuntu_desktop.py --apply --tasks https://example.com/tasks.json

    Run directly from a URL:
        curl -fsSL https://raw.githubusercontent.com/khensolomon/lethil/master/ubuntu_desktop.py | python3 - --apply

    Show version:
        python3 ubuntu_desktop.py --version
"""

import os
import sys
import grp
import json
import shutil
import hashlib
import getpass
import argparse
import datetime
import subprocess
import email.utils
import urllib.request

VERSION = "v26.07.02-1"

# ==========================================
# 0. DEFAULTS
# ==========================================
DEFAULTS = {
    "log_file": "~/.ubuntu_setup_history.json",
    "trust_file": "~/.ubuntu_setup_trust.json",
    "dev_dir": "~/dev",
    "extensions_dir": "~/.local/share/gnome-shell/extensions",
    "autostart_dir": "~/.config/autostart",
    "connectivity_urls": [
        "https://connectivity-check.ubuntu.com",
        "https://clients3.google.com/generate_204",
    ],
    "clock_skew_seconds": 300,
    "http_timeout": 8,
    "docker_gpg_url": "https://download.docker.com/linux/{distro}/gpg",
    "docker_keyring": "/etc/apt/keyrings/docker.asc",
    "docker_sources": "/etc/apt/sources.list.d/docker.list",
}

# Runtime flags (set from CLI arguments in main)
APPLY = False
ASSUME_YES = False
_APT_UPDATED = False

# ==========================================
# 1. CONFIGURATION DATA
# ==========================================
SETUP_TASKS = [
    {
        "name": "Required Applications",
        "prompt": "Check and install missing required applications?",
        "type": "apt_packages",
        "packages": [
            "git", "curl", "wget", "gpg",
            "inkscape", "gimp", "audacity",
            "sqlitebrowser", "mariadb-server",
            "openssh-server"
        ]
    },
    {
        "name": "Virtualization Stack (QEMU/KVM, libvirt, Boxes)",
        "prompt": "Install the virtualization stack (GNOME Boxes, virt-manager, QEMU/KVM)?",
        "type": "apt_stack",
        "packages": [
            "gnome-boxes", "virt-manager", "virtinst",
            "qemu-system-x86", "libvirt-daemon-system",
            "libvirt-clients", "ovmf"
        ],
        "groups": ["libvirt", "kvm"],
        "note": "Group membership changes require logging out and back in."
    },
    {
        "name": "Docker CE (upstream repository)",
        "prompt": "Install Docker CE from the official Docker apt repository?",
        "type": "docker_ce",
        "packages": [
            "docker-ce", "docker-ce-cli", "containerd.io",
            "docker-buildx-plugin", "docker-compose-plugin"
        ],
        "groups": ["docker"],
        "note": "Group membership changes require logging out and back in."
    },
    {
        "name": "GNOME Extension",
        "prompt": "Install custom GNOME extension 'lesion' (clone + symlink)?",
        "type": "git_extension",
        "repo": "https://github.com/khensolomon/lesion.git",
    },
    {
        "name": "Autostart Applications",
        "prompt": "Configure autostart applications?",
        "type": "autostart_group",
        "items": [
            {
                "app_name": "Visual Studio Code",
                "filename": "vscode.desktop",
                "content": [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Exec=code",
                    "Hidden=false",
                    "NoDisplay=false",
                    "Name=Visual Studio Code",
                    "Comment=Start VS Code on login"
                ]
            },
            {
                "app_name": "Remmina",
                "filename": "remmina.desktop",
                "content": [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Exec=remmina -i",
                    "Hidden=false",
                    "NoDisplay=false",
                    "Name=Remmina",
                    "Comment=Start Remmina on login"
                ]
            },
            {
                "app_name": "SSH Agent",
                "filename": "ssh-agent.desktop",
                "skip_if_env": "SSH_AUTH_SOCK",
                "content": [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Exec=ssh-agent",
                    "Hidden=false",
                    "NoDisplay=false",
                    "Name=SSH Agent",
                    "Comment=Start SSH Agent on login"
                ]
            }
        ]
    },
    {
        "name": "GNOME Dock Configuration",
        "prompt": "Change GNOME panel to a floating dock?",
        "type": "gnome_dock_interactive"
    }
]

# Schema used to validate built-in and injected tasks. Only these task
# types are accepted; required fields must be present per type.
TASK_SCHEMAS = {
    "apt_packages": {"required": ["packages"]},
    "apt_stack": {"required": ["packages"]},
    "docker_ce": {"required": []},
    "git_extension": {"required": ["repo"]},
    "autostart_group": {"required": ["items"]},
    "gnome_dock_interactive": {"required": []},
}

# ==========================================
# 2. LOGGER SYSTEM (For Verification & Rollback)
# ==========================================
LOG_FILE = os.path.expanduser(DEFAULTS["log_file"])
TRUST_FILE = os.path.expanduser(DEFAULTS["trust_file"])

def log_action(action_data):
    """Appends structured data to the local history JSON file."""
    history = []

    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r') as f:
                history = json.load(f)
        except json.JSONDecodeError:
            pass

    action_data["timestamp"] = datetime.datetime.now().isoformat()
    history.append(action_data)

    try:
        write_file_atomic(LOG_FILE, json.dumps(history, indent=4))
    except IOError as e:
        print_error(f"Failed to write to log file: {e}")

# ==========================================
# 3. UI & FORMATTING HELPERS
# ==========================================
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"{Colors.HEADER}{Colors.BOLD}{text}{Colors.ENDC}")

def print_step(text):
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}==> {text}{Colors.ENDC}")

def print_info(text, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{text}")

def print_success(text, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{Colors.OKGREEN}[✓] {text}{Colors.ENDC}")

def print_error(text, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{Colors.FAIL}[✗] {text}{Colors.ENDC}")

def print_dry(text, indent=2):
    spacing = "  " * indent
    print(f"{spacing}{Colors.WARNING}[dry-run] {text}{Colors.ENDC}")

def ensure_tty():
    """Re-attaches stdin to the terminal when the script body was piped in.

    Only required for interactive apply mode; audit and --yes runs never
    read from stdin.
    """
    if not sys.stdin.isatty():
        try:
            sys.stdin = open('/dev/tty')
        except OSError:
            print("\n[!] Error: No interactive terminal detected. This mode requires user input.")
            print("    Use '--yes' for non-interactive runs, or omit '--apply' to audit only.")
            sys.exit(1)

def ask_yes_no(question, default="y", indent=1):
    valid = {"yes": True, "y": True, "ye": True, "no": False, "n": False}
    prompt_hint = " [Y/n] " if default == "y" else " [y/N] "
    spacing = "  " * indent

    if ASSUME_YES:
        print(f"{spacing}{Colors.WARNING}? {question}{prompt_hint}{Colors.ENDC}{default} (auto)")
        return valid[default]

    while True:
        print(f"{spacing}{Colors.WARNING}? {question}{prompt_hint}{Colors.ENDC}", end="")
        try:
            choice = input().lower()
        except EOFError:
            print_error("\nInput stream detached. Cannot read user input.")
            sys.exit(1)

        if choice == "":
            return valid[default]
        elif choice in valid:
            return valid[choice]
        else:
            print_info("Please respond with 'yes' or 'no' (or 'y' or 'n').", indent + 1)

def ask_choice(question, choices, default=None, indent=1):
    spacing = "  " * indent

    if ASSUME_YES:
        selected = default if default in choices else choices[0]
        print(f"{spacing}{Colors.WARNING}? {question}{Colors.ENDC} -> {selected} (auto)")
        return selected

    print(f"{spacing}{Colors.WARNING}? {question}{Colors.ENDC}")

    for i, choice in enumerate(choices, 1):
        if default and choice == default:
            print_info(f"{i}. {choice.capitalize()} (default)", indent + 1)
        else:
            print_info(f"{i}. {choice.capitalize()}", indent + 1)

    default_hint = f" [{choices.index(default) + 1}]" if default and default in choices else ""

    while True:
        print(f"{spacing}{Colors.WARNING}Select an option [1-{len(choices)}]{default_hint}: {Colors.ENDC}", end="")
        try:
            raw_input = input().strip()
        except EOFError:
            print_error("\nInput stream detached. Cannot read user input.")
            sys.exit(1)

        if not raw_input and default and default in choices:
            return default

        try:
            answer = int(raw_input)
            if 1 <= answer <= len(choices):
                return choices[answer - 1]
            else:
                print_info(f"Please enter a number between 1 and {len(choices)}.", indent + 1)
        except ValueError:
            print_info("Please enter a valid number.", indent + 1)

def ensure_sudo(reason="Administrative privileges are required for this step.", indent=2):
    print_info(reason, indent)
    try:
        subprocess.run(['sudo', '-v'], check=True)
    except subprocess.CalledProcessError:
        print_error("Failed to acquire sudo privileges. Exiting to prevent partial setup.", indent)
        sys.exit(1)
    except KeyboardInterrupt:
        print_error("\nSetup aborted by user.", indent)
        sys.exit(1)
    except FileNotFoundError:
        print_error("Command 'sudo' not found. Cannot proceed.", indent)
        sys.exit(1)

# ==========================================
# 4. SYSTEM HELPERS
# ==========================================
def write_file_atomic(path, content):
    """Writes content to path via a temp file + rename, avoiding partial files."""
    directory = os.path.dirname(path) or "."
    tmp_path = os.path.join(directory, f".{os.path.basename(path)}.tmp")
    with open(tmp_path, 'w') as f:
        f.write(content)
    os.replace(tmp_path, path)

def fetch_url(url, timeout=None):
    """Fetches a URL and returns raw bytes. HTTPS is enforced."""
    if not url.startswith('https://'):
        raise ValueError(f"Only HTTPS URLs are accepted: {url}")
    timeout = timeout or DEFAULTS["http_timeout"]
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()

def fetch_url_trusted(url):
    """Fetches a URL with trust-on-first-use SHA-256 pinning.

    The first fetch records the content hash in the trust file. Later
    fetches warn (and require confirmation) if the content changed.
    """
    data = fetch_url(url)
    digest = hashlib.sha256(data).hexdigest()

    trust = {}
    if os.path.exists(TRUST_FILE):
        try:
            with open(TRUST_FILE, 'r') as f:
                trust = json.load(f)
        except json.JSONDecodeError:
            trust = {}

    known = trust.get(url)
    if known is None:
        trust[url] = digest
        write_file_atomic(TRUST_FILE, json.dumps(trust, indent=4))
        print_info(f"First fetch of this URL. Pinned SHA-256: {digest[:16]}...", indent=1)
    elif known != digest:
        print_error("Remote content has CHANGED since it was first trusted!", indent=1)
        print_info(f"Pinned:  {known}", indent=2)
        print_info(f"Current: {digest}", indent=2)
        if not ask_yes_no("Trust the new content and update the pin?", default="n", indent=1):
            raise RuntimeError(f"Untrusted content change for {url}")
        trust[url] = digest
        write_file_atomic(TRUST_FILE, json.dumps(trust, indent=4))
    else:
        print_success(f"Content matches pinned SHA-256 ({digest[:16]}...).", indent=1)

    return data

def apt_update_once(force=False):
    """Runs 'apt-get update' at most once per script run (unless forced)."""
    global _APT_UPDATED
    if _APT_UPDATED and not force:
        print_info("Package list already updated this run. Skipping.", indent=2)
        return
    subprocess.run(['sudo', 'apt-get', 'update'], check=True)
    _APT_UPDATED = True

def is_package_installed(pkg):
    try:
        result = subprocess.run(['dpkg', '-s', pkg],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return result.returncode == 0
    except FileNotFoundError:
        return None  # dpkg missing entirely

def is_group_member(group):
    """Checks configured membership in /etc/group (effective after re-login)."""
    try:
        return getpass.getuser() in grp.getgrnam(group).gr_mem
    except KeyError:
        return False

def get_os_release():
    data = {}
    try:
        with open('/etc/os-release') as f:
            for line in f:
                line = line.strip()
                if '=' in line:
                    key, _, value = line.partition('=')
                    data[key] = value.strip('"')
    except IOError:
        pass
    return data

def get_current_gsetting(schema, key):
    try:
        result = subprocess.run(['gsettings', 'get', schema, key],
                                capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None

def check_gsettings_schema_exists(schema):
    """Checks if a gsettings schema is installed on the system."""
    try:
        result = subprocess.run(['gsettings', 'list-schemas'],
                                capture_output=True, text=True, check=True)
        return schema in result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def validate_tasks(tasks, source="custom", overlay_names=None):
    """Validates a list of task dicts against TASK_SCHEMAS.

    Tasks whose 'name' matches an entry in overlay_names are treated as
    overlays of a built-in task and may omit 'type' (it is inherited during
    merging). Invalid entries are reported and dropped.
    """
    overlay_names = overlay_names or set()
    valid = []
    for i, task in enumerate(tasks, 1):
        label = task.get('name', f"#{i}") if isinstance(task, dict) else f"#{i}"
        if not isinstance(task, dict):
            print_error(f"Task {label} ({source}): not a JSON object. Dropped.", indent=1)
            continue
        task_type = task.get('type')
        if task_type is None and task.get('name') in overlay_names:
            valid.append(task)
            continue
        if task_type not in TASK_SCHEMAS:
            print_error(f"Task '{label}' ({source}): unknown type '{task_type}'. Dropped.", indent=1)
            continue
        missing = [f for f in TASK_SCHEMAS[task_type]["required"] if f not in task]
        if missing:
            print_error(f"Task '{label}' ({source}): missing fields {missing}. Dropped.", indent=1)
            continue
        valid.append(task)
    return valid

# ==========================================
# 5. TASK RUNNERS
# ==========================================
def install_packages_interactive(task, packages):
    """Shared check/prompt/install flow for apt-based tasks.

    Returns the list of packages that were installed (apply mode only).
    """
    missing_packages = []
    installed_packages = []
    print_info("Checking package status...", indent=1)

    for pkg in packages:
        status = is_package_installed(pkg)
        if status is None:
            print_error("Command 'dpkg' not found. Is this a Debian/Ubuntu system?", indent=2)
            return []
        if status:
            print_success(f"{pkg} is already installed.", indent=2)
            installed_packages.append(pkg)
        else:
            print_error(f"{pkg} is NOT installed.", indent=2)
            missing_packages.append(pkg)

    if not APPLY:
        if missing_packages:
            print_dry(f"Would install: {', '.join(missing_packages)}")
        else:
            print_success("All packages are already installed.", indent=2)
        return []

    installed_now = []
    if missing_packages:
        choices = [
            f"Install all {len(missing_packages)} missing packages",
            "Ask to install each missing package individually",
            "Skip missing package installation"
        ]
        choice = ask_choice("How would you like to handle the missing packages?",
                            choices, default=choices[0], indent=2)

        packages_to_install = []

        if choice == choices[0]:
            packages_to_install = missing_packages
        elif choice == choices[1]:
            for pkg in missing_packages:
                if ask_yes_no(f"Install {pkg}?", default="n", indent=3):
                    packages_to_install.append(pkg)

        if packages_to_install:
            ensure_sudo(reason=f"Sudo is required to install {len(packages_to_install)} package(s).", indent=2)
            print_info("Updating package list and installing...", indent=2)
            try:
                apt_update_once()
                subprocess.run(['sudo', 'apt-get', 'install', '-y'] + packages_to_install, check=True)
                print_success("Packages installed successfully.", indent=2)
                installed_now = packages_to_install

                log_action({
                    "task_name": task.get("name", "Unknown Task"),
                    "type": "apt_installed",
                    "packages_installed": packages_to_install
                })
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print_error(f"Failed to install packages: {e}", indent=2)
        else:
            print_info("Skipping missing package installation.", indent=2)
    else:
        print_success("All required packages are already installed!", indent=2)

    if installed_packages:
        print_info("\nChecking for updates for existing packages...", indent=1)
        if ask_yes_no(f"Would you like to check and apply updates for the {len(installed_packages)} already installed packages?", default="n", indent=2):
            ensure_sudo(reason="Sudo is required to upgrade packages.", indent=2)
            try:
                apt_update_once()
                print_info("Upgrading existing packages to their newest versions...", indent=2)
                subprocess.run(['sudo', 'apt-get', 'install', '--only-upgrade', '-y'] + installed_packages, check=True)
                print_success("Packages updated successfully.", indent=2)

                log_action({
                    "task_name": task.get("name", "Unknown Task"),
                    "type": "apt_upgraded",
                    "packages_upgraded": installed_packages
                })
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print_error(f"Failed to upgrade packages: {e}", indent=2)
        else:
            print_info("Skipping package upgrades.", indent=2)

    return installed_now

def apply_group_memberships(task):
    """Ensures the current user is in the groups a task requires."""
    groups = task.get("groups", [])
    if not groups:
        return

    user = getpass.getuser()
    pending = [g for g in groups if not is_group_member(g)]

    for g in groups:
        if g in pending:
            print_error(f"User '{user}' is not in group '{g}'.", indent=2)
        else:
            print_success(f"User '{user}' is already in group '{g}'.", indent=2)

    if not pending:
        return

    if not APPLY:
        print_dry(f"Would add user '{user}' to group(s): {', '.join(pending)}")
        return

    if ask_yes_no(f"Add user '{user}' to group(s): {', '.join(pending)}?", default="y", indent=2):
        ensure_sudo(reason="Sudo is required to modify group membership.", indent=2)
        added = []
        for g in pending:
            try:
                subprocess.run(['sudo', 'usermod', '-aG', g, user], check=True)
                print_success(f"Added '{user}' to '{g}'.", indent=2)
                added.append(g)
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print_error(f"Failed to add group '{g}': {e}", indent=2)
        if added:
            log_action({
                "task_name": task.get("name", "Unknown Task"),
                "type": "groups_added",
                "user": user,
                "groups": added
            })
            print_info("Note: group changes take effect after logging out and back in.", indent=2)

def run_apt_packages(task):
    packages = task.get("packages", [])
    if not packages:
        return
    install_packages_interactive(task, packages)

def run_apt_stack(task):
    """Installs a package set plus required group memberships."""
    packages = task.get("packages", [])
    if packages:
        install_packages_interactive(task, packages)
    apply_group_memberships(task)
    note = task.get("note")
    if note:
        print_info(note, indent=2)

def run_docker_ce(task):
    """Sets up the upstream Docker apt repository and installs Docker CE."""
    keyring = DEFAULTS["docker_keyring"]
    sources = DEFAULTS["docker_sources"]

    docker_bin = shutil.which('docker')
    repo_configured = os.path.exists(sources) and os.path.exists(keyring)

    if docker_bin:
        print_success(f"Docker CLI already present: {docker_bin}", indent=2)
    else:
        print_error("Docker CLI is NOT installed.", indent=2)

    if repo_configured:
        print_success("Docker apt repository is already configured.", indent=2)
    else:
        print_error("Docker apt repository is NOT configured.", indent=2)

    if not APPLY:
        if not repo_configured:
            print_dry("Would configure the upstream Docker apt repository (keyring + sources list).")
        missing = [p for p in task.get("packages", []) if not is_package_installed(p)]
        if missing:
            print_dry(f"Would install: {', '.join(missing)}")
        apply_group_memberships(task)
        return

    os_data = get_os_release()
    distro = os_data.get('ID', '')
    codename = os_data.get('VERSION_CODENAME') or os_data.get('UBUNTU_CODENAME', '')

    if distro not in ('ubuntu', 'debian'):
        # Derivatives (Pop!_OS, Mint) must map to their upstream base.
        id_like = os_data.get('ID_LIKE', '')
        if 'ubuntu' in id_like:
            distro = 'ubuntu'
        elif 'debian' in id_like:
            distro = 'debian'
        else:
            print_error(f"Unsupported distribution '{distro}' for the Docker CE repository.", indent=2)
            return

    if not codename:
        print_error("Could not determine the distribution codename from /etc/os-release.", indent=2)
        return

    if not repo_configured:
        if not ask_yes_no("Configure the upstream Docker apt repository?", default="y", indent=2):
            print_info("Skipping Docker repository setup.", indent=2)
            return

        ensure_sudo(reason="Sudo is required to configure the Docker repository.", indent=2)
        try:
            print_info("Fetching Docker GPG key...", indent=2)
            gpg_key = fetch_url(DEFAULTS["docker_gpg_url"].format(distro=distro))

            subprocess.run(['sudo', 'install', '-m', '0755', '-d', os.path.dirname(keyring)], check=True)
            subprocess.run(['sudo', 'tee', keyring], input=gpg_key,
                           stdout=subprocess.DEVNULL, check=True)

            arch = subprocess.run(['dpkg', '--print-architecture'],
                                  capture_output=True, text=True, check=True).stdout.strip()
            repo_line = (f"deb [arch={arch} signed-by={keyring}] "
                         f"https://download.docker.com/linux/{distro} {codename} stable\n")
            subprocess.run(['sudo', 'tee', sources], input=repo_line.encode(),
                           stdout=subprocess.DEVNULL, check=True)

            print_success("Docker repository configured.", indent=2)
            apt_update_once(force=True)  # new source requires a refresh

            log_action({
                "task_name": task.get("name", "Unknown Task"),
                "type": "apt_repo_added",
                "files": [keyring, sources]
            })
        except Exception as e:
            print_error(f"Failed to configure Docker repository: {e}", indent=2)
            return

    install_packages_interactive(task, task.get("packages", []))
    apply_group_memberships(task)
    note = task.get("note")
    if note:
        print_info(note, indent=2)

def run_git_extension(task):
    """Clones a GNOME extension repo under ~/dev and symlinks it into the
    local extensions directory. Updates become a plain 'git pull'.
    """
    repo = task["repo"]
    repo_name = os.path.basename(repo)
    if repo_name.endswith('.git'):
        repo_name = repo_name[:-4]

    dev_dir = os.path.expanduser(DEFAULTS["dev_dir"])
    dest = os.path.join(dev_dir, repo_name)
    ext_root = os.path.expanduser(DEFAULTS["extensions_dir"])

    cloned = os.path.isdir(os.path.join(dest, '.git'))
    if cloned:
        print_success(f"Repository already cloned: {dest}", indent=2)
    else:
        print_error(f"Repository not present at {dest}.", indent=2)

    # Determine the uuid if metadata is already available locally.
    uuid = None
    metadata_path = os.path.join(dest, 'metadata.json')
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path) as f:
                uuid = json.load(f).get('uuid')
        except (json.JSONDecodeError, IOError) as e:
            print_error(f"Could not read metadata.json: {e}", indent=2)

    link_path = os.path.join(ext_root, uuid) if uuid else None
    link_ok = bool(link_path and os.path.islink(link_path)
                   and os.path.realpath(link_path) == os.path.realpath(dest))
    if link_ok:
        print_success(f"Extension symlink in place: {link_path} -> {dest}", indent=2)
    elif uuid:
        print_error(f"Extension symlink missing or incorrect for uuid '{uuid}'.", indent=2)

    if not APPLY:
        if not cloned:
            print_dry(f"Would clone {repo} into {dest}.")
        else:
            print_dry(f"Would run 'git -C {dest} pull --ff-only' to update.")
        if not link_ok:
            print_dry(f"Would symlink {ext_root}/<uuid> -> {dest} and enable the extension.")
        return

    if not shutil.which('git'):
        print_error("Command 'git' not found. Run the 'Required Applications' task first.", indent=2)
        return

    try:
        if cloned:
            print_info("Updating existing clone (git pull --ff-only)...", indent=2)
            subprocess.run(['git', '-C', dest, 'pull', '--ff-only'], check=True)
        else:
            os.makedirs(dev_dir, exist_ok=True)
            print_info(f"Cloning {repo} into {dest}...", indent=2)
            subprocess.run(['git', 'clone', repo, dest], check=True)
    except subprocess.CalledProcessError as e:
        print_error(f"Git operation failed: {e}", indent=2)
        return

    # Re-read metadata after clone/update.
    if not os.path.exists(metadata_path):
        print_error("metadata.json not found at the repository root. Cannot link extension.", indent=2)
        return
    try:
        with open(metadata_path) as f:
            uuid = json.load(f).get('uuid')
    except (json.JSONDecodeError, IOError) as e:
        print_error(f"Could not read metadata.json: {e}", indent=2)
        return
    if not uuid:
        print_error("metadata.json does not define a 'uuid'. Cannot link extension.", indent=2)
        return

    link_path = os.path.join(ext_root, uuid)
    os.makedirs(ext_root, exist_ok=True)

    if os.path.islink(link_path):
        if os.path.realpath(link_path) != os.path.realpath(dest):
            print_error(f"Symlink exists but points elsewhere: {os.path.realpath(link_path)}", indent=2)
            if not ask_yes_no("Replace it?", default="y", indent=2):
                return
            os.remove(link_path)
    elif os.path.exists(link_path):
        print_error(f"A real directory already exists at {link_path}.", indent=2)
        if not ask_yes_no("Rename it to '.bak' and replace with a symlink?", default="n", indent=2):
            return
        os.rename(link_path, link_path + ".bak")

    if not os.path.exists(link_path):
        os.symlink(dest, link_path)
        print_success(f"Symlinked {link_path} -> {dest}", indent=2)

    # Compile schemas when the extension ships any.
    schemas_dir = os.path.join(dest, 'schemas')
    if os.path.isdir(schemas_dir) and shutil.which('glib-compile-schemas'):
        try:
            subprocess.run(['glib-compile-schemas', schemas_dir], check=True)
            print_success("Compiled extension schemas.", indent=2)
        except subprocess.CalledProcessError as e:
            print_error(f"Schema compilation failed: {e}", indent=2)

    # Enable: prefer the gnome-extensions CLI, fall back to gsettings so
    # the extension activates on the next login even if the current shell
    # session has not scanned it yet (required on Wayland).
    enabled = False
    if shutil.which('gnome-extensions'):
        result = subprocess.run(['gnome-extensions', 'enable', uuid],
                                capture_output=True, text=True)
        enabled = result.returncode == 0
    if not enabled:
        current = get_current_gsetting('org.gnome.shell', 'enabled-extensions')
        if current is not None and uuid not in current:
            try:
                # current is a GVariant string list like "['a', 'b']"
                merged = current.rstrip(']').rstrip()
                if merged.endswith('['):
                    merged += f"'{uuid}']"
                else:
                    merged += f", '{uuid}']"
                subprocess.run(['gsettings', 'set', 'org.gnome.shell',
                                'enabled-extensions', merged], check=True)
                enabled = True
            except subprocess.CalledProcessError:
                pass

    if enabled:
        print_success(f"Extension '{uuid}' enabled.", indent=2)
    else:
        print_info(f"Enable manually after re-login: gnome-extensions enable {uuid}", indent=2)
    print_info("A logout/login is required before GNOME Shell loads the extension (Wayland).", indent=2)

    log_action({
        "task_name": task.get("name", "Unknown Task"),
        "type": "git_extension",
        "repo": repo,
        "clone_path": dest,
        "symlink": link_path,
        "uuid": uuid,
        "update_hint": f"git -C {dest} pull"
    })

def run_autostart_group(task):
    autostart_dir = os.path.expanduser(DEFAULTS["autostart_dir"])
    created_files = []

    for item in task.get("items", []):
        app_name = item.get("app_name", "Unnamed App")
        filename = item.get("filename", "app.desktop")
        filepath = os.path.join(autostart_dir, filename)
        exists = os.path.exists(filepath)

        skip_env = item.get("skip_if_env")
        env_active = bool(skip_env and os.environ.get(skip_env))

        if not APPLY:
            if exists:
                print_success(f"{app_name}: {filename} already present.", indent=2)
            elif env_active:
                print_info(f"{app_name}: skipped, ${skip_env} indicates a running agent/service.", indent=2)
            else:
                print_dry(f"Would create {filepath}")
            continue

        default = "y"
        if env_active:
            print_info(f"${skip_env} is set. An equivalent agent/service appears to be active already.", indent=2)
            default = "n"

        if ask_yes_no(f"Add {app_name} to autostart?", default=default, indent=2):
            os.makedirs(autostart_dir, exist_ok=True)
            try:
                clean_content = "\n".join(item.get("content", [])) + "\n"
                write_file_atomic(filepath, clean_content)
                print_success(f"Created {filename}", indent=2)
                created_files.append(filepath)
            except IOError as e:
                print_error(f"Failed to create {filename}: {e}", indent=2)
        else:
            print_info(f"Skipping {app_name}.", indent=2)

    if created_files:
        log_action({
            "task_name": task.get("name", "Unknown Task"),
            "type": "files_created",
            "files": created_files
        })

def run_gnome_dock_interactive(task):
    schema = 'org.gnome.shell.extensions.dash-to-dock'

    if not check_gsettings_schema_exists(schema):
        print_error("The 'dash-to-dock' extension schema is not found on this system.", indent=2)
        print_info("Vanilla Debian does not include this by default. Skipping task.", indent=2)
        return

    current = get_current_gsetting(schema, 'dock-position')
    print_info(f"Current dock position: {current}", indent=2)

    if not APPLY:
        print_dry("Would prompt for a dock position and update dash-to-dock settings.")
        return

    position = ask_choice("Where do you want the dock positioned?",
                          ["BOTTOM", "LEFT", "RIGHT", "TOP"], default="LEFT", indent=2)

    rollback_data = [
        {"schema": schema, "key": "extend-height", "previous_value": get_current_gsetting(schema, 'extend-height')},
        {"schema": schema, "key": "dock-fixed", "previous_value": get_current_gsetting(schema, 'dock-fixed')},
        {"schema": schema, "key": "dock-position", "previous_value": current}
    ]

    cmds = [
        ['gsettings', 'set', schema, 'extend-height', 'false'],
        ['gsettings', 'set', schema, 'dock-fixed', 'true'],
        ['gsettings', 'set', schema, 'dock-position', f"'{position}'"]
    ]

    for cmd in cmds:
        try:
            subprocess.run(cmd, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print_error(f"Failed to execute '{' '.join(cmd)}': {e}", indent=2)
            return

    log_action({
        "task_name": task.get("name", "Unknown Task"),
        "type": "gsettings_modified",
        "rollback_instructions": rollback_data
    })

    print_success("Dock configured successfully.", indent=2)

TASK_HANDLERS = {
    "apt_packages": run_apt_packages,
    "apt_stack": run_apt_stack,
    "docker_ce": run_docker_ce,
    "git_extension": run_git_extension,
    "autostart_group": run_autostart_group,
    "gnome_dock_interactive": run_gnome_dock_interactive,
}

# ==========================================
# 6. MAIN ENGINE & MERGE LOGIC
# ==========================================
def merge_tasks(default_tasks, custom_tasks):
    merged = []
    custom_dict = {t['name']: t for t in custom_tasks if 'name' in t}

    for task in default_tasks:
        if task['name'] in custom_dict:
            user_task = custom_dict.pop(task['name'])
            merged_task = task.copy()

            if task.get('type') in ('apt_packages', 'apt_stack', 'docker_ce') and 'packages' in user_task:
                merged_task['packages'] = sorted(set(task.get('packages', []) + user_task['packages']))
                merged_task['prompt'] = user_task.get('prompt', task.get('prompt'))

            elif task.get('type') == 'autostart_group' and 'items' in user_task:
                merged_task['items'] = task.get('items', []) + user_task['items']
                merged_task['prompt'] = user_task.get('prompt', task.get('prompt'))

            merged.append(merged_task)
        else:
            merged.append(task)

    for task in custom_dict.values():
        merged.append(task)

    return merged

def load_custom_tasks(source):
    """Loads and validates custom tasks from a local path or HTTPS URL."""
    if source.startswith('http://'):
        print_error("Plain HTTP is not accepted for remote tasks. Use HTTPS.", indent=0)
        return None

    if source.startswith('https://'):
        print_info(f"Fetching remote custom tasks from {source}...", indent=0)
        raw = fetch_url_trusted(source)
        user_tasks = json.loads(raw.decode('utf-8'))
    elif os.path.exists(source):
        with open(source, 'r') as f:
            user_tasks = json.load(f)
    else:
        print_error(f"Custom tasks file/URL not found or invalid: {source}. Using defaults.", indent=0)
        return None

    if not isinstance(user_tasks, list):
        print_error("Tasks file must contain a JSON list. Using defaults.", indent=0)
        return None

    overlay_names = {t['name'] for t in SETUP_TASKS}
    return validate_tasks(user_tasks, source="injected", overlay_names=overlay_names)

def repair_system_clock(server_date_str, skew_minutes):
    """Fixes the clock immediately via 'date -s' and long-term via timesyncd."""
    ensure_sudo(reason="Sudo is required to update the system clock.", indent=3)
    fixed = False
    try:
        # Immediate correction from the trusted HTTPS Date header, so the
        # remainder of this run (APT, TLS) works right away.
        subprocess.run(['sudo', 'date', '-s', server_date_str],
                       check=True, stdout=subprocess.DEVNULL)
        print_success("System clock corrected from server time.", indent=3)
        fixed = True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print_error(f"Failed to set system time directly: {e}", indent=3)

    # Long-term: hand the clock to systemd-timesyncd so it stays in sync.
    if shutil.which('timedatectl'):
        try:
            subprocess.run(['sudo', 'timedatectl', 'set-ntp', 'true'],
                           check=True, stdout=subprocess.DEVNULL)
            print_success("NTP synchronization enabled (systemd-timesyncd).", indent=3)
            fixed = True
        except subprocess.CalledProcessError:
            print_info("Could not enable NTP via timedatectl.", indent=3)

    return fixed

def run_preflight_checks():
    print_step("System Environment Checks")

    print_info("Checking Operating System...", indent=1)
    os_data = get_os_release()
    os_id = os_data.get('ID', '')
    id_like = os_data.get('ID_LIKE', '')
    is_ubuntu_based = os_id in ('ubuntu', 'debian', 'pop') or 'ubuntu' in id_like or 'debian' in id_like

    if is_ubuntu_based:
        print_success(f"Ubuntu/Debian-based OS detected ({os_data.get('PRETTY_NAME', os_id)}).", indent=2)
    else:
        print_error("Non-Ubuntu OS detected. This script is designed for Debian/Ubuntu-based systems.", indent=2)
        if APPLY and not ask_yes_no("Are you sure you want to continue anyway? Things may break.", default="n", indent=2):
            sys.exit(1)

    print_info("Checking Internet & System Clock...", indent=1)
    response = None
    last_error = None
    for url in DEFAULTS["connectivity_urls"]:
        try:
            response = urllib.request.urlopen(url, timeout=DEFAULTS["http_timeout"])
            break
        except Exception as e:
            last_error = e

    if response is None:
        print_error(f"Internet check failed ({last_error}).", indent=2)
        print_info("GNOME Boxes or strict firewalls can sometimes cause false positives here.", indent=2)
        if APPLY and not ask_yes_no("Are you sure you have internet and want to proceed anyway?", default="n", indent=2):
            sys.exit(1)
    else:
        print_success("Internet connection active.", indent=2)

        # Check system time sync to prevent APT and SSL certificate failures.
        server_date_str = response.headers.get('Date')
        if server_date_str:
            server_time = email.utils.parsedate_to_datetime(server_date_str)
            local_time = datetime.datetime.now(datetime.timezone.utc)
            time_diff = abs((server_time - local_time).total_seconds())

            if time_diff > DEFAULTS["clock_skew_seconds"]:
                skew_minutes = int(time_diff / 60)
                print_error(f"System clock is out of sync (difference: ~{skew_minutes} minutes).", indent=2)
                print_info("A desynchronized clock will cause APT updates and SSL certificates to fail.", indent=2)

                if not APPLY:
                    print_dry("Would correct the clock ('date -s') and enable NTP (timedatectl).")
                elif ask_yes_no("Automatically fix the system time?", default="y", indent=2):
                    if not repair_system_clock(server_date_str, skew_minutes):
                        if not ask_yes_no("Proceed anyway? (Downloads will likely fail)", default="n", indent=3):
                            sys.exit(1)
                else:
                    if not ask_yes_no("Are you sure you want to proceed with a broken clock?", default="n", indent=2):
                        sys.exit(1)
            else:
                print_success("System clock is synchronized.", indent=2)

    print_info("Checking Python Version...", indent=1)
    if sys.version_info >= (3, 6):
        print_success(f"Python {sys.version_info.major}.{sys.version_info.minor} detected.", indent=2)
    else:
        print_error("Python 3.6+ is required.", indent=2)
        sys.exit(1)

def main():
    global APPLY, ASSUME_YES

    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--tasks', type=str, default=None,
                        help="Path or HTTPS URL to a custom JSON file to merge tasks.")
    parser.add_argument('--apply', action='store_true',
                        help="Apply changes. Without this flag the script audits only.")
    parser.add_argument('--yes', action='store_true',
                        help="Non-interactive mode: accept the default answer for every prompt.")
    parser.add_argument('--version', action='version', version=f"%(prog)s {VERSION}")
    args = parser.parse_args()

    APPLY = args.apply
    ASSUME_YES = args.yes

    if APPLY and not ASSUME_YES:
        ensure_tty()

    final_tasks = validate_tasks(SETUP_TASKS, source="built-in")

    if args.tasks:
        try:
            user_tasks = load_custom_tasks(args.tasks)
            if user_tasks is not None:
                final_tasks = merge_tasks(final_tasks, user_tasks)
                print_success(f"Successfully loaded and merged custom tasks from {args.tasks}", indent=0)
        except json.JSONDecodeError as e:
            print_error(f"Invalid JSON format: {e}. Using defaults.", indent=0)
        except Exception as e:
            print_error(f"Failed to load custom tasks: {e}. Using defaults.", indent=0)

    print_header(f"\nUbuntu Environment Interactive Setup Script {VERSION}")
    if APPLY:
        print_info("Mode: APPLY (changes will be made after confirmation)\n", indent=0)
    else:
        print_info("Mode: DRY-RUN (audit only; re-run with --apply to make changes)\n", indent=0)

    run_preflight_checks()

    print_step("Pre-flight Review")
    print_info("This script is configured to offer the following setup tasks:", indent=1)
    for i, task in enumerate(final_tasks, 1):
        print_info(f"{i}. {task.get('name', 'Unnamed Task')}", indent=2)

    if APPLY:
        print_info("\nPermission will be requested before any changes are made.", indent=1)
        if not ask_yes_no("Do you want to proceed with the setup wizard?", default="y", indent=1):
            print_info("Setup safely aborted by user.", indent=1)
            return

    for task in final_tasks:
        task_name = task.get("name", "Unnamed Task")
        print_step(task_name)

        handler = TASK_HANDLERS.get(task.get("type"))
        if not handler:
            print_error(f"Unknown task type: {task.get('type')}")
            continue

        if APPLY:
            prompt_text = task.get("prompt", f"Execute task: {task_name}?")
            if ask_yes_no(prompt_text):
                handler(task)
            else:
                print_info(f"Skipping {task_name.lower()}.", indent=1)
        else:
            handler(task)

    print_step("Audit Complete" if not APPLY else "Setup Complete")
    if APPLY:
        print_success(f"A detailed history of changes was saved to: {LOG_FILE}", indent=1)
        print_info("Please log out and log back in for all changes to take full effect.\n", indent=0)
    else:
        print_info("No changes were made. Re-run with '--apply' to perform the setup.\n", indent=1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("\n\nSetup aborted manually by user.")
        sys.exit(1)