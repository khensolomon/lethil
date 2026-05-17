"""
Base class for distro-specific builders.

Each subclass implements the parts that differ between distros:
  - validate_iso(): does this ISO match the expected distro?
  - generate_install_files(): write preseed/user-data/kickstart/etc
  - bootloader_files(): which bootloader configs to extract and patch
  - inject_autoinstall_entry(): add the autoinstall entry to bootloader

Everything else (workspace setup, host detection, prompt handling, ISO
extraction and rebuild) lives here.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from core import config, host, iso, prompts, ui


@dataclass
class UserInputs:
    """Settings collected from the user (or read from preset defaults)."""

    hostname: str = ""
    username: str = ""
    realname: str = ""
    password_hash: Optional[str] = None
    timezone: str = ""
    locale: str = ""
    keyboard_layout: str = ""
    keyboard_variant: str = ""
    keyboard_toggle: str = ""
    disk_layout: int = 0  # 0 = standard, 1 = LVM, 2 = LUKS
    crypto_passphrase: str = ""
    extra: Dict = field(default_factory=dict)


class Builder(ABC):
    """Abstract base for distro builders."""

    DISTRO_ID = ""  # 'ubuntu', 'debian', 'fedora', 'arch'
    DISPLAY_NAME = ""
    DEPENDENCIES = ["xorriso"]
    DEFAULT_WORKSPACE = "~/iso-autoinstall"

    def __init__(self, preset_path: Path, dry_run: bool = False):
        self.preset_path = Path(preset_path)
        self.dry_run = dry_run
        self.preset: Dict = {}
        self.builder_section: Dict = {}
        self.autoinstall: Dict = {}
        self.user_inputs = UserInputs()
        self.work_dir: Path = Path()
        self.iso_path: Optional[Path] = None
        self.collected_actions: Dict[str, List] = {
            "packages": [], "snaps": [], "late-commands": []
        }

    # ----- Hooks subclasses must implement ------------------------------

    @abstractmethod
    def validate_iso(self, iso_path: Path) -> None:
        """Raise an error if iso_path isn't a valid ISO for this distro."""

    @abstractmethod
    def generate_install_files(self, out_dir: Path) -> List[Path]:
        """
        Write preseed/user-data/kickstart/etc to out_dir.
        Returns the list of files that need to end up on the output ISO.
        """

    @abstractmethod
    def bootloader_files(self) -> List[Tuple[str, str]]:
        """
        List of (path-inside-iso, path-relative-to-extract-dir) tuples
        for bootloader configs that need to be extracted and patched.
        """

    @abstractmethod
    def patch_bootloader(self, extracted: List[Path]) -> List[Path]:
        """Add the autoinstall entry. Returns list of patched files."""

    @abstractmethod
    def iso_file_mappings(
        self, install_files: List[Path], patched_bootloaders: List[Path]
    ) -> List[Tuple[Path, str]]:
        """
        Build the (host-path, iso-path) mappings for `xorriso -map`.
        """

    @abstractmethod
    def expected_files_in_output(self) -> List[str]:
        """
        Files we expect to see in the output ISO after rebuild.
        Used by verify_output_iso.
        """

    # ----- Shared lifecycle ---------------------------------------------

    def run(self) -> None:
        """Execute the full build pipeline."""
        ui.print_header(f"{self.DISPLAY_NAME} ISO Builder")

        if not self.dry_run:
            iso.check_dependencies(self.DEPENDENCIES)

        self._load_preset()
        self._setup_workspace()
        if not self.dry_run:
            self._select_iso()
        self._gather_user_inputs()
        self._run_prompts()
        install_files = self._generate_files()

        if self.dry_run:
            self._dry_run_exit(install_files)
            return

        self._build_iso(install_files)
        self._verify_and_announce()

    def _load_preset(self) -> None:
        ui.print_step("Loading preset")
        try:
            data, warnings = config.load_preset(self.preset_path)
        except config.ConfigError as e:
            ui.print_error(str(e))
            return  # unreachable, print_error calls sys.exit
        for w in warnings:
            ui.print_warning(w)

        self.preset = data
        self.autoinstall = data.get("autoinstall", {})
        self.builder_section = data.get("builder", {})
        ui.print_success(f"Preset loaded: {self.preset_path}")

    def _setup_workspace(self) -> None:
        ui.print_step("Workspace")
        self.work_dir = iso.setup_workspace(self.DEFAULT_WORKSPACE)

    def _select_iso(self) -> None:
        ui.print_step("Source ISO")
        path = iso.ask_iso_path(os_hint=self.DISTRO_ID)
        if not path.exists():
            ui.print_error(f"ISO not found: {path}")
        ui.print_info(f"Detecting ISO type...")
        detected = iso.detect_iso_distro(path)
        if detected != self.DISTRO_ID and detected != "unknown":
            ui.print_error(
                f"This appears to be a {detected} ISO, but you're running "
                f"the {self.DISPLAY_NAME} builder. Did you select the wrong ISO?"
            )
        self.validate_iso(path)
        self.iso_path = path
        ui.print_success(f"ISO validated: {path}")

    def _gather_user_inputs(self) -> None:
        ui.print_step("System configuration")
        ai = self.autoinstall
        identity = ai.get("identity", {}) or {}
        keyboard = ai.get("keyboard", {}) or {}

        host_tz = host.get_host_timezone()
        host_locale = host.get_host_locale()
        host_kb = host.get_host_keyboard()

        u = self.user_inputs
        u.hostname = ui.ask_input("Hostname", identity.get("hostname", f"{self.DISTRO_ID}-mini"))
        u.timezone = ui.ask_input(f"Timezone (host: {host_tz})", ai.get("timezone", host_tz))
        u.locale = ui.ask_input(
            f"Locale (host: {host_locale or 'unset'})",
            ai.get("locale", host_locale or "en_US.UTF-8"),
        )
        u.keyboard_layout = ui.ask_input(
            f"Keyboard layout (host: {host_kb['layout'] or 'unset'})",
            keyboard.get("layout", host_kb["layout"] or "us"),
        )
        u.keyboard_variant = ui.ask_input(
            f"Keyboard variant (host: {host_kb['variant'] or 'unset'})",
            keyboard.get("variant", host_kb["variant"]),
        )
        u.keyboard_toggle = ui.ask_input(
            f"Keyboard toggle (host: {host_kb['toggle'] or 'unset'})",
            keyboard.get("toggle", host_kb["toggle"]),
        )
        u.username = ui.ask_input("Username", identity.get("username", "user"))
        u.realname = ui.ask_input("Real name", identity.get("realname", "User"))

        plain = ui.ask_password("Password (blank to keep preset hash)")
        if plain:
            u.password_hash = self._hash_password(plain)

        self._ask_disk_layout()

    def _ask_disk_layout(self) -> None:
        """Override to add distro-specific disk layout prompts."""
        pass

    def _run_prompts(self) -> None:
        ui.print_step("Optional features")
        self.collected_actions = prompts.run_prompts(self.builder_section, self.DISTRO_ID)
        prompts.merge_static_overrides(
            self.builder_section, self.DISTRO_ID, self.collected_actions
        )

    def _generate_files(self) -> List[Path]:
        ui.print_step("Generating install files")
        out_dir = self.work_dir / "extract"
        out_dir.mkdir(parents=True, exist_ok=True)
        return self.generate_install_files(out_dir)

    def _build_iso(self, install_files: List[Path]) -> None:
        ui.print_step("Extracting bootloader configs")
        extract_dir = self.work_dir / "extract"
        extracted = iso.extract_files(self.iso_path, self.bootloader_files(), extract_dir)
        ui.print_success(f"Extracted {len(extracted)} bootloader file(s)")

        ui.print_step("Patching bootloader")
        patched = self.patch_bootloader(extracted)

        ui.print_step("Rebuilding ISO")
        out_name = self.iso_path.stem + "-autoinstall.iso"
        out_iso = self.work_dir / out_name

        mappings = self.iso_file_mappings(install_files, patched)
        iso.rebuild_iso(self.iso_path, out_iso, mappings)
        self._output_iso = out_iso

    def _verify_and_announce(self) -> None:
        ui.print_step("Verifying output")
        missing = iso.verify_output_iso(self._output_iso, self.expected_files_in_output())
        if missing:
            ui.print_warning(
                "Output ISO is missing expected files: " + ", ".join(missing)
            )
        else:
            ui.print_success("All expected files present in output ISO.")

        ui.print_header("Done")
        size_mb = self._output_iso.stat().st_size / (1024 * 1024)
        ui.print_success(f"Output: {self._output_iso} ({size_mb:.0f} MB)")

    def _dry_run_exit(self, files: List[Path]) -> None:
        ui.print_header("Dry-run output")
        for f in files:
            print(f"\n--- {f} ---")
            print(f.read_text())
        ui.print_success("Dry-run complete. Files written to workspace.")

    def _hash_password(self, plain: str) -> str:
        import subprocess
        result = subprocess.run(
            ["openssl", "passwd", "-6", plain],
            check=True, capture_output=True, text=True,
        )
        return result.stdout.strip()
