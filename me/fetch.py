#!/usr/bin/env python3
"""
Fetch
version: 26.06.06-7
Feature: 
  - Downloads files from a list of URLs using only built-in libraries.
  - Follows redirects and extracts true filenames from headers or final URLs.
  - Prevents filename collisions within the same session by appending counters.
  - Verifies file integrity via SHA256 hashes before writing to disk (optional).
  - Supports interactive prompts OR fully automated command-line execution.
Usage: 
  python3 fetch.py [suspicious link removed] [--default] [--yes]

Bootstrap (Save & Launch):
  python3 -c "import urllib.request, os; url='https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/fetch.py'; d=urllib.request.urlopen(url).read(); open('fetch.py', 'wb').write(d); os.chmod('fetch.py', 0o755); os.system('./fetch.py')"

Bootstrap (Ghost / In-Memory):
  python3 -c "import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/fetch.py').read().decode('utf-8'))"
"""

import os
import sys
import argparse
import urllib.request
import urllib.parse
import urllib.error
import hashlib

# Define the default list of URLs
DEFAULT_URLS = [
    "https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/setup.py",
    "https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/disks.py",
    "https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/plex.py",
    "https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/transmission.py"
]

EXPECTED_HASHES = {}

def get_unique_filename(base_name, seen_set):
    """Ensures filenames do not collide within the same session."""
    if base_name not in seen_set:
        seen_set.add(base_name)
        return base_name
    
    name, ext = os.path.splitext(base_name)
    counter = 1
    while f"{name}_{counter}{ext}" in seen_set:
        counter += 1
        
    new_name = f"{name}_{counter}{ext}"
    seen_set.add(new_name)
    return new_name

def gather_urls():
    """Prompts to manage the URL list interactively."""
    urls = []
    
    print("--- Fetch ---")
    print("Default URLs:")
    for u in DEFAULT_URLS:
        print(f"  - {u}")
    print("-" * 30)
    
    print("\nOptions:")
    print("1. Use default list (additional URLs can be appended later)")
    print("2. Completely override the default list")
    
    while True:
        choice = input("Select an option [1 or 2]: ").strip()
        if choice in ['1', '2']:
            break
        print("Invalid choice. Enter 1 or 2.")

    if choice == '1':
        urls.extend(DEFAULT_URLS)
        print("\nDefault list loaded.")
    else:
        print("\nDefault list overridden. Starting fresh.")

    # Loop to add custom URLs
    while True:
        add_more = input("\nEnter a URL to add (or press Enter to proceed): ").strip()
        if not add_more:
            break
        urls.append(add_more)
        print(f"Added: {add_more}")

    return urls

def download_and_process(urls, interactive=True):
    """Downloads files, verifies integrity, handles collisions, and sets permissions."""
    if not urls:
        print("No URLs to download. Exiting.")
        return []

    print("\n--- Starting Fetch ---")
    
    req_headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    downloaded_files = set()
    successful_downloads = []

    for url in urls:
        print(f"\nFetching: {url}")
        
        try:
            req = urllib.request.Request(url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                
                filename = response.info().get_filename()
                if not filename:
                    parsed_url = urllib.parse.urlparse(response.url)
                    filename = os.path.basename(parsed_url.path)
                if not filename:
                    filename = "downloaded_file.out"
                
                filename = get_unique_filename(filename, downloaded_files)
                print(f"Target Filename: {filename}")
                
                file_data = response.read()
                
                if url in EXPECTED_HASHES:
                    actual_hash = hashlib.sha256(file_data).hexdigest()
                    if actual_hash != EXPECTED_HASHES[url]:
                        print(f"SECURITY WARNING: Hash mismatch for '{filename}'.")
                        print("Skipping file write and execution.")
                        continue

                with open(filename, 'wb') as out_file:
                    out_file.write(file_data)
            
            print(f"Success: Saved as '{filename}'")
            successful_downloads.append(filename)
            
            # Determine execution permissions based on interactive flag
            if interactive:
                exec_prompt = input(f"Make '{filename}' executable? [Y/n]: ").strip().lower()
                make_exec = exec_prompt in ['', 'y', 'yes']
            else:
                make_exec = True # Auto-approve in non-interactive mode
            
            if make_exec:
                current_permissions = os.stat(filename).st_mode
                os.chmod(filename, current_permissions | 0o111)
                print(f"Permissions updated: '{filename}' is now executable.")
            else:
                print(f"Skipped execution permissions for '{filename}'.")
                
        except urllib.error.URLError as e:
            print(f"Error downloading {url}: {e}")
        except Exception as e:
            print(f"An unexpected error occurred processing {url}: {e}")

    return successful_downloads

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and process scripts.", add_help=False)
    parser.add_argument('urls', nargs='*', help="Specific URLs to download")
    parser.add_argument('-d', '--default', action='store_true', help="Include default URLs")
    parser.add_argument('-y', '--yes', action='store_true', help="Skip prompts and auto-confirm permissions")
    parser.add_argument('-h', '--help', action='help', help="Show this help message and exit")
    
    args = parser.parse_args()

    try:
        target_urls = []
        
        # Determine URL list based on CLI arguments
        if args.urls or args.default:
            if args.default:
                target_urls.extend(DEFAULT_URLS)
            target_urls.extend(args.urls)
        else:
            # Fall back to interactive mode if no arguments provided
            target_urls = gather_urls()

        # Run process. If --yes is passed or arguments were provided, assume non-interactive
        is_interactive = not args.yes and not (args.urls or args.default)
        
        download_and_process(target_urls, interactive=is_interactive)
        print("\nAll tasks completed successfully.")
        
    except KeyboardInterrupt:
        print("\n\nProcess interrupted. Exiting.")