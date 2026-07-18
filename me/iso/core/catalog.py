"""
Shared application catalog loader (ISO builder side).

Single source of truth for "which apps to install" is catalog/apps.json
at the repo root — a sibling of iso/ and dev/. Both consumers read the
same file: the ISO builder loads it from the local checkout (this
module); dev/ubuntu_desktop.py fetches it over HTTPS, since that script
is meant to run standalone via curl-pipe. See catalog/README.md.

An app entry looks like:

    "chrome": {
      "name": "Google Chrome",
      "prompt": "Install Google Chrome?",
      "default": true,
      "iso": { "late-commands": [...] }
    }

Fields at the top level (name/prompt/default/packages) are shared
defaults. The "iso" block overrides them for this consumer, and is
where distro-specific ("ubuntu"/"debian") install actions live. Apps
with no divergent behavior (plain apt packages) need only the
top-level "packages" field — see the atomic entries in apps.json.
"""

import json
from pathlib import Path
from typing import Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CATALOG_PATH = REPO_ROOT / "catalog" / "apps.json"

# Fields resolve_app will pull from a context block, falling back to the
# app's top-level value when the context block doesn't override it.
_INHERITABLE_FIELDS = ("prompt", "default", "packages", "snaps", "late-commands")
# Fields that only ever make sense inside a context block (no top-level
# fallback — a bare package has no "type" or "repo").
_CONTEXT_ONLY_FIELDS = ("ubuntu", "debian", "type", "groups", "repo", "note")


class CatalogError(Exception):
    """Raised when the app catalog can't be loaded, parsed, or resolved."""


def load_catalog(path: Path = None) -> Dict:
    """Load catalog/apps.json and return its 'apps' mapping."""
    path = Path(path or DEFAULT_CATALOG_PATH).expanduser()
    if not path.exists():
        raise CatalogError(f"App catalog not found: {path}")
    try:
        with open(path, "r") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise CatalogError(f"App catalog {path} is not valid JSON: {e}") from e

    if not isinstance(data, dict) or "apps" not in data:
        raise CatalogError(f"App catalog {path} must contain a top-level 'apps' object")
    return data["apps"]


def resolve_app(app_id: str, apps: Dict, context: str) -> Dict:
    """
    Resolve one catalog entry for a given context ('iso' or 'dev') into a
    flat dict, falling back to top-level fields when the app has no
    context-specific override (the common case: a plain apt package).
    """
    if app_id not in apps:
        raise CatalogError(f"Unknown app id '{app_id}' referenced (not in catalog)")

    app = apps[app_id]
    ctx = app.get(context) or {}

    resolved = {}
    for key in _INHERITABLE_FIELDS:
        if key in ctx:
            resolved[key] = ctx[key]
        elif key in app:
            resolved[key] = app[key]

    for key in _CONTEXT_ONLY_FIELDS:
        if key in ctx:
            resolved[key] = ctx[key]

    resolved["name"] = app.get("name", app_id)
    return resolved


def resolve_apps(app_ids: List[str], apps: Dict, context: str) -> List[Dict]:
    """Resolve a list of app ids in order. Raises on unknown ids (fail fast)."""
    return [resolve_app(app_id, apps, context) for app_id in app_ids]
