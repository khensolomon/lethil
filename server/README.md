# server/

Scripts that run **on a remote server**, not on the operator's machine.

Each script must be independently runnable by hand — passing the right flags on the command line is enough. GitHub Actions workflows dispatch these same scripts with the same flags; the runner doesn't do anything the operator couldn't do at a terminal.

## What's here

| Script | Purpose | Workflow |
| --- | --- | --- |
| `setup.py` | Full server bootstrap — Docker, Swarm, Cloudflare Tunnel, landing nginx, firewall, rclone. Idempotent. | `.github/workflows/server-setup.yml` |

## Adding a script

1. Drop a new `<task>.py` (or `.sh`) in this directory.
2. Make sure it's runnable by hand: `python3 server/<task>.py --help` should explain what it does.
3. Add a corresponding workflow under `.github/workflows/server-<task>.yml` if you want to dispatch it from GitHub Actions. The workflow's only job is to ship the script + flags to the server and run it.
4. Update the table above.

See `docs/setup.md` for the full guide to provisioning a new server.
