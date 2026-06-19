#!/usr/bin/env python3
"""
Django Command Runner - v26.06.19-1

Description:
  A thin, optionless wrapper that forwards a Django management command to the
  right place -- `docker exec` into the <app>_web container (production swarm)
  or the local checkout's virtualenv (development) -- chosen automatically.
  Everything after the app name is passed to manage.py verbatim, so usage
  mirrors manage.py and the exit code is propagated unchanged.

Equivalence:
    python3 django.py <app> <command> [args...]
  is the same as, from inside the app's directory,
    python3 django.py <command> [args...]
  which forwards to
    python3 manage.py <command> [args...]

App resolution:
  The first token is the app only if it resolves to a directory containing a
  .env (by path, or by name under /opt and $DB_APP_DIRS). Otherwise the current
  directory is the app and every token is the command. So a real management
  command (migrate, createsuperuser, ...) is never mistaken for an app.

Mode (auto, no flag):
  <app>_web container running on this node -> docker: `docker exec` it (a TTY is
  attached for interactive commands such as createsuperuser and shell).
  Otherwise -> local: run the checkout's manage.py with its virtualenv python --
  <app>/venv/bin/python, else $VIRTUAL_ENV, else python3 (DJANGO_PYTHON
  overrides). No manual `source venv/bin/activate` is needed.

Passthrough:
  No options of its own. manage.py flags (--help, --verbosity, --noinput, ...)
  reach Django unchanged, and an unknown command ends gracefully with Django's
  own message and exit code.

Usage:
  python3 django.py [<app>|/path/to/app] <command> [manage.py args...]
"""

import os
import sys
import shlex
import subprocess
from pathlib import Path

# --- DEFAULTS ---
APP_BASE_DIRS      = ["/opt"]                   # base dirs for bare-name lookup (plus $DB_APP_DIRS)
WEB_SERVICE_SUFFIX = "web"                       # app code container; full Swarm name is <app>_web
CONTAINER_CODE_DIR = "/code"                     # image WORKDIR (where manage.py lives)
VENV_DIR           = "venv"                      # dev virtualenv at <app>/venv
SWARM_LABEL        = "com.docker.swarm.service.name"


def base_dirs():
    """/opt plus any colon-separated paths from the DB_APP_DIRS environment variable."""
    extra = [os.path.expanduser(d) for d in os.environ.get("DB_APP_DIRS", "").split(os.pathsep) if d]
    return APP_BASE_DIRS + extra


def resolve_app_directory(app_arg):
    """
    Returns the app Path if app_arg is a directory with a .env (by path), or a
    bare name found as <base>/<app_arg>/.env under the base dirs; else None.
    The .env file is only a marker -- its contents are not read here.
    """
    path_attempt = Path(app_arg).resolve()
    if path_attempt.is_dir() and (path_attempt / ".env").exists():
        return path_attempt
    for base_str in base_dirs():
        candidate = Path(base_str).resolve() / app_arg
        if candidate.is_dir() and (candidate / ".env").exists():
            return candidate
    return None


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


def local_python(app_dir):
    """
    Resolves the interpreter for local mode without an activated venv. Returns
    (interpreter, source). Search order:
      DJANGO_PYTHON -> <app>/{venv,.venv,env}/bin/{python,python3}
      -> $VIRTUAL_ENV/bin/python -> python3 (system).
    A project venv living outside the checkout (poetry, pipenv, pyenv) is not
    auto-discovered; point DJANGO_PYTHON at it, or activate it so $VIRTUAL_ENV is set.
    """
    override = os.environ.get("DJANGO_PYTHON")
    if override:
        return override, "DJANGO_PYTHON"
    for name in dict.fromkeys((VENV_DIR, "venv", ".venv", "env")):
        for exe in ("python", "python3"):
            candidate = app_dir / name / "bin" / exe
            if candidate.is_file():
                return str(candidate), f"{name}/bin/{exe}"
    active = os.environ.get("VIRTUAL_ENV")
    if active:
        candidate = Path(active) / "bin" / "python"
        if candidate.is_file():
            return str(candidate), "VIRTUAL_ENV"
    return "python3", "system"


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(0)

    # The first token is the app only if it resolves to an app directory;
    # otherwise the current directory is the app and all tokens are the command.
    app_dir = resolve_app_directory(args[0])
    if app_dir is not None:
        command = args[1:]
    else:
        app_dir = resolve_app_directory(".")
        command = args
        if app_dir is None:
            print(f"[-] Error: '{args[0]}' is not an app, and the current directory has no .env.",
                  file=sys.stderr)
            print("    Run from inside an app directory, or name it: django.py <app> <command> ...",
                  file=sys.stderr)
            sys.exit(2)

    web_service = f"{app_dir.name}_{WEB_SERVICE_SUFFIX}"
    container = find_local_container(web_service)

    if container:
        tty = "-it" if sys.stdin.isatty() else "-i"
        argv = ["docker", "exec", tty, container, "python", "manage.py", *command]
        run_cwd = None
        where = f"docker / {web_service}"
        interpreter = "python"
    else:
        manage = app_dir / "manage.py"
        if not manage.is_file():
            print(f"[-] Error: no manage.py in {app_dir}, and no '{web_service}' container on this node.",
                  file=sys.stderr)
            print("    In production the web service may be down; in dev, run from the app checkout.",
                  file=sys.stderr)
            sys.exit(2)
        interpreter, py_src = local_python(app_dir)
        argv = [interpreter, "manage.py", *command]
        run_cwd = str(app_dir)
        where = f"local / {app_dir.name}"
        if py_src == "system":
            print(f"[!] No virtualenv found in {app_dir} (venv/.venv/env); using system python3,",
                  file=sys.stderr)
            print("    which likely lacks Django. Create <app>/venv, or set DJANGO_PYTHON to the",
                  file=sys.stderr)
            print('    interpreter that has Django (after activating once: DJANGO_PYTHON="$(command -v python)").',
                  file=sys.stderr)

    # Notice goes to stderr so stdout stays purely manage.py's output.
    print(f"[*] {where}: {interpreter} manage.py {' '.join(command)}".rstrip(), file=sys.stderr)

    try:
        result = subprocess.run(argv, cwd=run_cwd)
    except FileNotFoundError as e:
        print(f"[-] Error: {e}", file=sys.stderr)
        sys.exit(127)
    sys.exit(result.returncode)