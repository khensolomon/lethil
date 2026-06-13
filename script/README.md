# secrets.py

Project-aware GitHub secrets manager.

A single self-contained Python script that reads a project's `.env` file,
validates it, and pushes the right pieces to GitHub Actions as repository
secrets. There is no separate config file — the `.env` is the single source of
truth.

- **Repository:** https://github.com/khensolomon/lethil (`script/secrets.py`)
- **Dependencies:** Python 3 (standard library only) + the GitHub CLI (`gh`)

---

## Mental model

The `.env` is divided into three zones by marker lines. A marker is a whole
line of the form `#@ <mode>`, where `<mode>` is one of `bundle`, `individual`,
or `local`. Everything before the first marker belongs to the bundle zone.

```ini
# Bundle zone — production app config. Concatenated and pushed as one
# secret named ENV_BASE. (The "#@ bundle" marker is optional; content
# before the first marker is treated as bundle by default.)
SECRET_KEY=xxx
DEBUG=False
DB_NAME=myordbok
DB_USER=appuser
DB_PWD=xxx
STORAGE_ROOT=/opt/bucket/storage

#@ individual
# Each key below is pushed as its own GitHub secret. The set is NOT
# hardcoded — whatever lands in this zone is pushed.
SERVER_HOSTNAME=ssh.admin.com
SERVER_USERNAME=root
SSH_PRIVATE_KEY_PATH=~/.ssh/prod_server
VM_RUNNER_STATUS_PAT=github_pat_xxxx
CF_SERVICE_TOKEN_ID=xxxx.access
CF_SERVICE_TOKEN_SECRET=xxxx

#@ local
# Never pushed. Read by the script only.
REPO_OWNER=khensolomon
REPO_NAME=myordbok
```

What the script does with each zone:

| Zone | Marker | Behaviour | GitHub result |
|------|--------|-----------|---------------|
| Bundle | content before the first marker (or `#@ bundle`) | All key/value lines are cleaned and concatenated | One secret named `ENV_BASE` |
| Individual | `#@ individual` | Each key is pushed as its own secret | `SERVER_HOSTNAME`, `CF_SERVICE_TOKEN_ID`, … |
| Local | `#@ local` | Never pushed; read by the script only | — |

Rules enforced by the parser:

- Markers must appear in order: `bundle` → `individual` → `local`. Any zone may
  be absent.
- A marker mode that is not one of the three recognised names is a fatal error
  (this catches typos in real markers).
- A duplicate marker is a fatal error.
- Blank lines and comment lines are stripped. An inline comment requires
  whitespace before the `#`, so a value such as `BRAND=#0a0a0a` or a password
  containing `#` is preserved intact.
- Empty values and unfilled placeholders (anything containing `REPLACE_ME`) are
  rejected at push time.

### The individual zone is not hardcoded

Adding a new deployment secret needs no change to the script — placing the key
under `#@ individual` is enough. This is what lets one `secrets.py` serve every
project: an app `.env` carries production config in the bundle zone plus its own
individual keys, while a tooling repo such as lethil can have no bundle at all,
only individual keys.

### The SSH key is special

`SSH_PRIVATE_KEY_PATH` in the individual zone is treated as a file path. The
file it points to is read, and **its contents** are pushed as the secret
`SSH_PRIVATE_KEY`. The path itself is never pushed.

### Repository identity

The target repository is resolved in this order:

1. The `--repo owner/name` flag, if supplied.
2. `REPO_OWNER` / `REPO_NAME` from the `#@ local` zone (with a fallback to the
   bundle zone for older `.env` files).
3. `gh repo view` on the current git remote, as a last resort.

If none of these yield a repository, the script aborts and explains how to set
`REPO_OWNER` and `REPO_NAME`.

---

## Install

### 1. Install the GitHub CLI

```bash
# Ubuntu / Debian
sudo apt install gh

# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# All platforms
# https://cli.github.com
```

### 2. Authenticate

```bash
gh auth login
```

The CLI must be authenticated with `repo` scope so it can read and write Actions
secrets.

### 3. Install the script

The script is one self-contained file and runs from anywhere. A common choice
is to place it on `PATH`:

```bash
sudo wget https://raw.githubusercontent.com/khensolomon/lethil/master/script/secrets.py -O /usr/local/bin/secrets.py
sudo chmod +x /usr/local/bin/secrets.py
```

Keeping it inside the project repo works equally well — location does not
matter.

### 4. Verify

```bash
cd ~/projects/myordbok
secrets.py --check
```

A healthy result reports that `gh` is authenticated, the current directory is
inside a git repo, and the `.env` parses cleanly.

---

## Updating

The install command is also the update command, since the script is a single
file:

```bash
sudo wget https://raw.githubusercontent.com/khensolomon/lethil/master/script/secrets.py -O /usr/local/bin/secrets.py
```

No `.env` is ever modified by updating the script.

---

## Setting up a new project

If a `.env` does not yet have the zone markers, scaffold them:

```bash
cd ~/projects/myordbok
secrets.py --init
```

When run inside a project that has no `.env`, `--init` creates one with all
three markers and empty `REPO_OWNER` / `REPO_NAME` placeholders. When a `.env`
already exists, `--init` appends only the markers that are missing and leaves
existing content untouched. Fill in the placeholders, then run `--push`.

---

## Commands

Running `secrets.py` with no flags shows a project overview: which individual
keys exist, the bundle line count, the resolved repository, and recent backup
state. Nothing is pushed. This is the safe "what is the current state" command.

### `--push`

The main verb. Reads `.env`, builds the bundle (`ENV_BASE`), resolves the
individual keys, and pushes everything to GitHub.

```bash
secrets.py --push                       # push everything
secrets.py --push --only DB_PWD         # push one secret (partial match ok)
secrets.py --push --dry-run             # validate + preview, nothing pushed
secrets.py --push --force               # push all, skip stale detection
```

A backup of `.env` is written before any push begins.

**Stale detection.** By default, each secret whose value matches the most recent
backup is skipped, so an unchanged value is not re-pushed. `--force` bypasses
this and pushes everything. `--only` also bypasses it for the single targeted
key. The SSH key is compared by its path value only (a cheap check) and is never
silently treated as unchanged.

`--only` accepts a partial name. An exact match wins; otherwise a
case-insensitive prefix match is used. `--push --only db` would match `DB_PWD`,
`DB_USER`, `DB_NAME`, and the matched name is printed before pushing. An
ambiguous or unmatched pattern aborts with the list of candidates.

### `--status`

Side-by-side comparison of the secrets resolved from `.env` against the secret
names present on GitHub. Each is marked as present locally, present on GitHub,
or missing on one side.

```bash
secrets.py --status
```

Useful before a push to see what would change. GitHub secret values cannot be
read back, so the comparison is by name and presence, not by value.

### `--diff`

Shows which keys changed between the most recent backup and the current `.env`,
across both the bundle and individual zones. Values are never printed — only a
per-key status of `ADDED`, `REMOVED`, `CHANGED`, or `same`.

```bash
secrets.py --diff
```

This compares local backups, not GitHub. A backup is created automatically on
every push, so the first `--diff` is available after the first `--push`.

### `--env-preview`

Prints exactly what would be pushed as `ENV_BASE` — the cleaned bundle zone,
with comments and non-bundle lines stripped. Sensitive keys are masked.

```bash
secrets.py --env-preview
```

This is what the deploy pipeline reconstructs on the server from
`${{ secrets.ENV_BASE }}`. Reading it is the fastest way to confirm the zones
are split correctly.

### `--list`

Lists all secret names currently set on the repository. GitHub-managed names are
labelled.

```bash
secrets.py --list
```

### `--restore`

Restores `.env` from a previous backup, chosen interactively from a numbered
list. The current `.env` is itself backed up before being overwritten, so the
operation is reversible.

```bash
secrets.py --restore
```

### `--rotate`

Guided SSH key rotation:

1. Generates a new Ed25519 keypair.
2. Prints the new public key and waits while it is added to the server's
   `authorized_keys` (the old key stays active during the transition).
3. Updates `SSH_PRIVATE_KEY_PATH` in `.env`.
4. Pushes the new private key as the `SSH_PRIVATE_KEY` GitHub secret.
5. Backs up `.env` and prints the cleanup steps for the old key.

```bash
secrets.py --rotate
```

Each step prints what is about to happen and waits for confirmation.

### `--check`

Diagnostic. Validates that `gh` is authenticated, the current directory is
inside a git repo, the `.env` exists and parses, the repository can be resolved,
and every individual key has a value (including that `SSH_PRIVATE_KEY_PATH`
points to a real file). Run this first whenever something seems wrong.

```bash
secrets.py --check
```

### `--init`

Ensures the three zone markers exist in `.env`. Creates a fresh `.env` when none
exists, or appends only the missing markers otherwise. Idempotent — running it
twice changes nothing the second time.

```bash
secrets.py --init
```

---

## Flags

### Global flags

| Flag | Effect |
|------|--------|
| `--env FILE` | Use this `.env` instead of the one at the git root |
| `--repo ORG/REPO` | Override repository detection |
| `-h` / `--help` | Show help |

### Push modifiers

| Flag | Available on | Effect |
|------|--------------|--------|
| `--only KEY` | `--push` | Push only secrets whose name matches (partial match) |
| `--dry-run` | `--push` | Validate and preview; push nothing |
| `--force` | `--push` | Skip stale detection; local always wins |

---

## Backup location

Every successful `--push` (and every `--restore` and `--rotate`) writes a
timestamped backup of `.env`, plus an `env-latest.env` copy used for stale
detection:

```
$STORAGE_ROOT/<repo-name>/env/env-YYYY-MM-DD_HH-MM-SS.env
$STORAGE_ROOT/<repo-name>/env/env-latest.env
```

`STORAGE_ROOT` is read from the `.env` (any zone; the bundle is the conventional
home). When it is not set, backups go to `~/.deploy/backups/<repo-name>/`
instead. Backups are written atomically (temp file plus rename) so a backup is
never left partial. The most recent ten timestamped backups per project are
retained; older ones are pruned automatically.

---

## Typical workflows

### Initial setup of a project

```bash
cd ~/projects/myordbok
secrets.py --check                   # confirm the environment is healthy
secrets.py --init                    # add the zone markers if missing
$EDITOR .env                         # fill in the values
secrets.py --push --dry-run          # preview
secrets.py --push                    # push
```

### Rotating a single value

After changing `DB_PWD` locally:

```bash
secrets.py --status                  # confirm DB_PWD differs from GitHub
secrets.py --push --only DB_PWD
```

### Rotating SSH keys

```bash
secrets.py --rotate
```

The new key is pushed and the old one is removed from the server after a
deployment confirms the new key works.

### Recovering from a bad edit

```bash
secrets.py --restore
```

Pick a backup from the list. The current (broken) `.env` is backed up first, so
nothing is lost.

### Operating on another project without changing directory

```bash
secrets.py --env ~/projects/otherproject/.env --status
secrets.py --repo myorg/otherrepo --status
```

---

## Migrating from the old single-boundary format

An earlier version of this script split the `.env` with one hard boundary line,
`# NOTE: development`, and recognised a fixed, hardcoded set of deployment keys.
The current version uses `#@` markers instead and treats any unmarked content as
the bundle zone.

Because the current parser only recognises `#@`-prefixed markers, an old `.env`
that still uses `# NOTE: development` is read as if it were all bundle: every
line collapses into `ENV_BASE` and no individual secrets are pushed. This fails
silently. Migrate before the first push under the new version.

To migrate an existing `.env`:

1. Replace the line `# NOTE: development` with `#@ individual`.
2. Add a `#@ local` marker below the deployment keys and move `REPO_OWNER` /
   `REPO_NAME` beneath it. (For backward compatibility these are still read from
   the bundle zone if found there, but `#@ local` is the correct home.)
3. Remove any lines that were previously ignored dev-only overrides, or leave
   them above `#@ individual` only if they belong in production config.
4. Run `secrets.py --check` to confirm the result parses, then
   `secrets.py --env-preview` to confirm the bundle is correct.

`secrets.py --init` can add any missing markers automatically.

---

## Conventions and assumptions

- **Zones are delimited by `#@ bundle` / `#@ individual` / `#@ local` markers.**
  Content before the first marker is the bundle zone.
- **The individual key set is not hardcoded.** Any key under `#@ individual` is
  pushed; no code change is needed to add one.
- **Repository identity comes from `REPO_OWNER` / `REPO_NAME`** in the local
  zone (with the resolution order described above).
- **`SSH_PRIVATE_KEY_PATH` → `SSH_PRIVATE_KEY`.** The path is a local
  convenience; the file's contents become the secret.
- **`GITHUB_TOKEN` is never pushed.** GitHub provides it to every workflow.
- **A backup is written before any destructive operation** — push, restore, and
  rotate all back up first.

---

## Troubleshooting

**`ABORT: gh (GitHub CLI) is not installed or not on PATH.`**
Install `gh` (see Install above), then run `gh auth login`.

**`ABORT: gh is not authenticated.`**
Run `gh auth login` and complete the browser prompt.

**`ABORT: Not inside a git repository.`**
Run the script from inside a project that has a `.git` directory, or pass
`--env` with an explicit path.

**`ABORT: Could not determine the target repository.`**
Add `REPO_OWNER` and `REPO_NAME` under `#@ local`, or pass `--repo owner/name`.

**`ABORT: unknown zone marker '#@ …'.`**
A marker mode is misspelled. Valid markers are `#@ bundle`, `#@ individual`, and
`#@ local`.

**`ABORT: Zone markers out of order` / `Duplicate '#@ …' marker`.**
Markers must appear once each, in the order bundle → individual → local.

**`Validation failed — … issue(s)`**
An individual key has an empty value or still contains `REPLACE_ME`, or
`SSH_PRIVATE_KEY_PATH` points to a missing or empty file. The message lists each
problem and how to fix it.

**Nothing happens on `--push`: "All secrets are up to date."**
Stale detection found no changes versus the last backup. Use `--force` to push
anyway.

---

## Security notes

- The `.env` should be `chmod 600` and listed in `.gitignore`.
- Backups land under `STORAGE_ROOT` (or `~/.deploy/backups/`); that location
  should also sit outside any git tree.
- `gh` stores its auth token in the OS keychain (macOS) or under
  `~/.config/gh/` (Linux). That file deserves the same care as `.env`.
- Pushed secrets are encrypted at rest by GitHub, decrypted only inside running
  workflows, and never shown in the web UI after creation.
- Secret values are sent to `gh` over stdin, never as command-line arguments, so
  they do not appear in the process list or shell history.
- `SSH_PRIVATE_KEY` deserves production-grade care. Rotate it with
  `secrets.py --rotate` rather than editing by hand.
  