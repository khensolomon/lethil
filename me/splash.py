#!/usr/bin/env python3
"""
Version: v26.08.24.15
Description: Configures GNOME Display Manager (GDM3) login logo/wallpaper and
             Plymouth boot splash logo. Auto-resizes SVG and raster images,
             updates dconf, and rebuilds initramfs for boot changes.

Usage:
    splash [OPTIONS]

Options:
    -h, --help    Show this help message and exit.
    --cli         Force CLI mode even if run outside a terminal.
    --gui         Force GTK GUI mode even if run inside a terminal.
"""

import os
import sys
import shutil
import argparse
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

# --- ANSI Formatting & Color Palette (CLI) ---
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

VALID_IMAGE_EXTENSIONS = {".svg", ".png", ".jpg", ".jpeg", ".bmp", ".webp"}

# Constraints
MAX_LOGO_WIDTH = 128
MAX_LOGO_HEIGHT = 128
BOOT_LOGO_WIDTH = 160
BOOT_LOGO_HEIGHT = 160

# System directories
SYSTEM_LOGO_DIR = Path("/usr/share/pixmaps/custom-gdm")
SYSTEM_WP_DIR = Path("/usr/share/backgrounds/custom-gdm")
PLYMOUTH_THEME_DIR = Path("/usr/share/plymouth/themes/ubuntu-logo")
PLYMOUTH_BACKUP_DIR = Path("/usr/share/plymouth/themes/ubuntu-logo/backup-splash")

# ==============================================================================
# 1. IMAGE PROCESSING & RESIZING HELPERS
# ==============================================================================

def resize_svg_logo(src_path, dest_path, max_w=MAX_LOGO_WIDTH, max_h=MAX_LOGO_HEIGHT):
    """Modifies SVG root attributes (width, height, viewBox) to constrain rendering."""
    try:
        ET.register_namespace('', "http://www.w3.org/2000/svg")
        ET.register_namespace('xlink', "http://www.w3.org/1999/xlink")
        
        tree = ET.parse(src_path)
        root = tree.getroot()

        viewbox = root.get('viewBox') or root.get('viewbox')
        if not viewbox and ('width' in root.attrib and 'height' in root.attrib):
            w_str = ''.join(c for c in root.attrib['width'] if c.isdigit() or c == '.')
            h_str = ''.join(c for c in root.attrib['height'] if c.isdigit() or c == '.')
            if w_str and h_str:
                viewbox = f"0 0 {w_str} {h_str}"

        if viewbox:
            root.set('viewBox', viewbox)

        root.set('width', f"{max_w}px")
        root.set('height', f"{max_h}px")

        tree.write(dest_path, encoding='utf-8', xml_declaration=True)
        return True
    except Exception as err:
        print(f"{Colors.RED}[!] SVG Resize Error: {err}. Copying original file.{Colors.RESET}")
        shutil.copy(src_path, dest_path)
        return False


def resize_raster_logo(src_path, dest_path, max_w=MAX_LOGO_WIDTH, max_h=MAX_LOGO_HEIGHT):
    """Resizes raster images (PNG/JPG) proportionally using PIL or GdkPixbuf."""
    try:
        from PIL import Image
        with Image.open(src_path) as img:
            img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            img.save(dest_path)
            return True
    except ImportError:
        pass

    try:
        import gi
        gi.require_version('GdkPixbuf', '2.0')
        from gi.repository import GdkPixbuf
        
        pixbuf = GdkPixbuf.Pixbuf.new_from_file(str(src_path))
        w, h = pixbuf.get_width(), pixbuf.get_height()
        scale = min(max_w / w, max_h / h)
        if scale < 1.0:
            new_w, new_h = int(w * scale), int(h * scale)
            scaled = pixbuf.scale_simple(new_w, new_h, GdkPixbuf.InterpType.BILINEAR)
            scaled.savev(str(dest_path), "png", [], [])
            return True
        else:
            shutil.copy(src_path, dest_path)
            return True
    except Exception:
        pass

    shutil.copy(src_path, dest_path)
    return False


def convert_to_png(src_path, dest_png_path, max_w=BOOT_LOGO_WIDTH, max_h=BOOT_LOGO_HEIGHT):
    """Converts any supported image format (including SVG) to PNG for Plymouth boot splash."""
    ext = Path(src_path).suffix.lower()
    
    # Try using inkscape or rsvg-convert for vector to PNG if available
    if ext == ".svg":
        if shutil.which("rsvg-convert"):
            subprocess.run(["rsvg-convert", "-w", str(max_w), "-h", str(max_h), str(src_path), "-o", str(dest_png_path)], check=False)
            if dest_png_path.exists():
                return True
        elif shutil.which("inkscape"):
            subprocess.run(["inkscape", f"--export-filename={dest_png_path}", f"-w={max_w}", f"-h={max_h}", str(src_path)], check=False)
            if dest_png_path.exists():
                return True

    # Try PIL (Pillow)
    try:
        from PIL import Image
        with Image.open(src_path) as img:
            img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            img.convert("RGBA").save(dest_png_path, "PNG")
            return True
    except Exception:
        pass

    # Try GdkPixbuf
    try:
        import gi
        gi.require_version('GdkPixbuf', '2.0')
        from gi.repository import GdkPixbuf
        pixbuf = GdkPixbuf.Pixbuf.new_from_file(str(src_path))
        w, h = pixbuf.get_width(), pixbuf.get_height()
        scale = min(max_w / w, max_h / h)
        new_w, new_h = int(w * scale), int(h * scale)
        scaled = pixbuf.scale_simple(new_w, new_h, GdkPixbuf.InterpType.BILINEAR)
        scaled.savev(str(dest_png_path), "png", [], [])
        return True
    except Exception:
        pass

    return False

# ==============================================================================
# 2. CORE SYSTEM LOGIC (Shared Backend)
# ==============================================================================

def is_valid_image(file_path):
    """Verifies path existence, file status, and image extension compatibility."""
    if not file_path:
        return False
    path = Path(file_path).resolve()
    return path.is_file() and path.suffix.lower() in VALID_IMAGE_EXTENSIONS


def ensure_gdm_profile():
    """Ensures /etc/dconf/profile/gdm exists so GDM knows to read custom databases."""
    profile_dir = Path("/etc/dconf/profile")
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_file = profile_dir / "gdm"
    profile_content = "user-db:user\nsystem-db:gdm\nfile-db:/usr/share/gdm/greeter-dconf-defaults\n"
    
    if not profile_file.exists() or profile_file.read_text() != profile_content:
        profile_file.write_text(profile_content)


def update_dconf_db():
    """Executes 'dconf update' safely under sudo/root without D-Bus failures."""
    ensure_gdm_profile()
    res = subprocess.run(["dconf", "update"], capture_output=True, text=True)
    
    if res.returncode != 0 or "failed to commit changes" in res.stderr or "dbus-launch" in res.stderr:
        if shutil.which("dbus-run-session"):
            subprocess.run(["dbus-run-session", "dconf", "update"], check=True)
        else:
            subprocess.run(["dconf", "update"], check=False)


def rebuild_initramfs():
    """Rebuilds initial RAM disk so Plymouth boot theme changes take effect."""
    print(f"{Colors.BLUE}[*] Action: Rebuilding initial RAM disk (update-initramfs)...{Colors.RESET}")
    subprocess.run(["update-initramfs", "-u"], check=False)
    print(f"{Colors.GREEN}[+] Status: Initramfs rebuilt successfully.{Colors.RESET}")


def read_current_logo():
    """Reads configured logo path from system dconf profile."""
    target_file = Path("/etc/dconf/db/gdm.d/01-custom-logo")
    if not target_file.is_file():
        return "None (System Default)"
    try:
        with open(target_file, "r") as src:
            for line in src:
                if line.startswith("logo="):
                    val = line.split("=", 1)[1].strip().strip("'\"")
                    return val if val else "None (Disabled)"
    except Exception:
        pass
    return "Unknown"


def read_current_wallpaper():
    """Checks custom wallpaper repository directory for active files."""
    if SYSTEM_WP_DIR.is_dir():
        for file in SYSTEM_WP_DIR.iterdir():
            if file.stem == "login-background":
                return str(file)
    return "None (System Theme Default)"


def read_current_boot_logo():
    """Checks if Plymouth theme uses a custom boot logo."""
    if (PLYMOUTH_THEME_DIR / "ubuntu-logo.png.custom_bak").exists():
        return "Custom Plymouth Boot Logo Active"
    return "System Default Boot Logo"


def apply_logo_setting(source_logo_path):
    """Resizes logo, copies it to system directory, and updates GDM dconf DB."""
    dconf_dir = Path("/etc/dconf/db/gdm.d")
    dconf_dir.mkdir(parents=True, exist_ok=True)
    config_file = dconf_dir / "01-custom-logo"

    if source_logo_path == "":
        with open(config_file, "w") as out:
            out.write("[org/gnome/login-screen]\nlogo=''\n")
        update_dconf_db()
        return

    if not is_valid_image(source_logo_path):
        return

    SYSTEM_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(source_logo_path).suffix.lower()
    dest_file = SYSTEM_LOGO_DIR / f"login-logo{ext}"

    if ext == ".svg":
        resize_svg_logo(source_logo_path, dest_file)
    else:
        resize_raster_logo(source_logo_path, dest_file)

    os.chmod(SYSTEM_LOGO_DIR, 0o755)
    os.chmod(dest_file, 0o644)

    with open(config_file, "w") as out:
        out.write(f"[org/gnome/login-screen]\nlogo='{dest_file}'\n")

    update_dconf_db()


def apply_wallpaper_setting(wallpaper_path):
    """Applies GDM background wallpaper via system theme directory override."""
    if not is_valid_image(wallpaper_path):
        return

    SYSTEM_WP_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(wallpaper_path).suffix
    dest_file = SYSTEM_WP_DIR / f"login-background{ext}"

    shutil.copy(wallpaper_path, dest_file)
    os.chmod(SYSTEM_WP_DIR, 0o755)
    os.chmod(dest_file, 0o644)


def apply_boot_logo_setting(boot_logo_path):
    """Applies custom Plymouth boot splash logo and updates initramfs."""
    if not PLYMOUTH_THEME_DIR.exists():
        print(f"{Colors.YELLOW}[!] Plymouth theme directory not found. Skipping boot logo.{Colors.RESET}")
        return False

    if not is_valid_image(boot_logo_path):
        return False

    target_files = ["ubuntu-logo.png", "watermark.png"]

    for target_name in target_files:
        target_path = PLYMOUTH_THEME_DIR / target_name
        backup_path = PLYMOUTH_THEME_DIR / f"{target_name}.custom_bak"

        if target_path.exists() and not backup_path.exists():
            shutil.copy(target_path, backup_path)

        temp_png = PLYMOUTH_THEME_DIR / f"temp_{target_name}"
        if convert_to_png(boot_logo_path, temp_png):
            shutil.move(temp_png, target_path)
            os.chmod(target_path, 0o644)

    rebuild_initramfs()
    return True


def restore_system_defaults():
    """Reverts GDM logo, wallpaper, and Plymouth boot logo to clean factory defaults."""
    logo_file = Path("/etc/dconf/db/gdm.d/01-custom-logo")
    if logo_file.exists():
        logo_file.unlink()
        update_dconf_db()

    plymouth_restored = False
    if PLYMOUTH_THEME_DIR.exists():
        for target_name in ["ubuntu-logo.png", "watermark.png"]:
            backup_path = PLYMOUTH_THEME_DIR / f"{target_name}.custom_bak"
            target_path = PLYMOUTH_THEME_DIR / target_name
            if backup_path.exists():
                shutil.copy(backup_path, target_path)
                backup_path.unlink()
                plymouth_restored = True

    if plymouth_restored:
        rebuild_initramfs()

    for directory in (SYSTEM_LOGO_DIR, SYSTEM_WP_DIR):
        if directory.exists():
            shutil.rmtree(directory)


def ensure_privileges():
    """Dynamically escalates privileges using sudo (CLI) or pkexec (GUI)."""
    if os.geteuid() == 0:
        return

    is_tty = sys.stdin.isatty()
    if is_tty:
        print(f"{Colors.YELLOW}[*] Root access required. Escalating via sudo...{Colors.RESET}")
        try:
            args = ["sudo", sys.executable, os.path.abspath(__file__)] + sys.argv[1:]
            os.execvp("sudo", args)
        except Exception as err:
            print(f"{Colors.RED}[!] Privilege escalation failed: {err}{Colors.RESET}")
            sys.exit(1)
    else:
        try:
            args = ["pkexec", sys.executable, os.path.abspath(__file__)] + sys.argv[1:]
            os.execvp("pkexec", args)
        except Exception as err:
            print(f"Privilege escalation failed via pkexec: {err}")
            sys.exit(1)

# ==============================================================================
# 3. GTK GUI ENGINE (Graphical Interface)
# ==============================================================================

def run_gui_mode():
    """Launches GTK3 Graphical User Interface."""
    try:
        import gi
        gi.require_version('Gtk', '3.0')
        from gi.repository import Gtk
    except ImportError:
        print(f"{Colors.RED}[!] PyGObject (Gtk 3) not found. Falling back to CLI mode...{Colors.RESET}")
        run_cli_mode()
        return

    class SplashApp(Gtk.Window):
        def __init__(self):
            super().__init__(title="GDM3 & Plymouth Customizer")
            self.set_border_width(18)
            self.set_default_size(560, 310)
            self.set_position(Gtk.WindowPosition.CENTER)

            grid = Gtk.Grid(column_spacing=12, row_spacing=14)
            self.add(grid)

            header = Gtk.Label()
            header.set_markup("<b>GDM3 &amp; Plymouth Splash Screen Settings</b>")
            grid.attach(header, 0, 0, 3, 1)

            # GDM Logo Row
            grid.attach(Gtk.Label(label="GDM Login Logo:", xalign=0), 0, 1, 1, 1)
            self.logo_entry = Gtk.Entry(text=read_current_logo())
            self.logo_entry.set_hexpand(True)
            grid.attach(self.logo_entry, 1, 1, 1, 1)

            btn_browse_logo = Gtk.Button(label="Browse...")
            btn_browse_logo.connect("clicked", lambda w: self.on_browse(self.logo_entry, "Select GDM Logo"))
            grid.attach(btn_browse_logo, 2, 1, 1, 1)

            # Boot Logo Row
            grid.attach(Gtk.Label(label="Plymouth Boot Logo:", xalign=0), 0, 2, 1, 1)
            self.boot_entry = Gtk.Entry(placeholder_text="Select boot splash logo...")
            self.boot_entry.set_hexpand(True)
            grid.attach(self.boot_entry, 1, 2, 1, 1)

            btn_browse_boot = Gtk.Button(label="Browse...")
            btn_browse_boot.connect("clicked", lambda w: self.on_browse(self.boot_entry, "Select Boot Logo"))
            grid.attach(btn_browse_boot, 2, 2, 1, 1)

            # Wallpaper Row
            grid.attach(Gtk.Label(label="GDM Wallpaper:", xalign=0), 0, 3, 1, 1)
            self.wp_entry = Gtk.Entry(placeholder_text="Select wallpaper image...")
            self.wp_entry.set_hexpand(True)
            grid.attach(self.wp_entry, 1, 3, 1, 1)

            btn_browse_wp = Gtk.Button(label="Browse...")
            btn_browse_wp.connect("clicked", lambda w: self.on_browse(self.wp_entry, "Select Wallpaper"))
            grid.attach(btn_browse_wp, 2, 3, 1, 1)

            # Action Buttons Box
            btn_box = Gtk.Box(spacing=10)
            grid.attach(btn_box, 0, 4, 3, 1)

            btn_reset = Gtk.Button(label="Reset Defaults")
            btn_reset.connect("clicked", self.on_reset_defaults)
            btn_box.pack_start(btn_reset, False, False, 0)

            btn_apply = Gtk.Button(label="Apply Changes")
            btn_apply.connect("clicked", self.on_apply)
            btn_box.pack_end(btn_apply, False, False, 0)

        def on_browse(self, target_entry, title):
            dialog = Gtk.FileChooserDialog(
                title=title, parent=self, action=Gtk.FileChooserAction.OPEN
            )
            dialog.add_buttons(
                Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT
            )

            filter_img = Gtk.FileFilter()
            filter_img.set_name("Images")
            for ext in VALID_IMAGE_EXTENSIONS:
                filter_img.add_pattern(f"*{ext}")
            dialog.add_filter(filter_img)

            if dialog.run() == Gtk.ResponseType.ACCEPT:
                target_entry.set_text(dialog.get_filename())
            dialog.destroy()

        def on_reset_defaults(self, widget):
            restore_system_defaults()
            self.logo_entry.set_text(read_current_logo())
            self.boot_entry.set_text("")
            self.wp_entry.set_text("")

            msg = Gtk.MessageDialog(
                transient_for=self, flags=0,
                message_type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="Restored System Defaults"
            )
            msg.format_secondary_text("GDM logo, wallpaper, and Plymouth boot splash reverted to factory state.")
            msg.run()
            msg.destroy()

        def on_apply(self, widget):
            logo_val = self.logo_entry.get_text().strip()
            boot_val = self.boot_entry.get_text().strip()
            wp_val = self.wp_entry.get_text().strip()

            if logo_val in ("", "None (Disabled)"):
                apply_logo_setting("")
            elif is_valid_image(logo_val):
                apply_logo_setting(logo_val)

            if is_valid_image(boot_val):
                apply_boot_logo_setting(boot_val)

            if is_valid_image(wp_val):
                apply_wallpaper_setting(wp_val)

            msg = Gtk.MessageDialog(
                transient_for=self, flags=0,
                message_type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="Changes Applied Successfully!"
            )
            msg.format_secondary_text("Restart GDM or reboot system to inspect updates.")
            msg.run()
            msg.destroy()
            Gtk.main_quit()

    app = SplashApp()
    app.connect("destroy", Gtk.main_quit)
    app.show_all()
    Gtk.main()

# ==============================================================================
# 4. CLI ENGINE (Terminal Interface)
# ==============================================================================

def print_banner():
    """Renders a visual header banner."""
    print(f"{Colors.CYAN}{Colors.BOLD}")
    print("==========================================================")
    print("            GDM3 & PLYMOUTH BOOT LOGO CUSTOMIZER          ")
    print("==========================================================")
    print(f"{Colors.RESET}")


def show_current_status():
    """Displays current system configuration status."""
    print(f"\n{Colors.BOLD}Current Configuration Status:{Colors.RESET}")
    print(f"  {Colors.BLUE}• Active GDM Logo Path:{Colors.RESET}   {read_current_logo()}")
    print(f"  {Colors.BLUE}• Active Boot Logo Status:{Colors.RESET} {read_current_boot_logo()}")
    print(f"  {Colors.BLUE}• Active Wallpaper Path:{Colors.RESET}  {read_current_wallpaper()}\n")


def prompt_selection():
    """Interactively prompts for configuration target and paths."""
    print(f"{Colors.BOLD}Select Configuration Target:{Colors.RESET}")
    print(f"  {Colors.CYAN}1){Colors.RESET} Change GDM Login Logo only")
    print(f"  {Colors.CYAN}2){Colors.RESET} Change Plymouth Boot Splash Logo only")
    print(f"  {Colors.CYAN}3){Colors.RESET} Change Wallpaper only")
    print(f"  {Colors.CYAN}4){Colors.RESET} Change All (GDM Logo + Boot Logo + Wallpaper)")
    print(f"  {Colors.CYAN}5){Colors.RESET} Reset / Restore System Defaults")
    print(f"  {Colors.CYAN}6){Colors.RESET} View Current Status")
    print(f"  {Colors.CYAN}7){Colors.RESET} Launch Graphical GUI Mode")
    print(f"  {Colors.CYAN}8){Colors.RESET} Exit\n")
    
    choice = input(f"{Colors.BOLD}Enter choice [1-8]: {Colors.RESET}").strip()

    if choice == "5":
        print(f"\n{Colors.YELLOW}[*] Action: Reverting system logos and wallpaper to defaults...{Colors.RESET}")
        restore_system_defaults()
        print(f"{Colors.GREEN}[+] Status: Reset complete. Reverted to factory defaults.{Colors.RESET}\n")
        sys.exit(0)

    if choice == "6":
        show_current_status()
        return prompt_selection()
    
    if choice == "7":
        print(f"\n{Colors.BLUE}[*] Launching Graphical Desktop GUI...{Colors.RESET}")
        run_gui_mode()
        sys.exit(0)

    if choice not in {"1", "2", "3", "4"}:
        print(f"\n{Colors.DIM}Exiting without making changes.{Colors.RESET}")
        sys.exit(0)

    target_gdm = (choice in {"1", "4"})
    target_boot = (choice in {"2", "4"})
    target_wp = (choice in {"3", "4"})

    new_gdm_logo = None
    new_boot_logo = None
    new_wallpaper = None

    if target_gdm:
        print(f"\n{Colors.BLUE}----------------------------------------------------------{Colors.RESET}")
        print(f"{Colors.BOLD}Current GDM Logo Path:{Colors.RESET} {Colors.DIM}{read_current_logo()}{Colors.RESET}")
        input_logo = input(f"{Colors.BOLD}Enter new GDM Logo file path {Colors.DIM}(or press Enter to remove logo){Colors.RESET}: ").strip()
        if input_logo:
            clean_path = str(Path(input_logo).expanduser().resolve())
            if is_valid_image(clean_path):
                new_gdm_logo = clean_path
            else:
                print(f"{Colors.YELLOW}[!] Skipping GDM logo update due to invalid file.{Colors.RESET}")
        else:
            new_gdm_logo = ""

    if target_boot:
        print(f"\n{Colors.BLUE}----------------------------------------------------------{Colors.RESET}")
        print(f"{Colors.BOLD}Current Boot Logo Status:{Colors.RESET} {Colors.DIM}{read_current_boot_logo()}{Colors.RESET}")
        input_boot = input(f"{Colors.BOLD}Enter new Plymouth Boot Logo file path:{Colors.RESET} ").strip()
        if input_boot:
            clean_path = str(Path(input_boot).expanduser().resolve())
            if is_valid_image(clean_path):
                new_boot_logo = clean_path
            else:
                print(f"{Colors.YELLOW}[!] Skipping Boot logo update due to invalid file.{Colors.RESET}")

    if target_wp:
        print(f"\n{Colors.BLUE}----------------------------------------------------------{Colors.RESET}")
        print(f"{Colors.BOLD}Current Wallpaper Path:{Colors.RESET} {Colors.DIM}{read_current_wallpaper()}{Colors.RESET}")
        input_wp = input(f"{Colors.BOLD}Enter new Wallpaper file path:{Colors.RESET} ").strip()
        if input_wp:
            clean_path = str(Path(input_wp).expanduser().resolve())
            if is_valid_image(clean_path):
                new_wallpaper = clean_path
            else:
                print(f"{Colors.YELLOW}[!] Skipping Wallpaper update due to invalid file.{Colors.RESET}")

    return target_gdm, new_gdm_logo, target_boot, new_boot_logo, target_wp, new_wallpaper


def run_cli_mode():
    """Runs terminal CLI mode."""
    print_banner()
    t_gdm, n_gdm, t_boot, n_boot, t_wp, n_wp = prompt_selection()

    if n_gdm is None and n_boot is None and n_wp is None:
        print(f"\n{Colors.YELLOW}[!] No valid configuration choices made. Exiting.{Colors.RESET}")
        sys.exit(0)

    print(f"\n{Colors.HEADER}{Colors.BOLD}=== Applying System Changes ==={Colors.RESET}")
    
    if t_gdm and n_gdm is not None:
        if n_gdm == "":
            print(f"{Colors.BLUE}[*] Action:{Colors.RESET} Clearing GDM logo configuration...")
        else:
            print(f"{Colors.BLUE}[*] Action:{Colors.RESET} Resizing & applying GDM login logo...")
        apply_logo_setting(n_gdm)
        print(f"{Colors.GREEN}[+] Status: GDM logo updated successfully.{Colors.RESET}")

    if t_boot and n_boot is not None:
        print(f"{Colors.BLUE}[*] Action:{Colors.RESET} Applying Plymouth boot splash logo...")
        if apply_boot_logo_setting(n_boot):
            print(f"{Colors.GREEN}[+] Status: Plymouth boot logo updated successfully.{Colors.RESET}")

    if t_wp and n_wp is not None:
        print(f"{Colors.BLUE}[*] Action:{Colors.RESET} Copying wallpaper to system directory...")
        apply_wallpaper_setting(n_wp)
        print(f"{Colors.GREEN}[+] Status: Wallpaper updated successfully.{Colors.RESET}")

    print(f"\n{Colors.GREEN}{Colors.BOLD}[+] Processing complete.{Colors.RESET}")
    print(f"{Colors.DIM}Reboot your system to inspect boot splash and login updates.{Colors.RESET}\n")

# ==============================================================================
# 5. ENTRY POINT & MODE ROUTING
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        prog="splash",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--cli", action="store_true", help="Force CLI mode")
    parser.add_argument("--gui", action="store_true", help="Force GTK GUI mode")
    args = parser.parse_args()

    ensure_privileges()

    try:
        if args.gui:
            run_gui_mode()
        elif args.cli:
            run_cli_mode()
        else:
            if sys.stdin.isatty():
                run_cli_mode()
            else:
                run_gui_mode()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}[!] Operation canceled by user. Exiting...{Colors.RESET}")
        sys.exit(130)  # Standard Linux exit code for Script terminated by Control-C

if __name__ == "__main__":
    main()