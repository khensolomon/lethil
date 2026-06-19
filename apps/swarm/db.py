#!/usr/bin/env python3
"""
Swarm DB Manager - v.26.06.18-12

Description:
  Zero-dependency MySQL backup and restore engine for Django + MySQL stacks.
  Resolves an app by name or path, reads its .env, then dumps/restores either
  through `docker exec` (swarm) or against a local MySQL directly (dev). The
  mode is auto-detected, not read from .env. Every run prints a plan before
  anything is touched.

Mode (auto-detected; no .env flag needed):
  The <app>_db container is probed on this node. Found -> docker/swarm: driven
  via `docker exec`. Not found -> local/direct: mysqldump/mysql run on this host
  over DB_HOST:DB_PORT (default 127.0.0.1:3306; needs the MySQL client locally).
  Force with --docker or --local. Either way the dump is scoped to DB_NAME, so a
  shared local server holding many databases is never touched beyond this app's.

Service name:
  Defaults to <app>_db. Override per-run with --service <name> (no .env needed),
  or persistently with DB_SERVICE_NAME in .env.

Layout (defaults):
  App directory:   /opt/<app>/.env          (dev: the repo checkout path given)
  Backup storage:  /opt/bucket/storage/<app>/mysql/
  Dump files:      <timestamp>.sql.gz       (e.g. 20260618_143022.sql.gz)
  Rolling pointer: latest.sql.gz -> newest dump (relative symlink)

Clean / exec -- DRY-RUN BY DEFAULT:
  Both run their SQL inside a transaction that is ROLLED BACK unless --apply is
  given, so nothing persists while testing. `mysql -t -v` shows output; add
  `SELECT ROW_COUNT();` after a delete to see how many rows it would touch.
  Add --apply to commit for real. Output is minimal by default (just query
  results, e.g. SELECT rows); --verbose restores echoed statements and boxed
  tables for debugging.
    clean : runs the standing set assets/db-query/*-clean.sql, in lexical order.
            Only '-clean.sql' files run; other .sql files in the folder are
            ignored (keep notes/one-offs there freely). Source by mode:
              local  -> disk:  <app>/assets/db-query/
              docker -> inside the <app>_web container at /code/assets/db-query/
            (so rules ship with the image; no separate copy needed).
    exec  : runs ONE ad-hoc .sql file (or - for stdin) -- one-off surgery or
            SELECT inspection.

Offsite copy to R2 (optional, via rclone), after a successful export:
  If rclone + remote are present, the new dump is copied to
  <remote>:<base>/<app>/mysql/. Prompted in a terminal; automatic under cron.
  --no-r2 skips it. Only *.sql.gz dumps are sent (copy, not sync).

Recognised .env keys:
  DB_NAME        Database to back up; scopes the dump and the clean/exec target.
  DB_USER, DB_PWD  Application login. Preferred. Password aliases: DB_PASSWORD,
                 MYSQL_PASSWORD; user alias: MYSQL_USER.
  DB_ROOT_PWD    Root password. Fallback only / whole-instance dump when DB_NAME
                 is unset. Aliases: DB_ROOT_PASSWORD, MYSQL_ROOT_PASSWORD.
  DB_HOST, DB_PORT  Used in local mode. Default 127.0.0.1:3306.
  DB_SERVICE_NAME  Optional persistent service override (default <app>_db).
  DB_CLEAN_DIR   Optional override for the clean dir (default assets/db-query).
  BACKUP_DIR     Overrides the storage root. Final path stays <root>/<app>/mysql.
  BACKUP_RETENTION_DAYS  Days to keep timestamped dumps. Default: 7.

Environment (shell, not .env):
  DB_APP_DIRS    Extra colon-separated base dirs for bare-name lookup, in
                 addition to /opt (e.g. export DB_APP_DIRS=$HOME/dev).

Safety:
  - A plan is printed before every action; nothing runs until confirmed.
  - Live-data changes (clean/exec) are dry-run unless --apply, and an --apply in
    docker mode also requires confirmation (or --yes when non-interactive).
  - Import always requires confirmation in a terminal (or --yes).
  - pipefail guards the pipelines; the password travels via MYSQL_PWD, never argv.

Usage:
  Export:  python3 db.py export [<app>|/path] [--yes] [--clean|--no-clean] [--apply] [--no-r2]
  Import:  python3 db.py import [<app>|/path] [/path/to/backup.sql.gz] [--yes]
  Clean:   python3 db.py clean  [<app>|/path] [--apply] [--yes]
  Exec:    python3 db.py exec   [<app>|/path] <file.sql|-> [--apply] [--yes]
  List:    python3 db.py list   [<app>|/path]
  Common:  [--local|--docker] [--service <name>] [--verbose]
  Help:    python3 db.py help

  Omitting <app> uses the current directory.
"""

import os
import sys
import shlex
import shutil
import tempfile
import subprocess
from datetime import datetime
from pathlib import Path

# --- DEFAULTS ---
APP_BASE_DIRS      = ["/opt"]                   # base dirs for bare-name lookup (plus $DB_APP_DIRS)
STORAGE_BASE       = "/opt/bucket/storage"      # root of per-app backup storage
DB_SUBDIR          = "mysql"                     # dumps live under <storage>/<app>/<subdir>/
DB_SERVICE_SUFFIX  = "db"                        # compose service; full Swarm name is <app>_db
WEB_SERVICE_SUFFIX = "web"                       # app code container; full Swarm name is <app>_web
CONTAINER_CODE_DIR = "/code"                     # image WORKDIR; clean dir is <code>/assets/db-query
CLEAN_REL          = "assets/db-query"          # repo-relative dir of clean scripts (disk + image)
CLEAN_GLOB         = "*-clean.sql"             # only these run in the standing clean (opt-in tag)
LATEST_NAME        = "latest.sql.gz"           # relative symlink to the newest dump
RETENTION_DAYS     = 7                           # default; overridable via .env BACKUP_RETENTION_DAYS
MIN_VALID_BYTES    = 100                         # dumps smaller than this are treated as failures
SWARM_LABEL        = "com.docker.swarm.service.name"
RCLONE_REMOTE      = "r2"                        # rclone remote name (configured on the host)
RCLONE_BASE        = "storage"                   # remote base; dir = <remote>:<base>/<app>/<subdir>/


# --- HELPERS ---
def human_size(n):
    """Formats a byte count as a short human-readable string."""
    size = float(n)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{int(size)} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024


def print_kv(label, value):
    """Prints a single aligned key/value line for a plan block."""
    print(f"    {label + ':':<14}{value}")


def confirm_proceed(assume_yes):
    """True to proceed: --yes, or an interactive y/N; refuses non-interactively."""
    if assume_yes:
        return True
    if sys.stdin.isatty():
        return input("Proceed? (y/N): ").strip().lower() in ("y", "yes")
    print("[-] Refusing without confirmation in non-interactive mode (pass --yes).",
          file=sys.stderr)
    return False


def parse_env_file(env_path):
    """
    Parses a .env file into a dict (stdlib only). Handles an optional `export `
    prefix, wrapping quotes, and inline comments:
      - Quoted value: the closing quote ends it, so '#' and spaces inside quotes
        are kept and any trailing comment after the quote is dropped.
      - Unquoted value: a '#' is a comment only when preceded by whitespace, so a
        '#' inside a token (e.g. a password p#ss) is preserved -- never silently
        truncated.
    """
    env_vars = {}
    if not env_path.exists():
        return env_vars
    with open(env_path, "r") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key.startswith("export "):
                key = key[len("export "):].strip()
            value = value.strip()

            if value[:1] in ('"', "'"):
                quote = value[0]
                end = value.find(quote, 1)
                value = value[1:end] if end != -1 else value[1:]
            else:
                cut = -1
                for idx in range(1, len(value)):
                    if value[idx] == "#" and value[idx - 1] in " \t":
                        cut = idx
                        break
                if cut != -1:
                    value = value[:cut].rstrip()

            env_vars[key] = value
    return env_vars


def base_dirs():
    """/opt plus any colon-separated paths from the DB_APP_DIRS environment variable."""
    extra = [os.path.expanduser(d) for d in os.environ.get("DB_APP_DIRS", "").split(os.pathsep) if d]
    return APP_BASE_DIRS + extra


def resolve_app_directory(app_arg):
    """
    Strict app resolution. Returns a Path or None.
      1. A directory containing a .env is used directly (dev: the checkout path).
      2. Otherwise the bare name is looked up as <base>/<app>/.env under the base
         dirs (/opt plus $DB_APP_DIRS). No deep or fuzzy scanning.
    """
    path_attempt = Path(app_arg).resolve()
    if path_attempt.is_dir() and (path_attempt / ".env").exists():
        return path_attempt
    for base_str in base_dirs():
        candidate = Path(base_str).resolve() / app_arg
        if candidate.is_dir() and (candidate / ".env").exists():
            return candidate
    return None


def backup_dir_for(app_dir, env_vars):
    """Computes <storage>/<app>/<subdir>; .env BACKUP_DIR overrides the storage root."""
    base = env_vars.get("BACKUP_DIR") or STORAGE_BASE
    return Path(base).resolve() / app_dir.name / DB_SUBDIR


def list_backups(backup_dir):
    """Returns timestamped dumps in a directory, newest first, excluding the pointer."""
    if not backup_dir.is_dir():
        return []
    files = [f for f in backup_dir.glob("*.sql.gz")
             if f.name != LATEST_NAME and not f.is_symlink()]
    return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)


def find_local_container(service_name):
    """Returns the local container ID for a Swarm service, or "" if none runs here."""
    cmd = (
        "docker ps -q "
        f"-f label={SWARM_LABEL}={shlex.quote(service_name)} "
        "| head -n1"
    )
    out = subprocess.run(cmd, shell=True, executable="/bin/bash",
                         capture_output=True, text=True)
    return out.stdout.strip()


def r2_remote_path(app_name):
    """Remote directory for an app's dumps, e.g. r2:storage/zaideih/mysql/."""
    return f"{RCLONE_REMOTE}:{RCLONE_BASE}/{app_name}/{DB_SUBDIR}/"


def rclone_ready():
    """Returns (ready, reason). Ready only if rclone exists and the remote is configured."""
    if shutil.which("rclone") is None:
        return False, "rclone not installed"
    out = subprocess.run(["rclone", "listremotes"], capture_output=True, text=True)
    if out.returncode != 0:
        return False, "rclone listremotes failed"
    if f"{RCLONE_REMOTE}:" not in out.stdout.split():
        return False, f"remote '{RCLONE_REMOTE}:' not configured"
    return True, ""


def read_db_settings(env_vars, app_name, service_override=None, require_retention=False):
    """Resolves identity, scope, and target service from .env values (+ service override)."""
    name = env_vars.get("DB_NAME")
    app_user = env_vars.get("DB_USER") or env_vars.get("MYSQL_USER")
    app_pwd  = (env_vars.get("DB_PWD")
                or env_vars.get("DB_PASSWORD")
                or env_vars.get("MYSQL_PASSWORD"))
    root_pwd = (env_vars.get("DB_ROOT_PWD")
                or env_vars.get("DB_ROOT_PASSWORD")
                or env_vars.get("MYSQL_ROOT_PASSWORD"))

    if name and app_user and app_pwd:
        user, password, cred_src = app_user, app_pwd, "DB_USER/DB_PWD"
        scope, scope_label, restore_target = [name], f"database '{name}'", name
    elif root_pwd:
        user, password, cred_src = "root", root_pwd, "DB_ROOT_PWD"
        if name:
            scope, scope_label, restore_target = ["--databases", name], f"database '{name}'", None
        else:
            scope, scope_label, restore_target = ["--all-databases"], "all databases", None
    else:
        user = app_user or "root"
        password = app_pwd
        cred_src = "DB_PWD"
        if name:
            scope, scope_label, restore_target = [name], f"database '{name}'", name
        else:
            scope, scope_label, restore_target = ["--all-databases"], "all databases", None

    if service_override:
        service, service_src = service_override, "--service"
    elif env_vars.get("DB_SERVICE_NAME") or env_vars.get("MYSQL_SERVICE_NAME"):
        service = env_vars.get("DB_SERVICE_NAME") or env_vars.get("MYSQL_SERVICE_NAME")
        service_src = "DB_SERVICE_NAME"
    else:
        service, service_src = f"{app_name}_{DB_SERVICE_SUFFIX}", "default"

    settings = {
        "name": name, "user": user, "password": password, "cred_src": cred_src,
        "service": service, "service_src": service_src,
        "scope": scope, "scope_label": scope_label, "restore_target": restore_target,
        "host": env_vars.get("DB_HOST") or "127.0.0.1",
        "port": env_vars.get("DB_PORT") or "3306",
    }
    if require_retention:
        try:
            settings["retention"] = int(env_vars.get("BACKUP_RETENTION_DAYS", str(RETENTION_DAYS)))
        except ValueError:
            settings["retention"] = RETENTION_DAYS
    return settings


def require_password(db):
    """Exits with a clear message if no usable database password was resolved."""
    if not db["password"]:
        print("[-] Error: no usable database password in .env. Set DB_USER + DB_PWD",
              file=sys.stderr)
        print("    (preferred) or DB_ROOT_PWD.", file=sys.stderr)
        sys.exit(1)


def need_local_client():
    """Exits if the MySQL client is required (local mode) but not installed."""
    for client in ("mysql", "mysqldump"):
        if shutil.which(client) is None:
            print(f"[-] Error: local mode needs the MySQL client; '{client}' not in PATH.",
                  file=sys.stderr)
            sys.exit(1)


def resolve_connection(db, force_mode):
    """
    Picks docker vs local. force_mode is 'docker', 'local', or None (auto).
    Auto: <app>_db container present -> docker; absent -> local.
    """
    container_id = "" if force_mode == "local" else find_local_container(db["service"])

    if force_mode == "docker":
        if not container_id:
            print(f"[-] Error: --docker forced but no '{db['service']}' container runs on this node.",
                  file=sys.stderr)
            print("    docker service ls --format '{{.Name}}'   (override with --service <name>)",
                  file=sys.stderr)
            sys.exit(1)
        return {"mode": "docker", "container": container_id, "why": "forced --docker"}

    if force_mode is None and container_id:
        return {"mode": "docker", "container": container_id, "why": "auto: container found"}

    # local (forced, or auto fallback when no container is present)
    need_local_client()
    why = "forced --local" if force_mode == "local" else "auto: no container found"
    return {"mode": "local", "host": db["host"], "port": db["port"], "why": why}


def client_prefix(conn, db, client, extra=""):
    """Builds the `mysql`/`mysqldump` invocation prefix for the active connection mode."""
    flags = f" {extra}" if extra else ""
    if conn["mode"] == "docker":
        return (f"docker exec -i -e MYSQL_PWD {shlex.quote(conn['container'])} "
                f"{client}{flags} -u{shlex.quote(db['user'])}")
    return (f"{client}{flags} -h{shlex.quote(conn['host'])} -P{shlex.quote(conn['port'])} "
            f"-u{shlex.quote(db['user'])}")


def output_flags(verbose):
    """mysql result formatting for clean/exec: minimal by default, boxed+echoed with --verbose."""
    return "-t -v" if verbose else ""


def piped_sql(source_cmd, mysql_cmd, dry_run):
    """Wraps a SQL source -> mysql pipe; in dry-run, brackets it in a rolled-back transaction."""
    if dry_run:
        begin = shlex.quote("SET autocommit=0; START TRANSACTION;")
        end = shlex.quote("ROLLBACK;")
        return f"set -o pipefail; {{ echo {begin}; {source_cmd}; echo {end}; }} | {mysql_cmd}"
    return f"set -o pipefail; {source_cmd} | {mysql_cmd}"


def run_shell(cmd, db):
    """Runs a /bin/bash command with MYSQL_PWD set; returns the exit code."""
    env = os.environ.copy()
    env["MYSQL_PWD"] = db["password"]
    return subprocess.run(cmd, shell=True, executable="/bin/bash", env=env).returncode


def print_mode(conn, db):
    """Prints the connection-mode plan line(s)."""
    if conn["mode"] == "local":
        print_kv("Mode", f"local / direct -> {conn['host']}:{conn['port']} ({conn['why']})")
    else:
        print_kv("Mode", f"docker / swarm ({conn['why']})")
        print_kv("DB service", f"{db['service']} (from {db['service_src']})")
        print_kv("Container", f"{conn['container']} (local node)")


def discover_clean(app_dir, env_vars, conn):
    """
    Locates the standing clean scripts (CLEAN_GLOB) for the active mode. Returns:
      {'kind':'disk','dir':Path,'files':[Path,...]}
      {'kind':'container','web':id,'dir':str,'files':[str,...]}
      {'kind':'none','reason':str}
    """
    rel = env_vars.get("DB_CLEAN_DIR") or CLEAN_REL

    if conn["mode"] == "local":
        d = app_dir / rel
        files = sorted(d.glob(CLEAN_GLOB))
        if files:
            return {"kind": "disk", "dir": d, "files": files}
        return {"kind": "none", "reason": f"no {CLEAN_GLOB} in {d}"}

    web_service = f"{app_dir.name}_{WEB_SERVICE_SUFFIX}"
    web = find_local_container(web_service)
    if not web:
        return {"kind": "none", "reason": f"web container '{web_service}' not running"}
    cdir = f"{CONTAINER_CODE_DIR}/{rel}"
    listing = subprocess.run(
        ["docker", "exec", web, "sh", "-c", f"ls -1 {shlex.quote(cdir)}/{CLEAN_GLOB} 2>/dev/null"],
        capture_output=True, text=True)
    files = sorted(ln for ln in listing.stdout.splitlines() if ln.strip())
    if not files:
        return {"kind": "none", "reason": f"no {CLEAN_GLOB} in {web_service}:{cdir}"}
    return {"kind": "container", "web": web, "dir": cdir, "files": files}


def print_clean_lines(found):
    """Prints the clean-source plan lines for a discover_clean() result."""
    if found["kind"] == "disk":
        print_kv("Clean dir", f"{found['dir']} (disk)")
        for f in found["files"]:
            print(f"      - {f.name}")
    elif found["kind"] == "container":
        print_kv("Clean dir", f"{found['web']}:{found['dir']} (image)")
        for f in found["files"]:
            print(f"      - {f.split('/')[-1]}")


def clean_source_cmd(found):
    """Returns the shell command that emits the concatenated clean SQL to stdout."""
    if found["kind"] == "disk":
        return "cat " + " ".join(shlex.quote(str(p)) for p in found["files"])
    inner = "cat " + " ".join(shlex.quote(p) for p in found["files"])
    return f"docker exec {shlex.quote(found['web'])} sh -c {shlex.quote(inner)}"


def run_clean(conn, db, found, apply, verbose):
    """Streams the discovered clean scripts into the live database (dry-run unless apply)."""
    tag = "apply" if apply else "DRY-RUN"
    print(f"[+] Clean ({tag}): {len(found['files'])} file(s)...")
    target = f" {shlex.quote(db['name'])}" if db["name"] else ""
    mysql = client_prefix(conn, db, "mysql", output_flags(verbose)) + target
    cmd = piped_sql(clean_source_cmd(found), mysql, dry_run=not apply)
    if run_shell(cmd, db) != 0:
        print("[-] Error: clean failed.", file=sys.stderr)
        sys.exit(1)
    if apply:
        print("[+] Clean applied.")
    else:
        print("[*] DRY-RUN complete: rolled back, nothing persisted. Re-run with --apply to commit.")


def maybe_upload_r2(app_name, local_dir, ready, assume_yes, no_r2):
    """Copies the backup dir to R2 when rclone is ready and not opted out."""
    if no_r2 or not ready:
        return
    remote = r2_remote_path(app_name)
    if assume_yes or not sys.stdin.isatty():
        do_upload = True
    else:
        do_upload = input(f"[?] Upload backup to R2 ({remote})? (y/N): ").strip().lower() in ("y", "yes")
    if not do_upload:
        print("[*] Skipped R2 upload.")
        return

    print(f"[+] Uploading to R2: {remote}")
    rc = subprocess.run(["rclone", "copy", str(local_dir), remote,
                         "--include", "*.sql.gz"]).returncode
    if rc == 0:
        print("[+] R2 upload complete.")
    else:
        print("[!] Warning: R2 upload FAILED. The local backup is intact, but the offsite",
              file=sys.stderr)
        print("    copy did not complete. Exiting non-zero so automation can alert.",
              file=sys.stderr)
        sys.exit(1)


# --- ACTIONS ---
def export_db(app_dir, env_vars, db, conn, assume_yes, do_clean, no_clean, apply, no_r2, verbose):
    """Cleans (optional), dumps to <timestamp>.sql.gz, repoints latest, copies to R2 (optional)."""
    target_backup_dir = backup_dir_for(app_dir, env_vars)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = target_backup_dir / f"{timestamp}.sql.gz"
    latest_link = target_backup_dir / LATEST_NAME

    found = {"kind": "none", "reason": "disabled (--no-clean)"} if no_clean \
        else discover_clean(app_dir, env_vars, conn)
    has_clean = found["kind"] != "none"
    r2_ready, r2_reason = rclone_ready()
    apply_word = "apply" if apply else "DRY-RUN"

    if no_clean:
        clean_label = "skipped (--no-clean)"
    elif not has_clean:
        clean_label = f"none ({found['reason']})"
    elif do_clean:
        clean_label = f"{len(found['files'])} file(s) -- yes (--clean) [{apply_word}]"
    elif sys.stdin.isatty():
        clean_label = f"{len(found['files'])} file(s) -- will prompt [{apply_word}]"
    else:
        clean_label = f"{len(found['files'])} file(s) -- skipped (non-interactive; pass --clean)"

    if no_r2:
        r2_label = "disabled (--no-r2)"
    elif not r2_ready:
        r2_label = f"skipped ({r2_reason})"
    elif assume_yes or not sys.stdin.isatty():
        r2_label = f"yes, automatic -> {r2_remote_path(app_dir.name)}"
    else:
        r2_label = f"will prompt -> {r2_remote_path(app_dir.name)}"

    print("[*] Export plan:")
    print_kv("App", app_dir.name)
    print_kv("App dir", app_dir)
    print_kv("Database", db["scope_label"])
    print_mode(conn, db)
    print_kv("Auth", f"{db['user']} (from {db['cred_src']})")
    print_kv("Pre-clean", clean_label)
    if has_clean:
        print_clean_lines(found)
    print_kv("Backup dir", target_backup_dir)
    print_kv("New dump", backup_file.name)
    print_kv("Pointer", f"{LATEST_NAME} -> {backup_file.name}")
    print_kv("Retention", f"{db['retention']} days")
    print_kv("R2 upload", r2_label)

    if not confirm_proceed(assume_yes):
        print("[-] Export cancelled.")
        return

    target_backup_dir.mkdir(parents=True, exist_ok=True)

    if has_clean:
        if do_clean:
            run_now = True
        elif sys.stdin.isatty():
            run_now = input(f"[?] Run pre-export clean now [{apply_word}]? (y/N): ").strip().lower() in ("y", "yes")
        else:
            run_now = False
        if run_now:
            run_clean(conn, db, found, apply, verbose)
        else:
            print("[*] Skipped clean.")

    print(f"[+] Exporting {db['scope_label']} ...")
    scope_str = " ".join(shlex.quote(s) for s in db["scope"])
    cmd = (
        "set -o pipefail; "
        f"{client_prefix(conn, db, 'mysqldump')} "
        f"--single-transaction --routines --triggers {scope_str} "
        f"| gzip > {shlex.quote(str(backup_file))}"
    )
    rc = run_shell(cmd, db)

    if rc != 0 or not backup_file.exists() or backup_file.stat().st_size <= MIN_VALID_BYTES:
        print("[-] Error: export failed or produced an empty backup file.", file=sys.stderr)
        if backup_file.exists():
            backup_file.unlink()
        sys.exit(1)

    print(f"[+] Export successful: {backup_file.name} ({human_size(backup_file.stat().st_size)})")

    try:
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        latest_link.symlink_to(backup_file.name)
        print(f"[+] Pointer updated: {LATEST_NAME} -> {backup_file.name}")
    except OSError as e:
        print(f"[!] Warning: failed to update {LATEST_NAME}: {e}", file=sys.stderr)

    now = datetime.now()
    for f in target_backup_dir.glob("*.sql.gz"):
        if f.name == LATEST_NAME or f.is_symlink():
            continue
        if (now - datetime.fromtimestamp(f.stat().st_mtime)).days > db["retention"]:
            f.unlink()
            print(f"[*] Deleted expired backup: {f.name}")

    maybe_upload_r2(app_dir.name, target_backup_dir, r2_ready, assume_yes, no_r2)


def import_db(app_dir, env_vars, db, conn, backup_file_path, assume_yes):
    """Restores the database from an explicit archive or the latest dump."""
    target_backup_dir = backup_dir_for(app_dir, env_vars)

    if backup_file_path:
        backup_file = Path(backup_file_path).resolve()
    else:
        latest_link = target_backup_dir / LATEST_NAME
        if latest_link.is_symlink() and latest_link.resolve().exists():
            backup_file = latest_link.resolve()
        else:
            candidates = list_backups(target_backup_dir)
            if not candidates:
                print(f"[-] Error: no dumps found in '{target_backup_dir}'.", file=sys.stderr)
                sys.exit(1)
            backup_file = candidates[0]

    if not backup_file.exists():
        print(f"[-] Error: backup file not found at {backup_file}", file=sys.stderr)
        sys.exit(1)

    print("[*] Import plan:")
    print_kv("App", app_dir.name)
    print_kv("Database", db["scope_label"])
    print_mode(conn, db)
    print_kv("Auth", f"{db['user']} (from {db['cred_src']})")
    print_kv("Backup dir", target_backup_dir)

    available = list_backups(target_backup_dir)
    if available:
        print("    Available:")
        for f in available[:10]:
            st = f.stat()
            stamp = datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")
            print(f"      {f.name:<24} {human_size(st.st_size):>9}  {stamp}")
        if len(available) > 10:
            print(f"      ... and {len(available) - 10} more")

    print_kv("Restore from", f"{backup_file.name} ({human_size(backup_file.stat().st_size)})")
    target_label = f"database '{db['name']}'" if db["name"] else "the archive contents"
    print_kv("Target", f"OVERWRITE {target_label}")

    if not confirm_proceed(assume_yes):
        print("[-] Import cancelled.")
        return

    print("[+] Importing ...")
    target = f" {shlex.quote(db['restore_target'])}" if db["restore_target"] else ""
    cmd = (
        "set -o pipefail; "
        f"gunzip < {shlex.quote(str(backup_file))} "
        f"| {client_prefix(conn, db, 'mysql')}{target}"
    )
    if run_shell(cmd, db) == 0:
        print("[+] Import successful.")
    else:
        print("[-] Error: import failed.", file=sys.stderr)
        sys.exit(1)


def clean_db(app_dir, env_vars, db, conn, assume_yes, apply, verbose):
    """Runs the standing clean set against the live database (dry-run unless --apply)."""
    found = discover_clean(app_dir, env_vars, conn)
    if found["kind"] == "none":
        print(f"[*] No clean scripts to run ({found['reason']}). Nothing to do.")
        return

    print("[*] Clean plan:")
    print_kv("App", app_dir.name)
    print_kv("Database", db["scope_label"])
    print_mode(conn, db)
    print_kv("Auth", f"{db['user']} (from {db['cred_src']})")
    print_kv("Scripts", f"{len(found['files'])} file(s)")
    print_clean_lines(found)
    print_kv("Action", "APPLY (commits deletes)" if apply else "DRY-RUN (rolled back; add --apply to commit)")

    # Dry-run is harmless; only a real apply needs confirmation.
    if apply and not confirm_proceed(assume_yes):
        print("[-] Clean cancelled.")
        return

    run_clean(conn, db, found, apply, verbose)


def exec_db(app_dir, env_vars, db, conn, sql_arg, assume_yes, apply, verbose):
    """Runs one ad-hoc .sql file (or stdin) against the app DB (dry-run unless --apply)."""
    tmp = None
    if sql_arg == "-":
        tmp = tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False)
        tmp.write(sys.stdin.read())
        tmp.close()
        sql_path = Path(tmp.name)
        label = "stdin"
    else:
        sql_path = Path(sql_arg).resolve()
        if not sql_path.is_file():
            print(f"[-] Error: SQL file not found: {sql_path}", file=sys.stderr)
            sys.exit(1)
        label = str(sql_path)

    print("[*] Exec plan:")
    print_kv("App", app_dir.name)
    print_kv("Database", db["scope_label"])
    print_mode(conn, db)
    print_kv("Auth", f"{db['user']} (from {db['cred_src']})")
    print_kv("Source", label)
    print_kv("Action", "APPLY (commits)" if apply else "DRY-RUN (rolled back; add --apply to commit)")

    if apply and not confirm_proceed(assume_yes):
        print("[-] Exec cancelled.")
        if tmp:
            os.unlink(tmp.name)
        return

    print("[+] Executing ...")
    target = f" {shlex.quote(db['name'])}" if db["name"] else ""
    mysql = client_prefix(conn, db, "mysql", output_flags(verbose)) + target
    source = f"cat {shlex.quote(str(sql_path))}"
    rc = run_shell(piped_sql(source, mysql, dry_run=not apply), db)
    if tmp:
        os.unlink(tmp.name)

    if rc == 0:
        print("[+] Exec applied." if apply else "[*] DRY-RUN complete: rolled back. Re-run with --apply to commit.")
    else:
        print("[-] Error: exec failed.", file=sys.stderr)
        sys.exit(1)


def list_db(app_dir, env_vars):
    """Prints the backup directory contents without restoring anything."""
    target_backup_dir = backup_dir_for(app_dir, env_vars)
    latest_link = target_backup_dir / LATEST_NAME

    print("[*] Backups:")
    print_kv("App", app_dir.name)
    print_kv("Backup dir", target_backup_dir)
    if latest_link.is_symlink():
        print_kv("Pointer", f"{LATEST_NAME} -> {os.readlink(latest_link)}")

    backups = list_backups(target_backup_dir)
    if not backups:
        print("    (no dumps found)")
        return
    for f in backups[:20]:
        st = f.stat()
        stamp = datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")
        print(f"    {f.name:<24} {human_size(st.st_size):>9}  {stamp}")
    if len(backups) > 20:
        print(f"    ... and {len(backups) - 20} more")


# --- ENTRY ---
if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0].lower() in ("-h", "--help", "help"):
        print(__doc__.strip())
        sys.exit(0)

    assume_yes = apply = do_clean = no_clean = no_r2 = verbose = False
    force_mode = None
    service_override = None
    cleaned = []
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("-y", "--yes"):
            assume_yes = True
        elif a == "--apply":
            apply = True
        elif a == "--verbose":
            verbose = True
        elif a == "--clean":
            do_clean = True
        elif a == "--no-clean":
            no_clean = True
        elif a == "--no-r2":
            no_r2 = True
        elif a == "--local":
            force_mode = "local"
        elif a == "--docker":
            force_mode = "docker"
        elif a == "--service":
            i += 1
            if i >= len(args):
                print("[-] Error: --service needs a name.", file=sys.stderr)
                sys.exit(1)
            service_override = args[i]
        elif a.startswith("--service="):
            service_override = a.split("=", 1)[1]
        else:
            cleaned.append(a)
        i += 1

    if do_clean and no_clean:
        print("[-] Error: use either --clean or --no-clean, not both.", file=sys.stderr)
        sys.exit(1)

    action = cleaned[0].lower()
    rest = cleaned[1:]

    target_dir_str = "."
    backup_file_arg = None
    sql_arg = None

    if action in ("export", "list", "clean"):
        if rest:
            target_dir_str = rest[0]
    elif action == "import":
        if len(rest) == 1:
            arg = rest[0]
            if arg.endswith(".sql.gz") or Path(arg).is_file():
                backup_file_arg = arg
            else:
                target_dir_str = arg
        elif len(rest) >= 2:
            target_dir_str = rest[0]
            backup_file_arg = rest[1]
    elif action == "exec":
        if len(rest) == 1:
            sql_arg = rest[0]
        elif len(rest) >= 2:
            target_dir_str = rest[0]
            sql_arg = rest[1]
        if not sql_arg:
            print("[-] Error: exec needs a SQL file path (or - for stdin).", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"[-] Error: unknown action '{action}'. Use export, import, clean, exec, or list.",
              file=sys.stderr)
        print("\n" + __doc__.strip())
        sys.exit(1)

    app_dir = resolve_app_directory(target_dir_str)
    if app_dir is None:
        print(f"[-] Error: could not resolve '{target_dir_str}' to an app directory with a .env.",
              file=sys.stderr)
        print(f"    Pass a path (e.g. '{action} ~/dev/zaideih'), or set DB_APP_DIRS to add base dirs.",
              file=sys.stderr)
        sys.exit(1)

    configs = parse_env_file(app_dir / ".env")

    if action == "list":
        list_db(app_dir, configs)
        sys.exit(0)

    settings = read_db_settings(configs, app_dir.name, service_override,
                                require_retention=(action == "export"))
    require_password(settings)
    connection = resolve_connection(settings, force_mode)

    if action == "export":
        export_db(app_dir, configs, settings, connection, assume_yes, do_clean, no_clean, apply, no_r2, verbose)
    elif action == "import":
        import_db(app_dir, configs, settings, connection, backup_file_arg, assume_yes)
    elif action == "clean":
        clean_db(app_dir, configs, settings, connection, assume_yes, apply, verbose)
    elif action == "exec":
        exec_db(app_dir, configs, settings, connection, sql_arg, assume_yes, apply, verbose)