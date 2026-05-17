#!/usr/bin/env python3

"""
Ubuntu Environment Interactive Setup Script

Version: 1.1.7
Date: 2026-03-07

Description:
    An interactive, data-driven script to configure a fresh Ubuntu and Debian environment.
    Designed to be executed directly from a URL or run locally. Supports external 
    JSON configuration injection via the '--tasks' argument.
    
Changelog:
    - 1.1.7 (2026-03-07): Added default value support for multi-choice prompts. Set 
                          GNOME dock position to default to "LEFT" (Ubuntu default).
    - 1.1.6 (2026-03-06): Added automatic clock repair. If the VM clock is out of sync, 
                          the script will fetch the true time from the internet and use 
                          'sudo date -s' to fix it automatically, preventing SSL/APT failures.
    - 1.1.5 (2026-03-06): Improved internet pre-flight check to also validate system clock 
                          synchronization. Out-of-sync clocks in VMs cause silent APT/SSL failures.
    - 1.1.4 (2026-03-06): Improved internet connectivity check for VMs (GNOME Boxes). 
                          Increased timeout, added error context, and made it bypassable.
    - 1.1.3 (2026-03-05): Final Audit. Fixed FileNotFoundError crashes for missing core utils.
                          Prevented silent directory creation. Un-hid apt-get update output.
    - 1.1.2 (2026-03-05): Added Debian compatibility by safely checking for the 
                          'dash-to-dock' gsettings schema.
    - 1.1.1 (2026-03-05): Added remote URL support for custom JSON injection.
    - 1.1.0 (2026-03-05): Added intelligent pre-flight checks and package upgrade handling.
    - 1.0.0 (2026-03-04): Initial stable release.
"""

import os
import sys
import subprocess
import urllib.request
import json
import datetime
import argparse
import email.utils

# ==========================================
# 0. TERMINAL FIX FOR PIPED EXECUTION
# ==========================================
if not sys.stdin.isatty():
    try:
        sys.stdin = open('/dev/tty')
    except OSError:
        print("\n[!] Error: No interactive terminal detected. This script requires user input.")
        print("    If running in an automated pipeline, please run interactively.")
        sys.exit(1)

# ==========================================
# 1. CONFIGURATION DATA
# ==========================================
SETUP_TASKS = [
    {
        "name": "Required Applications",
        "prompt": "Check and install missing required applications?",
        "type": "apt_packages",
        "packages": [
            "inkscape", "gimp", "audacity", 
            "sqlitebrowser", "curl", "wget", 
            "gpg", "openssh-server"
        ]
    },
    {
        "name": "GNOME Extension",
        "prompt": "Install custom GNOME extension 'lesion'?",
        "type": "python_url",
        "url": "https://raw.githubusercontent.com/khensolomon/lesion/master/install.py",
    },
    {
        "name": "Autostart Applications",
        "prompt": "Configure autostart applications?",
        "type": "autostart_group",
        "items": [
            {
                "app_name": "Visual Studio Code",
                "filename": "vscode.desktop",
                "content": [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Exec=code",
                    "Hidden=false",
                    "NoDisplay=false",
                    "X-GNOME-Autostart-enabled=true",
                    "Name=Visual Studio Code",
                    "Comment=Start VS Code on login"
                ]
            },
            {
                "app_name": "Remmina",
                "filename": "remmina.desktop",
                "content": [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Exec=remmina -i",
                    "Hidden=false",
                    "NoDisplay=false",
                    "X-GNOME-Autostart-enabled=true",
                    "Name=Remmina",
                    "Comment=Start Remmina on login"
                ]
            },
            {
                "app_name": "SSH Agent",
                "filename": "ssh-agent.desktop",
                "content": [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Exec=ssh-agent",
                    "Hidden=false",
                    "NoDisplay=false",
                    "X-GNOME-Autostart-enabled=true",
                    "Name=SSH Agent",
                    "Comment=Start SSH Agent on login"
                ]
            }
        ]
    },
    {
        "name": "GNOME Dock Configuration",
        "prompt": "Change GNOME panel to a floating dock?",
        "type": "gnome_dock_interactive"
    }
]

# ==========================================
# 2. LOGGER SYSTEM (For Verification & Rollback)
# ==========================================
LOG_FILE = os.path.expanduser("~/.ubuntu_setup_history.json")

def log_action(action_data):
    """Appends structured data to the local history JSON file."""
    history = []
    
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r') as f:
                history = json.load(f)
        except json.JSONDecodeError:
            pass 

    action_data["timestamp"] = datetime.datetime.now().isoformat()
    history.append(action_data)

    try:
        with open(LOG_FILE, 'w') as f:
            json.dump(history, f, indent=4)
    except IOError as e:
        print_error(f"Failed to write to log file: {e}")

# ==========================================
# 3. UI & FORMATTING HELPERS
# ==========================================
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"{Colors.HEADER}{Colors.BOLD}{text}{Colors.ENDC}")

def print_step(text):
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}==> {text}{Colors.ENDC}")

def print_info(text, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{text}")

def print_success(text, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{Colors.OKGREEN}[✓] {text}{Colors.ENDC}")

def print_error(text, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{Colors.FAIL}[✗] {text}{Colors.ENDC}")

def ask_yes_no(question, default="y", indent=1):
    valid = {"yes": True, "y": True, "ye": True, "no": False, "n": False}
    prompt_hint = " [Y/n] " if default == "y" else " [y/N] "
    spacing = "  " * indent

    while True:
        print(f"{spacing}{Colors.WARNING}? {question}{prompt_hint}{Colors.ENDC}", end="")
        try:
            choice = input().lower()
        except EOFError:
            print_error("\nInput stream detached. Cannot read user input.")
            sys.exit(1)
            
        if choice == "":
            return valid[default]
        elif choice in valid:
            return valid[choice]
        else:
            print_info("Please respond with 'yes' or 'no' (or 'y' or 'n').", indent + 1)

def ask_choice(question, choices, default=None, indent=1):
    spacing = "  " * indent
    print(f"{spacing}{Colors.WARNING}? {question}{Colors.ENDC}")
    
    for i, choice in enumerate(choices, 1):
        if default and choice == default:
            print_info(f"{i}. {choice.capitalize()} (default)", indent + 1)
        else:
            print_info(f"{i}. {choice.capitalize()}", indent + 1)
            
    default_hint = f" [{choices.index(default) + 1}]" if default and default in choices else ""
    
    while True:
        print(f"{spacing}{Colors.WARNING}Select an option [1-{len(choices)}]{default_hint}: {Colors.ENDC}", end="")
        try:
            raw_input = input().strip()
        except EOFError:
            print_error("\nInput stream detached. Cannot read user input.")
            sys.exit(1)
            
        if not raw_input and default and default in choices:
            return default
            
        try:
            answer = int(raw_input)
            if 1 <= answer <= len(choices):
                return choices[answer - 1]
            else:
                print_info(f"Please enter a number between 1 and {len(choices)}.", indent + 1)
        except ValueError:
            print_info("Please enter a valid number.", indent + 1)

def ensure_sudo(reason="Administrative privileges are required for this step.", indent=2):
    print_info(reason, indent)
    try:
        subprocess.run(['sudo', '-v'], check=True)
    except subprocess.CalledProcessError:
        print_error("Failed to acquire sudo privileges. Exiting to prevent partial setup.", indent)
        sys.exit(1)
    except KeyboardInterrupt:
        print_error("\nSetup aborted by user.", indent)
        sys.exit(1)
    except FileNotFoundError:
        print_error("Command 'sudo' not found. Cannot proceed.", indent)
        sys.exit(1)

def get_current_gsetting(schema, key):
    try:
        result = subprocess.run(['gsettings', 'get', schema, key], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None

def check_gsettings_schema_exists(schema):
    """Checks if a gsettings schema is installed on the system."""
    try:
        result = subprocess.run(['gsettings', 'list-schemas'], capture_output=True, text=True, check=True)
        return schema in result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

# ==========================================
# 4. TASK RUNNERS
# ==========================================
def run_python_url(task):
    if "url" not in task:
        print_error("Task missing 'url' parameter.")
        return
        
    print_info(f"Target URL: {task['url']}", indent=2)
    print_info("Fetching and running script...", indent=2)
    try:
        with urllib.request.urlopen(task["url"]) as response:
            script_content = response.read()
        
        subprocess.run(['python3', '-'], input=script_content, check=True)
        print_success("Successfully executed remote script.", indent=2)
        
        log_action({
            "task_name": task.get("name", "Unknown Task"),
            "type": "python_script_execution",
            "url_executed": task["url"],
            "note": "External scripts must be uninstalled manually if required."
        })
    except Exception as e:
        print_error(f"Failed to execute script: {e}", indent=2)

def run_autostart_group(task):
    autostart_dir = os.path.expanduser("~/.config/autostart")
    created_files = []

    for item in task.get("items", []):
        app_name = item.get("app_name", "Unnamed App")
        filename = item.get("filename", "app.desktop")
        
        if ask_yes_no(f"Add {app_name} to autostart?", default="y", indent=2):
            os.makedirs(autostart_dir, exist_ok=True)
            filepath = os.path.join(autostart_dir, filename)
            try:
                with open(filepath, 'w') as f:
                    clean_content = "\n".join(item.get("content", [])) + "\n"
                    f.write(clean_content)
                print_success(f"Created {filename}", indent=2)
                created_files.append(filepath)
            except IOError as e:
                print_error(f"Failed to create {filename}: {e}", indent=2)
        else:
            print_info(f"Skipping {app_name}.", indent=2)
            
    if created_files:
        log_action({
            "task_name": task.get("name", "Unknown Task"),
            "type": "files_created",
            "files": created_files
        })

def run_gnome_dock_interactive(task):
    schema = 'org.gnome.shell.extensions.dash-to-dock'
    
    if not check_gsettings_schema_exists(schema):
        print_error("The 'dash-to-dock' extension schema is not found on this system.", indent=2)
        print_info("Vanilla Debian does not include this by default. Skipping task.", indent=2)
        return
    
    position = ask_choice("Where do you want the dock positioned?", ["BOTTOM", "LEFT", "RIGHT", "TOP"], default="LEFT", indent=2)
    
    rollback_data = [
        {"schema": schema, "key": "extend-height", "previous_value": get_current_gsetting(schema, 'extend-height')},
        {"schema": schema, "key": "dock-fixed", "previous_value": get_current_gsetting(schema, 'dock-fixed')},
        {"schema": schema, "key": "dock-position", "previous_value": get_current_gsetting(schema, 'dock-position')}
    ]

    cmds = [
        ['gsettings', 'set', schema, 'extend-height', 'false'],
        ['gsettings', 'set', schema, 'dock-fixed', 'true'],
        ['gsettings', 'set', schema, 'dock-position', f"'{position}'"]
    ]

    for cmd in cmds:
        try:
            subprocess.run(cmd, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print_error(f"Failed to execute '{' '.join(cmd)}': {e}", indent=2)
            return
            
    log_action({
        "task_name": task.get("name", "Unknown Task"),
        "type": "gsettings_modified",
        "rollback_instructions": rollback_data
    })
    
    print_success("Dock configured successfully.", indent=2)

def run_apt_packages(task):
    packages = task.get("packages", [])
    if not packages:
        return

    missing_packages = []
    installed_packages = []
    print_info("Checking package status...", indent=1)
    
    for pkg in packages:
        try:
            result = subprocess.run(['dpkg', '-s', pkg], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode == 0:
                print_success(f"{pkg} is already installed.", indent=2)
                installed_packages.append(pkg)
            else:
                print_error(f"{pkg} is NOT installed.", indent=2)
                missing_packages.append(pkg)
        except FileNotFoundError:
            print_error("Command 'dpkg' not found. Is this a Debian/Ubuntu system?", indent=2)
            return
            
    if missing_packages:
        choices = [
            f"Install all {len(missing_packages)} missing packages",
            "Ask to install each missing package individually",
            "Skip missing package installation"
        ]
        choice = ask_choice("How would you like to handle the missing packages?", choices, indent=2)
        
        packages_to_install = []
        
        if choice == choices[0]:
            packages_to_install = missing_packages
        elif choice == choices[1]:
            for pkg in missing_packages:
                if ask_yes_no(f"Install {pkg}?", default="n", indent=3):
                    packages_to_install.append(pkg)

        if packages_to_install:
            ensure_sudo(reason=f"Sudo is required to install {len(packages_to_install)} package(s).", indent=2)
            print_info("Updating package list and installing...", indent=2)
            try:
                subprocess.run(['sudo', 'apt-get', 'update'], check=True)
                subprocess.run(['sudo', 'apt-get', 'install', '-y'] + packages_to_install, check=True)
                print_success("Packages installed successfully.", indent=2)
                
                log_action({
                    "task_name": task.get("name", "Unknown Task"),
                    "type": "apt_installed",
                    "packages_installed": packages_to_install
                })
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print_error(f"Failed to install packages: {e}", indent=2)
        else:
            print_info("Skipping missing package installation.", indent=2)
    else:
        print_success("All required packages are already installed!", indent=2)

    if installed_packages:
        print_info("\nChecking for updates for existing packages...", indent=1)
        if ask_yes_no(f"Would you like to check and apply updates for the {len(installed_packages)} already installed packages?", default="n", indent=2):
            ensure_sudo(reason="Sudo is required to upgrade packages.", indent=2)
            try:
                subprocess.run(['sudo', 'apt-get', 'update'], check=True)
                print_info("Upgrading existing packages to their newest versions...", indent=2)
                subprocess.run(['sudo', 'apt-get', 'install', '--only-upgrade', '-y'] + installed_packages, check=True)
                print_success("Packages updated successfully.", indent=2)
                
                log_action({
                    "task_name": task.get("name", "Unknown Task"),
                    "type": "apt_upgraded",
                    "packages_upgraded": installed_packages
                })
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print_error(f"Failed to upgrade packages: {e}", indent=2)
        else:
            print_info("Skipping package upgrades.", indent=2)

TASK_HANDLERS = {
    "python_url": run_python_url,
    "autostart_group": run_autostart_group,
    "gnome_dock_interactive": run_gnome_dock_interactive,
    "apt_packages": run_apt_packages
}

# ==========================================
# 5. MAIN ENGINE & MERGE LOGIC
# ==========================================
def merge_tasks(default_tasks, custom_tasks):
    merged = []
    custom_dict = {t['name']: t for t in custom_tasks if 'name' in t}
    
    for task in default_tasks:
        if task['name'] in custom_dict:
            user_task = custom_dict.pop(task['name'])
            merged_task = task.copy()
            
            if task.get('type') == 'apt_packages' and 'packages' in user_task:
                merged_task['packages'] = list(set(task.get('packages', []) + user_task['packages']))
                merged_task['prompt'] = user_task.get('prompt', task.get('prompt'))
            
            elif task.get('type') == 'autostart_group' and 'items' in user_task:
                merged_task['items'] = task.get('items', []) + user_task['items']
                merged_task['prompt'] = user_task.get('prompt', task.get('prompt'))
                
            merged.append(merged_task)
        else:
            merged.append(task)
            
    for task in custom_dict.values():
        merged.append(task)
        
    return merged

def run_preflight_checks():
    print_step("System Environment Checks")
    
    print_info("Checking Operating System...", indent=1)
    is_ubuntu_based = False
    try:
        with open('/etc/os-release') as f:
            os_data = f.read().lower()
            if 'id=ubuntu' in os_data or 'id=debian' in os_data or 'id=pop' in os_data or 'id_like=ubuntu' in os_data:
                is_ubuntu_based = True
    except IOError:
        pass
    
    if is_ubuntu_based:
        print_success("Ubuntu/Debian-based OS detected.", indent=2)
    else:
        print_error("Non-Ubuntu OS detected. This script is designed for Debian/Ubuntu-based systems.", indent=2)
        if not ask_yes_no("Are you sure you want to continue anyway? Things may break.", default="n", indent=2):
            sys.exit(1)
            
    print_info("Checking Internet & System Clock...", indent=1)
    try:
        # Use a lightweight endpoint with a longer timeout
        response = urllib.request.urlopen('http://clients3.google.com/generate_204', timeout=5)
        print_success("Internet connection active.", indent=2)
        
        # Check system time sync to prevent APT and SSL Certificate failures
        server_date_str = response.headers.get('Date')
        if server_date_str:
            server_time = email.utils.parsedate_to_datetime(server_date_str)
            local_time = datetime.datetime.now(datetime.timezone.utc)
            time_diff = abs((server_time - local_time).total_seconds())
            
            if time_diff > 300: # Over 5 minutes desynchronized
                print_error(f"System clock is out of sync (difference: ~{int(time_diff/60)} minutes).", indent=2)
                print_info("A desynchronized clock will cause APT updates and SSL certificates to fail.", indent=2)
                
                if ask_yes_no("Would you like this script to automatically fix your system time?", default="y", indent=2):
                    ensure_sudo(reason="Sudo is required to update the system clock.", indent=3)
                    try:
                        # Feed the exact time we just got from the HTTP header straight to the Linux date command
                        subprocess.run(['sudo', 'date', '-s', server_date_str], check=True, stdout=subprocess.DEVNULL)
                        print_success("System clock has been successfully synchronized!", indent=3)
                    except subprocess.CalledProcessError as e:
                        print_error(f"Failed to set system time: {e}", indent=3)
                        if not ask_yes_no("Proceed anyway? (Downloads will likely fail)", default="n", indent=3):
                            sys.exit(1)
                else:
                    if not ask_yes_no("Are you sure you want to proceed with a broken clock?", default="n", indent=2):
                        sys.exit(1)
            else:
                print_success("System clock is synchronized.", indent=2)

    except Exception as e:
        print_error(f"Internet check failed ({e}).", indent=2)
        print_info("GNOME Boxes or strict firewalls can sometimes cause false positives here.", indent=2)
        if not ask_yes_no("Are you sure you have internet and want to proceed anyway?", default="n", indent=2):
            sys.exit(1)

    print_info("Checking Python Version...", indent=1)
    if sys.version_info >= (3, 6):
        print_success(f"Python {sys.version_info.major}.{sys.version_info.minor} detected.", indent=2)
    else:
        print_error("Python 3.6+ is required.", indent=2)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Ubuntu Environment Interactive Setup Script")
    parser.add_argument('--tasks', type=str, help="Path or URL to a custom JSON file to merge tasks.", default=None)
    args = parser.parse_args()

    final_tasks = SETUP_TASKS
    
    if args.tasks:
        try:
            if args.tasks.startswith('http://') or args.tasks.startswith('https://'):
                print_info(f"Fetching remote custom tasks from {args.tasks}...", indent=0)
                with urllib.request.urlopen(args.tasks) as response:
                    user_tasks = json.loads(response.read().decode('utf-8'))
                if isinstance(user_tasks, list):
                    final_tasks = merge_tasks(SETUP_TASKS, user_tasks)
                    print_success(f"Successfully loaded and merged custom tasks from URL", indent=0)
                else:
                    print_error("Remote tasks file must contain a JSON list. Using defaults.", indent=0)
            
            elif os.path.exists(args.tasks):
                with open(args.tasks, 'r') as f:
                    user_tasks = json.load(f)
                if isinstance(user_tasks, list):
                    final_tasks = merge_tasks(SETUP_TASKS, user_tasks)
                    print_success(f"Successfully loaded and merged custom tasks from {args.tasks}", indent=0)
                else:
                    print_error("Local tasks file must contain a JSON list. Using defaults.", indent=0)
            else:
                print_error(f"Custom tasks file/URL not found or invalid: {args.tasks}. Using defaults.", indent=0)
                
        except json.JSONDecodeError as e:
            print_error(f"Invalid JSON format: {e}. Using defaults.", indent=0)
        except Exception as e:
            print_error(f"Failed to load custom tasks: {e}. Using defaults.", indent=0)

    print_header("\nUbuntu Environment Interactive Setup Script")
    print_info("Running configuration...\n", indent=0)

    run_preflight_checks()

    print_step("Pre-flight Review")
    print_info("This script is configured to offer the following setup tasks:", indent=1)
    for i, task in enumerate(final_tasks, 1):
        print_info(f"{i}. {task.get('name', 'Unnamed Task')}", indent=2)
    
    print_info("\nYou will be prompted for permission before any changes are made.", indent=1)
    if not ask_yes_no("Do you want to proceed with the setup wizard?", default="y", indent=1):
        print_info("Setup safely aborted by user.", indent=1)
        return

    for task in final_tasks:
        task_name = task.get("name", "Unnamed Task")
        print_step(task_name)
        
        prompt_text = task.get("prompt", f"Execute task: {task_name}?")
        
        if ask_yes_no(prompt_text):
            handler = TASK_HANDLERS.get(task.get("type"))
            if handler:
                handler(task)
            else:
                print_error(f"Unknown task type: {task.get('type')}")
        else:
            print_info(f"Skipping {task_name.lower()}.", indent=1)

    print_step("Setup Complete")
    print_success(f"A detailed history of changes was saved to: {LOG_FILE}", indent=1)
    print_info("Please log out and log back in for all changes to take full effect.\n", indent=0)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("\n\nSetup aborted manually by user.")
        sys.exit(1)