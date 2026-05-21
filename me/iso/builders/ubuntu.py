"""
Ubuntu autoinstall ISO builder.

Builds a custom ISO that uses cloud-init / Subiquity autoinstall to do an
unattended install. The autoinstall data goes in /nocloud/user-data and
/nocloud/meta-data, and we patch grub.cfg to add an autoinstall menuentry.
"""

from pathlib import Path
from typing import Dict, List, Tuple

import yaml

from core import config, iso, postinstall, ui
from .base import Builder


GRUB_AUTOINSTALL_ENTRY = """menuentry "Ubuntu Autoinstall (Wipes Disk)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud\\;s=/cdrom/nocloud/ ---
    initrd  /casper/initrd
}
menuentry "Ubuntu Autoinstall - DEBUG MODE (verbose)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud\\;s=/cdrom/nocloud/ debug --- console=tty0 console=ttyS0,115200n8
    initrd  /casper/initrd
}
"""


class UbuntuBuilder(Builder):
    DISTRO_ID = "ubuntu"
    DISPLAY_NAME = "Ubuntu"
    DEPENDENCIES = ["xorriso", "openssl"]
    DEFAULT_WORKSPACE = "~/ubuntu-autoinstall"

    def validate_iso(self, iso_path: Path) -> None:
        """
        Verify this is a usable Ubuntu ISO. We accept any ISO that has either:
          - /casper (the traditional Ubuntu live-system layout, still used in 24.04 LTS)
          - /.disk/info containing "Ubuntu" (works regardless of layout changes)

        If neither is present, show what *is* in the ISO root so the user can
        diagnose. Layouts evolve (26.04 may differ from 22.04), and a hard
        "missing /casper" error is unhelpful when the ISO is in fact Ubuntu.
        """
        has_casper = iso.file_exists_in_iso(iso_path, "/casper")
        disk_info = iso.read_iso_text_file(iso_path, "/.disk/info")
        is_ubuntu_by_info = "ubuntu" in disk_info.lower() if disk_info else False

        if has_casper or is_ubuntu_by_info:
            if disk_info:
                ui.print_info(f"Detected: {disk_info}")
            return

        # Validation failed — be helpful, not just refuse.
        contents = iso.list_iso_contents(iso_path, "/")
        preview = ", ".join(contents[:15]) if contents else "(could not list)"
        ui.print_error(
            f"{iso_path} doesn't appear to be an Ubuntu ISO.\n"
            f"  Looked for /casper directory: {'found' if has_casper else 'not found'}\n"
            f"  Looked for /.disk/info: {disk_info or 'not found'}\n"
            f"  ISO root contents: {preview}\n"
            f"  Run `build.py inspect <iso>` for full directory listing."
        )

    def _ask_disk_layout(self) -> None:
        if not ui.UNATTENDED:
            print()
        u = self.user_inputs
        u.disk_layout = ui.ask_choice(
            "Disk partitioning",
            ["Standard (direct wipe)", "LVM"],
            default=1,
        )

    def bootloader_files(self) -> List[Tuple[str, str]]:
        return [
            ("/boot/grub/grub.cfg", "boot/grub/grub.cfg"),
        ]

    def generate_install_files(self, out_dir: Path) -> List[Path]:
        nocloud = out_dir / "nocloud"
        nocloud.mkdir(parents=True, exist_ok=True)

        # Build the user-data dict from preset + user inputs + collected actions.
        ai = dict(self.autoinstall)
        u = self.user_inputs

        # Identity
        identity = ai.get("identity", {}) or {}
        identity["hostname"] = u.hostname
        identity["username"] = u.username
        identity["realname"] = u.realname
        if u.password_hash:
            identity["password"] = u.password_hash
        ai["identity"] = identity

        # Keyboard
        ai["keyboard"] = {
            "layout": u.keyboard_layout,
            "variant": u.keyboard_variant,
            "toggle": u.keyboard_toggle,
        }

        # Locale & timezone
        ai["locale"] = u.locale
        ai["timezone"] = u.timezone

        # APT mirror reliability hardening. Without these, Subiquity does a
        # geoip lookup to pick a country mirror — which can stall if the
        # geoip endpoint is slow, or if the chosen country mirror is down.
        # We override that to use the global mirror with explicit fallback
        # behavior so a slow mirror doesn't hang the install indefinitely.
        if "apt" not in ai:
            ai["apt"] = {}
        ai["apt"].setdefault("geoip", False)
        ai["apt"].setdefault("fallback", "offline-install")
        # Don't replace primary if the preset already specified one
        if "primary" not in ai["apt"] and "mirror-selection" not in ai["apt"]:
            ai["apt"]["primary"] = [
                {"arches": ["default"], "uri": "http://archive.ubuntu.com/ubuntu"}
            ]

        # Storage layout (preset value or user choice)
        if u.disk_layout == 1:
            ai["storage"] = {"layout": {"name": "lvm"}}
        else:
            ai.setdefault("storage", {"layout": {"name": "direct"}})

        # Error commands: when Subiquity hits a fatal error, normally it just
        # prints a traceback to console and waits forever. These commands run
        # AT FAILURE so you have something to inspect. Output goes to a tty so
        # it's visible without scrolling, plus a file you can grab over SSH
        # if you've added the SSH key to authorized_keys via the autoinstall.
        ai.setdefault("error-commands", [
            "tail -n 200 /var/log/installer/subiquity-server-debug.log > /dev/tty1 || true",
            "tail -n 200 /var/log/installer/curtin-install.log > /dev/tty1 || true",
        ])

        # Make autoinstall fully non-interactive. Without this, Subiquity may
        # stop and ask interactively for any section we didn't fully specify
        # (network, ssh, etc). Empty list == "don't be interactive about anything".
        ai.setdefault("interactive-sections", [])

        # Add a network section if missing — Subiquity halts on missing network
        # when interactive-sections is empty unless we provide one. The default
        # "use whatever DHCP gives you" config is fine for most systems.
        if "network" not in ai:
            ai["network"] = {
                "version": 2,
                "ethernets": {
                    "any": {
                        "match": {"name": "en*"},
                        "dhcp4": True,
                        "dhcp6": False,
                        "optional": True,
                    }
                },
            }

        # Merge in collected packages and snaps
        existing_packages = ai.get("packages", []) or []
        merged_packages = existing_packages + self.collected_actions.get("packages", [])
        ai["packages"] = sorted(set(merged_packages))

        existing_snaps = ai.get("snaps", []) or []
        merged_snaps = list(existing_snaps)
        for s in self.collected_actions.get("snaps", []):
            # snaps come as "name|classic" strings from prompts
            if isinstance(s, str) and "|classic" in s:
                merged_snaps.append({"name": s.split("|", 1)[0], "classic": True})
            elif isinstance(s, str):
                merged_snaps.append({"name": s})
            else:
                merged_snaps.append(s)
        if merged_snaps:
            ai["snaps"] = merged_snaps

        # Late-commands: write a separate post-install script and reference it.
        # This avoids the fragile backslash-quoting that bit us before.
        late_cmds = self.collected_actions.get("late-commands", [])
        existing_late = ai.get("late-commands", []) or []
        all_late = existing_late + late_cmds

        if all_late or merged_snaps:
            script_path = nocloud / "post-install.sh"
            postinstall.write_postinstall_script(
                script_path,
                commands=all_late,
                snaps=merged_snaps if merged_snaps else None,
            )
            # Replace late-commands with entries that:
            #   1. Copy the post-install script from CD into /target/tmp (always
            #      writable; /target/root may not have the right permissions yet)
            #   2. Run it inside the chroot with curtin's in-target wrapper
            #   3. Capture output to a log on the new system for debugging
            ai["late-commands"] = [
                "cp /cdrom/nocloud/post-install.sh /target/tmp/post-install.sh",
                "curtin in-target --target=/target -- bash /tmp/post-install.sh",
                "rm -f /target/tmp/post-install.sh",
            ]
            # Snaps go through the postinstall script now, not the autoinstall key.
            # (Keeping them in both places would cause double-install.)
            ai.pop("snaps", None)

        # Write the user-data file. cloud-init requires the magic header line.
        user_data_path = nocloud / "user-data"
        with open(user_data_path, "w") as f:
            f.write("#cloud-config\n")
            yaml.safe_dump(
                {"autoinstall": ai},
                f,
                default_flow_style=False,
                sort_keys=False,
                indent=2,
            )

        # meta-data file (instance ID, hostname)
        meta_data_path = nocloud / "meta-data"
        with open(meta_data_path, "w") as f:
            f.write(f"instance-id: {u.hostname}-autoinstall\n")
            f.write(f"local-hostname: {u.hostname}\n")

        return [user_data_path, meta_data_path]

    def patch_bootloader(self, extracted: List[Path]) -> List[Path]:
        patched = []
        for f in extracted:
            if f.name == "grub.cfg":
                self._patch_grub(f)
                patched.append(f)
        return patched

    def _patch_grub(self, grub_cfg: Path) -> None:
        content = grub_cfg.read_text()
        if "Ubuntu Autoinstall" in content:
            ui.print_info("grub.cfg already has autoinstall entry, skipping injection")
            return
        # Inject our entry before the first existing menuentry
        content = content.replace("menuentry ", GRUB_AUTOINSTALL_ENTRY + "menuentry ", 1)
        grub_cfg.write_text(content)
        ui.print_success("Injected autoinstall entry into grub.cfg")

    def iso_file_mappings(
        self, install_files: List[Path], patched_bootloaders: List[Path]
    ) -> List[Tuple[Path, str]]:
        mappings = []
        nocloud_dir = install_files[0].parent  # all install files share a parent
        mappings.append((nocloud_dir, "/nocloud"))
        for b in patched_bootloaders:
            if b.name == "grub.cfg":
                mappings.append((b, "/boot/grub/grub.cfg"))
        return mappings

    def expected_files_in_output(self) -> List[str]:
        return [
            "/nocloud/user-data",
            "/nocloud/meta-data",
            "/boot/grub/grub.cfg",
        ]