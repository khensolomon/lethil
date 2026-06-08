#!/usr/bin/env python3
"""
Fetch — a small, dependency-free file downloader.

version: 26.06.07-2

What it does
------------
  * Streams downloads in fixed-size blocks, so memory stays flat regardless of
    file size (safe for large files on slow or flaky links).
  * Retries automatically with exponential backoff on transient network errors.
  * Follows redirects and derives a sensible filename (Content-Disposition first,
    then the final redirected URL path).
  * Avoids filename collisions within a single run (foo.py -> foo_1.py).
  * Writes atomically: data lands in a ".part" temp file and is only renamed into
    place once the download (and optional hash check) succeeds. A failed download
    never leaves a truncated file behind.
  * Verifies integrity via SHA-256 against either an inline EXPECTED_HASHES map or
    a trust-on-first-use lockfile (fetch.lock.json).
  * Runs interactively (prompts) or fully unattended (for CI / cron).

Usage
-----
  python3 fetch.py [URL ...] [options]

  # Download the built-in default set, unattended, into ./bin:
  python3 fetch.py --default --yes --output-dir ./bin

  # Download specific URLs and record their hashes to the lockfile:
  python3 fetch.py https://example.com/a.py https://example.com/b.py

Self-bootstrap one-liners
-------------------------
  Set the source URL once, then run any snippet below. The URL appears a single
  time; each command receives it (and any extra arguments) on the command line.

    RAW=https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py

  1) Download only
       python3 -c "import sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],u.split('/')[-1])" "$RAW"

  2) Save & launch
       python3 -c "import sys,os,urllib.request as r;r.urlretrieve(u:=sys.argv[1],f:=u.split('/')[-1]);os.system('python3 '+f)" "$RAW"
     Forward extra args to the saved script (replaces the process via os.execv):
       python3 -c "import os,sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],f:=u.split('/')[-1]);os.execv(sys.executable,[sys.executable,f,*sys.argv[2:]])" "$RAW" --default --yes -o ./bin

  3) Ghost / in-memory  (runs remote code unverified — use a trusted source only)
       python3 -c "import sys,urllib.request as r;exec(r.urlopen(sys.argv[1]).read())" "$RAW"
     Pass arguments to the in-memory script (rewrites sys.argv first):
       python3 -c "import sys,urllib.request as r;c=r.urlopen(u:=sys.argv[1]).read();sys.argv=[u.split('/')[-1],*sys.argv[2:]];exec(c)" "$RAW" --default --yes

  Without a shell variable (download only, URL inline):
       python3 -c "import urllib.request as r,os,sys;u=sys.argv[1];r.urlretrieve(u,os.path.basename(u))" https://raw.githubusercontent.com/khensolomon/lethil/master/me/fetch.py

  Reference notes
    - os.path.basename(u) and u.split('/')[-1] both yield the filename for these
      raw URLs; basename is the safer choice for paths with trailing slashes.
    - Save & launch: os.system spawns the script as a child process; the os.execv
      form replaces the current process, forwards sys.argv[2:], and returns the
      script's own exit code.
    - Ghost without the sys.argv rewrite leaves argv as ['-c', URL, ...], so an
      in-memory run reads the URL as its own first argument; the rewrite form
      restores argv to [filename, *extra] so flags parse as they do on disk.
    - Ghost mode performs no hash check before execution; review or pin the source.
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

__version__ = "26.06.07-2"

# Built-in download set. Treated as read-only; copy before mutating.
DEFAULT_URLS = [
    "https://raw.githubusercontent.com/khensolomon/lethil/master/me/media/setup.py",
    "https://raw.githubusercontent.com/khensolomon/lethil/master/me/media/disks.py",
    "https://raw.githubusercontent.com/khensolomon/lethil/master/me/media/plex.py",
    "https://raw.githubusercontent.com/khensolomon/lethil/master/me/media/transmission.py",
]

# Optional hard-pinned hashes: {filename_or_url: "sha256hex"}.
# Anything listed here MUST match or the download is rejected.
EXPECTED_HASHES = {}

USER_AGENT = "fetch.py/" + __version__
BLOCK_SIZE = 64 * 1024  # 64 KiB; larger than 8 KiB for noticeably better throughput.


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def human_size(num_bytes):
    """Return a compact, human-readable size string for a byte count."""
    size = float(num_bytes)
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if size < 1024 or unit == "TiB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
        size /= 1024


def get_unique_filename(base_name, seen_set):
    """Return a name not already in ``seen_set``, appending _1, _2, ... if needed."""
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


def filename_from_response(response, fallback_url):
    """Derive a filename from response headers, then the (possibly redirected) URL.

    GitHub raw and many static hosts send no Content-Disposition, so we fall back
    to the last path segment of the final URL, with any query string stripped.
    """
    name = response.headers.get_filename()
    if not name:
        final_url = response.geturl() or fallback_url
        path = urllib.parse.urlparse(final_url).path
        name = os.path.basename(path)
    return name or "downloaded.out"


def load_lockfile(path):
    """Load the {url: sha256} trust-on-first-use lockfile, or {} if absent/invalid."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError) as exc:
        print(f"Warning: could not read lockfile {path}: {exc}")
        return {}


def save_lockfile(path, lock):
    """Persist the lockfile, sorted for stable diffs."""
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(lock.items())), f, indent=2)
            f.write("\n")
    except OSError as exc:
        print(f"Warning: could not write lockfile {path}: {exc}")


# --------------------------------------------------------------------------- #
# Core download
# --------------------------------------------------------------------------- #
def download_file(url, dest_path, retries, timeout):
    """Stream ``url`` to ``dest_path`` atomically, with retry/backoff.

    Returns a tuple ``(ok, resolved_name, sha256_hex, n_bytes)``. On failure,
    ``ok`` is False and any partial ".part" file is removed. The destination is
    only created/replaced once the body has been fully and successfully written.
    """
    part_path = dest_path + ".part"
    headers = {"User-Agent": USER_AGENT}

    for attempt in range(1, retries + 1):
        sha = hashlib.sha256()
        total = 0
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as response:
                resolved = filename_from_response(response, url)
                declared = response.headers.get("Content-Length")
                with open(part_path, "wb") as f:
                    while True:
                        chunk = response.read(BLOCK_SIZE)
                        if not chunk:
                            break
                        f.write(chunk)
                        sha.update(chunk)
                        total += len(chunk)

            # Sanity check: if the server told us a size, make sure we got it all.
            if declared is not None and total != int(declared):
                raise IOError(
                    f"size mismatch: got {total} bytes, expected {declared}"
                )

            os.replace(part_path, dest_path)  # atomic on same filesystem
            return True, resolved, sha.hexdigest(), total

        except (urllib.error.URLError, OSError, ValueError) as exc:
            if os.path.exists(part_path):
                try:
                    os.remove(part_path)
                except OSError:
                    pass
            print(f"  Attempt {attempt}/{retries} failed: {exc}")
            if attempt < retries:
                time.sleep(min(2 ** attempt, 30))  # 2s, 4s, 8s ... capped at 30s

    return False, None, None, 0


def verify_hash(name, url, actual, expected_hashes, lock, use_lock):
    """Check ``actual`` against pins and TOFU lock. Returns (ok, message)."""
    pinned = expected_hashes.get(name) or expected_hashes.get(url)
    if pinned:
        if actual.lower() != pinned.lower():
            return False, f"HASH MISMATCH (pinned)\n    expected {pinned}\n    actual   {actual}"
        return True, "hash verified against EXPECTED_HASHES"

    if use_lock:
        known = lock.get(url)
        if known is None:
            lock[url] = actual  # trust on first use
            return True, f"hash recorded (first use): {actual[:16]}…"
        if known.lower() != actual.lower():
            return (
                False,
                "HASH MISMATCH (lockfile changed since last fetch)\n"
                f"    locked {known}\n    actual {actual}\n"
                "    Delete the lockfile entry to accept the new content.",
            )
        return True, "hash matches lockfile"

    return True, f"sha256 {actual[:16]}…"


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def gather_urls():
    """Interactively collect URLs, one per line, until a blank line is entered."""
    print("Enter URLs to download (one per line; blank line to finish):")
    urls = []
    while True:
        try:
            line = input("  url> ").strip()
        except EOFError:
            break
        if not line:
            break
        urls.append(line)
    return urls


def download_and_process(urls, args):
    seen = set()
    lock_path = os.path.join(args.output_dir, args.lock_name)
    lock = load_lockfile(lock_path) if args.lock else {}
    results = []

    os.makedirs(args.output_dir, exist_ok=True)

    for url in urls:
        print(f"\nFetching: {url}")
        # Provisional name only used for collision reservation; the authoritative
        # name comes back from the response (handles redirects/Content-Disposition).
        provisional = os.path.basename(urllib.parse.urlparse(url).path) or "downloaded.out"
        reserved = get_unique_filename(provisional, seen)
        dest_path = os.path.join(args.output_dir, reserved)

        ok, resolved, sha, nbytes = download_file(
            url, dest_path, retries=args.retries, timeout=args.timeout
        )
        if not ok:
            print(f"  Failed after {args.retries} attempts.")
            results.append((url, None, False))
            continue

        verified, msg = verify_hash(
            reserved, url, sha, EXPECTED_HASHES, lock, args.lock
        )
        print(f"  Saved '{dest_path}' ({human_size(nbytes)}) — {msg}")
        if not verified:
            print(f"  REJECTED: {msg}")
            try:
                os.remove(dest_path)
            except OSError:
                pass
            results.append((url, None, False))
            continue

        # Decide on the executable bit.
        if args.no_exec:
            make_exec = False
        elif args.exec or args.yes:
            make_exec = True
        else:
            make_exec = input(f"  Make '{reserved}' executable? [Y/n]: ").strip().lower() in ("", "y", "yes")

        if make_exec:
            os.chmod(dest_path, os.stat(dest_path).st_mode | 0o111)
            print(f"  '{reserved}' is now executable.")

        results.append((url, dest_path, True))

    if args.lock:
        save_lockfile(lock_path, lock)

    succeeded = [r for r in results if r[2]]
    print(f"\nDone: {len(succeeded)}/{len(results)} succeeded.")
    return [r[1] for r in succeeded]


def build_parser():
    parser = argparse.ArgumentParser(
        prog="fetch.py",
        description="Fetch and process scripts/files over HTTP(S).",
    )
    parser.add_argument("urls", nargs="*", help="Specific URLs to download.")
    parser.add_argument("-d", "--default", action="store_true",
                        help="Include the built-in DEFAULT_URLS set.")
    parser.add_argument("-y", "--yes", action="store_true",
                        help="Non-interactive: assume yes to all prompts.")
    parser.add_argument("--exec", action="store_true",
                        help="Always set the executable bit on downloads.")
    parser.add_argument("--no-exec", action="store_true",
                        help="Never set the executable bit (overrides --exec/--yes).")
    parser.add_argument("-o", "--output-dir", default=".",
                        help="Directory to save files into (default: current dir).")
    parser.add_argument("--retries", type=int, default=3,
                        help="Retry attempts per file (default: 3).")
    parser.add_argument("--timeout", type=float, default=15.0,
                        help="Per-request timeout in seconds (default: 15).")
    parser.add_argument("--lock", action="store_true", default=True,
                        help="Use the trust-on-first-use hash lockfile (default: on).")
    parser.add_argument("--no-lock", dest="lock", action="store_false",
                        help="Disable the hash lockfile.")
    parser.add_argument("--lock-name", default="fetch.lock.json",
                        help="Lockfile name within the output dir.")
    parser.add_argument("--version", action="version",
                        version=f"%(prog)s {__version__}")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)

    urls = list(DEFAULT_URLS) if args.default else []   # copy, never alias
    urls.extend(args.urls)
    if not urls:
        urls = gather_urls()
    if not urls:
        print("No URLs provided. Try: python3 fetch.py --default  (or --help)")
        return 1

    download_and_process(urls, args)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)