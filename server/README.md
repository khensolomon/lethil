# server/

Scripts that run **on a remote server**, not on the operator's machine.

Each script must be independently runnable by hand — passing the right flags on the command line is enough. GitHub Actions workflows dispatch these same scripts with the same flags; the runner doesn't do anything the operator couldn't do at a terminal.

## What's here

| Script | Purpose | Workflow |
| --- | --- | --- |
| `setup.py` | Full server bootstrap — Docker, Swarm, Cloudflare Tunnel, landing nginx, firewall, rclone. Idempotent. | `.github/workflows/server-setup.yml` |

## Show the setup command

`setup.py` takes its secrets as flags. Instead of keeping a hand-written copy of the long invocation (which drifts the moment a token rotates), print it from `../.env`:

```bash
# Run in the repo, not on the server.
python3 server/setup.py --show-command
```

This is the one **read-only** mode: it reads `../.env`, fills the template, prints the full `sudo python3 setup.py ...` command to stdout, and does nothing else — no sudo, no files, no changes. Copy the output and run it on the server.

`../.env` is the single source for the secrets (`CF_*`, `R2_*`). The non-secret config — domain, tunnel name, app domains — is literal in the template, which lives in `setup.py`'s docstring between the `<command>` tags. To extend it: add a `--flag "{ENV_KEY}"` line and add `ENV_KEY` to `../.env`. Placeholders are keyed by `.env` name, so `{R2_ACCESS_SECRET}` fills the `--r2-secret-access-key` value. A missing key fails loudly and names itself.

The output contains live secrets, so it lands in terminal scrollback and (once pasted) shell history — prefix the paste with a space where the shell ignores space-led history.

## Adding a script

1. Drop a new `<task>.py` (or `.sh`) in this directory.
2. Make sure it's runnable by hand: `python3 server/<task>.py --help` should explain what it does.
3. Add a corresponding workflow under `.github/workflows/server-<task>.yml` to dispatch it from GitHub Actions. The workflow's only job is to ship the script + flags to the server and run it.
4. Update the table above.

See `docs/setup.md` for the full guide to provisioning a new server.