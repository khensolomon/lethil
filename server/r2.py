#!/usr/bin/env python3
"""
r2.py — Cloudflare R2 backup/restore tool for Docker Swarm apps.

Source:   https://github.com/khensolomon/lets/blob/make/server/r2.py
Config:   /opt/bucket/storage/access/r2.conf  (default; overridable via --config)

Usage (run from inside an app's bucket folder, e.g. /opt/bucket/storage/myordbok/):

    r2.py backup mysql              Dump live DB via docker exec, upload to R2
    r2.py restore mysql             Download latest.sql.gz from R2 to ./mysql/
    r2.py restore mysql --if-empty  Only restore if local latest.sql.gz missing
    r2.py list mysql                Show available R2 dumps
    r2.py prune mysql --keep 7      Delete old timestamped dumps, keep N newest

    r2.py push <folder>             Upload local folder to R2 (overwrite)
    r2.py pull <folder>             Download R2 folder to local (overwrite)

    r2.py status                    Show all folders, handlers, and basic state
    r2.py info                      Show detected stack, container, R2 connection

Or operate on any app from any directory using --app:

    r2.py push --app myapp env
    r2.py pull --app myapp env
    r2.py backup --app myapp mysql
    r2.py status --app myapp

Or use sync for general-purpose, path-explicit copies (no cwd, no app):

    r2.py sync r2:storage/myapp/configs/ /opt/foo/configs/    # download
    r2.py sync /opt/foo/configs/ r2:storage/myapp/configs/    # upload
    r2.py sync r2:storage/dumps/big.tar.gz /tmp/big.tar.gz    # single file

App detection:
    A folder under <R2_ROOT>/<bucket>/<n>/ is considered an "app" if and
    only if <APP_DEPLOY_ROOT>/<n>/.env exists on the host. This .env is
    created by the GitHub Actions deploy pipeline. Folders like access/,
    store/, etc. that are NOT deployed apps are correctly excluded without
    any hardcoded list.

Credentials:
    - R2 creds live in r2.conf (one file, host-wide)
    - MySQL creds NEVER touch the host — script execs into container and uses
      env vars already set there (DB_NAME, MYSQL_ROOT_PASSWORD, etc.)
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

try:
    import boto3
    from botocore.client import Config as BotoConfig
    from botocore.exceptions import ClientError
except ImportError:
    sys.stderr.write(
        "ERROR: boto3 is required but not installed.\n"
        "Install it with one of:\n"
        "    sudo apt install python3-boto3\n"
        "    pip install boto3\n"
    )
    sys.exit(2)


# ============================================================================
# Constants and conventions
# ============================================================================

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = Path("/opt/bucket/storage/access/r2.conf")

# Recognized handler folder names. Anything else falls back to plain files.
MYSQL_FOLDERS = {"mysql", "mariadb"}

# Timestamp format for backup filenames (sortable, filesystem-safe).
TS_FORMAT = "%Y-%m-%dT%H-%M-%SZ"
TS_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.sql\.gz$")

# How many bytes to stream at a time when piping docker exec → file.
STREAM_CHUNK = 1024 * 1024  # 1 MiB


# ============================================================================
# Config loading
# ============================================================================

@dataclass
class Config:
    """Parsed contents of r2.conf, with env-var overrides applied."""
    account_id: str
    access_key_id: str
    secret_access_key: str
    endpoint: str
    bucket: str
    retention_keep: int = 7
    compression_level: int = 6
    root: str = "/opt/bucket"
    app_deploy_root: str = "/opt"  # Where /opt/<app>/.env lives — used to detect apps

    @classmethod
    def load(cls, path: Path) -> "Config":
        """Read r2.conf (KEY=VALUE format), apply env var overrides."""
        if not path.is_file():
            die(f"Config file not found: {path}\n"
                f"Create it with R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
                f"R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET")

        # Permission check — config holds secrets, must not be world-readable.
        mode = path.stat().st_mode & 0o777
        if mode & 0o077:
            warn(f"{path} is mode {oct(mode)}. Recommend chmod 600.")

        values: dict[str, str] = {}
        for lineno, raw in enumerate(path.read_text().splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                die(f"{path}:{lineno}: expected KEY=VALUE, got: {raw!r}")
            key, _, value = line.partition("=")
            # Strip surrounding quotes if present (.env-style)
            value = value.strip().strip('"').strip("'")
            values[key.strip()] = value

        # Env vars take precedence over config file (standard 12-factor pattern).
        def get(key: str, default: str | None = None) -> str | None:
            return os.environ.get(key) or values.get(key) or default

        required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
                    "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"]
        missing = [k for k in required if not get(k)]
        if missing:
            die(f"Missing required config keys: {', '.join(missing)}")

        return cls(
            account_id=get("R2_ACCOUNT_ID") or "",
            access_key_id=get("R2_ACCESS_KEY_ID") or "",
            secret_access_key=get("R2_SECRET_ACCESS_KEY") or "",
            endpoint=get("R2_ENDPOINT") or "",
            bucket=get("R2_BUCKET") or "",
            retention_keep=int(get("RETENTION_KEEP", "7") or "7"),
            compression_level=int(get("COMPRESSION_LEVEL", "6") or "6"),
            root=get("R2_ROOT", "/opt/bucket") or "/opt/bucket",
            app_deploy_root=get("APP_DEPLOY_ROOT", "/opt") or "/opt",
        )


# ============================================================================
# App detection
# ============================================================================
#
# A folder under R2_ROOT/<bucket>/<name>/ is considered an "app" if and only if
# the deployment artifact at <APP_DEPLOY_ROOT>/<name>/.env exists.
#
# This .env file is created by the GitHub Actions deployment pipeline (see
# deploy.yml) on every successful deploy — for SSH/Tunnel paths it's scp'd
# to /opt/<app>/.env, and for the local VM path it's also copied there for
# consistency. Its presence is the authoritative signal that this folder
# represents a deployed app on this host.
#
# Folders like access/, store/, r2/ that are *not* deployed apps simply don't
# have a corresponding /opt/<name>/.env, so they are correctly identified as
# non-apps without any hardcoded list.

def is_app(name: str, deploy_root: str = "/opt") -> bool:
    """Return True if <deploy_root>/<n>/.env exists on the host."""
    return (Path(deploy_root) / name / ".env").is_file()


# ============================================================================
# Path / context resolution
# ============================================================================

@dataclass
class Context:
    """The 'where am I' picture, derived from cwd + config."""
    cwd: Path
    app: str            # e.g. "myordbok" (cwd basename)
    bucket_root: Path   # e.g. /opt/bucket/storage
    config: Config

    @property
    def stack(self) -> str:
        """Docker Swarm stack name. Same as app name by convention."""
        return self.app

    def r2_prefix(self, folder: str) -> str:
        """Return the R2 key prefix for a given local folder.
        Example: folder='mysql' → 'myordbok/mysql/'"""
        return f"{self.app}/{folder.strip('/')}/"

    def local_folder(self, folder: str) -> Path:
        return self.cwd / folder


def resolve_context(config: Config, app_override: str | None = None) -> Context:
    """Figure out which app we're operating on.

    If app_override is given (--app flag), use it directly without looking at
    cwd. The local target becomes <R2_ROOT>/<R2_BUCKET>/<app>/.

    Otherwise, derive the app from cwd. Refuse if cwd is outside R2_ROOT.

    Symlink handling: we try the *logical* cwd first (what the shell shows you,
    preserved in $PWD), then fall back to the *physical* cwd (symlinks resolved).
    This lets you keep R2_ROOT=/opt/bucket even when /opt/bucket/storage is a
    symlink to /mnt/keep/storage on a dev machine — both paths get tried.
    """
    # --app override path: skip all cwd resolution, just build the context.
    if app_override:
        if "/" in app_override or ".." in app_override:
            die(f"--app must be a single name, not a path: {app_override!r}")
        if not is_app(app_override, config.app_deploy_root):
            marker = Path(config.app_deploy_root) / app_override / ".env"
            die(f"--app '{app_override}' is not a deployed app on this host.\n"
                f"  (expected marker: {marker})")
        bucket_root = Path(config.root) / config.bucket
        synthetic_cwd = bucket_root / app_override
        if not synthetic_cwd.is_dir():
            die(f"--app target does not exist: {synthetic_cwd}\n"
                f"Create the directory first, or check the app name.")
        say(f"target: {synthetic_cwd}")
        return Context(
            cwd=synthetic_cwd,
            app=app_override,
            bucket_root=bucket_root,
            config=config,
        )

    # Cwd-based path: try logical cwd from $PWD, then physical cwd.
    candidates: list[Path] = []
    pwd_env = os.environ.get("PWD")
    if pwd_env:
        logical = Path(pwd_env)
        # Sanity check: $PWD must point to the same inode as the real cwd.
        # Otherwise the user has a stale $PWD (rare but possible).
        try:
            if logical.is_dir() and logical.resolve() == Path.cwd().resolve():
                candidates.append(logical)
        except OSError:
            pass
    candidates.append(Path.cwd())  # physical fallback

    # R2_ROOT may also be a symlink target; try both interpretations.
    # Additionally, if R2_ROOT itself contains symlinks (e.g. /opt/bucket/storage
    # is a symlink to /mnt/keep/storage on a dev machine), we need to also accept
    # the physical target as a valid root.
    root_logical = Path(config.root)
    roots: list[Path] = [root_logical]
    try:
        root_physical = root_logical.resolve()
        if root_physical != root_logical:
            roots.append(root_physical)
        # Also walk one level deep — common case is /opt/bucket exists but
        # /opt/bucket/storage is the symlink. Add each subdir's resolved target.
        if root_logical.is_dir():
            for child in root_logical.iterdir():
                if child.is_symlink() and child.is_dir():
                    target = child.resolve()
                    # The "virtual root" for this symlinked subdir is its parent —
                    # because if /opt/bucket/storage → /mnt/keep/storage, then
                    # paths like /mnt/keep/storage/myapp should be treated as
                    # being two levels under a synthetic /mnt/keep root.
                    synthetic_root = target.parent
                    if synthetic_root not in roots:
                        roots.append(synthetic_root)
    except OSError:
        pass

    rel: Path | None = None
    cwd: Path | None = None
    for c in candidates:
        for r in roots:
            try:
                rel = c.relative_to(r)
                cwd = c
                break
            except ValueError:
                continue
        if rel is not None:
            break

    if rel is None or cwd is None:
        tried = " or ".join(str(c) for c in candidates)
        die(f"cwd {tried} is not under R2_ROOT {config.root}.\n"
            f"Run from inside an app folder, e.g. {config.root}/storage/myapp/")

    parts = rel.parts
    if len(parts) < 2:
        die(f"cwd {cwd} is too shallow.\n"
            f"Expected: {config.root}/<bucket>/<app>/  (got rel parts: {parts})")

    bucket_dir = parts[0]  # e.g. "storage"
    app = parts[1]         # e.g. "myordbok"

    # Verify this folder is actually a deployed app on this host.
    # The marker is <APP_DEPLOY_ROOT>/<app>/.env, which is created by the
    # GitHub Actions deployment pipeline (see deploy.yml). This naturally
    # excludes folders like 'access/', 'store/', 'r2/' that are NOT deployed
    # apps — no hardcoded list needed.
    if not is_app(app, config.app_deploy_root):
        marker = Path(config.app_deploy_root) / app / ".env"
        die(f"'{app}' is not a deployed app on this host.\n"
            f"  (expected marker: {marker})\n"
            f"  If you want to operate on shared infrastructure (like access/),\n"
            f"  use 'r2.py sync ...' with explicit paths instead.")

    if bucket_dir != config.bucket:
        warn(f"cwd is under '{bucket_dir}' but R2_BUCKET is '{config.bucket}'. "
             f"Using R2_BUCKET for uploads/downloads.")

    return Context(
        cwd=cwd,
        app=app,
        bucket_root=Path(config.root) / bucket_dir,
        config=config,
    )


# ============================================================================
# R2 client
# ============================================================================

def make_r2_client(config: Config):
    """Create a boto3 S3 client pointed at Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=config.endpoint,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        region_name="auto",  # R2 ignores region but boto3 requires one
        config=BotoConfig(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


def r2_list(s3, bucket: str, prefix: str) -> list[dict]:
    """List all objects under a prefix. Returns list of {Key, Size, LastModified}."""
    out: list[dict] = []
    paginator = s3.get_paginator("list_objects_v2")
    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            out.extend(page.get("Contents", []))
    except ClientError as e:
        die(f"R2 list failed for {bucket}/{prefix}: {e}")
    return out


def r2_upload_file(s3, local: Path, bucket: str, key: str, dry: bool = False) -> None:
    """Upload a single file with multipart support (handled by boto3)."""
    size_mb = local.stat().st_size / 1_048_576
    if dry:
        say(f"  [dry-run] upload  {local}  →  s3://{bucket}/{key}  ({size_mb:.1f} MB)")
        return
    say(f"  upload  {local}  →  s3://{bucket}/{key}  ({size_mb:.1f} MB)")
    try:
        s3.upload_file(str(local), bucket, key)
    except ClientError as e:
        die(f"Upload failed: {e}")


def r2_download_file(s3, bucket: str, key: str, local: Path, dry: bool = False) -> None:
    """Download a single object to a local file path."""
    if dry:
        say(f"  [dry-run] download s3://{bucket}/{key}  →  {local}")
        return
    local.parent.mkdir(parents=True, exist_ok=True)
    say(f"  download s3://{bucket}/{key}  →  {local}")
    try:
        s3.download_file(bucket, key, str(local))
    except ClientError as e:
        die(f"Download failed: {e}")


def r2_delete(s3, bucket: str, key: str, dry: bool = False) -> None:
    if dry:
        say(f"  [dry-run] delete  s3://{bucket}/{key}")
        return
    say(f"  delete  s3://{bucket}/{key}")
    try:
        s3.delete_object(Bucket=bucket, Key=key)
    except ClientError as e:
        die(f"Delete failed: {e}")


# ============================================================================
# Docker helpers (Swarm-aware)
# ============================================================================

def docker_run(args: list[str], capture: bool = True, check: bool = True
               ) -> subprocess.CompletedProcess:
    """Run a docker command. Returns CompletedProcess."""
    try:
        return subprocess.run(
            ["docker", *args],
            capture_output=capture,
            text=True,
            check=check,
        )
    except FileNotFoundError:
        die("docker command not found. Is Docker installed and in PATH?")
    except subprocess.CalledProcessError as e:
        # Caller decides what to do; just re-raise with context.
        if capture and e.stderr:
            sys.stderr.write(e.stderr)
        raise


def find_db_container(stack: str, service_suffix: str = "db") -> str:
    """Find the running task container for <stack>_<suffix>.
    Returns container name like 'myordbok_db.1.abc123xyz'."""
    service = f"{stack}_{service_suffix}"

    # Strategy 1: Swarm task containers carry this label.
    result = docker_run([
        "ps",
        "--filter", f"label=com.docker.swarm.service.name={service}",
        "--filter", "status=running",
        "--format", "{{.Names}}",
    ])
    names = [n for n in result.stdout.strip().splitlines() if n]
    if names:
        return names[0]

    # Strategy 2: name prefix match (handles plain compose, swarm, etc.).
    # Swarm names look like 'myordbok_db.1.xxx', compose names like 'myordbok-db-1'.
    result = docker_run([
        "ps",
        "--filter", f"name=^{stack}[_-]{service_suffix}",
        "--filter", "status=running",
        "--format", "{{.Names}}",
    ])
    names = [n for n in result.stdout.strip().splitlines() if n]
    if names:
        return names[0]

    die(f"No running container found for service '{service}'.\n"
        f"Tried Swarm label and name-prefix lookups.\n"
        f"Is the stack deployed? Try: docker service ls | grep {stack}")


def docker_exec_capture(container: str, cmd: list[str]) -> str:
    """Run a command in the container and return stdout (text)."""
    result = docker_run(["exec", container, *cmd])
    return result.stdout


def docker_get_env(container: str, var: str) -> str | None:
    """Read a single env var from inside the container. Returns None if unset/empty."""
    try:
        result = docker_run(
            ["exec", container, "printenv", var],
            check=False,
        )
        if result.returncode == 0:
            value = result.stdout.strip()
            return value or None
    except subprocess.CalledProcessError:
        pass
    return None


# ============================================================================
# MySQL handler
# ============================================================================

def mysql_dump_to_file(container: str, db_name: str, dest: Path,
                       compression_level: int) -> None:
    """Run mysqldump inside the container, gzip on the host, write to dest.

    Tries credential strategies in order:
      1. root with no password (works when MYSQL_ALLOW_EMPTY_PASSWORD=yes)
      2. root with $MYSQL_ROOT_PASSWORD inside container
      3. root with $DB_ROOT_PWD inside container

    NOTE: strategies 2 and 3 only succeed if the corresponding env var is
    actually set inside the *db* container's environment. The default
    docker.production.yml sets MYSQL_ROOT_PASSWORD/DB_ROOT_PWD on the *web*
    service only, not on db, so in that configuration only strategy 1 works
    (which is fine — MYSQL_ALLOW_EMPTY_PASSWORD=yes makes it succeed). If
    you ever switch root to a real password, also pass the password env var
    through to the db service or strategies 2/3 will silently no-op.
    """
    base_args = [
        "--single-transaction",  # consistent snapshot without locking
        "--quick",               # don't buffer rows in memory
        "--routines",            # include stored procs/functions
        "--triggers",
        "--no-tablespaces",      # avoid PROCESS privilege requirement
        db_name,
    ]

    # Each strategy is a shell command run inside the container.
    # We use sh -c so $VARS expand inside the container, not on the host.
    strategies = [
        # 1. No password (your current setup with MYSQL_ALLOW_EMPTY_PASSWORD=yes)
        f'mysqldump -u root {" ".join(base_args)}',
        # 2. MYSQL_ROOT_PASSWORD env var
        f'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root {" ".join(base_args)}',
        # 3. DB_ROOT_PWD env var (your web service uses this naming)
        f'MYSQL_PWD="$DB_ROOT_PWD" mysqldump -u root {" ".join(base_args)}',
    ]

    last_err = ""
    for i, sh_cmd in enumerate(strategies, 1):
        say(f"  trying mysqldump strategy {i}/{len(strategies)}...")
        try:
            # Stream stdout in chunks → gzip → dest. Avoids loading dump into memory.
            proc = subprocess.Popen(
                ["docker", "exec", container, "sh", "-c", sh_cmd],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            tmp = dest.with_suffix(dest.suffix + ".tmp")
            try:
                with gzip.open(tmp, "wb", compresslevel=compression_level) as gz:
                    assert proc.stdout is not None
                    while True:
                        chunk = proc.stdout.read(STREAM_CHUNK)
                        if not chunk:
                            break
                        gz.write(chunk)
                stderr = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
                rc = proc.wait()
                if rc != 0:
                    last_err = stderr.strip() or f"exit code {rc}"
                    tmp.unlink(missing_ok=True)
                    continue
                # Sanity: gzipped dump should be non-trivial in size.
                if tmp.stat().st_size < 100:
                    last_err = "dump output suspiciously small"
                    tmp.unlink(missing_ok=True)
                    continue
                tmp.replace(dest)
                say(f"  dump succeeded ({dest.stat().st_size / 1_048_576:.1f} MB compressed)")
                return
            except Exception:
                tmp.unlink(missing_ok=True)
                raise
        except FileNotFoundError:
            die("docker command not found.")

    die(f"All mysqldump strategies failed. Last error:\n{last_err}")


def cmd_backup_mysql(ctx: Context, args, s3) -> None:
    """Dump the live DB, write latest.sql.gz + <timestamp>.sql.gz, upload both."""
    folder = args.folder
    local_dir = ctx.local_folder(folder)
    local_dir.mkdir(parents=True, exist_ok=True)

    container = find_db_container(ctx.stack)
    say(f"db container: {container}")

    db_name = docker_get_env(container, "DB_NAME") or \
              docker_get_env(container, "MYSQL_DATABASE")
    if not db_name:
        die(f"Could not read DB_NAME/MYSQL_DATABASE from container env.\n"
            f"Check: docker exec {container} printenv | grep -E 'DB_NAME|MYSQL_DATABASE'")
    say(f"database to dump: {db_name}")

    if args.dry_run:
        say("[dry-run] would dump DB and upload latest + timestamped copy")
        return

    # Dump to a temp location first, then atomically rename to latest.sql.gz.
    # This protects against a half-written latest.sql.gz being read by a
    # racing 'restore' or by the docker entrypoint init logic.
    timestamp = dt.datetime.now(dt.timezone.utc).strftime(TS_FORMAT)
    timestamped = local_dir / f"{timestamp}.sql.gz"
    latest = local_dir / "latest.sql.gz"

    say(f"\ndumping to {timestamped}")
    mysql_dump_to_file(
        container=container,
        db_name=db_name,
        dest=timestamped,
        compression_level=ctx.config.compression_level,
    )

    # latest.sql.gz = copy of the timestamped file (same content, predictable name).
    # Use copy then rename for atomicity on the same filesystem.
    say(f"updating {latest}")
    tmp_latest = latest.with_suffix(".gz.tmp")
    shutil.copyfile(timestamped, tmp_latest)
    tmp_latest.replace(latest)

    # Upload both to R2.
    prefix = ctx.r2_prefix(folder)
    say(f"\nuploading to s3://{ctx.config.bucket}/{prefix}")
    r2_upload_file(s3, timestamped, ctx.config.bucket,
                   f"{prefix}{timestamped.name}", dry=False)
    r2_upload_file(s3, latest, ctx.config.bucket,
                   f"{prefix}latest.sql.gz", dry=False)

    say(f"\nbackup complete. Local copies kept in {local_dir}")
    say(f"(run 'r2.py prune {folder}' to clean up old timestamped dumps)")


def cmd_restore_mysql(ctx: Context, args, s3) -> None:
    """Download latest.sql.gz from R2 to ./mysql/. Idempotent if --if-empty."""
    folder = args.folder
    local_dir = ctx.local_folder(folder)
    local_latest = local_dir / "latest.sql.gz"
    key = f"{ctx.r2_prefix(folder)}latest.sql.gz"

    if args.if_empty and local_latest.exists():
        say(f"{local_latest} already exists; --if-empty set, nothing to do.")
        return

    # Check that the object exists before attempting download.
    try:
        s3.head_object(Bucket=ctx.config.bucket, Key=key)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            if args.if_empty:
                say(f"No remote {key} found; --if-empty set, nothing to restore. (OK for first deploy.)")
                return
            die(f"Remote object not found: s3://{ctx.config.bucket}/{key}\n"
                f"Has a backup ever been uploaded? Try: r2.py list {folder}")
        die(f"R2 head_object failed: {e}")

    r2_download_file(s3, ctx.config.bucket, key, local_latest, dry=args.dry_run)

    if not args.dry_run:
        say(f"\nrestore complete. {local_latest} is ready for docker-entrypoint-initdb.d.")


def cmd_list_mysql(ctx: Context, args, s3) -> None:
    """Show all dumps in R2 for this folder, with sizes and dates."""
    folder = args.folder
    prefix = ctx.r2_prefix(folder)
    objects = r2_list(s3, ctx.config.bucket, prefix)
    if not objects:
        say(f"No objects under s3://{ctx.config.bucket}/{prefix}")
        return

    # Sort newest first.
    objects.sort(key=lambda o: o["LastModified"], reverse=True)
    say(f"s3://{ctx.config.bucket}/{prefix}")
    for o in objects:
        size_mb = o["Size"] / 1_048_576
        ts = o["LastModified"].strftime("%Y-%m-%d %H:%M:%S UTC")
        name = o["Key"][len(prefix):]
        say(f"  {ts}  {size_mb:>8.2f} MB  {name}")


def cmd_prune_mysql(ctx: Context, args, s3) -> None:
    """Delete old timestamped dumps in R2, keeping the N newest. Never touches latest.sql.gz."""
    folder = args.folder
    keep = args.keep if args.keep is not None else ctx.config.retention_keep
    prefix = ctx.r2_prefix(folder)

    objects = r2_list(s3, ctx.config.bucket, prefix)
    # Only consider timestamped dumps; latest.sql.gz is sacred.
    timestamped = [
        o for o in objects
        if TS_REGEX.match(o["Key"][len(prefix):])
    ]
    timestamped.sort(key=lambda o: o["LastModified"], reverse=True)

    to_keep = timestamped[:keep]
    to_delete = timestamped[keep:]

    say(f"s3://{ctx.config.bucket}/{prefix}")
    say(f"  found {len(timestamped)} timestamped dumps; keeping {len(to_keep)}, deleting {len(to_delete)}")
    if not to_delete:
        return

    for o in to_delete:
        r2_delete(s3, ctx.config.bucket, o["Key"], dry=args.dry_run)


# ============================================================================
# Plain files handler — shared transfer engine
# ============================================================================
#
# Architecture: one engine, multiple front-ends.
#
# sync_core() handles all transfers between local and R2. push, pull, and
# the new `sync` command are thin wrappers that build endpoint descriptors
# and call sync_core(). MySQL backup/restore stays separate because it does
# fundamentally different work (mysqldump, gzip, atomic writes).
#
# Endpoints are described by tagged dicts:
#     {"kind": "local", "path": Path}
#     {"kind": "r2",    "bucket": str, "key": str}
#
# Either side can be a folder or a single file. The engine figures out which
# from inspection (local: stat the path; r2: head_object the key).
# ============================================================================

def iter_local_files(root: Path) -> Iterator[Path]:
    """Yield every regular file under root, recursively."""
    for p in root.rglob("*"):
        if p.is_file():
            yield p


def parse_endpoint(arg: str, default_bucket: str | None = None) -> dict:
    """Parse one CLI argument into an endpoint descriptor.

    'r2:bucket/key/...' or 's3:bucket/key/...' → r2 endpoint
    Anything else → local endpoint (path)

    For r2: prefix, the bucket is required (first segment after the colon).
    Trailing slashes are ignored — they're decoration.
    """
    for prefix in ("r2:", "s3:"):
        if arg.startswith(prefix):
            rest = arg[len(prefix):].lstrip("/")
            if not rest:
                die(f"R2 endpoint missing bucket: {arg!r}")
            parts = rest.split("/", 1)
            bucket = parts[0]
            key = parts[1] if len(parts) > 1 else ""
            # Strip trailing slash — it's decoration, not meaning.
            key = key.rstrip("/")
            return {"kind": "r2", "bucket": bucket, "key": key}
    # Local path. Resolve to absolute, but don't follow symlinks here —
    # the user might have given us a symlinked path on purpose.
    return {"kind": "local", "path": Path(arg).expanduser().absolute()}


def describe_endpoint(ep: dict) -> str:
    """Human-readable rendering of an endpoint, for log lines."""
    if ep["kind"] == "r2":
        return f"s3://{ep['bucket']}/{ep['key']}"
    return str(ep["path"])


def sync_core(s3, source: dict, target: dict, *, dry_run: bool,
              force_folder: bool = False) -> int:
    """The one transfer engine. Always overwrites. Returns count of files transferred.

    Direction is implied by which side is r2 vs local. Exactly one side must
    be r2; this is enforced by the caller.

    Source can be a folder (recursive copy of contents) or a single file.
    For folders: contents land directly inside the target (the (a) semantics
    we agreed on — no extra folder level inserted).

    force_folder: when True, skip single-file detection on R2 sources. Used
    by the cwd-based push/pull commands which always operate on folders.
    """
    if source["kind"] == target["kind"]:
        die(f"Both endpoints are {source['kind']}; one must be r2 and the other local.\n"
            f"  source: {describe_endpoint(source)}\n"
            f"  target: {describe_endpoint(target)}")

    say(f"sync  {describe_endpoint(source)}  →  {describe_endpoint(target)}")

    # Branch on direction. Each branch produces a list of (source_ref, target_ref)
    # pairs and then transfers them. Keeping the branches separate is clearer
    # than a unified abstraction that obscures what's actually happening.

    if source["kind"] == "local" and target["kind"] == "r2":
        return _sync_upload(s3, source["path"], target["bucket"], target["key"], dry_run)

    if source["kind"] == "r2" and target["kind"] == "local":
        return _sync_download(s3, source["bucket"], source["key"], target["path"],
                              dry_run, force_folder)

    # Unreachable due to the kind-check above, but keeps the type-checker happy.
    die("internal error: unhandled sync direction")


def _sync_upload(s3, src_path: Path, bucket: str, key_prefix: str, dry_run: bool) -> int:
    """Upload local path → R2. Folder uploads recursively; file uploads single object."""
    if not src_path.exists():
        die(f"Source not found: {src_path}")

    if src_path.is_file():
        # Single-file upload. If the key looks like a folder (ends with / or is
        # empty), append the source filename. Otherwise use the key as-is.
        if not key_prefix or key_prefix.endswith("/"):
            key = (key_prefix.rstrip("/") + "/" + src_path.name).lstrip("/")
        else:
            key = key_prefix
        r2_upload_file(s3, src_path, bucket, key, dry=dry_run)
        return 1

    if not src_path.is_dir():
        die(f"Source is neither file nor directory: {src_path}")

    files = list(iter_local_files(src_path))
    if not files:
        say("  (source folder is empty, nothing to upload)")
        return 0

    # Folder upload: contents of src_path land *directly* under key_prefix.
    # E.g. src=/opt/foo/configs/ with file 'a.txt' and key_prefix='myapp/configs'
    #      → uploads to 'myapp/configs/a.txt'
    base = key_prefix.rstrip("/")
    for f in files:
        rel = f.relative_to(src_path).as_posix()
        key = f"{base}/{rel}" if base else rel
        r2_upload_file(s3, f, bucket, key, dry=dry_run)

    say(f"\nuploaded {len(files)} file(s).")
    return len(files)


def _sync_download(s3, bucket: str, key_prefix: str, dst_path: Path,
                   dry_run: bool, force_folder: bool = False) -> int:
    """Download R2 → local path. Detects single file vs folder by listing.

    force_folder: skip single-file detection (used by `pull` which always
    means folder-mode).
    """
    # First, see what's at the source. If exactly one object matches the key
    # exactly (not as a prefix), treat it as a single-file copy. Otherwise
    # treat it as a folder.
    #
    # This handles both 'r2:bucket/path/to/file.tar.gz' and 'r2:bucket/folder/'
    # naturally without requiring the user to flag which they meant.
    single_obj = None
    if not force_folder and key_prefix and not key_prefix.endswith("/"):
        try:
            head = s3.head_object(Bucket=bucket, Key=key_prefix)
            single_obj = {"Key": key_prefix, "Size": head["ContentLength"]}
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code not in ("404", "NoSuchKey", "NotFound"):
                die(f"R2 head_object failed: {e}")
            # Fall through to folder/prefix listing.

    if single_obj is not None:
        # Single-file download. If dst is an existing dir or ends with '/',
        # land inside with the source filename. Otherwise use dst as the
        # exact target path.
        src_name = key_prefix.rsplit("/", 1)[-1]
        target_is_dir = dst_path.is_dir() or str(dst_path).endswith("/")
        dest_file = (dst_path / src_name) if target_is_dir else dst_path
        r2_download_file(s3, bucket, key_prefix, dest_file, dry=dry_run)
        return 1

    # Folder download. List everything under the prefix and mirror it locally.
    # Normalize prefix to end with '/' so we don't match e.g. 'foo' against 'foobar/'.
    list_prefix = key_prefix
    if list_prefix and not list_prefix.endswith("/"):
        list_prefix += "/"

    objects = r2_list(s3, bucket, list_prefix)
    if not objects:
        say(f"  (nothing under {describe_endpoint({'kind': 'r2', 'bucket': bucket, 'key': list_prefix})})")
        return 0

    count = 0
    for o in objects:
        rel = o["Key"][len(list_prefix):]
        if not rel:  # directory placeholder, skip
            continue
        dest = dst_path / rel
        r2_download_file(s3, bucket, o["Key"], dest, dry=dry_run)
        count += 1

    say(f"\ndownloaded {count} file(s).")
    return count


# ----------------------------------------------------------------------------
# Front-ends: push, pull, sync — all delegate to sync_core
# ----------------------------------------------------------------------------

def cmd_push(ctx: Context, args, s3) -> None:
    """Upload local <folder>/ → R2 prefix. Thin wrapper around sync_core."""
    folder = args.folder
    local_dir = ctx.local_folder(folder)
    if not local_dir.exists():
        die(f"Local folder not found: {local_dir}")

    source = {"kind": "local", "path": local_dir}
    target = {"kind": "r2", "bucket": ctx.config.bucket,
              "key": ctx.r2_prefix(folder).rstrip("/")}
    sync_core(s3, source, target, dry_run=args.dry_run)


def cmd_pull(ctx: Context, args, s3) -> None:
    """Download R2 prefix → local <folder>/. Thin wrapper around sync_core."""
    folder = args.folder
    local_dir = ctx.local_folder(folder)

    source = {"kind": "r2", "bucket": ctx.config.bucket,
              "key": ctx.r2_prefix(folder).rstrip("/")}
    target = {"kind": "local", "path": local_dir}
    sync_core(s3, source, target, dry_run=args.dry_run, force_folder=True)


def cmd_sync(args, s3) -> None:
    """General-purpose copy: <what-to-copy> → <where-to-paste>.

    Either side may be 'r2:bucket/key' or a local path. Exactly one side
    must be r2. No --app, no cwd inference — paths are explicit.
    """
    source = parse_endpoint(args.source)
    target = parse_endpoint(args.target)

    # The kind-mismatch check is also done inside sync_core for safety, but
    # we check here too to fail fast before any work.
    if source["kind"] == target["kind"]:
        die(f"sync requires one local and one r2: endpoint.\n"
            f"  source: {describe_endpoint(source)} ({source['kind']})\n"
            f"  target: {describe_endpoint(target)} ({target['kind']})")

    sync_core(s3, source, target, dry_run=args.dry_run)


# ============================================================================
# Status / info
# ============================================================================

def cmd_status(ctx: Context, args, s3) -> None:
    """Show what's in this app folder and how each subfolder will be handled."""
    say(f"app:       {ctx.app}")
    say(f"location:  {ctx.cwd}")
    say(f"bucket:    s3://{ctx.config.bucket}/{ctx.app}/")
    say("")
    say("subfolders:")
    found_any = False
    for entry in sorted(ctx.cwd.iterdir()):
        if not entry.is_dir():
            continue
        if entry.name.startswith("."):
            continue
        found_any = True
        handler = "mysql" if entry.name in MYSQL_FOLDERS else "files"
        latest = entry / "latest.sql.gz" if handler == "mysql" else None
        marker = ""
        if latest and latest.exists():
            size_mb = latest.stat().st_size / 1_048_576
            marker = f"  (latest.sql.gz: {size_mb:.1f} MB)"
        say(f"  {entry.name:<20} handler={handler}{marker}")
    if not found_any:
        say("  (no subfolders yet)")


def cmd_info(ctx: Context, args, s3) -> None:
    """Show detected stack/container/R2 connection — useful for debugging."""
    say(f"app (stack):  {ctx.app}")
    say(f"cwd:          {ctx.cwd}")
    say(f"R2 endpoint:  {ctx.config.endpoint}")
    say(f"R2 bucket:    {ctx.config.bucket}")
    say("")
    # Quick R2 connectivity check.
    try:
        s3.head_bucket(Bucket=ctx.config.bucket)
        say(f"R2 bucket reachable: yes")
    except ClientError as e:
        say(f"R2 bucket reachable: NO ({e})")
    # Try to find the db container, but don't fail if it's not running.
    try:
        c = find_db_container(ctx.stack)
        say(f"db container: {c}")
        db = docker_get_env(c, "DB_NAME") or docker_get_env(c, "MYSQL_DATABASE") or "?"
        say(f"db name:      {db}")
    except SystemExit:
        say(f"db container: not running (OK if app is down)")


# ============================================================================
# Output helpers
# ============================================================================

def say(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    sys.stderr.write(f"warning: {msg}\n")


def die(msg: str) -> None:
    sys.stderr.write(f"error: {msg}\n")
    sys.exit(1)


# ============================================================================
# CLI
# ============================================================================

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="r2.py",
        description="Cloudflare R2 backup/restore tool for Docker Swarm apps.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--config", default=str(DEFAULT_CONFIG_PATH),
                   help=f"Path to config file (default: {DEFAULT_CONFIG_PATH})")
    p.add_argument("--dry-run", action="store_true",
                   help="Show what would happen without doing it")

    sub = p.add_subparsers(dest="command", required=True)

    def add_app_arg(subparser: argparse.ArgumentParser) -> None:
        """Every subcommand can take --app to override cwd-based detection."""
        subparser.add_argument(
            "--app", default=None,
            help="Operate on this app instead of detecting from cwd "
                 "(e.g. --app myapp). When set, cwd is ignored.",
        )

    sp = sub.add_parser("backup", help="Backup a folder (mysql: dump+upload)")
    add_app_arg(sp)
    sp.add_argument("folder", help="Folder name (e.g. 'mysql')")

    sp = sub.add_parser("restore", help="Restore a folder (mysql: download latest.sql.gz)")
    add_app_arg(sp)
    sp.add_argument("folder")
    sp.add_argument("--if-empty", action="store_true",
                    help="Only restore if local latest.sql.gz is missing")

    sp = sub.add_parser("list", help="List R2 objects under <folder>")
    add_app_arg(sp)
    sp.add_argument("folder")

    sp = sub.add_parser("prune", help="Delete old timestamped dumps, keep N newest")
    add_app_arg(sp)
    sp.add_argument("folder")
    sp.add_argument("--keep", type=int, default=None,
                    help="How many timestamped dumps to keep (default: from config)")

    sp = sub.add_parser("push", help="Upload local folder contents to R2 (plain files)")
    add_app_arg(sp)
    sp.add_argument("folder")

    sp = sub.add_parser("pull", help="Download R2 folder contents to local (plain files)")
    add_app_arg(sp)
    sp.add_argument("folder")

    sp = sub.add_parser(
        "sync",
        help="General-purpose copy: <source> → <target>. "
             "One side must be r2:bucket/key, the other a local path.",
        description=(
            "General-purpose copy between local and R2.\n\n"
            "Examples:\n"
            "  r2.py sync r2:storage/myapp/configs/ /opt/foo/configs/\n"
            "  r2.py sync /opt/foo/configs/ r2:storage/myapp/configs/\n"
            "  r2.py sync r2:storage/dumps/file.tar.gz /tmp/file.tar.gz\n\n"
            "Trailing slashes are decoration. Always overwrites the target."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sp.add_argument("source", help="What to copy (r2:bucket/key or local path)")
    sp.add_argument("target", help="Where to paste (r2:bucket/key or local path)")

    sp = sub.add_parser("status", help="Show subfolders and detected handlers")
    add_app_arg(sp)
    sp = sub.add_parser("info", help="Show detected stack, container, R2 connection")
    add_app_arg(sp)

    return p


def dispatch(args) -> None:
    config = Config.load(Path(args.config))
    s3 = make_r2_client(config)

    cmd = args.command

    # `sync` is path-explicit — no cwd inference, no --app. Handle it before
    # resolve_context is called, since resolve_context requires either cwd to
    # be inside R2_ROOT or an --app override.
    if cmd == "sync":
        cmd_sync(args, s3)
        return

    # All other commands run inside an app context (cwd-derived or --app).
    app_override = getattr(args, "app", None)
    ctx = resolve_context(config, app_override=app_override)

    if cmd == "status":
        cmd_status(ctx, args, s3); return
    if cmd == "info":
        cmd_info(ctx, args, s3); return

    # All other commands take a folder. Decide handler by folder name.
    folder = args.folder
    is_mysql = folder in MYSQL_FOLDERS

    if cmd == "backup":
        if is_mysql:
            cmd_backup_mysql(ctx, args, s3)
        else:
            # For plain files, "backup" is just an alias for "push".
            cmd_push(ctx, args, s3)
    elif cmd == "restore":
        if is_mysql:
            cmd_restore_mysql(ctx, args, s3)
        else:
            cmd_pull(ctx, args, s3)
    elif cmd == "list":
        # list works the same whether mysql or files — show R2 objects.
        if is_mysql:
            cmd_list_mysql(ctx, args, s3)
        else:
            objects = r2_list(s3, ctx.config.bucket, ctx.r2_prefix(folder))
            if not objects:
                say(f"(empty)")
                return
            objects.sort(key=lambda o: o["LastModified"], reverse=True)
            for o in objects:
                size = o["Size"] / 1_048_576
                ts = o["LastModified"].strftime("%Y-%m-%d %H:%M:%S UTC")
                say(f"  {ts}  {size:>8.2f} MB  {o['Key']}")
    elif cmd == "prune":
        if not is_mysql:
            die(f"prune only applies to mysql folders (got '{folder}').")
        cmd_prune_mysql(ctx, args, s3)
    elif cmd == "push":
        if is_mysql:
            warn("push on a mysql folder uploads files raw (no dump). "
                 "Did you mean 'backup mysql'?")
        cmd_push(ctx, args, s3)
    elif cmd == "pull":
        if is_mysql:
            warn("pull on a mysql folder downloads all files raw. "
                 "Did you mean 'restore mysql'?")
        cmd_pull(ctx, args, s3)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        dispatch(args)
    except KeyboardInterrupt:
        sys.stderr.write("\ninterrupted.\n")
        sys.exit(130)


if __name__ == "__main__":
    main()