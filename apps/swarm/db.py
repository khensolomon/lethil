#!/usr/bin/env python3
"""
Swarm DB Manager - v.26.05.29-4

Description:
  A zero-dependency database backup and restoration engine tailored for Docker 
  Swarm environments running Django & MySQL stacks. It dynamically locates active 
  running tasks across the Swarm cluster, parses local configuration secrets, and 
  executes highly reliable, compressed database exports and imports.

Features:
  * Dual-File Exporting: Generates a timestamped archive and automatically updates 
    a 'mysql_backup_latest.sql.gz' relative symlink pointing to the newest backup.
  * Application Path Resolution: Automatically resolves a simple app name (e.g. 'app_one') 
    to its actual path by searching common directories (e.g., /home/ubuntu/apps, /var/www).
  * Auto-Latest Restore Discovery: If the import command omits the backup file argument, 
    the script automatically detects and offers to restore the most recent backup file.
  * Pipefail Integration: Forwards execution to /bin/bash with 'pipefail' active 
    to guarantee errors in the mysqldump pipeline fail the script immediately.
  * Corrupt/Empty File Prevention: Assesses both execution exit-status and 
    file-size footprints to clean up corrupt/empty archives on stream failures.
  * Smart Parameter Routing: Simplifies cron and manual tasks by allowing omission 
    of path parameters, defaulting directly to the current working directory.
  * Built-in Safety Prompts: Includes explicit risk warning prompts before executing 
    overwrites on active database instances.

Usage:
  Export (Backup):
    python3 ./apps/swarm/db.py export [<app_name> or /path/to/app]

  Import (Restore):
    python3 ./apps/swarm/db.py import [<app_name> or /path/to/app] [/path/to/backup.sql.gz]
    (Omitting the backup file path automatically selects the newest backup for that app)
"""

import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path

# --- GLOBAL CONFIGURATION CONSTANTS ---
DEFAULT_BACKUP_DIR = "/var/backups/swarm_apps"
APPS_BASE_DIRS = [
    "/home/ubuntu/apps",
    "/home/ubuntu",
    "/var/www",
    "/apps",
    "."
]

def parse_env_file(env_path):
    """
    Parses a standard .env file into a dictionary using only standard libraries.
    Handles whitespace, comments, and wrapping quotes.
    """
    env_vars = {}
    if not env_path.exists():
        return env_vars

    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            # Ignore empty lines or comments
            if not line or line.startswith('#'):
                continue
            # Split at the first '=' only
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                # Strip wrapping quotes if present
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                env_vars[key] = value
    return env_vars

def resolve_app_directory(app_arg):
    """
    Smarter Directory Resolution:
    If app_arg is an existing directory path, returns it.
    Otherwise, scans standard base directories looking for a folder matching app_arg
    that contains a '.env' file.
    """
    path_attempt = Path(app_arg).resolve()
    if path_attempt.is_dir() and (path_attempt / '.env').exists():
        return path_attempt

    # If it is a simple app name, look for it under known parent directories
    for base_str in APPS_BASE_DIRS:
        base_dir = Path(base_str).resolve()
        if base_dir.is_dir():
            # Check direct subdirectory
            candidate = base_dir / app_arg
            if candidate.is_dir() and (candidate / '.env').exists():
                return candidate
            
            # Search one level deep for matching directories (e.g. user home subfolders)
            try:
                for sub in base_dir.iterdir():
                    if sub.is_dir():
                        nested_candidate = sub / app_arg
                        if nested_candidate.is_dir() and (nested_candidate / '.env').exists():
                            return nested_candidate
                        if sub.name == app_arg and (sub / '.env').exists():
                            return sub
            except PermissionError:
                continue

    # Fallback to sibling directories in parent folder
    sibling_candidate = Path("..").resolve() / app_arg
    if sibling_candidate.is_dir() and (sibling_candidate / '.env').exists():
        return sibling_candidate

    # Return the resolved path_attempt if search fails so that the script handles it gracefully
    return path_attempt

def get_swarm_container(db_service_name):
    """
    Dynamically fetches the container ID of the active running Swarm service task.
    """
    try:
        swarm_cmd = f"docker service ps -q --filter 'desired-state=running' {db_service_name} | head -n1"
        container_id = subprocess.check_output(swarm_cmd, shell=True, text=True).strip()
        return container_id
    except subprocess.CalledProcessError:
        return ""

def export_db(app_path, env_vars):
    """
    Backs up the database to a compressed .sql.gz archive with strict error-checking and retention cleanup.
    Additionally updates a 'mysql_backup_latest.sql.gz' symbolic link to point to this new backup.
    """
    db_user = env_vars.get('DB_USER') or env_vars.get('MYSQL_USER') or 'root'
    db_password = env_vars.get('DB_PASSWORD') or env_vars.get('MYSQL_PASSWORD') or env_vars.get('MYSQL_ROOT_PASSWORD')
    db_service_name = env_vars.get('DB_SERVICE_NAME') or env_vars.get('MYSQL_SERVICE_NAME')
    backup_dir_str = env_vars.get('BACKUP_DIR') or DEFAULT_BACKUP_DIR
    retention_days = int(env_vars.get('BACKUP_RETENTION_DAYS', '7'))
    
    if not db_password:
        print("[-] Error: Database password (DB_PASSWORD/MYSQL_PASSWORD) missing from .env", file=sys.stderr)
        sys.exit(1)
        
    if not db_service_name:
        print("[-] Error: Service name (DB_SERVICE_NAME/MYSQL_SERVICE_NAME) missing from .env", file=sys.stderr)
        sys.exit(1)
        
    target_backup_dir = Path(backup_dir_str) / app_path.name
    target_backup_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = target_backup_dir / f"mysql_backup_{timestamp}.sql.gz"
    latest_link = target_backup_dir / "mysql_backup_latest.sql.gz"
    
    container_id = get_swarm_container(db_service_name)
    if not container_id:
        print(f"[-] Error: No running container found for Swarm service '{db_service_name}'", file=sys.stderr)
        sys.exit(1)
        
    print(f"[+] Exporting database from Swarm service '{db_service_name}'...")
    
    cmd = (
        f"set -o pipefail; "
        f"docker exec -i {container_id} mysqldump "
        f"-u{db_user} -p'{db_password}' "
        f"--single-transaction --routines --triggers --all-databases "
        f"| gzip > {backup_file}"
    )
    
    result = subprocess.run(cmd, shell=True, executable='/bin/bash')
    
    if result.returncode == 0 and backup_file.exists() and backup_file.stat().st_size > 100:
        print(f"[+] Export successful: {backup_file} ({backup_file.stat().st_size} bytes)")
        
        # Smart relative symlink updating
        try:
            if latest_link.exists() or latest_link.is_symlink():
                latest_link.unlink()
            # Creating a relative symlink avoids broken paths if backup folder is moved or mounted elsewhere
            latest_link.symlink_to(backup_file.name)
            print(f"[+] Updated symlink: {latest_link} -> {backup_file.name}")
        except Exception as e:
            print(f"[!] Warning: Failed to create/update latest symlink: {e}", file=sys.stderr)

        # Retention management: Clean up old backups safely only after a successful dump
        now = datetime.now()
        for f in target_backup_dir.glob("*.sql.gz"):
            # Ensure we do not accidentally delete our 'latest' symlink or a file named 'latest.sql.gz'
            if f.name == "mysql_backup_latest.sql.gz":
                continue
            if (now - datetime.fromtimestamp(f.stat().st_mtime)).days > retention_days:
                f.unlink()
                print(f"[–] Deleted expired backup: {f.name}")
    else:
        print("[-] Error: Export failed or produced an empty backup file.", file=sys.stderr)
        if backup_file.exists():
            backup_file.unlink()
        sys.exit(1)

def import_db(app_path, env_vars, backup_file_path=None):
    """
    Restores the database from a specified compressed archive or auto-detects the latest backup.
    """
    db_user = env_vars.get('DB_USER') or env_vars.get('MYSQL_USER') or 'root'
    db_password = env_vars.get('DB_PASSWORD') or env_vars.get('MYSQL_PASSWORD') or env_vars.get('MYSQL_ROOT_PASSWORD')
    db_service_name = env_vars.get('DB_SERVICE_NAME') or env_vars.get('MYSQL_SERVICE_NAME')
    backup_dir_str = env_vars.get('BACKUP_DIR') or DEFAULT_BACKUP_DIR
    
    if not db_password or not db_service_name:
        print("[-] Error: Missing database credentials or service name in .env", file=sys.stderr)
        sys.exit(1)
        
    container_id = get_swarm_container(db_service_name)
    if not container_id:
        print(f"[-] Error: No running container for service '{db_service_name}'", file=sys.stderr)
        sys.exit(1)

    if not backup_file_path:
        # Smart Auto-Detection of the latest backup
        target_backup_dir = Path(backup_dir_str) / app_path.name
        # Try checking if our smart symlink exists first, otherwise fallback to finding the newest file
        latest_link = target_backup_dir / "mysql_backup_latest.sql.gz"
        if latest_link.exists() or latest_link.is_symlink():
            backup_file = latest_link.resolve()
            print(f"[+] No backup file specified. Using target of 'latest' symlink: {backup_file.name}")
        else:
            backup_files = sorted(
                [f for f in target_backup_dir.glob("*.sql.gz") if f.name != "mysql_backup_latest.sql.gz"], 
                key=lambda x: x.stat().st_mtime
            )
            if not backup_files:
                print(f"[-] Error: No backup files found in directory '{target_backup_dir}' to restore.", file=sys.stderr)
                sys.exit(1)
            backup_file = backup_files[-1]
            print(f"[+] No backup file specified. Auto-detected latest backup file: {backup_file.name}")
    else:
        backup_file = Path(backup_file_path)

    if not backup_file.exists():
        print(f"[-] Error: Backup file not found at {backup_file}", file=sys.stderr)
        sys.exit(1)
        
    print(f"[!] WARNING: About to overwrite database in '{db_service_name}' using {backup_file.name}")
    confirm = input("Are you sure you want to proceed? (y/N): ")
    if confirm.lower() != 'y':
        print("[-] Import cancelled.")
        return

    print(f"[+] Importing database into Swarm service '{db_service_name}'...")
    cmd = f"set -o pipefail; gunzip < {backup_file} | docker exec -i {container_id} mysql -u{db_user} -p'{db_password}'"
    
    if subprocess.run(cmd, shell=True, executable='/bin/bash').returncode == 0:
        print("[+] Import successful!")
    else:
        print("[-] Error: Import failed.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1].lower() in ('-h', '--help', 'help'):
        print(__doc__.strip())
        sys.exit(0)
        
    action = sys.argv[1].lower()
    
    target_dir_str = "."
    backup_file_arg = None
    
    if action == "export":
        if len(sys.argv) >= 3:
            target_dir_str = sys.argv[2]
    elif action == "import":
        if len(sys.argv) == 3:
            # Smart Parameter Parsing: Determine if argument is the app directory or the backup archive
            arg = sys.argv[2]
            if arg.endswith(".sql.gz") or Path(arg).is_file():
                backup_file_arg = arg
            else:
                target_dir_str = arg
        elif len(sys.argv) >= 4:
            target_dir_str = sys.argv[2]
            backup_file_arg = sys.argv[3]
    else:
        print(f"[-] Error: Unknown action '{action}'. Use 'export' or 'import'.", file=sys.stderr)
        print("\n" + __doc__.strip())
        sys.exit(1)
        
    # Smart app directory resolution by path or name search
    app_dir = resolve_app_directory(target_dir_str)
    env_path = app_dir / '.env'
    
    if not env_path.exists():
        print(f"[-] Error: Resolved directory '{app_dir}' is not a valid app folder (.env file missing).", file=sys.stderr)
        sys.exit(1)
        
    configs = parse_env_file(env_path)
    
    if action == "export":
        export_db(app_dir, configs)
    elif action == "import":
        import_db(app_dir, configs, backup_file_arg)