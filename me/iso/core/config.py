"""
Preset loading and schema validation.

Replaces the legacy custom parser (~150 lines) with PyYAML + a pure-Python
schema validator. The validator catches typos, wrong types, and unknown keys
*before* any ISO operation, so a typo costs you 1 second instead of failing
mid-build after 30 seconds of mounting.

Preset structure (a real, valid cloud-init document for autoinstall:, plus
a separate top-level `builder:` key the cloud-init installer ignores):

    autoinstall:
      version: 1
      identity: { ... }
      packages: [ ... ]
      ...

    builder:
      shared:
        prompts: [ ... ]
      ubuntu:
        packages: [ ... ]
        prompts: [ ... ]
      debian:
        ...
"""

from pathlib import Path
from typing import Any, Dict, List, Tuple

try:
    import yaml
except ImportError:
    raise SystemExit(
        "PyYAML is required. Install with:\n"
        "  sudo apt install python3-yaml\n"
        "  # or\n"
        "  pip install pyyaml"
    )

from . import catalog as app_catalog


class ConfigError(Exception):
    """Raised when a preset fails to load or validate."""


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

# A tiny schema language: each entry maps a key to (type, required, child_schema).
# - type: 'str' | 'int' | 'bool' | 'list' | 'dict' | 'list[str]' | 'list[dict]'
# - required: True/False
# - child_schema: nested schema for 'dict' types, or None
#
# Unknown keys produce a warning, not an error — autoinstall has many optional
# fields and we want to forward them to cloud-init unchanged.

PROMPT_SCHEMA = {
    "ask": ("str", True, None),
    "default": ("str", False, None),
    "packages": ("list[str]", False, None),
    "snaps": ("list[str]", False, None),
    "late-commands": ("list[str]", False, None),
    "choices": ("list[dict]", False, None),
    "ubuntu": ("dict", False, None),  # nested override per-distro
    "debian": ("dict", False, None),
    "fedora": ("dict", False, None),
    "arch": ("dict", False, None),
}

CHOICE_SCHEMA = {
    "label": ("str", True, None),
    "packages": ("list[str]", False, None),
    "snaps": ("list[str]", False, None),
    "late-commands": ("list[str]", False, None),
    "ubuntu": ("dict", False, None),
    "debian": ("dict", False, None),
    "fedora": ("dict", False, None),
    "arch": ("dict", False, None),
}

DISTRO_SECTION_SCHEMA = {
    "packages": ("list[str]", False, None),
    "snaps": ("list[str]", False, None),
    "late-commands": ("list[str]", False, None),
    "prompts": ("list[dict]", False, None),
}

BUILDER_SCHEMA = {
    "shared": ("dict", False, DISTRO_SECTION_SCHEMA),
    "ubuntu": ("dict", False, DISTRO_SECTION_SCHEMA),
    "debian": ("dict", False, DISTRO_SECTION_SCHEMA),
    "fedora": ("dict", False, DISTRO_SECTION_SCHEMA),
    "arch": ("dict", False, DISTRO_SECTION_SCHEMA),
}

TOP_LEVEL_SCHEMA = {
    "autoinstall": ("dict", True, None),  # forwarded as-is to cloud-init
    "builder": ("dict", False, BUILDER_SCHEMA),
}


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _check_type(value: Any, expected: str) -> bool:
    if expected == "str":
        return isinstance(value, str)
    if expected == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "bool":
        return isinstance(value, bool)
    if expected == "list":
        return isinstance(value, list)
    if expected == "dict":
        return isinstance(value, dict)
    if expected == "list[str]":
        return isinstance(value, list) and all(isinstance(x, str) for x in value)
    if expected == "list[dict]":
        return isinstance(value, list) and all(isinstance(x, dict) for x in value)
    return False


def _validate(data: Any, schema: Dict, path: str, errors: List[str], warnings: List[str]) -> None:
    if not isinstance(data, dict):
        errors.append(f"{path}: expected a mapping, got {type(data).__name__}")
        return

    # Required keys present?
    for key, (typ, required, child) in schema.items():
        if required and key not in data:
            errors.append(f"{path}: missing required key '{key}'")

    # Each present key has correct type?
    for key, value in data.items():
        if key not in schema:
            # Unknown key — warn but allow (forward to cloud-init)
            warnings.append(f"{path}.{key}: unknown key (will be passed through)")
            continue

        typ, required, child = schema[key]
        if not _check_type(value, typ):
            errors.append(
                f"{path}.{key}: expected {typ}, got {type(value).__name__}"
            )
            continue

        if child is not None:
            _validate(value, child, f"{path}.{key}", errors, warnings)


def _validate_prompts(builder: Dict, errors: List[str], warnings: List[str]) -> None:
    """Validate prompt and choice substructures (dynamic — depend on data)."""
    for distro_key, distro_section in builder.items():
        if not isinstance(distro_section, dict):
            continue
        prompts = distro_section.get("prompts", [])
        for i, p in enumerate(prompts):
            ppath = f"builder.{distro_key}.prompts[{i}]"
            _validate(p, PROMPT_SCHEMA, ppath, errors, warnings)
            for j, c in enumerate(p.get("choices") or []):
                _validate(c, CHOICE_SCHEMA, f"{ppath}.choices[{j}]", errors, warnings)


# ---------------------------------------------------------------------------
# Catalog expansion — resolves builder.<section>.app_ids into the same
# literal packages/snaps/late-commands/prompts shape the schema already
# expects. Runs before validation, so prompts.py and the schema itself
# stay unaware the catalog exists — they only ever see resolved data.
# ---------------------------------------------------------------------------

_BUILDER_SECTIONS = ("shared", "ubuntu", "debian", "fedora", "arch")


def _catalog_prompt_dict(resolved: Dict) -> Dict:
    """Turn a resolve_app() result into a literal prompt dict (PROMPT_SCHEMA shape)."""
    prompt = {
        "ask": resolved["prompt"],
        "default": "yes" if resolved.get("default", True) else "no",
    }
    for key in ("packages", "snaps", "late-commands", "ubuntu", "debian"):
        if resolved.get(key):
            prompt[key] = resolved[key]
    return prompt


def expand_app_ids(data: Dict, apps: Dict) -> Dict:
    """
    Walk builder.<section>.app_ids and resolve each id against the catalog:
      - apps with a "prompt" become an entry appended to that section's
        "prompts" list (same shape as a hand-written prompt).
      - apps with no "prompt" are unconditional; their packages/snaps/
        late-commands are appended directly onto the section's own
        static packages/snaps/late-commands lists.
    Mutates and returns `data`. Never touches `data["autoinstall"]` —
    catalog resolution only ever writes into builder:, which the existing
    merge machinery (prompts.merge_static_overrides, base.py) already
    folds into autoinstall at build time.
    """
    builder = data.get("builder")
    if not isinstance(builder, dict):
        return data

    for section_name in _BUILDER_SECTIONS:
        section = builder.get(section_name)
        if not isinstance(section, dict):
            continue

        app_ids = section.pop("app_ids", None)
        if not app_ids:
            continue

        for app_id in app_ids:
            resolved = app_catalog.resolve_app(app_id, apps, context="iso")
            if resolved.get("prompt"):
                section.setdefault("prompts", []).append(_catalog_prompt_dict(resolved))
            else:
                for key in ("packages", "snaps", "late-commands"):
                    if resolved.get(key):
                        section.setdefault(key, []).extend(resolved[key])

    return data


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_preset(path: Path, catalog_path: Path = None) -> Tuple[Dict, List[str]]:
    """
    Load, expand catalog app_ids, and validate a preset file.

    Returns:
        (config_dict, warnings)

    Raises:
        ConfigError: if the file can't be parsed, the catalog can't be
        resolved, or the result fails validation.
    """
    path = Path(path).expanduser()
    if not path.exists():
        raise ConfigError(f"Preset not found: {path}")

    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        # YAML errors include line numbers, which is exactly what we want
        raise ConfigError(f"YAML parse error in {path}:\n{e}") from e

    if data is None:
        raise ConfigError(f"Preset {path} is empty")

    try:
        apps = app_catalog.load_catalog(catalog_path)
        expand_app_ids(data, apps)
    except app_catalog.CatalogError as e:
        raise ConfigError(f"Preset {path}: {e}") from e

    errors: List[str] = []
    warnings: List[str] = []

    _validate(data, TOP_LEVEL_SCHEMA, "<root>", errors, warnings)

    builder = data.get("builder")
    if isinstance(builder, dict):
        _validate_prompts(builder, errors, warnings)

    if errors:
        bullet = "\n  - "
        raise ConfigError(
            f"Preset {path} failed validation:{bullet}{bullet.join(errors)}"
        )

    return data, warnings


def list_presets(presets_dir: Path) -> List[Path]:
    """List all .yaml/.yml files in the presets directory."""
    presets_dir = Path(presets_dir).expanduser()
    if not presets_dir.exists():
        return []
    return sorted(
        list(presets_dir.glob("*.yaml")) + list(presets_dir.glob("*.yml"))
    )


def write_yaml(data: Dict, path: Path) -> None:
    """Write a dict back to YAML cleanly (no Python tags, sorted keys off)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        yaml.safe_dump(
            data,
            f,
            default_flow_style=False,
            sort_keys=False,
            indent=2,
            width=100,
        )
