# script/

Helper scripts run on the operator's machine — manually, by hand. They act on
the repo and on GitHub, never on a production server (that is `server/`).

## What's here

| Script | Purpose |
|---|---|
| `secrets.py` | Read the repo-root `.env`, push secrets to GitHub Actions Secrets via the GitHub CLI (`gh`). Git-root aware: run it from anywhere inside the repo. |

## secrets.py — the .env zone model

The `.env` is divided into three zones by marker lines of the form `#@ <mode>`:

| Zone | Marker | Behaviour |
|---|---|---|
| Bundle | (content before the first marker) | Concatenated, pushed as one secret `ENV_BASE` |
| Individual | `#@ individual` | Each key pushed as its own secret. `SSH_PRIVATE_KEY_PATH` is special: the file it points to is read and its CONTENTS pushed as `SSH_PRIVATE_KEY` |
| Local | `#@ local` | Never pushed. Read by the script only (`REPO_OWNER`, `REPO_NAME`) |

Markers must appear in order (bundle → individual → local); any may be absent.
An unrecognised mode after `#@` is a fatal error (catches typos in real
markers). Comments and blank lines are stripped; empty values are skipped.

The set of individual-zone keys is not hardcoded — whatever is in the zone is
pushed. Adding a key to `.env` needs no change to the script. This is what
lets one `secrets.py` serve both lethil and the Django app repos: an app's
`.env` has bundle content (its production config → `ENV_BASE`) plus individual
keys; lethil's `.env` has no bundle, only individual keys.

## Common commands

```bash
python3 script/secrets.py            # overview — safe, nothing pushed
python3 script/secrets.py --check    # verify gh, git, .env structure
python3 script/secrets.py --push     # push all secrets
python3 script/secrets.py --push --dry-run   # validate + preview
python3 script/secrets.py --status   # local .env vs GitHub
python3 script/secrets.py --list     # secret names on GitHub
python3 script/secrets.py --init     # ensure the zone markers exist
```

`gh` (the GitHub CLI) must be installed and authenticated (`gh auth login`).
