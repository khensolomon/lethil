#!/usr/bin/env python3
"""
Swarm DB Manager - v.26.06.18-4

Description:
  Zero-dependency MySQL backup and restore engine for Docker Swarm stacks.
  Resolves an app by name or path, reads its .env, locates the database
  container running on the local node, and performs compressed dump/restore
  over `docker exec`. Every run prints a plan of what was found and where the
  data will go before anything is touched.

Layout (defaults):
  App directory:   /opt/<app>/.env
  Backup storage:  /opt/bucket/storage/<app>/mysql/
  Dump files:      <timestamp>.sql.gz   (e.g. 20260618_143022.sql.gz)
  Rolling pointer: latest.sql.gz -> newest dump (relative symlink)

Recognised .env keys:
  DB_NAME        Database to back up. When DB_NAME, DB_USER and DB_PWD are all
                 present the dump is scoped to this single database and runs as
                 the application user (the common one-database-per-stack case).
  DB_USER, DB_PWD  Application login. Preferred backup identity, since it has a
                 real password and rights on its own database. Aliases for the
                 password: DB_PASSWORD, MYSQL_PASSWORD; for the user: MYSQL_USER.
  DB_ROOT_PWD    Root password. Used only as a fallback when an application
                 login is not available, or for a whole-instance dump when
                 DB_NAME is unset. Aliases: DB_ROOT_PASSWORD, MYSQL_ROOT_PASSWORD.
                 Note: the official MySQL image leaves root password-less when
                 started with MYSQL_ALLOW_EMPTY_PASSWORD=yes, in which case
                 DB_ROOT_PWD will not authenticate -- use the application login.
  BACKUP_DIR     Overrides the storage root. Final path stays <root>/<app>/mysql.
  BACKUP_RETENTION_DAYS  Days to keep timestamped dumps. Default: 7.

  DB_HOST, DB_PORT and a service name are NOT required. dump/restore run inside
  the container against localhost, so host and port are unused; the database
  service is assumed to be <app>_db (a compose `db:` service deploys as
  <stack>_db). Set DB_SERVICE_NAME only to override that assumption.

Resolution:
  An <app> argument is matched strictly: an existing directory that contains a
  .env is used as-is; otherwise the bare name is looked up as <base>/<app>/.env
  under APP_BASE_DIRS. Unrelated folders living under the base or storage
  directories are never scanned or guessed.

Container lookup:
  The target container is found on the local node via the Swarm service label
  (com.docker.swarm.service.name), defaulting the service name to <app>_db.
  `docker exec` only reaches local containers, so a service scheduled on
  another node is reported clearly instead of failing later.

Safety:
  - A plan is printed before every action; nothing runs until confirmed.
  - Export proceeds automatically when stdin is not a TTY (cron-friendly).
  - Import always requires confirmation in a terminal, or --yes when
    non-interactive; a database is never overwritten silently.
  - pipefail guards the dump and restore pipelines.
  - Dumps smaller than the minimum size are deleted and reported as failures.
  - The password is passed through the MYSQL_PWD environment variable, keeping
    it out of the host and container process lists.

Usage:
  Export:  python3 db.py export [<app>|/path/to/app] [--yes]
  Import:  python3 db.py import [<app>|/path/to/app] [/path/to/backup.sql.gz] [--yes]
  List:    python3 db.py list   [<app>|/path/to/app]
  Help:    python3 db.py help

  Omitting <app> uses the current directory. Omitting the backup file on import
  selects latest.sql.gz, or the newest dump if the pointer is missing.
"""

import os
import sys
import shlex
import subprocess
from datetime import datetime
from pathlib import Path

# --- DEFAULTS ---
APP_BASE_DIRS     = ["/opt"]                    # where <app> directories live (each holds a .env)
STORAGE_BASE      = "/opt/bucket/storage"       # root of per-app backup storage
DB_SUBDIR         = "mysql"                      # dumps live under <storage>/<app>/<subdir>/
DB_SERVICE_SUFFIX = "db"                         # compose service name; full Swarm name is <app>_<suffix>
LATEST_NAME       = "latest.sql.gz"             # relative symlink to the newest dump
RETENTION_DAYS    = 7                            # default; overridable via .env BACKUP_RETENTION_DAYS
MIN_VALID_BYTES   = 100                          # dumps smaller than this are treated as failures
SWARM_LABEL       = "com.docker.swarm.service.name"


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


def confirm_proceed(assume_yes, destructive=False):
    """
    Decides whether to proceed after a plan has been shown.
      - assume_yes (--yes)        -> always proceed.
      - interactive terminal      -> ask y/N.
      - non-interactive + safe    -> proceed (cron-friendly export).
      - non-interactive + danger  -> refuse (no silent overwrite).
    """
    if assume_yes:
        return True
    if sys.stdin.isatty():
        return input("Proceed? (y/N): ").strip().lower() in ("y", "yes")
    if destructive:
        print("[-] Refusing a destructive action in non-interactive mode without --yes.",
              file=sys.stderr)
        return False
    return True


def parse_env_file(env_path):
    """
    Parses a standard .env file into a dictionary using only standard libraries.
    Handles whitespace, comments, and wrapping quotes.
    """
    env_vars = {}
    if not env_path.exists():
        return env_vars

    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                env_vars[key] = value
    return env_vars


def resolve_app_directory(app_arg):
    """
    Strict app resolution. Returns a Path or None.
      1. If app_arg is a directory containing a .env, it is used directly.
      2. Otherwise app_arg is treated as a bare name and looked up only as
         <base>/<app_arg>/.env under APP_BASE_DIRS. No deep or fuzzy scanning,
         so unrelated siblings under the base directories are ignored.
    """
    path_attempt = Path(app_arg).resolve()
    if path_attempt.is_dir() and (path_attempt / ".env").exists():
        return path_attempt

    for base_str in APP_BASE_DIRS:
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
    """
    Returns the local container ID for a Swarm service, or "" if none runs on
    this node. Uses the service label because `docker exec` only reaches local
    containers, unlike `docker service ps` task IDs.
    """
    cmd = (
        "docker ps -q "
        f"-f label={SWARM_LABEL}={shlex.quote(service_name)} "
        "| head -n1"
    )
    out = subprocess.run(cmd, shell=True, executable="/bin/bash",
                         capture_output=True, text=True)
    return out.stdout.strip()


def read_db_settings(env_vars, app_name, require_retention=False):
    """
    Resolves backup identity, target service, and dump scope from .env values.

    Identity: the application login (DB_USER/DB_PWD) is preferred and scoped to
    its own DB_NAME -- it has a real password and rights on that database, and
    does not depend on root, which the MySQL image may leave password-less.
    Root (DB_ROOT_PWD) is used only when an application login is unavailable, or
    for a whole-instance dump when DB_NAME is unset.

    Service: defaults to <app>_db; DB_SERVICE_NAME overrides if set.
    """
    name = env_vars.get("DB_NAME")
    app_user = env_vars.get("DB_USER") or env_vars.get("MYSQL_USER")
    app_pwd  = (env_vars.get("DB_PWD")
                or env_vars.get("DB_PASSWORD")
                or env_vars.get("MYSQL_PASSWORD"))
    root_pwd = (env_vars.get("DB_ROOT_PWD")
                or env_vars.get("DB_ROOT_PASSWORD")
                or env_vars.get("MYSQL_ROOT_PASSWORD"))

    if name and app_user and app_pwd:
        # Application user, single database. Dump tables only (no CREATE
        # DATABASE), restore explicitly into <name> so app-level grants suffice.
        user, password, cred_src = app_user, app_pwd, "DB_USER/DB_PWD"
        scope, scope_label, restore_target = [name], f"database '{name}'", name
    elif root_pwd:
        user, password, cred_src = "root", root_pwd, "DB_ROOT_PWD"
        if name:
            scope, scope_label, restore_target = ["--databases", name], f"database '{name}'", None
        else:
            scope, scope_label, restore_target = ["--all-databases"], "all databases", None
    else:
        # Last resort: whatever login exists; require_credentials reports if none.
        user = app_user or "root"
        password = app_pwd
        cred_src = "DB_PWD"
        if name:
            scope, scope_label, restore_target = [name], f"database '{name}'", name
        else:
            scope, scope_label, restore_target = ["--all-databases"], "all databases", None

    service = env_vars.get("DB_SERVICE_NAME") or env_vars.get("MYSQL_SERVICE_NAME")
    if service:
        service_src = "DB_SERVICE_NAME"
    else:
        service, service_src = f"{app_name}_{DB_SERVICE_SUFFIX}", "default"

    settings = {
        "name": name,
        "user": user,
        "password": password,
        "cred_src": cred_src,
        "service": service,
        "service_src": service_src,
        "scope": scope,
        "scope_label": scope_label,
        "restore_target": restore_target,
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


def resolve_container_or_exit(db):
    """Finds the local DB container or exits with guidance."""
    container_id = find_local_container(db["service"])
    if not container_id:
        print(f"[-] Error: no running container for service '{db['service']}' on this node.",
              file=sys.stderr)
        print("    Confirm it is running here:  docker service ls --format '{{.Name}}'",
              file=sys.stderr)
        print("    If the service name differs from <app>_db, set DB_SERVICE_NAME in .env.",
              file=sys.stderr)
        sys.exit(1)
    return container_id


# --- ACTIONS ---
def export_db(app_dir, env_vars, assume_yes):
    """Dumps the database to <timestamp>.sql.gz and repoints latest.sql.gz."""
    db = read_db_settings(env_vars, app_dir.name, require_retention=True)
    require_password(db)
    container_id = resolve_container_or_exit(db)

    target_backup_dir = backup_dir_for(app_dir, env_vars)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = target_backup_dir / f"{timestamp}.sql.gz"
    latest_link = target_backup_dir / LATEST_NAME

    print("[*] Export plan:")
    print_kv("App", app_dir.name)
    print_kv("App dir", app_dir)
    print_kv("Database", db["scope_label"])
    print_kv("DB service", f"{db['service']} (from {db['service_src']})")
    print_kv("Auth", f"{db['user']} (from {db['cred_src']})")
    print_kv("Container", f"{container_id} (local node)")
    print_kv("Backup dir", target_backup_dir)
    print_kv("New dump", backup_file.name)
    print_kv("Pointer", f"{LATEST_NAME} -> {backup_file.name}")
    print_kv("Retention", f"{db['retention']} days")

    if not confirm_proceed(assume_yes, destructive=False):
        print("[-] Export cancelled.")
        return

    target_backup_dir.mkdir(parents=True, exist_ok=True)
    print(f"[+] Exporting {db['scope_label']} from '{db['service']}'...")

    env = os.environ.copy()
    env["MYSQL_PWD"] = db["password"]
    scope_str = " ".join(shlex.quote(s) for s in db["scope"])
    cmd = (
        "set -o pipefail; "
        f"docker exec -i -e MYSQL_PWD {shlex.quote(container_id)} "
        f"mysqldump -u{shlex.quote(db['user'])} "
        f"--single-transaction --routines --triggers {scope_str} "
        f"| gzip > {shlex.quote(str(backup_file))}"
    )
    result = subprocess.run(cmd, shell=True, executable="/bin/bash", env=env)

    if result.returncode != 0 or not backup_file.exists() or backup_file.stat().st_size <= MIN_VALID_BYTES:
        print("[-] Error: export failed or produced an empty backup file.", file=sys.stderr)
        if backup_file.exists():
            backup_file.unlink()
        sys.exit(1)

    print(f"[+] Export successful: {backup_file.name} ({human_size(backup_file.stat().st_size)})")

    # Relative pointer so the folder can be moved or mounted elsewhere without breaking.
    try:
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        latest_link.symlink_to(backup_file.name)
        print(f"[+] Pointer updated: {LATEST_NAME} -> {backup_file.name}")
    except OSError as e:
        print(f"[!] Warning: failed to update {LATEST_NAME}: {e}", file=sys.stderr)

    # Retention runs only after a confirmed successful dump.
    now = datetime.now()
    for f in target_backup_dir.glob("*.sql.gz"):
        if f.name == LATEST_NAME or f.is_symlink():
            continue
        if (now - datetime.fromtimestamp(f.stat().st_mtime)).days > db["retention"]:
            f.unlink()
            print(f"[*] Deleted expired backup: {f.name}")


def import_db(app_dir, env_vars, backup_file_path, assume_yes):
    """Restores the database from an explicit archive or the latest dump."""
    db = read_db_settings(env_vars, app_dir.name)
    require_password(db)
    container_id = resolve_container_or_exit(db)

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
    print_kv("App dir", app_dir)
    print_kv("DB service", f"{db['service']} (from {db['service_src']})")
    print_kv("Auth", f"{db['user']} (from {db['cred_src']})")
    print_kv("Container", f"{container_id} (local node)")
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
    print_kv("Target", f"OVERWRITE {target_label} in '{db['service']}'")

    if not confirm_proceed(assume_yes, destructive=True):
        print("[-] Import cancelled.")
        return

    print(f"[+] Importing into '{db['service']}'...")
    env = os.environ.copy()
    env["MYSQL_PWD"] = db["password"]
    target = f" {shlex.quote(db['restore_target'])}" if db["restore_target"] else ""
    cmd = (
        "set -o pipefail; "
        f"gunzip < {shlex.quote(str(backup_file))} "
        f"| docker exec -i -e MYSQL_PWD {shlex.quote(container_id)} "
        f"mysql -u{shlex.quote(db['user'])}{target}"
    )
    if subprocess.run(cmd, shell=True, executable="/bin/bash", env=env).returncode == 0:
        print("[+] Import successful.")
    else:
        print("[-] Error: import failed.", file=sys.stderr)
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

    assume_yes = False
    cleaned = []
    for a in args:
        if a in ("-y", "--yes"):
            assume_yes = True
        else:
            cleaned.append(a)

    action = cleaned[0].lower()
    rest = cleaned[1:]

    target_dir_str = "."
    backup_file_arg = None

    if action in ("export", "list"):
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
    else:
        print(f"[-] Error: unknown action '{action}'. Use 'export', 'import', or 'list'.",
              file=sys.stderr)
        print("\n" + __doc__.strip())
        sys.exit(1)

    app_dir = resolve_app_directory(target_dir_str)
    if app_dir is None:
        print(f"[-] Error: could not resolve '{target_dir_str}' to an app directory with a .env.",
              file=sys.stderr)
        print(f"    Pass an app name or path, e.g. '{action} zaideih'. Looked in the path itself",
              file=sys.stderr)
        print(f"    and under {APP_BASE_DIRS}.", file=sys.stderr)
        sys.exit(1)

    configs = parse_env_file(app_dir / ".env")

    if action == "export":
        export_db(app_dir, configs, assume_yes)
    elif action == "import":
        import_db(app_dir, configs, backup_file_arg, assume_yes)
    elif action == "list":
        list_db(app_dir, configs)