"""
Auto-detect host system defaults for timezone, locale, and keyboard.

These are best-effort: if detection fails, we return safe fallbacks and the
caller can prompt the user.
"""

import os
from typing import Dict


def get_host_timezone() -> str:
    """Detect host timezone from /etc/timezone or /etc/localtime symlink."""
    try:
        with open("/etc/timezone", "r") as f:
            tz = f.read().strip()
            if tz:
                return tz
    except OSError:
        pass

    try:
        target = os.readlink("/etc/localtime")
        if "zoneinfo/" in target:
            return target.split("zoneinfo/", 1)[1]
    except OSError:
        pass

    return "UTC"


def get_host_locale() -> str:
    """Detect host locale from /etc/default/locale or LANG env var."""
    try:
        with open("/etc/default/locale", "r") as f:
            for line in f:
                if line.startswith("LANG="):
                    return line.split("=", 1)[1].strip(" \n\r\"'")
    except OSError:
        pass
    return os.environ.get("LANG", "")


def get_host_keyboard() -> Dict[str, str]:
    """Detect host keyboard layout, variant, and toggle from /etc/default/keyboard."""
    kb = {"layout": "", "variant": "", "toggle": ""}
    try:
        with open("/etc/default/keyboard", "r") as f:
            for line in f:
                if line.startswith("XKBLAYOUT="):
                    kb["layout"] = line.split("=", 1)[1].strip(" \n\r\"'")
                elif line.startswith("XKBVARIANT="):
                    kb["variant"] = line.split("=", 1)[1].strip(" \n\r\"'")
                elif line.startswith("XKBOPTIONS="):
                    opts = line.split("=", 1)[1].strip(" \n\r\"'")
                    for opt in opts.split(","):
                        if opt.startswith("grp:"):
                            kb["toggle"] = opt
    except OSError:
        pass
    return kb


def detect_host_distro() -> str:
    """Return distro id ('ubuntu', 'debian', 'fedora', etc.) or 'unknown'."""
    try:
        with open("/etc/os-release", "r") as f:
            for line in f:
                if line.startswith("ID="):
                    return line.split("=", 1)[1].strip().strip('"').lower()
    except OSError:
        pass
    return "unknown"
