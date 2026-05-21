# Post-install workflow

This document explains how isobuilder runs post-install commands on the
target system, and how to write, debug, and verify them.

## How it works

When your preset includes any `late-commands` or `snaps`, isobuilder does
**not** embed them directly into the autoinstall/preseed file. Instead:

1. **At build time** — All commands and snap installs are compiled into a
   single `post-install.sh` shell script. The script is bash-syntax-checked
   (with `bash -n`) before being written. Any syntax error in the script
   would mean a bug in isobuilder, not your preset; we want to catch that
   at build time, not on a freshly installed system that won't boot.

2. **The script is placed on the ISO** at `/nocloud/post-install.sh` (Ubuntu)
   or `/post-install.sh` (Debian). You can extract it and read it before
   burning the ISO — `xorriso -osirrox on -indev YOUR.iso -extract
   /nocloud/post-install.sh /tmp/post-install.sh` — to verify exactly what
   will run.

3. **At install time** — The autoinstall config has just two or three
   late-commands that copy the script into the chroot, run it with the
   target system as root, and clean up:

   ```yaml
   # Ubuntu user-data
   late-commands:
     - cp /cdrom/nocloud/post-install.sh /target/tmp/post-install.sh
     - curtin in-target --target=/target -- bash /tmp/post-install.sh
     - rm -f /target/tmp/post-install.sh
   ```

   ```bash
   # Debian preseed (multi-line preseed/late_command)
   d-i preseed/late_command string \
     cp /cdrom/post-install.sh /target/root/post-install.sh ; \
     in-target chmod +x /root/post-install.sh ; \
     in-target /bin/bash /root/post-install.sh ; \
     in-target rm /root/post-install.sh
   ```

4. **The script runs** inside the new system's filesystem (chroot), as root,
   with networking up. Each command is wrapped in a `run` or `run_shell`
   helper that:
   - Logs the command to `/var/log/isobuilder-postinstall.log` on the target
   - Reports OK or FAILED with the exit code
   - **Continues on failure** — one broken command doesn't strand the install

## Why a separate script (vs inline in the preseed)?

The legacy approach — stuffing commands into `late_command` with backslash
continuations and `'\\''` quote escaping — was the source of most build
failures. A single misplaced quote would silently break the entire late
phase. With a separate script:

- You can read it: `cat /nocloud/post-install.sh` extracted from the ISO
  shows you exactly what will run, in human-readable bash
- You can re-run it: if the install reaches a usable state, you can
  re-execute `/var/log/isobuilder-postinstall.log` shows you what already ran
- Quotes work normally — no triple-escape gymnastics
- You see *which* command failed, not "preseed exit 1"

## Writing late-commands in your preset

```yaml
builder:
  shared:
    prompts:
      - ask: "Install Chrome?"
        default: "yes"
        late-commands:
          - "wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb"
          - "apt-get install -y /tmp/chrome.deb"

  ubuntu:
    late-commands:
      - "echo 'Some setup' > /etc/motd"
      - "systemctl enable --now ssh"
```

### Things to know

- **Each command is a string**, run via `bash -c "..."`. Pipes (`|`),
  redirects (`>`, `<`), conditionals (`&&`, `||`), and substitutions
  (`$(cmd)`) all work as expected.

- **You're root, in the new system's filesystem**, with networking up.
  `apt-get install ...` works directly, no need for `chroot` wrappers.

- **No `curtin in-target -- ` prefix needed.** If you copied this from
  legacy preseed examples, isobuilder strips the prefix automatically when
  generating the script. Either form is accepted.

- **Failures don't abort.** A failed `apt-get install` won't strand the
  install — the log records `FAILED (exit N)` and the script continues.
  This is usually what you want, but if you really need to halt on error,
  use explicit `&&` chains: `apt-get install foo && apt-get install bar`.

- **Use absolute paths.** `cd /tmp` is fine; relative paths to `/tmp` are
  not, since each `run_shell` line is a fresh `bash -c`.

- **Heredocs work.** A heredoc inside a single command:
  ```yaml
  - |
    cat > /etc/foo.conf <<EOF
    setting=value
    EOF
  ```

## Verifying before you burn the ISO

The new `--dry-run` mode generates all install files without building the
ISO, and prints them to your terminal:

```bash
./build.py ubuntu --preset desktop --dry-run --unattended
```

You can also extract the script from a built ISO without mounting:

```bash
xorriso -osirrox on -indev OUT.iso -extract /nocloud/post-install.sh /tmp/check.sh
cat /tmp/check.sh
bash -n /tmp/check.sh && echo "syntax OK"
```

## Debugging on the target system

### Where the logs live

After install, on the new system:

| File | What's there |
|------|--------------|
| `/var/log/isobuilder-postinstall.log` | Every command's `>>>` line plus OK/FAILED status |
| `/var/log/installer/subiquity-server-debug.log` | Subiquity's own log (Ubuntu only) |
| `/var/log/installer/curtin-install.log` | Curtin's storage/apt operations (Ubuntu only) |
| `/var/log/installer/autoinstall-user-data` | The exact autoinstall config used |
| `/var/log/syslog` (or `journalctl -u cloud-init`) | cloud-init activity |

### When the install hangs

If installation appears stuck:

1. **Switch to a TTY** with `Ctrl+Alt+F2` (or F3, F4) — Subiquity uses TTY1
   for the GUI. The other TTYs let you log in as `installer` (no password)
   and inspect things.

2. **Check the logs**:
   ```bash
   sudo less /var/log/installer/subiquity-server-debug.log
   sudo journalctl -u cloud-init -n 100
   ```

3. **Check whether Subiquity is waiting on something**:
   ```bash
   sudo tail -f /var/log/installer/curtin-install.log
   ```

### Re-running the post-install manually

If the post-install script ran but some commands failed (or the system
booted but something didn't work), you can re-run individual commands:

```bash
# View what already ran
sudo cat /var/log/isobuilder-postinstall.log

# Re-run a specific command
sudo bash -c 'apt-get install -y the-thing-that-failed'

# Or grab the original script from the ISO and re-run it
sudo mount /dev/sr0 /mnt    # or wherever the ISO is mounted
sudo bash /mnt/nocloud/post-install.sh
```

### When the install finishes but the system doesn't boot

This is almost always a bootloader issue (UEFI vs BIOS mismatch) or a
storage layout that didn't take. Boot from the rescue ISO and check:

```bash
sudo mount /dev/<root> /mnt
sudo cat /mnt/var/log/isobuilder-postinstall.log
sudo cat /mnt/var/log/installer/curtin-install.log
```

## Use the DEBUG MODE grub entry

When isobuilder builds an Ubuntu ISO, it adds **two** menu entries:

- `Ubuntu Autoinstall (Wipes Disk)` — normal install, minimal output
- `Ubuntu Autoinstall - DEBUG MODE (verbose)` — same install, with
  `debug` kernel param, full logging to TTY1, and serial console output to
  `ttyS0` (115200 baud)

If your install hangs with the normal entry, **boot the debug entry next
time**. You'll see exactly which step is running when things stall.

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Hangs on splash screen, no errors visible | `quiet splash` hides logs | Boot the DEBUG MODE grub entry |
| Hangs at "starting subiquity" | autoinstall config has a typo | `--inspect` your built ISO, extract user-data, validate against the [Subiquity schema](https://canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html) |
| Stops asking about network/keyboard | Missing `interactive-sections: []` | isobuilder adds this automatically; if you've overridden it in `autoinstall:`, restore it |
| Asks "wipe disk?" | Missing `autoinstall` kernel arg | Use the menu entry isobuilder generates, not the original "Try Ubuntu" entry |
| Late-commands don't run | Quotes in a command broke the script | Run `--dry-run` and check the generated script with `bash -n` |
| Snap installs fail in script | Network not up at script-run time | snaps are installed with `&& true` in case snapd isn't ready; check `journalctl -u snapd` after boot |

## Differences between Ubuntu and Debian

| | Ubuntu | Debian |
|--|--------|--------|
| Script location on ISO | `/nocloud/post-install.sh` | `/post-install.sh` |
| Working dir at run time | `/target/tmp/` | `/target/root/` |
| Wrapped by | `curtin in-target` | `in-target` (debian-installer) |
| Log file on installed system | `/var/log/isobuilder-postinstall.log` | `/var/log/isobuilder-postinstall.log` |
| Snap support | Yes | Only if `snapd` is in your packages list |