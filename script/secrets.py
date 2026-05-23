#!/usr/bin/env python3
"""
secrets.py — project-aware GitHub secrets manager.

Single source of truth: the project .env file. Run from inside any git
repository that has a .env at its root.

HOW THE .env IS STRUCTURED
─────────────────────────────────────────────────────────────────────────────
  # Bundle zone (content before the first marker). Concatenated and pushed
  # as one secret named ENV_BASE.
  SECRET_KEY=xxx
  DEBUG=False
  STORAGE_ROOT=/opt/bucket/storage

  #@ individual
  # Each key below is pushed as its own GitHub secret. The set is not
  # hardcoded — whatever lands here is pushed. SSH_PRIVATE_KEY_PATH is
  # special: its file's CONTENTS are pushed as the secret SSH_PRIVATE_KEY.
  SSH_PRIVATE_KEY_PATH=~/.ssh/prod_server
  CF_SERVICE_TOKEN_ID=xxxx.access
  CF_SERVICE_TOKEN_SECRET=xxxx

  #@ local
  # Never pushed. Read by this script only.
  REPO_OWNER=khensolomon
  REPO_NAME=lethil
─────────────────────────────────────────────────────────────────────────────

Zone markers are whole lines of the form  #@ <mode>  where <mode> is one of:
bundle, individual, local. They must appear in that order; any may be absent.
Content before the first marker is the bundle zone.

BACKUP LOCATION
  STORAGE_ROOT (if set) + repo-name + /env/
  e.g. /opt/bucket/storage/lethil/env/env-2026-04-22_14-30-00.env
  Fallback: ~/.deploy/backups/<repo-name>/ if STORAGE_ROOT is not set.

USAGE
  python3 secrets.py               Project overview — safe default, nothing pushed
  python3 secrets.py --push        Push all secrets to GitHub
  python3 secrets.py --push --only KEY   Push one secret (partial name match ok)
  python3 secrets.py --push --dry-run    Validate + preview, nothing pushed
  python3 secrets.py --push --force      Push all, skip stale detection
  python3 secrets.py --status      Compare local .env vs GitHub side-by-side
  python3 secrets.py --diff        Show what changed since the last backup
  python3 secrets.py --env-preview Show cleaned bundle zone (ENV_BASE)
  python3 secrets.py --list        List secret names on GitHub
  python3 secrets.py --init        Ensure the zone markers exist in .env
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
#
# THE .env ZONE MODEL
# ─────────────────────────────────────────────────────────────────────────────
# A .env file is divided into three zones by marker lines. A marker is a line
# matching exactly:   #@ <mode>
# where <mode> is one of: bundle, individual, local.
#
#   #@ bundle      Concatenated and pushed as ONE secret named ENV_BASE.
#                  This is the production app config consumed by the deploy
#                  pipeline's merge action. Content before the first marker
#                  is treated as bundle by default (the marker is optional
#                  for backward compatibility).
#
#   #@ individual  Each key is pushed as its OWN secret. The set of keys is
#                  not hardcoded — whatever lands in this zone is pushed.
#                  SSH_PRIVATE_KEY_PATH is special-cased: its value is a file
#                  path, the file is read, and the CONTENTS are pushed as the
#                  secret SSH_PRIVATE_KEY (the path itself is never pushed).
#
#   #@ local       Never pushed. Read by this script only (e.g. REPO_OWNER,
#                  REPO_NAME). Also the home for any local-only value that
#                  must never reach GitHub.
#
# Zones must appear in order: bundle, then individual, then local. A zone may
# be absent. An unrecognised mode after #@ is a fatal error (likely a typo in
# a real marker).

# Recognised zone modes, in required order.
ZONE_MODES = ("bundle", "individual", "local")

# Marker syntax: a whole line of the form "#@ <mode>" (spacing flexible).
MARKER_RE = re.compile(r"^#@\s*([A-Za-z][A-Za-z0-9_-]*)\s*$")

# Holds a file path in the individual zone — the file's contents are read
# and pushed as the secret named below.
SSH_KEY_PATH_KEY = "SSH_PRIVATE_KEY_PATH"
SSH_KEY_SECRET   = "SSH_PRIVATE_KEY"

# The single bundled secret name produced from the bundle zone. Load-bearing:
# the deploy pipeline's merge action consumes a secret with exactly this name.
BUNDLE_SECRET    = "ENV_BASE"

# Repo identity — read from the local zone, joined as REPO_OWNER/REPO_NAME.
# These identify the target repo; they are never pushed as secrets.
REPO_OWNER_KEY   = "REPO_OWNER"
REPO_NAME_KEY    = "REPO_NAME"

# Storage root, if present in the bundle zone, sets the backup location.
STORAGE_ROOT_KEY = "STORAGE_ROOT"

# Auto-provided by GitHub Actions — never pushed manually.
GITHUB_MANAGED   = {"GITHUB_TOKEN"}

# Keys whose names contain any of these substrings are masked in terminal
# output, in addition to the always-masked names below. Covers most
# credential keys without needing an exhaustive list.
SENSITIVE_PATTERNS = ("_PWD", "_PASSWORD", "_SECRET", "_KEY", "_TOKEN", "_PAT")

# Names always masked regardless of pattern.
ALWAYS_SENSITIVE = {SSH_KEY_SECRET, BUNDLE_SECRET}

# Number of timestamped backup files to retain per project.
BACKUP_RETENTION = 10


def is_sensitive(key: str) -> bool:
    """Whether a secret name should be masked in terminal output."""
    if key in ALWAYS_SENSITIVE:
        return True
    upper = key.upper()
    return any(pat in upper for pat in SENSITIVE_PATTERNS)


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


def repo_from_env(env_data: dict) -> str | None:
    """
    Build 'owner/name' from REPO_OWNER and REPO_NAME if both are present.
    These live in the local zone (read by this script, never pushed). Returns
    None if either is missing.
    """
    owner = (env_data["local"].get(REPO_OWNER_KEY)
             or env_data["bundle"].get(REPO_OWNER_KEY))
    name  = (env_data["local"].get(REPO_NAME_KEY)
             or env_data["bundle"].get(REPO_NAME_KEY))
    if owner and name:
        return f"{owner}/{name}"
    return None


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
    Parse a .env file into the three zones (bundle, individual, local).
    Aborts with a clear message on any error.

    Zone markers are whole lines of the form "#@ <mode>". Content before the
    first marker belongs to the bundle zone. Zones must appear in order
    (bundle, individual, local); a zone may be absent.

    Returns:
        bundle        {KEY: VALUE}  — bundle-zone key/values (parsed)
        individual    {KEY: VALUE}  — individual-zone key/values
        local         {KEY: VALUE}  — local-zone key/values (never pushed)
        storage_root  str | None    — STORAGE_ROOT, looked up across zones
        raw_bundle    str           — cleaned bundle text, pushed as ENV_BASE
    """
    if not env_path.exists():
        abort(
            f".env file not found at: {env_path}",
            "Every project using secrets.py must have a .env file at the repository root.\n"
            "Run:  python3 secrets.py --init   to scaffold one."
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

    # Content before the first marker defaults to the bundle zone.
    current = "bundle"
    seen_order = []           # modes encountered, to validate ordering
    bundle_lines = []         # cleaned KEY=VALUE lines for the bundle text
    zones = {"bundle": {}, "individual": {}, "local": {}}

    for lineno, raw_line in enumerate(raw_text.splitlines(), 1):
        stripped = raw_line.rstrip()

        # Is this a zone marker?
        marker = MARKER_RE.match(stripped.strip())
        if marker:
            mode = marker.group(1).lower()
            if mode not in ZONE_MODES:
                abort(
                    f"{env_path.name}:{lineno}: unknown zone marker '#@ {mode}'.",
                    f"Valid markers: {', '.join('#@ ' + m for m in ZONE_MODES)}.\n"
                    f"This is most likely a typo in a real marker."
                )
            seen_order.append(mode)
            current = mode
            continue

        cleaned = _clean_line(stripped)
        if not cleaned or "=" not in cleaned:
            continue
        k, _, v = cleaned.partition("=")
        k = k.strip()
        v = v.strip()
        zones[current][k] = v
        if current == "bundle":
            bundle_lines.append(f"{k}={v}")

    # Validate zone ordering: markers must appear in the canonical order, and
    # no mode may be declared twice. (Content-before-first-marker is bundle by
    # default and does not count as a declared marker.)
    canonical_index = {m: i for i, m in enumerate(ZONE_MODES)}
    last = -1
    for mode in seen_order:
        idx = canonical_index[mode]
        if idx < last:
            abort(
                f"Zone markers out of order in {env_path.name}.",
                f"Markers must appear in this order: "
                f"{' → '.join('#@ ' + m for m in ZONE_MODES)}."
            )
        if idx == last:
            abort(
                f"Duplicate '#@ {mode}' marker in {env_path.name}.",
                "Each zone marker may appear at most once."
            )
        last = idx

    # STORAGE_ROOT may live in any zone; bundle is the conventional home.
    storage_root = (zones["bundle"].get(STORAGE_ROOT_KEY)
                    or zones["individual"].get(STORAGE_ROOT_KEY)
                    or zones["local"].get(STORAGE_ROOT_KEY))

    return {
        "bundle":       zones["bundle"],
        "individual":   zones["individual"],
        "local":        zones["local"],
        "storage_root": storage_root,
        "raw_bundle":   ("\n".join(bundle_lines) + "\n") if bundle_lines else "",
    }


def resolve_secrets(env_data: dict) -> dict:
    """
    Build the final {SECRET_NAME: value} dict ready to push to GitHub.

    - The bundle zone (if non-empty) becomes a single secret named ENV_BASE.
    - Every key in the individual zone becomes its own secret, EXCEPT
      SSH_PRIVATE_KEY_PATH, which is replaced by SSH_PRIVATE_KEY holding the
      contents of the file it points to.
    - The set of individual keys is not hardcoded: whatever is in the zone is
      pushed. Adding a key to .env needs no change here.

    Aborts if a value is an unfilled placeholder or SSH_PRIVATE_KEY_PATH
    points to a missing/empty file.
    """
    secrets = {}
    errors  = []

    # Bundle → ENV_BASE (only if there is bundle content).
    if env_data["raw_bundle"].strip():
        secrets[BUNDLE_SECRET] = env_data["raw_bundle"]

    individual = env_data["individual"]

    for key, val in individual.items():
        # SSH key path is special: push the file CONTENTS as SSH_PRIVATE_KEY.
        if key == SSH_KEY_PATH_KEY:
            ssh_path = Path(val).expanduser().resolve()
            if not ssh_path.exists():
                errors.append(
                    f"  {SSH_KEY_PATH_KEY} points to a missing file: {ssh_path}\n"
                    f"  Generate:  ssh-keygen -t ed25519 -C deploy -f {ssh_path} -N ''"
                )
                continue
            try:
                key_content = ssh_path.read_text()
            except PermissionError:
                errors.append(f"  Permission denied reading SSH key: {ssh_path}")
                continue
            if not key_content.strip():
                errors.append(f"  SSH key file is empty: {ssh_path}")
                continue
            secrets[SSH_KEY_SECRET] = key_content
            continue

        # Ordinary individual key. Skip empty / obvious placeholders.
        if not val or "REPLACE_ME" in val:
            errors.append(f"  {key} has an empty or placeholder value")
            continue
        secrets[key] = val

    if errors:
        print(f"\n  Validation failed — {len(errors)} issue(s):\n")
        for e in errors:
            print(e)
        print()
        sys.exit(1)

    if not secrets:
        abort(
            "Nothing to push.",
            "The .env has no bundle content and no individual-zone keys.\n"
            "Add values above the first marker (bundle) or under '#@ individual'."
        )

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
    if is_sensitive(key) or len(lines) > 1:
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

    # Individual-zone key status
    individual = env_data["individual"]
    print(f"\n  Individual secrets (#@ individual zone):\n")

    if not individual:
        print("    (none)")
    any_problem = False
    for k in sorted(individual):
        val = individual.get(k, "")
        if not val:
            print(f"    MISSING  {k}")
            any_problem = True
        elif k == SSH_KEY_PATH_KEY:
            resolved = Path(val).expanduser()
            exists   = resolved.exists()
            state    = "file exists" if exists else "FILE NOT FOUND"
            print(f"    OK       {k}={val}  ({state})")
            if not exists:
                any_problem = True
        elif is_sensitive(k):
            print(f"    OK       {k}={preview_value(k, val)}")
        else:
            print(f"    OK       {k}={val}")

    # Bundle summary
    line_count = len(env_data["raw_bundle"].strip().splitlines()) if env_data["raw_bundle"].strip() else 0
    print(f"\n  Bundle ({BUNDLE_SECRET}): {line_count} line(s) ready to push\n")

    # Next step hint
    if any_problem:
        print("  Some values are missing or point at missing files.\n")
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
    repo     = args.repo or repo_from_env(env_data) or gh_detect_repo()
    if not repo:
        abort(
            "Could not determine the repository.",
            "Add REPO_OWNER and REPO_NAME under '#@ local' in .env."
        )
    print(f"  repository   : {repo}")

    storage = env_data["storage_root"]
    if storage:
        print(f"  STORAGE_ROOT  : {storage}")
    else:
        print(f"  STORAGE_ROOT  : not set — fallback: {Path.home() / '.deploy' / 'backups'}")

    individual   = env_data["individual"]
    problems     = []

    print(f"\n  Individual secrets ({len(individual)} found):\n")
    if not individual:
        print("    (none)")
    for k in sorted(individual):
        val = individual.get(k, "")
        if not val:
            print(f"    MISSING  {k}")
            problems.append(k)
        else:
            print(f"    OK       {k}")

    ssh_path = individual.get(SSH_KEY_PATH_KEY)
    if ssh_path:
        resolved = Path(ssh_path).expanduser()
        exists   = resolved.exists()
        print(f"\n  SSH key file : {resolved}  ({'exists' if exists else 'NOT FOUND'})")
        if not exists:
            print(f"  Generate:    ssh-keygen -t ed25519 -C deploy -f {resolved} -N ''")
            problems.append(SSH_KEY_PATH_KEY + "_file")

    bundle_lines = len(env_data["raw_bundle"].strip().splitlines()) if env_data["raw_bundle"].strip() else 0
    print(f"\n  Bundle ({BUNDLE_SECRET}): {bundle_lines} line(s)")

    if problems:
        print(f"\n  {len(problems)} issue(s) found.\n")
        sys.exit(1)
    else:
        print("\n  All checks passed.\n")


def cmd_env_preview(env_data: dict) -> None:
    """Show the cleaned bundle content that would be pushed as ENV_BASE."""
    header(f"ENV PREVIEW — bundle zone (pushed as {BUNDLE_SECRET})")
    print()
    if not env_data["raw_bundle"].strip():
        print("  (bundle zone is empty — nothing would be pushed as "
              f"{BUNDLE_SECRET})\n")
        return
    for line in env_data["raw_bundle"].splitlines():
        if "=" in line:
            k = line.split("=")[0]
            if is_sensitive(k):
                print(f"  {k}=***")
                continue
        print(f"  {line}")
    line_count = len(env_data["raw_bundle"].strip().splitlines())
    print(f"\n  {line_count} line(s) would be pushed as {BUNDLE_SECRET}.\n")


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

    current  = parse_env_file(env_path)["bundle"]
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
    Ensure the .env has the three zone markers (#@ bundle / individual / local).
    Non-destructive: existing content is preserved. Markers that already exist
    are left in place; missing ones are appended in canonical order with a
    short comment. This does not prompt for or invent any keys — the zone
    model is generic, so what goes in each zone is the operator's choice.
    """
    header("INIT — ensure zone markers exist in .env")

    if not env_path.exists():
        # Scaffold a fresh .env from scratch.
        skeleton = (
            "# Bundle zone: everything here is concatenated and pushed as one\n"
            f"# secret named {BUNDLE_SECRET}. Production app config goes here.\n"
            "\n"
            "#@ individual\n"
            "# Each key below is pushed as its own GitHub secret.\n"
            f"# {SSH_KEY_PATH_KEY} is special: its file's CONTENTS are pushed\n"
            f"# as {SSH_KEY_SECRET}.\n"
            "\n"
            "#@ local\n"
            "# Never pushed. Read by secrets.py only.\n"
            f"{REPO_OWNER_KEY}=\n"
            f"{REPO_NAME_KEY}=\n"
        )
        try:
            env_path.write_text(skeleton, encoding="utf-8")
        except (PermissionError, OSError) as e:
            abort(f"Failed to create .env: {e}")
        print(f"\n  Created {env_path} with the three zone markers.")
        print("  Fill in values, then run:  python3 secrets.py --check\n")
        return

    try:
        content = env_path.read_text(encoding="utf-8")
    except PermissionError:
        abort(f"Permission denied reading: {env_path}")

    present = set()
    for line in content.splitlines():
        m = MARKER_RE.match(line.strip())
        if m and m.group(1).lower() in ZONE_MODES:
            present.add(m.group(1).lower())

    missing = [m for m in ZONE_MODES if m != "bundle" and m not in present]
    if not missing:
        print("\n  All zone markers already present. Nothing to do.\n")
        return

    additions = ["", ""]
    for mode in missing:
        additions.append(f"#@ {mode}")
        if mode == "individual":
            additions.append("# Each key here is pushed as its own GitHub secret.")
        elif mode == "local":
            additions.append("# Never pushed. Read by secrets.py only.")
            additions.append(f"{REPO_OWNER_KEY}=")
            additions.append(f"{REPO_NAME_KEY}=")
        additions.append("")

    new_content = content.rstrip() + "\n" + "\n".join(additions) + "\n"
    try:
        tmp = env_path.parent / ".env.init.tmp"
        tmp.write_text(new_content, encoding="utf-8")
        tmp.rename(env_path)
    except (PermissionError, OSError) as e:
        abort(f"Failed to write .env: {e}")

    print(f"\n  Added markers: {', '.join('#@ ' + m for m in missing)}")
    print(f"  .env updated at {env_path}")
    print("  Run:  python3 secrets.py --check   to verify.\n")


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
    zone    = env_data["individual"]
    cur_path = zone.get(SSH_KEY_PATH_KEY)

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

    # Stale detection — skip unchanged secrets vs last backup. Compares the
    # bundle text (→ ENV_BASE) and each individual key's literal value. The
    # SSH key is compared by its path value, not file contents (cheap and
    # good enough; --force bypasses all of this anyway).
    if not args.force and not args.only:
        latest = backup_dir / "env-latest.env"
        if latest.exists():
            try:
                prev = parse_env_file(latest)
                prev_vals = {BUNDLE_SECRET: prev["raw_bundle"]}
                for k, v in prev["individual"].items():
                    if k == SSH_KEY_PATH_KEY:
                        continue  # pushed value is file contents; skip cheap compare
                    prev_vals[k] = v
                unchanged = {k for k, v in secrets.items() if prev_vals.get(k) == v}
                # Never treat SSH_PRIVATE_KEY as unchanged via this cheap path.
                unchanged.discard(SSH_KEY_SECRET)
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
    if BUNDLE_SECRET in secrets and success > 0:
        print()
        print(f"  ── {BUNDLE_SECRET} (what the server will receive) " + "─" * 10)
        for line in env_data["raw_bundle"].splitlines():
            if "=" in line:
                k = line.split("=")[0].strip()
                if is_sensitive(k):
                    print(f"  {k}=***")
                    continue
            print(f"  {line}")
        line_count = len(env_data["raw_bundle"].strip().splitlines())
        print(f"  ── {line_count} line(s) ──")
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
    # Repo identity lives in the local zone (REPO_OWNER / REPO_NAME). The
    # --repo flag overrides. gh's own detection is a last resort.
    repo = args.repo or repo_from_env(env_data) or gh_detect_repo()
    if not repo:
        abort(
            "Could not determine the target repository.",
            "Add REPO_OWNER and REPO_NAME under '#@ local' in .env,\n"
            "or pass --repo owner/name."
        )

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
