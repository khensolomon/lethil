#!/usr/bin/env python3
"""
secrets.py — Project-Aware GitHub Secrets Manager

Single source of truth: the project .env file.
No secrets.conf required. Run from inside any git repository that has a .env.

HOW THE .env IS STRUCTURED
─────────────────────────────────────────────────────────────────────────────
  # ZONE 1 — Production app values (pushed as ENV_BASE)
  SECRET_KEY=xxx
  DEBUG=False
  STORAGE_ROOT=/opt/bucket/storage

  # NOTE: development          ← hard boundary — everything below stays local

  # ZONE 2 — Local dev overrides (ignored by this script)
  DEBUG=True
  DB_HOST=localhost

  # ZONE 3 — Deployment secrets (pushed individually as GitHub Actions secrets)
  SERVER_HOSTNAME=ssh.admin.com
  SERVER_USER=root
  SSH_PRIVATE_KEY_PATH=~/.ssh/prod_server
  VM_RUNNER_STATUS_PAT=github_pat_xxxx
  CF_SERVICE_TOKEN_ID=xxxx.access
  CF_SERVICE_TOKEN_SECRET=xxxx
─────────────────────────────────────────────────────────────────────────────

BACKUP LOCATION
  STORAGE_ROOT (from Zone 1) + repo-name + /env/
  e.g. /opt/bucket/storage/repo-one/env/env-2026-04-22_14-30-00.env
  Fallback: ~/.deploy/backups/<repo-name>/ if STORAGE_ROOT is not set.

USAGE
  python3 secrets.py               Project overview — safe default, nothing pushed
  python3 secrets.py --push        Push all secrets to GitHub
  python3 secrets.py --push --only KEY   Push one secret (partial name match ok)
  python3 secrets.py --push --dry-run    Validate + preview, nothing pushed
  python3 secrets.py --push --force      Push all, skip stale detection
  python3 secrets.py --status      Compare local .env vs GitHub side-by-side
  python3 secrets.py --diff        Show what changed since the last backup
  python3 secrets.py --env-preview Show cleaned Zone 1 (ENV_BASE)
  python3 secrets.py --list        List secret names on GitHub
  python3 secrets.py --init        Scaffold deployment section in .env
  python3 secrets.py --restore     Restore .env from a previous backup
  python3 secrets.py --rotate      Guided SSH key rotation
  python3 secrets.py --check       Verify gh, git, .env structure
  python3 secrets.py --env FILE    Override which .env file to use
  python3 secrets.py --repo ORG/R  Override REPO_OWNER/REPO_NAME detection
"""

import os
import re
import sys
import json
import shutil
import tempfile
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

# ── SECTION MAP ───────────────────────────────────────────────────────────────
# constants & keys       ~  65
# abort helper           ~  95
# gh CLI wrappers        ~ 105
# git root detection     ~ 195
# .env parser            ~ 210
# backup system          ~ 365
# display helpers        ~ 440
# partial key matching   ~ 480
# cmd_overview           ~ 505
# cmd_check              ~ 555
# cmd_env_preview        ~ 610
# cmd_status             ~ 625
# cmd_diff               ~ 645
# cmd_list               ~ 700
# cmd_restore            ~ 710
# cmd_init               ~ 745
# cmd_rotate             ~ 830
# cmd_push               ~ 900
# parse_args             ~ 985
# main                   ~ 1020
# entry point            ~ 1110
# ─────────────────────────────────────────────────────────────────────────────


# ==============================================================================
# CONSTANTS
# ==============================================================================

# Keys found in Zone 3 pushed as individual GitHub Actions secrets
DEPLOY_KEYS = {
    "SERVER_HOSTNAME",
    "SERVER_USER",
    "VM_RUNNER_STATUS_PAT",
    "CF_SERVICE_TOKEN_ID",
    "CF_SERVICE_TOKEN_SECRET",
}

# Holds a file path — file contents are read and pushed as SSH_PRIVATE_KEY
SSH_KEY_PATH_KEY = "SSH_PRIVATE_KEY_PATH"
SSH_KEY_SECRET   = "SSH_PRIVATE_KEY"

# Repo identity — read from Zone 1, joined as REPO_OWNER/REPO_NAME
# Both must exist in Zone 1 or the script aborts immediately.
REPO_OWNER_KEY   = "REPO_OWNER"
REPO_NAME_KEY    = "REPO_NAME"

# Auto-provided by GitHub Actions — never pushed manually
GITHUB_MANAGED   = {"GITHUB_TOKEN"}

# Values masked in all terminal output
SENSITIVE_KEYS   = {
    "SSH_PRIVATE_KEY",
    "ENV_BASE",
    "CF_SERVICE_TOKEN_SECRET",
    "VM_RUNNER_STATUS_PAT",
}

# Hard boundary separating Zone 1 from Zones 2 + 3
DEV_MARKER       = "# NOTE: development"

# Number of timestamped backup files to retain per project
BACKUP_RETENTION = 10


# ==============================================================================
# ABORT HELPER
# ==============================================================================

def abort(reason: str, hint: str = "") -> None:
    """Print a clear error message and exit. Execution never continues."""
    print(f"\n  ABORT: {reason}")
    if hint:
        # Indent every line of the hint consistently
        for line in hint.splitlines():
            print(f"  Hint : {line}" if line == hint.splitlines()[0] else f"         {line}")
    print()
    sys.exit(1)


# ==============================================================================
# GH CLI — PREREQUISITE CHECK AND WRAPPERS
# ==============================================================================

def _gh_available() -> bool:
    """Return True if gh binary exists on PATH."""
    try:
        subprocess.run(["gh", "--version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def _tool_available(name: str) -> bool:
    """Return True if a command-line tool exists on PATH."""
    try:
        subprocess.run([name, "--version"], capture_output=True)
        return True
    except FileNotFoundError:
        return False


def check_gh(silent: bool = False) -> bool:
    """
    Verify gh is installed and the user is authenticated.
    Returns True if all clear. Prints instructions if silent=False.
    """
    result = subprocess.run(["gh", "--version"], capture_output=True, text=True)
    if result.returncode != 0:
        if not silent:
            print("\n  ERROR: 'gh' (GitHub CLI) is not installed or not on PATH.\n")
            print("  Install for the current platform:\n")
            print("    Ubuntu / Debian   sudo apt install gh")
            print("    macOS             brew install gh")
            print("    Windows           winget install --id GitHub.cli")
            print("    All platforms     https://cli.github.com\n")
            print("  After installing, authenticate once:")
            print("    gh auth login\n")
        return False

    version_line = result.stdout.splitlines()[0].strip()

    auth = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
    if auth.returncode != 0:
        if not silent:
            print("\n  ERROR: gh is installed but not authenticated.\n")
            print("  Run:  gh auth login\n")
        return False

    if not silent:
        print(f"  gh version : {version_line}")
        for line in (auth.stderr + auth.stdout).splitlines():
            if "Logged in" in line or "account" in line.lower():
                print(f"  gh auth    : {line.strip()}")
                break

    return True


def gh_secret_set(name: str, value: str, repo: str) -> tuple:
    """
    Push one secret via gh. Value is sent via stdin — never in the
    process argument list or shell history.
    Returns (success: bool, message: str).
    """
    try:
        result = subprocess.run(
            ["gh", "secret", "set", name, "--repo", repo],
            input=value, capture_output=True, text=True,
        )
        if result.returncode == 0:
            return True, "ok"
        err = result.stderr.strip() or result.stdout.strip() or "unknown error"
        return False, err
    except FileNotFoundError:
        return False, "gh not found — was it removed after startup?"
    except OSError as e:
        return False, f"OS error calling gh: {e}"


def gh_secret_list(repo: str) -> list:
    """Return sorted list of secret names currently on the repository."""
    try:
        result = subprocess.run(
            ["gh", "secret", "list", "--repo", repo, "--json", "name"],
            capture_output=True, text=True,
        )
    except FileNotFoundError:
        abort("gh not found.", "Run: python3 secrets.py --check")

    if result.returncode != 0:
        abort(
            f"gh secret list failed: {result.stderr.strip() or result.stdout.strip()}",
            "Check gh auth status and repository access."
        )
    data = json.loads(result.stdout or "[]")
    return sorted(item["name"] for item in data)


def gh_detect_repo() -> str | None:
    """
    Ask gh for the current repository (org/repo).
    Returns None if not inside a git repo, no remote is set, or network fails.
    """
    try:
        result = subprocess.run(
            ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            name = result.stdout.strip()
            if name:
                return name
    except (FileNotFoundError, OSError):
        pass
    return None


# ==============================================================================
# GIT ROOT DETECTION
# ==============================================================================

def find_git_root(start: Path) -> Path | None:
    """Walk up from start until a .git directory is found. Returns None if not found."""
    current = start.resolve()
    while True:
        if (current / ".git").exists():
            return current
        parent = current.parent
        if parent == current:
            return None
        current = parent


# ==============================================================================
# .env PARSER AND ZONE SPLITTER
# ==============================================================================

def _clean_line(line: str) -> str | None:
    """
    Process one raw .env line:
      - Strip leading whitespace
      - Skip blank lines and full comment lines
      - Strip inline comments (quote-aware — # inside quotes is preserved)
      - Normalise KEY = VALUE → KEY=VALUE around the first =
    Returns the cleaned string, or None if the line should be skipped.
    """
    line = line.lstrip()
    if not line or line.startswith("#"):
        return None

    out      = ""
    in_quote = ""
    for ch in line:
        if in_quote:
            out += ch
            if ch == in_quote:
                in_quote = ""
        else:
            if ch in ('"', "'"):
                in_quote = ch
                out += ch
            elif ch == "#":
                break
            else:
                out += ch

    out = out.rstrip()

    idx = out.find("=")
    if idx > 0:
        key = out[:idx].rstrip()
        val = out[idx + 1:].lstrip()
        out = f"{key}={val}"

    return out if out else None


def parse_env_file(env_path: Path) -> dict:
    """
    Parse a .env file into zones. Aborts with a clear message on any error.

    Returns:
        zone1        {KEY: VALUE}  — production app values (above marker)
        zone3        {KEY: VALUE}  — known deployment keys (below marker)
        storage_root  str | None    — STORAGE_ROOT from Zone 1
        raw_zone1    str           — cleaned Zone 1 text for ENV_BASE
    """
    if not env_path.exists():
        abort(
            f".env file not found at: {env_path}",
            "Every project using secrets.py must have a .env file at the repository root.\n"
            "Run:  python3 secrets.py --init   to scaffold the deployment section."
        )

    try:
        raw_text = env_path.read_text(encoding="utf-8")
    except PermissionError:
        abort(
            f"Permission denied reading: {env_path}",
            f"Check file permissions:  ls -la {env_path}"
        )
    except UnicodeDecodeError:
        abort(
            f"{env_path} is not a valid UTF-8 text file.",
            "The .env file may be corrupted or accidentally a binary file."
        )

    zone1_lines  = []
    zone3_raw    = {}
    in_dev       = False
    marker_found = False

    for raw_line in raw_text.splitlines():
        stripped = raw_line.rstrip()

        if stripped.strip().lower().startswith("# note: development"):
            in_dev       = True
            marker_found = True
            continue

        if not in_dev:
            cleaned = _clean_line(stripped)
            if cleaned:
                zone1_lines.append(cleaned)
        else:
            cleaned = _clean_line(stripped)
            if cleaned and "=" in cleaned:
                k, _, v = cleaned.partition("=")
                k = k.strip()
                if k in DEPLOY_KEYS or k == SSH_KEY_PATH_KEY:
                    zone3_raw[k] = v.strip()

    if not marker_found:
        abort(
            f"'# NOTE: development' marker not found in {env_path.name}",
            "This marker separates production values from local dev values.\n"
            "Add it to .env before the local development section."
        )

    if not zone1_lines:
        abort(
            f"Zone 1 (above '# NOTE: development') in {env_path.name} is empty.",
            "Production app variables must exist above the marker."
        )

    zone1 = {}
    for line in zone1_lines:
        if "=" in line:
            k, _, v = line.partition("=")
            zone1[k.strip()] = v.strip()

    return {
        "zone1":       zone1,
        "zone3":       zone3_raw,
        "storage_root": zone1.get("STORAGE_ROOT"),
        "raw_zone1":   "\n".join(zone1_lines) + "\n",
    }


def resolve_secrets(env_data: dict) -> dict:
    """
    Build the final {SECRET_NAME: value} dict ready to push to GitHub.
    Aborts if any required value is missing, empty, or points to a missing file.
    """
    secrets = {}
    errors  = []

    secrets["ENV_BASE"] = env_data["raw_zone1"]

    zone3 = env_data["zone3"]

    # SSH private key — read file contents from path
    if SSH_KEY_PATH_KEY in zone3:
        ssh_path = Path(zone3[SSH_KEY_PATH_KEY]).expanduser().resolve()
        if not ssh_path.exists():
            errors.append(
                f"  SSH_PRIVATE_KEY_PATH points to a missing file: {ssh_path}\n"
                f"  Generate:  ssh-keygen -t ed25519 -C prod-deploy -f {ssh_path} -N ''"
            )
        else:
            try:
                key_content = ssh_path.read_text()
                if not key_content.strip():
                    errors.append(f"  SSH key file is empty: {ssh_path}")
                else:
                    secrets[SSH_KEY_SECRET] = key_content
            except PermissionError:
                errors.append(f"  Permission denied reading SSH key: {ssh_path}")
    else:
        errors.append(
            f"  {SSH_KEY_PATH_KEY} is missing from Zone 3 of .env\n"
            f"  Add:  {SSH_KEY_PATH_KEY}=~/.ssh/prod_server"
        )

    # All other deployment keys
    missing = []
    for key in sorted(DEPLOY_KEYS):
        if key in zone3:
            val = zone3[key]
            if not val or "REPLACE_ME" in val:
                errors.append(f"  {key} has an empty or placeholder value")
            else:
                secrets[key] = val
        else:
            missing.append(key)

    if missing:
        errors.append(
            "  Missing deployment keys in Zone 3 of .env:\n"
            + "\n".join(f"    {k}=REPLACE_ME" for k in missing)
        )

    if errors:
        print(f"\n  Validation failed — {len(errors)} issue(s):\n")
        for e in errors:
            print(e)
        print()
        sys.exit(1)

    return secrets


# ==============================================================================
# BACKUP SYSTEM
# ==============================================================================

def resolve_backup_dir(storage_root: str | None, repo_slug: str) -> Path:
    """
    Derive the backup directory:
      Primary  : STORAGE_ROOT / repo-slug / env
      Fallback : ~/.deploy/backups / repo-slug
    Aborts if neither can be created.
    """
    if storage_root:
        backup_dir = Path(storage_root) / repo_slug / "env"
    else:
        backup_dir = Path.home() / ".deploy" / "backups" / repo_slug

    try:
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir
    except PermissionError:
        abort(
            f"Permission denied creating backup directory: {backup_dir}",
            "Check that STORAGE_ROOT in .env points to a writable location."
        )
    except OSError as e:
        abort(f"Cannot create backup directory: {backup_dir}", str(e))


def backup_env(env_path: Path, backup_dir: Path) -> Path:
    """
    Write a timestamped backup of .env to backup_dir.
    Uses an atomic write (temp file + rename) to prevent partial writes.
    Updates env-latest.env and prunes old backups beyond BACKUP_RETENTION.
    Returns the path of the new backup file.
    """
    timestamp   = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_file = backup_dir / f"env-{timestamp}.env"

    try:
        # Atomic write — write to temp then rename so backup is never partial
        tmp = backup_dir / f".env-{timestamp}.tmp"
        shutil.copy2(env_path, tmp)
        tmp.rename(backup_file)

        # Update env-latest.env atomically too
        latest_tmp = backup_dir / ".env-latest.tmp"
        shutil.copy2(env_path, latest_tmp)
        latest_tmp.rename(backup_dir / "env-latest.env")

    except PermissionError:
        abort(
            f"Permission denied writing backup to: {backup_dir}",
            "Check write permissions on the backup directory."
        )
    except OSError as e:
        abort(f"Backup failed: {e}")

    # Prune old backups
    timestamped = sorted(
        backup_dir.glob("env-????-??-??_??-??-??.env"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in timestamped[BACKUP_RETENTION:]:
        try:
            old.unlink()
        except OSError:
            pass  # pruning failure is non-fatal

    return backup_file


def list_backups(backup_dir: Path) -> list:
    """Return timestamped backup files, most recent first."""
    return sorted(
        backup_dir.glob("env-????-??-??_??-??-??.env"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )


# ==============================================================================
# DISPLAY HELPERS
# ==============================================================================

def preview_value(key: str, value: str) -> str:
    """Return a display-safe preview. Sensitive values are masked."""
    lines = value.strip().splitlines()
    if key in SENSITIVE_KEYS or len(lines) > 1:
        if len(lines) > 1:
            return f"[{len(lines)} lines]"
        masked = value[:6] + "*" * min(len(value) - 6, 20)
        return f"{masked}  ({len(value)} chars)"
    return value if len(value) <= 60 else value[:57] + "..."


def print_table(rows: list, headers: tuple) -> None:
    """Print a compact fixed-width aligned table."""
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))
    print()
    print("  ".join(h.ljust(widths[i]) for i, h in enumerate(headers)))
    print("  ".join("-" * w for w in widths))
    for row in rows:
        print("  ".join(str(c).ljust(widths[i]) for i, c in enumerate(row)))
    print()


def header(title: str) -> None:
    """Print a consistent section header."""
    print(f"\n  {'─' * 56}")
    print(f"  {title}")
    print(f"  {'─' * 56}")


# ==============================================================================
# PARTIAL KEY MATCHING (for --only)
# ==============================================================================

def resolve_only_key(partial: str, available: dict) -> str:
    """
    Match a partial key name. Exact match wins first.
    Falls back to case-insensitive prefix match.
    Aborts if ambiguous or not found.
    """
    if partial in available:
        return partial

    upper   = partial.upper()
    matches = [k for k in available if k.startswith(upper)]

    if len(matches) == 1:
        print(f"  Matched '--only {partial}' → {matches[0]}")
        return matches[0]

    if len(matches) > 1:
        abort(
            f"--only '{partial}' is ambiguous — matches {len(matches)} keys:",
            "\n".join(f"  {m}" for m in sorted(matches))
        )

    abort(
        f"--only '{partial}' matched no known secret.",
        f"Available: {', '.join(sorted(available))}"
    )


# ==============================================================================
# COMMANDS
# ==============================================================================

def cmd_overview(git_root: Path, env_path: Path, env_data: dict,
                 repo: str, backup_dir: Path) -> None:
    """
    Default no-argument command. Shows project state at a glance.
    Safe — reads only, nothing is pushed or modified.
    """
    header("OVERVIEW — project secrets state")

    # Environment
    print(f"\n  git root     : {git_root}")
    print(f"  .env         : {env_path}")
    print(f"  repository   : {repo}")

    # Backup state
    backups = list_backups(backup_dir)
    if backups:
        last = datetime.fromtimestamp(
            backups[0].stat().st_mtime
        ).strftime("%Y-%m-%d %H:%M:%S")
        print(f"  backup dir   : {backup_dir}  ({len(backups)} backup(s))")
        print(f"  last backup  : {last}")
    else:
        print(f"  backup dir   : {backup_dir}  (no backups yet)")

    # Zone 3 deployment key status
    zone3 = env_data["zone3"]
    print(f"\n  Deployment keys (Zone 3):\n")

    all_keys = sorted(DEPLOY_KEYS | {SSH_KEY_PATH_KEY})
    any_missing = False
    for k in all_keys:
        val = zone3.get(k)
        if not val:
            print(f"    MISSING  {k}")
            any_missing = True
        elif k in SENSITIVE_KEYS or k == SSH_KEY_PATH_KEY:
            if k == SSH_KEY_PATH_KEY:
                resolved = Path(val).expanduser()
                exists   = resolved.exists()
                state    = "file exists" if exists else "FILE NOT FOUND"
                print(f"    OK       {k}={val}  ({state})")
                if not exists:
                    any_missing = True
            else:
                print(f"    OK       {k}={preview_value(k, val)}")
        else:
            print(f"    OK       {k}={val}")

    # Zone 1 summary
    line_count = len(env_data["raw_zone1"].strip().splitlines())
    print(f"\n  Zone 1 (ENV_BASE): {line_count} lines ready to push\n")

    # Next step hint
    if any_missing:
        print("  Some keys are missing. Run:  python3 secrets.py --init\n")
    else:
        print("  Everything looks good.")
        print("  Run:  python3 secrets.py --push            to push all secrets")
        print("  Run:  python3 secrets.py --push --dry-run  to preview first\n")


def cmd_check(args, git_root: Path, env_path: Path) -> None:
    """
    Technical verification: gh, git root, .env structure, all deployment keys.
    """
    header("CHECK — environment readiness")

    # gh
    gh_ok = check_gh(silent=False)
    if not gh_ok:
        sys.exit(1)

    print(f"\n  git root     : {git_root}")
    print(f"  .env         : {env_path}")

    if not env_path.exists():
        abort(
            f".env not found at {env_path}",
            "Run: python3 secrets.py --init"
        )

    env_data = parse_env_file(env_path)
    repo     = args.repo or env_data.get("deploy_repo") or gh_detect_repo()
    if not repo:
        abort(
            "Could not determine the repository.",
            "Add REPO_OWNER and REPO_NAME in Zone 1 of .env."
        )
    print(f"  repository   : {repo}")

    storage = env_data["storage_root"]
    if storage:
        print(f"  STORAGE_ROOT  : {storage}")
    else:
        print(f"  STORAGE_ROOT  : not set — fallback: {Path.home() / '.deploy' / 'backups'}")

    zone3        = env_data["zone3"]
    all_keys     = sorted(DEPLOY_KEYS | {SSH_KEY_PATH_KEY})
    missing_keys = []

    print(f"\n  Deployment keys ({len(all_keys)} required):\n")
    for k in all_keys:
        val = zone3.get(k)
        if not val:
            print(f"    MISSING  {k}")
            missing_keys.append(k)
        else:
            print(f"    OK       {k}")

    ssh_path = zone3.get(SSH_KEY_PATH_KEY)
    if ssh_path:
        resolved = Path(ssh_path).expanduser()
        exists   = resolved.exists()
        print(f"\n  SSH key file : {resolved}  ({'exists' if exists else 'NOT FOUND'})")
        if not exists:
            print(f"  Generate:    ssh-keygen -t ed25519 -C prod-deploy -f {resolved} -N ''")
            missing_keys.append(SSH_KEY_PATH_KEY + "_file")

    if missing_keys:
        print(f"\n  {len(missing_keys)} issue(s) found. Run:  python3 secrets.py --init\n")
        sys.exit(1)
    else:
        print("\n  All checks passed.\n")


def cmd_env_preview(env_data: dict) -> None:
    """Show the cleaned Zone 1 content that would be pushed as ENV_BASE."""
    header("ENV PREVIEW — Zone 1 (production values only)")
    print()
    for line in env_data["raw_zone1"].splitlines():
        if "=" in line:
            k = line.split("=")[0]
            if k in SENSITIVE_KEYS:
                print(f"  {k}=***")
                continue
        print(f"  {line}")
    line_count = len(env_data["raw_zone1"].strip().splitlines())
    print(f"\n  {line_count} lines would be pushed as ENV_BASE.\n")


def cmd_status(repo: str, env_data: dict) -> None:
    """Compare local deployment secrets vs what is currently on GitHub."""
    header(f"STATUS — local vs GitHub  ({repo})")

    secrets      = resolve_secrets(env_data)
    remote_names = set(gh_secret_list(repo))
    local_names  = set(secrets.keys())
    all_names    = sorted(local_names | remote_names)

    rows = []
    for name in all_names:
        local  = "set"         if name in local_names  else "NOT IN .env"
        remote = "set"         if name in remote_names else "MISSING on GitHub"
        flag   = ""            if (name in local_names and name in remote_names) else "←"
        rows.append((name, local, remote, flag))

    print_table(rows, ("SECRET", "LOCAL", "GITHUB", ""))

    needs_action = [r[0] for r in rows if r[3]]
    if needs_action:
        print(f"  {len(needs_action)} secret(s) need attention.")
        print(f"  Run:  python3 secrets.py --push   to sync.\n")
    else:
        print("  Local and GitHub are in sync.\n")


def cmd_diff(env_path: Path, backup_dir: Path) -> None:
    """Show which Zone 1 keys changed between the last backup and now."""
    header("DIFF — current .env vs last backup")
    print()
    print("  Note: --diff compares local backups, not GitHub.")
    print("        GitHub secrets are write-only and cannot be read back.\n")

    backups = list_backups(backup_dir)
    if not backups:
        abort(
            "--diff requires at least one backup.",
            f"Backup directory: {backup_dir}\n"
            "A backup is created automatically before every push.\n"
            "Run:  python3 secrets.py --push --dry-run   to validate first,\n"
            "then: python3 secrets.py --push             to push and create the first backup."
        )

    latest_backup = backups[0]
    mtime = datetime.fromtimestamp(
        latest_backup.stat().st_mtime
    ).strftime("%Y-%m-%d %H:%M:%S")
    print(f"  Comparing against: {latest_backup.name}  ({mtime})\n")

    current  = parse_env_file(env_path)["zone1"]
    previous = {}
    try:
        prev_text = latest_backup.read_text(encoding="utf-8")
    except (PermissionError, OSError) as e:
        abort(f"Cannot read backup file: {latest_backup}", str(e))

    for line in prev_text.splitlines():
        cleaned = _clean_line(line.rstrip())
        if cleaned and "=" in cleaned:
            k, _, v = cleaned.partition("=")
            previous[k.strip()] = v.strip()

    all_keys = sorted(set(current) | set(previous))
    rows     = []
    changed  = 0

    for key in all_keys:
        cur = current.get(key)
        prv = previous.get(key)
        if cur is None:
            rows.append((key, "—", "present", "REMOVED"))
            changed += 1
        elif prv is None:
            rows.append((key, "present", "—", "ADDED"))
            changed += 1
        elif cur != prv:
            rows.append((key, "changed", "was different", "CHANGED"))
            changed += 1
        else:
            rows.append((key, "same", "same", ""))

    print_table(rows, ("KEY", "CURRENT", "BACKUP", "STATUS"))

    if changed:
        print(f"  {changed} key(s) changed since last backup.\n")
    else:
        print("  No changes since last backup.\n")


def cmd_list(repo: str) -> None:
    """List secret names currently set on the repository."""
    header(f"LIST — secrets on {repo}")
    names = gh_secret_list(repo)
    if names:
        for name in names:
            note = "  [GitHub-managed]" if name in GITHUB_MANAGED else ""
            print(f"    {name}{note}")
    else:
        print("    (none)")
    print()


def cmd_restore(env_path: Path, backup_dir: Path) -> None:
    """Interactively restore .env from a previous backup."""
    header("RESTORE — pick a backup to restore")

    backups = list_backups(backup_dir)
    if not backups:
        abort(
            "No backups found — nothing to restore.",
            f"Backup directory: {backup_dir}\n"
            "Backups are created automatically before each push.\n"
            "Run:  python3 secrets.py --push   to push and create the first backup."
        )

    print()
    for i, b in enumerate(backups, start=1):
        mtime = datetime.fromtimestamp(b.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        size  = b.stat().st_size
        print(f"  [{i:2}]  {b.name}  ({mtime}, {size} bytes)")

    print()
    raw = input("  Select backup number (or Enter to cancel): ").strip()
    if not raw:
        print("  Cancelled.\n")
        return

    try:
        idx = int(raw) - 1
        if not (0 <= idx < len(backups)):
            raise ValueError
    except ValueError:
        abort("Invalid selection — enter a number from the list.")

    chosen  = backups[idx]
    confirm = input(
        f"\n  Restore from {chosen.name}?\n"
        f"  This will overwrite {env_path}. Confirm? [y/N]: "
    ).strip().lower()

    if confirm != "y":
        print("\n  Cancelled.\n")
        return

    # Back up current state before overwriting — atomic write
    backup_file = backup_env(env_path, backup_dir)
    print(f"\n  Current .env backed up → {backup_file.name}")

    try:
        tmp = env_path.parent / ".env.restore.tmp"
        shutil.copy2(chosen, tmp)
        tmp.rename(env_path)
    except (PermissionError, OSError) as e:
        abort(f"Restore failed: {e}")

    print(f"  .env restored from {chosen.name}\n")


def cmd_init(args, git_root: Path, env_path: Path) -> None:
    """
    Append the deployment secrets scaffold below the # NOTE: development marker.
    Prompts interactively. Rewrites the deployment block cleanly on each run.
    """
    header("INIT — add deployment scaffold to .env")

    if not env_path.exists():
        abort(
            f".env not found at {env_path}",
            "Create .env with production app values first, then re-run --init."
        )

    try:
        content = env_path.read_text(encoding="utf-8")
    except PermissionError:
        abort(f"Permission denied reading: {env_path}")

    if DEV_MARKER.lower() not in content.lower():
        abort(
            f"'# NOTE: development' marker not found in {env_path.name}",
            "Add this marker line to .env before the local development section."
        )

    env_data    = parse_env_file(env_path)
    existing_z3 = env_data["zone3"]

    # Repo detection from Zone 1 — abort if either key is missing
    owner = env_data["zone1"].get("REPO_OWNER")
    name  = env_data["zone1"].get("REPO_NAME")
    if not owner:
        abort(
            "REPO_OWNER not found in Zone 1 of .env",
            "Add REPO_OWNER=your-github-org above '# NOTE: development', then re-run --init."
        )
    if not name:
        abort(
            "REPO_NAME not found in Zone 1 of .env",
            "Add REPO_NAME=your-repo-name above '# NOTE: development', then re-run --init."
        )
    detected_repo = args.repo or f"{owner}/{name}"

    print(f"\n  Detected from Zone 1:")
    print(f"    REPO_OWNER : {owner}")
    print(f"    REPO_NAME  : {name}")
    print(f"    Repository : {detected_repo}")
    print(f"\n  Press Enter to continue, Ctrl+C to cancel.")
    input()

    print("  Prompting for Zone 3 deployment secrets.")
    print("  Press Enter to keep the existing value.\n")

    def prompt(key: str, default: str = "", mask: bool = False) -> str:
        cur     = existing_z3.get(key, default)
        display = f"{cur[:10]}..." if mask and len(cur) > 10 else cur
        val     = input(f"  {key} [{display}]: ").strip()
        return val or cur

    scaffold = {}
    scaffold["SERVER_HOSTNAME"]      = prompt("SERVER_HOSTNAME")
    scaffold["SERVER_USER"]          = prompt("SERVER_USER", "root")
    scaffold[SSH_KEY_PATH_KEY]       = prompt(SSH_KEY_PATH_KEY, "~/.ssh/prod_server")
    scaffold["VM_RUNNER_STATUS_PAT"] = prompt("VM_RUNNER_STATUS_PAT", mask=True)
    scaffold["CF_SERVICE_TOKEN_ID"]  = prompt("CF_SERVICE_TOKEN_ID")
    scaffold["CF_SERVICE_TOKEN_SECRET"] = prompt("CF_SERVICE_TOKEN_SECRET", mask=True)

    # Build the deployment block
    block_lines = [
        "",
        "# Deployment secrets — used by secrets.py only, never sent to Django",
    ]
    for k, v in scaffold.items():
        if v:
            block_lines.append(f"{k}={v}")

    # Find the marker and replace everything after it with the new block
    marker_pos = content.lower().find("# note: development")
    zone_above = content[:marker_pos].rstrip()
    new_content = zone_above + "\n\n# NOTE: development\n" + "\n".join(block_lines) + "\n"

    # Atomic write
    try:
        tmp = env_path.parent / ".env.init.tmp"
        tmp.write_text(new_content, encoding="utf-8")
        tmp.rename(env_path)
    except (PermissionError, OSError) as e:
        abort(f"Failed to write .env: {e}")

    print(f"\n  .env updated at {env_path}")
    print("  Run:  python3 secrets.py --check   to verify everything is ready.\n")


def cmd_rotate(repo: str, env_path: Path, backup_dir: Path) -> None:
    """Guided SSH key rotation."""
    header("ROTATE — SSH key rotation")

    if not _tool_available("ssh-keygen"):
        abort(
            "ssh-keygen is not available on PATH.",
            "Install OpenSSH:  sudo apt install openssh-client   (Ubuntu)\n"
            "                  brew install openssh               (macOS)"
        )

    env_data = parse_env_file(env_path)
    zone3    = env_data["zone3"]
    cur_path = zone3.get(SSH_KEY_PATH_KEY)

    if not cur_path:
        abort(
            f"{SSH_KEY_PATH_KEY} not set in .env Zone 3.",
            "Add it below '# NOTE: development' or run --init."
        )

    cur_resolved = Path(cur_path).expanduser()
    new_path_str = input(
        f"  New key path [{cur_resolved}_new]: "
    ).strip() or f"{cur_resolved}_new"
    new_path = Path(new_path_str).expanduser()

    print(f"\n  Generating new Ed25519 key at {new_path} ...")
    result = subprocess.run(
        ["ssh-keygen", "-t", "ed25519", "-C", "prod-deploy-rotated",
         "-f", str(new_path), "-N", ""],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        abort("ssh-keygen failed.", result.stderr.strip())

    pub_path = Path(str(new_path) + ".pub")
    try:
        pub_key = pub_path.read_text().strip()
    except OSError as e:
        abort(f"Cannot read new public key: {e}")

    print(f"\n  New public key:\n\n  {pub_key}\n")
    print("  Add this public key to the server's ~/.ssh/authorized_keys")
    print("  before continuing — keep the old key active during transition.\n")

    input("  Press Enter once the new public key is authorised on the server...")

    # Update SSH_PRIVATE_KEY_PATH in .env — atomic write
    try:
        content   = env_path.read_text(encoding="utf-8")
        old_entry = f"{SSH_KEY_PATH_KEY}={cur_path}"
        new_entry = f"{SSH_KEY_PATH_KEY}={new_path_str}"
        if old_entry in content:
            new_content = content.replace(old_entry, new_entry, 1)
            tmp = env_path.parent / ".env.rotate.tmp"
            tmp.write_text(new_content, encoding="utf-8")
            tmp.rename(env_path)
            print(f"\n  .env updated: {SSH_KEY_PATH_KEY} → {new_path_str}")
        else:
            print(f"\n  Could not find '{old_entry}' in .env — update it manually.")
    except (PermissionError, OSError) as e:
        abort(f"Failed to update .env: {e}")

    # Push the new key
    print(f"  Pushing new {SSH_KEY_SECRET} to GitHub ({repo}) ...")
    new_env_data = parse_env_file(env_path)
    new_secrets  = resolve_secrets(new_env_data)
    ok, msg      = gh_secret_set(SSH_KEY_SECRET, new_secrets[SSH_KEY_SECRET], repo)

    if ok:
        backup_file = backup_env(env_path, backup_dir)
        print(f"  GitHub secret updated.")
        print(f"  .env backed up → {backup_file.name}")
        print(f"\n  Rotation complete.")
        print(f"  Test a deployment, then remove the old key from authorized_keys")
        print(f"  and delete {cur_resolved}\n")
    else:
        abort(f"Failed to push {SSH_KEY_SECRET} to GitHub.", msg)


def cmd_push(args, repo: str, env_data: dict, env_path: Path, backup_dir: Path) -> None:
    """Resolve, validate, optionally dry-run, back up, and push secrets."""
    secrets = resolve_secrets(env_data)

    # --only filter with partial matching
    if args.only:
        key     = resolve_only_key(args.only, secrets)
        secrets = {key: secrets[key]}

    # Stale detection — skip unchanged secrets vs last backup
    if not args.force and not args.only:
        latest = backup_dir / "env-latest.env"
        if latest.exists():
            try:
                prev      = parse_env_file(latest)
                prev_vals = {
                    "ENV_BASE": prev["raw_zone1"],
                    **{k: prev["zone3"].get(k, "") for k in DEPLOY_KEYS},
                }
                unchanged = {k for k, v in secrets.items() if prev_vals.get(k) == v}
                if unchanged:
                    print(f"\n  Skipping {len(unchanged)} unchanged secret(s):")
                    for k in sorted(unchanged):
                        print(f"    {k}")
                    for k in list(unchanged):
                        del secrets[k]
            except Exception:
                pass  # stale detection failure is non-fatal — push everything

    if not secrets:
        print("\n  All secrets are up to date. Nothing to push.\n")
        return

    # --dry-run
    if args.dry_run:
        header("DRY RUN — what would be pushed")
        rows = [(k, preview_value(k, v), "would push") for k, v in sorted(secrets.items())]
        print_table(rows, ("SECRET", "VALUE PREVIEW", "ACTION"))
        print(f"  {len(secrets)} secret(s) validated. Nothing was pushed or backed up.\n")
        return

    # Backup before any GitHub interaction
    backup_file = backup_env(env_path, backup_dir)
    print(f"\n  .env backed up → {backup_file.name}")
    print(f"  Repository    : {repo}")
    print(f"  Pushing       : {len(secrets)} secret(s)")

    results = []
    success = 0
    failed  = 0

    for key, value in sorted(secrets.items()):
        ok, msg = gh_secret_set(key, value, repo)
        if ok:
            results.append((key, preview_value(key, value), "OK  pushed"))
            success += 1
        else:
            short = msg[:50] + "..." if len(msg) > 50 else msg
            results.append((key, preview_value(key, value), f"ERR {short}"))
            failed += 1

    print_table(results, ("SECRET", "VALUE PREVIEW", "RESULT"))
    print(f"  Total : {len(secrets)}  |  Success : {success}  |  Failed : {failed}")

    if failed:
        print(f"\n  {failed} secret(s) failed. Backup saved before attempting.\n")
        sys.exit(1)
    else:
        print(f"\n  All {success} secret(s) pushed successfully.")

    # Always show what was sent as ENV_BASE after a successful push
    if "ENV_BASE" in secrets and success > 0:
        print()
        print("  ── ENV_BASE (what the server will receive) " + "─" * 10)
        for line in env_data["raw_zone1"].splitlines():
            if "=" in line:
                k = line.split("=")[0].strip()
                if k in SENSITIVE_KEYS:
                    print(f"  {k}=***")
                    continue
            print(f"  {line}")
        line_count = len(env_data["raw_zone1"].strip().splitlines())
        print(f"  ── {line_count} lines ──")
        print()


# ==============================================================================
# ARGUMENT PARSING
# ==============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Project-aware GitHub secrets manager.\n"
            "Run from inside a git repository that has a .env file.\n"
            "Default (no arguments): show project overview — safe, nothing pushed."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Mutually exclusive commands
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--push",       action="store_true", help="Push secrets to GitHub.")
    mode.add_argument("--status",     action="store_true", help="Compare local vs GitHub secrets.")
    mode.add_argument("--diff",       action="store_true", help="Show changes since last backup.")
    mode.add_argument("--env-preview",action="store_true", help="Show cleaned Zone 1 (ENV_BASE).")
    mode.add_argument("--list",       action="store_true", help="List secret names on GitHub.")
    mode.add_argument("--init",       action="store_true", help="Scaffold deployment section in .env.")
    mode.add_argument("--restore",    action="store_true", help="Restore .env from a backup.")
    mode.add_argument("--rotate",     action="store_true", help="Guided SSH key rotation.")
    mode.add_argument("--check",      action="store_true", help="Verify gh, git, .env structure.")

    # Push modifiers (only meaningful with --push)
    parser.add_argument("--only",     metavar="KEY",      help="Push one secret (partial match ok).")
    parser.add_argument("--dry-run",  action="store_true",help="Preview what --push would do. Nothing sent.")
    parser.add_argument("--force",    action="store_true",help="Push all secrets, skip stale detection.")

    # Global overrides
    parser.add_argument("--env",      metavar="FILE",     help="Override .env file path.")
    parser.add_argument("--repo",     metavar="ORG/REPO", help="Override auto-detected repository.")

    return parser.parse_args()


# ==============================================================================
# MAIN — CONTEXT RESOLUTION + COMMAND DISPATCH
# ==============================================================================

def main():
    args = parse_args()

    # ── Verify gh is available before anything else ───────────────────────────
    if not _gh_available():
        abort(
            "gh (GitHub CLI) is not installed or not on PATH.",
            "Run: python3 secrets.py --check   for install instructions."
        )

    # ── Find git root ─────────────────────────────────────────────────────────
    git_root = find_git_root(Path.cwd())
    if not git_root:
        abort(
            "Not inside a git repository.",
            "Run secrets.py from within a project directory that has a .git folder."
        )

    # ── Locate .env ───────────────────────────────────────────────────────────
    env_path = Path(args.env).expanduser().resolve() if args.env else git_root / ".env"

    # ── --check and --init are allowed before .env is fully configured ────────
    if args.check:
        cmd_check(args, git_root, env_path)
        return

    if args.init:
        cmd_init(args, git_root, env_path)
        return

    # ── All other commands need a fully valid .env ────────────────────────────
    if not check_gh(silent=True):
        abort(
            "gh is not authenticated.",
            "Run:  gh auth login"
        )

    env_data = parse_env_file(env_path)

    # ── Resolve repository ────────────────────────────────────────────────────
    # Repo is always derived from Zone 1 — abort if either key is missing
    _owner = env_data["zone1"].get("REPO_OWNER")
    _name  = env_data["zone1"].get("REPO_NAME")
    if not _owner:
        abort(
            "REPO_OWNER not found in Zone 1 of .env",
            "Add REPO_OWNER=your-github-org above '# NOTE: development'."
        )
    if not _name:
        abort(
            "REPO_NAME not found in Zone 1 of .env",
            "Add REPO_NAME=your-repo-name above '# NOTE: development'."
        )
    repo = args.repo or f"{_owner}/{_name}"

    # ── Resolve backup directory ──────────────────────────────────────────────
    storage_root = env_data["storage_root"]
    if not storage_root:
        fallback = Path.home() / ".deploy" / "backups"
        print(
            f"\n  NOTE: STORAGE_ROOT not set in .env.\n"
            f"  Backups will be saved to: {fallback}\n"
        )
    repo_slug  = repo.split("/")[-1]
    backup_dir = resolve_backup_dir(storage_root, repo_slug)

    # ── Command dispatch ──────────────────────────────────────────────────────
    if args.push:
        cmd_push(args, repo, env_data, env_path, backup_dir)

    elif args.status:
        cmd_status(repo, env_data)

    elif args.diff:
        cmd_diff(env_path, backup_dir)

    elif args.env_preview:
        cmd_env_preview(env_data)

    elif args.list:
        cmd_list(repo)

    elif args.restore:
        cmd_restore(env_path, backup_dir)

    elif args.rotate:
        cmd_rotate(repo, env_path, backup_dir)

    else:
        # Default — safe overview, nothing pushed
        cmd_overview(git_root, env_path, env_data, repo, backup_dir)


# ==============================================================================
# ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Cancelled.\n")
        sys.exit(0)
    except EOFError:
        print("\n\n  Input closed unexpectedly (stdin is not a terminal).\n")
        sys.exit(1)
    except BrokenPipeError:
        sys.exit(0)  # silent — normal when output is piped to head/less
