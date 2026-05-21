# me/

Scripts that run **on the operator's machine** — your laptop, your workstation. Not the server.

These act on your local environment: creating VMs, building ISOs, helping with local dev. They're never dispatched by GitHub Actions because they need access to your local resources (libvirt, hypervisor, USB drives, etc.).

## What's here

Empty for now. Planned:

- `create-vm.py` — create a local libvirt VM for testing
- `build-iso.py` — build a custom Ubuntu/Debian ISO with cloud-init defaults

## Adding a script

1. Drop it in this directory.
2. Make sure it's self-documenting: `python3 me/<script>.py --help`.
3. List it above.

No workflows. No automation. Run by hand when you need to.

## Why no workflows?

GitHub Actions runners are remote machines. They can't reach your local libvirt socket, your local hypervisor, or your local USB drives. Scripts in `me/` are the operator's responsibility — keep them in the repo for consistency, but don't try to wrap them in CI.
