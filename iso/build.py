#!/usr/bin/env python3
"""
isobuilder — unified autoinstall ISO builder for Linux distros.

Usage:
    build.py ubuntu                                  # interactive, default preset
    build.py ubuntu --preset desktop                 # use presets/ubuntu-desktop.yaml
    build.py debian --config ./my-preset.yaml        # explicit preset path
    build.py ubuntu --dry-run                        # generate configs, skip ISO build
    build.py ubuntu --unattended --preset desktop    # zero-prompt build
    build.py --list-presets                          # show available presets
    build.py --list-targets                          # show supported distros
"""

import argparse
import sys
import traceback
from pathlib import Path

from builders import BUILDERS
from core import config, ui

SCRIPT_DIR = Path(__file__).resolve().parent
PRESETS_DIR = SCRIPT_DIR / "presets"


def list_presets() -> int:
    presets = config.list_presets(PRESETS_DIR)
    if not presets:
        print(f"No presets found in {PRESETS_DIR}")
        return 1
    print(f"Available presets ({PRESETS_DIR}):")
    for p in presets:
        print(f"  {p.stem}")
    return 0


def list_targets() -> int:
    print("Supported targets:")
    for name, cls in BUILDERS.items():
        print(f"  {name:<10} {cls.DISPLAY_NAME}")
    return 0


def inspect_iso(iso_path_str: str) -> int:
    """
    Print the structure and metadata of an ISO. The diagnostic tool for
    "why won't my ISO validate?" — shows what the script actually sees.
    """
    from core import iso as iso_mod

    iso_path = Path(iso_path_str).expanduser()
    if not iso_path.exists():
        ui.print_error(f"ISO not found: {iso_path}")

    ui.print_header(f"Inspecting {iso_path.name}")

    # Size
    size_mb = iso_path.stat().st_size / (1024 * 1024)
    print(f"Size: {size_mb:.0f} MB ({iso_path.stat().st_size} bytes)")

    # Distro detection
    detected = iso_mod.detect_iso_distro(iso_path)
    print(f"Detected distro: {detected}")

    # /.disk/info — the most reliable distro identifier
    disk_info = iso_mod.read_iso_text_file(iso_path, "/.disk/info")
    if disk_info:
        print(f"/.disk/info: {disk_info}")
    else:
        print("/.disk/info: (not present)")

    # Top-level contents
    print("\nTop-level contents:")
    root = iso_mod.list_iso_contents(iso_path, "/")
    if root:
        for entry in root:
            print(f"  {entry}")
    else:
        print("  (could not enumerate)")

    # Check for the directories each builder cares about
    print("\nKey directory checks:")
    checks = [
        ("/casper", "Ubuntu live-system layout"),
        ("/install.amd", "Debian installer"),
        ("/isolinux", "BIOS bootloader (legacy)"),
        ("/EFI", "UEFI bootloader"),
        ("/boot/grub", "GRUB configs"),
        ("/.disk", "Distro metadata"),
        ("/preseed", "Preseed files"),
        ("/nocloud", "cloud-init data"),
    ]
    for path, desc in checks:
        present = iso_mod.file_exists_in_iso(iso_path, path)
        marker = "[+]" if present else "[ ]"
        print(f"  {marker} {path:<20} {desc}")

    return 0


def resolve_preset(target: str, preset_name: str = None, config_path: str = None) -> Path:
    """Pick the preset file based on --preset name, --config path, or default."""
    if config_path:
        p = Path(config_path).expanduser()
        if not p.exists():
            ui.print_error(f"Config file not found: {p}")
        return p

    if preset_name:
        # Try presets/<target>-<preset>.yaml then presets/<preset>.yaml
        candidates = [
            PRESETS_DIR / f"{target}-{preset_name}.yaml",
            PRESETS_DIR / f"{preset_name}.yaml",
        ]
        for c in candidates:
            if c.exists():
                return c
        ui.print_error(
            f"Preset '{preset_name}' not found for target '{target}'. "
            f"Looked in: {', '.join(str(c) for c in candidates)}"
        )

    # Default: presets/<target>-desktop.yaml, then <target>.yaml, then autoinstall.yaml
    candidates = [
        PRESETS_DIR / f"{target}-desktop.yaml",
        PRESETS_DIR / f"{target}.yaml",
        PRESETS_DIR / "autoinstall.yaml",
        SCRIPT_DIR / "autoinstall.yaml",  # legacy location
    ]
    for c in candidates:
        if c.exists():
            return c

    ui.print_error(
        f"No preset found. Looked for: {', '.join(str(c) for c in candidates)}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Unified autoinstall ISO builder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:")[1] if "Usage:" in __doc__ else None,
    )
    parser.add_argument(
        "target",
        nargs="?",
        choices=list(BUILDERS.keys()),
        help="Distro to build for (ubuntu, debian, ...)",
    )
    parser.add_argument(
        "--preset",
        help="Preset name (e.g. 'desktop' → presets/<target>-desktop.yaml)",
    )
    parser.add_argument(
        "--config",
        help="Path to a custom preset YAML file (overrides --preset)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate install files but don't build the ISO",
    )
    parser.add_argument(
        "--unattended",
        action="store_true",
        help="Skip all prompts; use defaults",
    )
    parser.add_argument(
        "--list-presets",
        action="store_true",
        help="List available presets and exit",
    )
    parser.add_argument(
        "--list-targets",
        action="store_true",
        help="List supported distros and exit",
    )
    parser.add_argument(
        "--inspect",
        metavar="ISO_PATH",
        help="Show the structure of an ISO (diagnostic). Use when validation fails.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Show full tracebacks on error",
    )

    args = parser.parse_args()

    if args.list_targets:
        return list_targets()
    if args.list_presets:
        return list_presets()
    if args.inspect:
        return inspect_iso(args.inspect)

    if not args.target:
        parser.print_help()
        return 1

    if args.unattended:
        ui.set_unattended(True)

    preset_path = resolve_preset(args.target, args.preset, args.config)

    builder_cls = BUILDERS[args.target]
    builder = builder_cls(preset_path=preset_path, dry_run=args.dry_run)

    try:
        builder.run()
    except KeyboardInterrupt:
        print()
        ui.print_error("Aborted by user.")
    except Exception as e:
        if args.debug:
            traceback.print_exc()
        ui.print_error(str(e))

    return 0


if __name__ == "__main__":
    sys.exit(main())
