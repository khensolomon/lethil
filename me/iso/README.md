# isobuilder

Unified autoinstall ISO builder for Linux distros. Build custom Ubuntu and
Debian ISOs that install themselves with no user interaction, configurable
via a single YAML preset.

## Quick start

```bash
# Install the one external dependency (xorriso provides the ISO build)
sudo apt install python3-yaml xorriso openssl

# Build an Ubuntu desktop ISO interactively
./build.py ubuntu --preset desktop

# Build a Debian ISO with no prompts (uses preset defaults)
./build.py debian --preset desktop --unattended

# See what the install files would look like, without building the ISO
./build.py ubuntu --preset desktop --dry-run

# Use a custom preset path
./build.py ubuntu --config /path/to/my-preset.yaml

# List available presets and supported distros
./build.py --list-presets
./build.py --list-targets

# Diagnose ISO compatibility issues
./build.py --inspect /path/to/source.iso
```

## Important: Ubuntu Desktop ISO vs Server ISO

**Canonical's recommended approach for autoinstall is to use the Server
ISO and install desktop packages on top.** This is documented in
[canonical/autoinstall-desktop](https://github.com/canonical/autoinstall-desktop).

| | Server ISO | Desktop ISO |
|--|------------|-------------|
| Autoinstall support | Since 20.04 | Since 23.04 |
| Tested with isobuilder | Yes | Yes, but more known issues |
| Size | ~2 GB | ~5+ GB |
| Default kernel | `generic` | `hwe` |
| Default storage | LVM | direct |
| Pre-installed | minimal | full GNOME |

If you hit problems with the Desktop ISO, **try the Server ISO with the
same preset** — it's the path Canonical themselves take. You can install
GNOME on top with `packages: [ubuntu-desktop]` in your preset.

## What this does

1. Reads a preset YAML that contains a real `autoinstall:` document plus
   `builder:` extensions (prompts, conditional packages, etc).
2. Validates the YAML against a schema — typos and wrong types are caught
   in milliseconds, not after a 60-second ISO build.
3. Auto-detects host timezone, locale, and keyboard for sensible defaults.
4. Asks the user for any overrides (or skips with `--unattended`).
5. Generates the install files (`user-data` for Ubuntu, `preseed.cfg` for
   Debian) plus a clean `post-install.sh` script for late commands.
6. Extracts the source ISO's bootloader configs using `xorriso -osirrox`
   (no `sudo`, no mounting).
7. Patches the bootloader to add an autoinstall menu entry.
8. Rebuilds the ISO with `xorriso`, overlaying our changes onto the source.
9. Verifies the output ISO actually contains the expected files.

The whole pipeline runs unprivileged. `sudo` is never required.

## Project layout

```
isobuilder/
├── build.py              # Entry point — argparse + dispatch
├── core/                 # Distro-agnostic utilities
│   ├── ui.py             # Colored output, prompts
│   ├── host.py           # Host system detection
│   ├── config.py         # YAML loading + schema validation
│   ├── iso.py            # xorriso-based ISO ops (no mount)
│   ├── prompts.py        # Dynamic prompt engine
│   └── postinstall.py    # Post-install script generation
├── builders/             # Per-distro builders
│   ├── base.py           # Abstract Builder class — shared lifecycle
│   ├── ubuntu.py         # Ubuntu (cloud-init / Subiquity)
│   └── debian.py         # Debian (preseed)
├── presets/
│   ├── ubuntu-desktop.yaml
│   └── debian-desktop.yaml
└── tests/
    └── test_config.py    # Schema validation tests
```

## Preset schema

A preset is a YAML file with two top-level keys:

### `autoinstall:` — passed to the installer

This is a real Ubuntu autoinstall (cloud-init) document. The builder forwards
it to the installer largely unchanged, with three substitutions:

- Identity (hostname, username, realname, password) replaced by user input
- Keyboard, locale, timezone replaced by user input
- Storage layout adjusted based on the disk-partitioning prompt

Anything else you put under `autoinstall:` is forwarded to cloud-init.

### `builder:` — read only by isobuilder

Per-distro packages, snaps, late-commands, and interactive prompts:

```yaml
builder:
  shared:                       # Applies to all target distros
    prompts:
      - ask: "Install Chrome?"
        default: "yes"
        late-commands: ["..."]

      - ask: "Install VS Code?"
        ubuntu:                 # Distro-specific actions
          snaps: ["code|classic"]
        debian:
          late-commands: ["..."]

  ubuntu:                       # Only when target is ubuntu
    packages: [...]
    late-commands: [...]
    prompts:
      - ask: "Pick a desktop environment"
        default: "1"
        choices:
          - label: "GNOME"
            packages: ["gnome-core"]
          - label: "Headless"
            packages: []

  debian:
    ...
```

The schema is enforced at load time. Common errors and their messages:

| Mistake | Error |
|---|---|
| `packages: "curl"` (string instead of list) | `expected list[str], got str` |
| Prompt without `ask:` | `missing required key 'ask'` |
| Wrong type for `default:` | `expected str, got bool` |
| Top-level typo (e.g. `aotuinstall:`) | `missing required key 'autoinstall'` |

Unknown keys *inside* `autoinstall:` are silently passed through to cloud-init,
since cloud-init has many fields we don't track. If you see your install
ignoring a setting, check spelling — `autoinstall:` is not validated by us.

## Disk layouts

| Layout | Ubuntu | Debian |
|---|---|---|
| Standard (direct wipe) | ✅ | ✅ |
| LVM | ✅ | ✅ |
| Encrypted LVM (LUKS) | ❌ | ✅ |

## Late commands and post-install

Late commands listed in the preset get compiled into a `post-install.sh` shell
script that's placed on the ISO. The preseed/user-data only runs that script.

This means:

- You can read the script with `cat` to see exactly what will run
- Quote escaping is handled correctly (no more backslash soup)
- Each command's success/failure is logged to `/var/log/isobuilder-postinstall.log`
- Failures are reported but don't abort — a single broken package won't strand
  the install

## Adding new distros

1. Create `builders/<distro>.py` with a class extending `Builder`.
2. Implement the abstract methods (`validate_iso`, `generate_install_files`,
   `bootloader_files`, `patch_bootloader`, `iso_file_mappings`,
   `expected_files_in_output`).
3. Add the class to `BUILDERS` in `builders/__init__.py`.
4. Add presets to `presets/<distro>-*.yaml`.
5. Add the distro to the schema in `core/config.py` (the `BUILDER_SCHEMA`
   and per-distro override keys).

Each builder is roughly 200 lines of distro-specific glue.

## Testing

```bash
python3 -m unittest discover tests/ -v
```

The test suite validates the YAML schema, the post-install script generator,
and the prompt-merging logic. Tests don't require a real ISO.

## Differences from the legacy scripts

- Single `build.py` instead of separate `ubuntu.py` and `debian.py`
- PyYAML replaces a custom 150-line parser
- Schema validation catches typos in milliseconds
- No `sudo` required; no mounting of ISOs
- Late commands live in a separate, debuggable shell script
- Preset format: `builder:` instead of `x-os-overrides:`

## License

Same terms as the original scripts.