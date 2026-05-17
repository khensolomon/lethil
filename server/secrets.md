# secrets.py

Project-aware GitHub secrets manager.

A single Python script that reads your project's `.env` file, validates it, and pushes the right pieces to GitHub Actions as repository secrets. No separate config file — the `.env` is the single source of truth.

- **Source:** https://github.com/khensolomon/lethil/blob/master/server/secrets.py
- **Dependencies:** Python 3 + the GitHub CLI (`gh`)

---

## Mental model

The `.env` file in your project is split into three zones by a single boundary line:

```ini
# ZONE 1 — Production app values (pushed as ENV_BASE)
SECRET_KEY=xxx
DEBUG=False
DB_NAME=myordbok
DB_USER=appuser
DB_PWD=xxx
REPO_OWNER=khensolomon
REPO_NAME=myordbok
STORAGE_ROOT=/opt/bucket/storage

# NOTE: development          ← hard boundary — everything below stays local

# ZONE 2 — Local dev overrides (ignored by this script)
DEBUG=True
DB_HOST=localhost

# ZONE 3 — Deployment secrets (pushed individually)
SERVER_HOSTNAME=ssh.admin.com
SERVER_USER=root
SSH_PRIVATE_KEY_PATH=~/.ssh/prod_server
VM_RUNNER_STATUS_PAT=github_pat_xxxx
CF_SERVICE_TOKEN_ID=xxxx.access
CF_SERVICE_TOKEN_SECRET=xxxx
```

The boundary is the literal comment line `# NOTE: development`. Above it is what gets shipped to production. Below it is your local-only stuff.

What the script does with each zone:

| Zone | Pushed how | GitHub secret name |
|------|-----------|---------------------|
| Zone 1 (everything above the boundary) | All lines concatenated, pushed as one bundle | `ENV_BASE` |
| Zone 2 (right after boundary, before deploy keys) | Ignored — your local dev overrides | — |
| Zone 3 (the recognised deploy keys) | Each pushed as its own GitHub secret | `SERVER_HOSTNAME`, `SERVER_USER`, etc. |

Only specific keys in Zone 3 are pushed. The recognised set is:

- `SERVER_HOSTNAME`
- `SERVER_USER`
- `VM_RUNNER_STATUS_PAT`
- `CF_SERVICE_TOKEN_ID`
- `CF_SERVICE_TOKEN_SECRET`
- `SSH_PRIVATE_KEY_PATH` — special: the value is treated as a file path, the file is read, and **its contents** are pushed as `SSH_PRIVATE_KEY` (not the path itself).

Anything else you put in Zone 3 is silently ignored. Add it to the `DEPLOY_KEYS` set in `secrets.py` if you want a new deploy key recognised.

`REPO_OWNER` and `REPO_NAME` must exist in Zone 1. They identify the GitHub repo to push to. The script aborts immediately if either is missing.

---

## Install

### 1. Install the GitHub CLI

```bash
# macOS
brew install gh

# Debian / Ubuntu
sudo apt install gh

# Other systems
# https://github.com/cli/cli#installation
```

### 2. Authenticate

```bash
gh auth login
```

The script needs `gh` to be authenticated with `repo` scope so it can read and write Actions secrets.

### 3. Download the script

```bash
sudo wget https://raw.githubusercontent.com/khensolomon/lethil/master/server/secrets.py -O /usr/local/bin/secrets.py
sudo chmod +x /usr/local/bin/secrets.py
```

Or just keep it inside your project — it doesn't matter where it lives.

### 4. Verify

```bash
cd ~/projects/myordbok
secrets.py --check
```

Should report that `gh` is authenticated, you're inside a git repo, and your `.env` parses cleanly.

---

## Updating

Same command as install — the script is one self-contained file:

```bash
sudo wget https://raw.githubusercontent.com/khensolomon/lethil/master/server/secrets.py -O /usr/local/bin/secrets.py
```

Your `.env` is never touched.

---

## Setting up a new project

If your `.env` doesn't yet have a deployment section, scaffold one:

```bash
cd ~/projects/myordbok
secrets.py --init
```

This appends the `# NOTE: development` boundary and a blank Zone 3 template to your `.env`. Edit the placeholders, then run `--push`.

---

## Commands

The script's default action — running `secrets.py` with no flags — shows an overview of your project: which keys are in Zone 1, which deploy secrets exist, what's on GitHub already. Nothing is pushed. This is the safe "what's the state of things" command.

### `--push`

The main verb. Reads `.env`, builds the Zone 1 bundle, pushes everything to GitHub.

```bash
secrets.py --push                       # push everything
secrets.py --push --only DB_PWD         # push one secret (partial match ok)
secrets.py --push --dry-run             # validate + preview, no actual push
secrets.py --push --force               # push all, skip stale detection
```

Stale detection: by default, if a secret on GitHub is newer than the corresponding line in your local `.env`, the script warns you instead of overwriting. `--force` bypasses this. Use it when you know your local `.env` is the truth and the GitHub side is what needs updating.

`--only` accepts a partial name. `--push --only db` would match `DB_PWD`, `DB_USER`, `DB_NAME`, etc. The script prints what it matched before pushing.

### `--status`

Side-by-side comparison of local `.env` vs GitHub. Marks each secret as **synced**, **stale**, **missing locally**, or **missing on GitHub**.

```bash
secrets.py --status
```

Useful before a push to see what would actually change.

### `--diff`

Shows what changed in your `.env` since the last backup. Backups are created automatically on every `--push`.

```bash
secrets.py --diff
```

If no backup exists yet, the diff is "everything is new."

### `--env-preview`

Prints exactly what would be pushed as `ENV_BASE` — the cleaned Zone 1 bundle, with comments and dev-zone lines stripped.

```bash
secrets.py --env-preview
```

This is what `printf "%s" "${{ secrets.ENV_BASE }}" > .env` reconstructs on the production server. Reading this is the fastest way to confirm your zones are split correctly.

### `--list`

Lists all secret names currently on GitHub for this repo.

```bash
secrets.py --list
```

### `--restore`

Restores `.env` from a previous backup. Interactive — picks the backup from a numbered list.

```bash
secrets.py --restore
```

The current `.env` is itself backed up before being overwritten, so this operation is reversible.

### `--rotate`

Guided SSH key rotation:

1. Generates a new keypair
2. Walks you through adding the public key to the server's `authorized_keys`
3. Tests the new key
4. Updates `SSH_PRIVATE_KEY_PATH` in your `.env`
5. Pushes the new private key as the `SSH_PRIVATE_KEY` GitHub secret
6. Optionally removes the old public key from the server

```bash
secrets.py --rotate
```

Read the prompts carefully — the script tells you exactly what it's about to do at each step and asks for confirmation.

### `--check`

Diagnostic. Validates that `gh` is authenticated, you're in a git repo, the `.env` exists and parses, the boundary line is present, and `REPO_OWNER`/`REPO_NAME` are set. Run this first if anything feels broken.

```bash
secrets.py --check
```

### `--init`

Scaffolds a deployment section in `.env` if one doesn't exist. Appends the `# NOTE: development` boundary and a Zone 3 template with placeholders. Idempotent — won't duplicate if the boundary is already present.

```bash
secrets.py --init
```

---

## Flags

### Global flags

| Flag | Effect |
|------|--------|
| `--env FILE` | Use this `.env` instead of the one in the project root |
| `--repo ORG/REPO` | Override `REPO_OWNER`/`REPO_NAME` detection from the `.env` |
| `-h` / `--help` | Show help |

### Per-command flags

| Flag | Available on | Effect |
|------|--------------|--------|
| `--only KEY` | `--push` | Only push secrets whose name matches (partial match) |
| `--dry-run` | `--push` | Validate and show what would happen, push nothing |
| `--force` | `--push` | Skip stale detection — local always wins |

---

## Backup location

Every successful `--push` creates a timestamped backup of your `.env`:

```
$STORAGE_ROOT/<repo-name>/env/env-YYYY-MM-DD_HH-MM-SS.env
```

`STORAGE_ROOT` is read from Zone 1 of your `.env`. If it's not set, backups go to `~/.deploy/backups/<repo-name>/` instead.

Old backups are pruned automatically — the script keeps the last several and removes anything older.

---

## Typical workflows

### Initial setup of a project

```bash
cd ~/projects/myordbok
secrets.py --check                   # confirm environment is healthy
secrets.py --init                    # scaffold deployment section if missing
$EDITOR .env                         # fill in the Zone 3 placeholders
secrets.py --push --dry-run          # see what would happen
secrets.py --push                    # actually push
```

### Day-to-day: rotating a single value

You changed `DB_PWD` locally and want it on GitHub:

```bash
secrets.py --status                  # confirm DB_PWD shows as 'stale on GitHub'
secrets.py --push --only DB_PWD
```

### Day-to-day: rotating SSH keys

```bash
secrets.py --rotate
```

Walk through the prompts. The new key is pushed and the old one is optionally removed from the server.

### Recovering from a bad edit

You broke your `.env` and want to roll back to the last good version:

```bash
secrets.py --restore
```

Pick the backup from the list. Your current (broken) `.env` is itself backed up first, so nothing is lost.

### Switching between projects

The script auto-detects the project from `cwd`. To operate on a different project's secrets without changing directories:

```bash
secrets.py --env ~/projects/otherproject/.env --status
```

Or override the repo identity:

```bash
secrets.py --repo myorg/otherrepo --status
```

---

## Conventions and assumptions

- **Zone boundary = the literal comment `# NOTE: development`.** No alternate spellings, no flexibility. The script does a string match for that line.
- **Repo identity = `REPO_OWNER/REPO_NAME` from Zone 1.** Both must exist or the script aborts.
- **Recognised deploy keys are hardcoded.** See the `DEPLOY_KEYS` set near the top of `secrets.py` to see/add to the list.
- **`SSH_PRIVATE_KEY_PATH` → `SSH_PRIVATE_KEY`.** The path is for your local convenience; the file's contents become the actual GitHub secret named `SSH_PRIVATE_KEY`.
- **`GITHUB_TOKEN` is never pushed.** It's auto-provided to every Actions workflow by GitHub itself.
- **Backups are always written before any destructive operation.** Push, init, rotate, restore — they all back up first.

---

## Troubleshooting

**`error: gh CLI not authenticated.`**
Run `gh auth login` and follow the browser prompt.

**`error: Not inside a git repository.`**
The script needs to be run from inside a project. `cd` into it first or pass `--env` explicitly.

**`error: REPO_OWNER and REPO_NAME must both be set in Zone 1.`**
Open `.env`, add the two lines above the `# NOTE: development` boundary:
```ini
REPO_OWNER=yourorg
REPO_NAME=yourrepo
```

**`error: zone boundary '# NOTE: development' not found in .env`**
The `.env` is missing the divider. Run `secrets.py --init` to add it (appends below your existing content) or add it manually.

**`warning: SSH_PRIVATE_KEY_PATH points to a file that doesn't exist.`**
The path in your `.env` is wrong, or you're on a different machine than the one with the key. Fix the path or generate a new key with `secrets.py --rotate`.

**`warning: secret on GitHub is newer than local — refusing to overwrite.`**
Stale detection caught a possible regression. Either pull the latest `.env` from your real source of truth, or pass `--force` if you're sure the local version is correct.

**`error: matched no secrets with --only <pattern>`**
The partial match found nothing. Run `secrets.py --status` to see the exact key names available.

---

## Security notes

- The `.env` file should be `chmod 600`. The script warns if it isn't.
- The `.env` should be in `.gitignore`. The script warns if it isn't.
- Backups are written to `STORAGE_ROOT` (or `~/.deploy/backups/`) — make sure that location is also outside any git tree.
- `gh` stores its auth token in your OS keychain (macOS) or in a dotfile under `~/.config/gh/` (Linux). Treat that file the same way you treat `.env`.
- Pushed secrets are encrypted at rest by GitHub. They're decrypted only inside running Actions workflows and are never visible in the GitHub web UI after creation — even to repo admins.
- `SSH_PRIVATE_KEY` deserves the same care as any production credential. Rotate with `secrets.py --rotate` rather than editing by hand.