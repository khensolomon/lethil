"""
Dynamic prompt engine.

The `builder:` section of a preset can declare interactive prompts. This module
walks them and collects the user's answers into package/snap/late-command lists
that the distro-specific builder can then merge into autoinstall data.

Prompt forms supported:

    # Yes/no prompt — applies the listed actions if the user says yes
    - ask: "Install Chrome?"
      default: "yes"
      late-commands: ["wget ... && apt install ..."]

    # Per-distro yes/no — different actions on Ubuntu vs Debian
    - ask: "Install VS Code?"
      default: "yes"
      ubuntu:
        snaps: ["code|classic"]
      debian:
        late-commands: ["..."]

    # Multi-choice — pick one
    - ask: "Select desktop environment"
      default: "1"
      choices:
        - label: "GNOME"
          packages: ["gnome-core"]
        - label: "Headless"
          packages: []
"""

from typing import Dict, List

from . import ui


def _collect_actions(target: Dict, distro: str) -> Dict[str, List[str]]:
    """
    Pull packages/snaps/late-commands out of a prompt or choice dict.
    Includes both top-level fields and the distro-specific override.
    """
    out = {"packages": [], "snaps": [], "late-commands": []}

    # Top-level fields apply to all distros
    for key in out:
        out[key].extend(target.get(key, []))

    # Distro-specific override layered on top
    distro_target = target.get(distro, {})
    if isinstance(distro_target, dict):
        for key in out:
            out[key].extend(distro_target.get(key, []))

    return out


def run_prompts(builder: Dict, distro: str) -> Dict[str, List[str]]:
    """
    Execute all prompts (shared first, then distro-specific) and collect results.

    Returns a dict with three lists: packages, snaps, late-commands.
    """
    result = {"packages": [], "snaps": [], "late-commands": []}

    groups = []
    shared_prompts = (builder.get("shared") or {}).get("prompts", [])
    distro_prompts = (builder.get(distro) or {}).get("prompts", [])
    if shared_prompts:
        groups.append(("Shared options", shared_prompts))
    if distro_prompts:
        groups.append((f"{distro.capitalize()} options", distro_prompts))

    for group_name, prompts in groups:
        if not ui.UNATTENDED:
            ui.print_header(group_name)

        for p in prompts:
            ask = p.get("ask", "?")
            default = p.get("default", "yes")

            target = None
            if p.get("choices"):
                labels = [c.get("label", f"option {i+1}") for i, c in enumerate(p["choices"])]
                # Default for choices is 1-based index as string, e.g. "1"
                try:
                    default_idx = int(default)
                except (ValueError, TypeError):
                    default_idx = 1
                idx = ui.ask_choice(ask, labels, default=default_idx)
                target = p["choices"][idx]
            else:
                if ui.ask_yes_no(ask, default=default):
                    target = p

            if target is not None:
                actions = _collect_actions(target, distro)
                for key in result:
                    result[key].extend(actions[key])

    return result


def merge_static_overrides(builder: Dict, distro: str, accumulated: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """
    Merge non-prompt static overrides (packages/snaps/late-commands listed
    directly under `builder.shared.*` or `builder.<distro>.*`) into the
    accumulated result.
    """
    for section_name in ("shared", distro):
        section = builder.get(section_name) or {}
        if not isinstance(section, dict):
            continue
        for key in ("packages", "snaps", "late-commands"):
            accumulated.setdefault(key, []).extend(section.get(key, []))
    return accumulated
