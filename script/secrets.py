#!/usr/bin/env python3
"""
secrets.py — sync .env at the repo root to GitHub Actions Secrets.

Reads .env from the repo root, pushes each KEY=VALUE pair to GitHub
Secrets via the GitHub CLI (`gh`). Multi-line values (e.g. SSH private
keys) are supported when wrapped in double quotes in .env.

Usage:
    python3 script/secrets.py --check    Show what would be pushed (safe)
    python3 script/secrets.py --push     Actually push to GitHub
    python3 script/secrets.py --list     List existing secrets on the repo

REPO_OWNER and REPO_NAME from .env identify the target repo. If both are
unset, the script aborts — pushing to the wrong repo is too easy a mistake.

Skipped automatically:
    Empty values (KEY=).
    Lines starting with #.
    REPO_OWNER and REPO_NAME themselves (they identify the target, they
    aren't secrets to push).
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parent
ENV_PATH   = REPO_ROOT / ".env"

# Keys in .env that identify the target repo, not secrets to push.
META_KEYS = {"REPO_OWNER", "REPO_NAME"}


# ── Output helpers ───────────────────────────────────────────────────────────
def say(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    sys.stderr.write(f"warning: {msg}\n")


def die(msg: str) -> None:
    sys.stderr.write(f"error: {msg}\n")
    sys.exit(1)


# ── .env parsing ─────────────────────────────────────────────────────────────
def parse_env(path: Path) -> dict[str, str]:
    """
    Read a .env file. Supports:
      KEY=value
      KEY="quoted value"
      KEY="multi
      line
      value"
      # comments and blank lines
    Returns a dict of all key/value pairs. Empty values are kept (so the
    caller can decide to skip or warn).
    """
    if not path.is_file():
        die(f".env not found at {path}\n"
            f"Hint: cp {REPO_ROOT}/.env.example {path}, then fill in values.")

    text = path.read_text(encoding="utf-8")
    result: dict[str, str] = {}

    # We parse character-by-character to handle multi-line quoted values.
    # Regex-only approaches struggle with multi-line strings without becoming
    # hard to read.
    i = 0
    n = len(text)
    while i < n:
        # Skip whitespace and comments at start of line
        while i < n and text[i] in " \t":
            i += 1
        if i < n and text[i] == '#':
            while i < n and text[i] != '\n':
                i += 1
            i += 1  # consume the \n
            continue
        if i < n and text[i] == '\n':
            i += 1
            continue
        if i >= n:
            break

        # Read KEY up to '='
        key_start = i
        while i < n and text[i] not in "=\n":
            i += 1
        if i >= n or text[i] != '=':
            warn(f"Skipping malformed line near char {key_start}: no '=' found")
            while i < n and text[i] != '\n':
                i += 1
            continue
        key = text[key_start:i].strip()
        i += 1  # skip '='

        # Read value. If it starts with a quote, read until matching quote
        # (allows multi-line). Otherwise read to end of line.
        if i < n and text[i] in '"\'':
            quote = text[i]
            i += 1
            value_start = i
            while i < n and text[i] != quote:
                i += 1
            value = text[value_start:i]
            if i < n:
                i += 1  # consume closing quote
            # Consume to end of line
            while i < n and text[i] != '\n':
                i += 1
            if i < n:
                i += 1
        else:
            value_start = i
            while i < n and text[i] != '\n':
                i += 1
            value = text[value_start:i].strip()
            if i < n:
                i += 1

        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            warn(f"Skipping invalid key name: {key!r}")
            continue

        result[key] = value

    return result


# ── gh CLI helpers ───────────────────────────────────────────────────────────
def require_gh() -> None:
    """Bail out if `gh` is not installed or not authenticated."""
    if shutil.which("gh") is None:
        die("'gh' (GitHub CLI) is not installed or not on PATH.\n"
            "Install: https://cli.github.com/  then run: gh auth login")

    result = subprocess.run(["gh", "auth", "status"],
                            capture_output=True, text=True)
    if result.returncode != 0:
        die("gh is installed but not authenticated. Run: gh auth login")


def repo_slug(env: dict[str, str]) -> str:
    owner = env.get("REPO_OWNER", "").strip()
    name  = env.get("REPO_NAME", "").strip()
    if not owner or not name:
        die("REPO_OWNER and REPO_NAME must both be set in .env\n"
            "These identify the target repo for secrets. Without them this\n"
            "script can't tell which repo to push to.")
    return f"{owner}/{name}"


def gh_set_secret(name: str, value: str, repo: str) -> tuple[bool, str]:
    """
    Push one secret. Value goes via stdin, never in argv — so it doesn't
    show up in process listings or shell history.
    """
    try:
        result = subprocess.run(
            ["gh", "secret", "set", name, "--repo", repo],
            input=value, capture_output=True, text=True,
        )
        if result.returncode == 0:
            return True, "ok"
        err = (result.stderr or result.stdout).strip() or "unknown error"
        return False, err
    except OSError as e:
        return False, f"OS error: {e}"


def gh_list_secrets(repo: str) -> list[str]:
    result = subprocess.run(
        ["gh", "secret", "list", "--repo", repo, "--json", "name"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        die(f"gh secret list failed: "
            f"{(result.stderr or result.stdout).strip()}")
    import json
    return sorted(item["name"] for item in json.loads(result.stdout or "[]"))


# ── Display helpers ──────────────────────────────────────────────────────────
def preview(value: str) -> str:
    """A safe-to-print preview of a value. Never reveals more than a hint."""
    if not value:
        return "(empty)"
    lines = value.splitlines()
    if len(lines) > 1:
        return f"({len(lines)} lines, {len(value)} chars)"
    if len(value) <= 12:
        return f"{'*' * len(value)}  ({len(value)} chars)"
    return f"{value[:4]}…{value[-2:]}  ({len(value)} chars)"


# ── Commands ─────────────────────────────────────────────────────────────────
def cmd_check(env: dict[str, str]) -> None:
    say(f"\nrepo : {repo_slug(env)}")
    say(f"file : {ENV_PATH}\n")
    say(f"{'KEY':30}  {'PREVIEW':40}  ACTION")
    say(f"{'-'*30}  {'-'*40}  {'-'*8}")
    pushable = skipped = 0
    for key, value in env.items():
        if key in META_KEYS:
            say(f"{key:30}  {preview(value):40}  skip (meta)")
            skipped += 1
            continue
        if not value:
            say(f"{key:30}  {preview(value):40}  skip (empty)")
            skipped += 1
            continue
        say(f"{key:30}  {preview(value):40}  would push")
        pushable += 1
    say(f"\nwould push {pushable} secret(s); skipping {skipped}.\n")


def cmd_push(env: dict[str, str]) -> None:
    require_gh()
    repo = repo_slug(env)
    say(f"\npushing to {repo}\n")

    success = failed = skipped = 0
    for key, value in env.items():
        if key in META_KEYS:
            skipped += 1
            continue
        if not value:
            say(f"  skip   {key}  (empty)")
            skipped += 1
            continue
        ok, msg = gh_set_secret(key, value, repo)
        if ok:
            say(f"  ok     {key}  → {preview(value)}")
            success += 1
        else:
            say(f"  FAIL   {key}  ({msg})")
            failed += 1

    say(f"\n{success} pushed, {failed} failed, {skipped} skipped.\n")
    if failed:
        sys.exit(1)


def cmd_list(env: dict[str, str]) -> None:
    require_gh()
    repo = repo_slug(env)
    say(f"\nsecrets currently on {repo}:\n")
    names = gh_list_secrets(repo)
    if not names:
        say("  (none)")
    for n in names:
        say(f"  {n}")
    say("")


# ── Entry point ──────────────────────────────────────────────────────────────
def main() -> None:
    p = argparse.ArgumentParser(
        prog="secrets.py",
        description="Sync .env at the repo root to GitHub Actions Secrets.",
    )
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true",
                      help="Show what would be pushed (safe — no changes).")
    mode.add_argument("--push",  action="store_true",
                      help="Push every non-empty key in .env to GitHub Secrets.")
    mode.add_argument("--list",  action="store_true",
                      help="List secret names currently set on the repo.")
    args = p.parse_args()

    env = parse_env(ENV_PATH)
    if args.check:
        cmd_check(env)
    elif args.push:
        cmd_push(env)
    elif args.list:
        cmd_list(env)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.stderr.write("\ninterrupted.\n")
        sys.exit(130)
