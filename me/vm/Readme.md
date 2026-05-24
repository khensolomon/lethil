# Ubuntu Cloud VM Manager

A small Python helper for building **golden** Ubuntu cloud VMs with
libvirt/KVM and cloning fresh VMs from them on demand.

## What it does

1. Takes an Ubuntu cloud image (e.g. `ubuntu-26.04-server-cloudimg-amd64.img`
   or `ubuntu-25.10-server-cloudimg-amd64.img`) and a cloud-init `user-data.yaml`.
2. Builds a **golden image** — a fully provisioned, reusable template VM.
3. Clones lightweight VMs from that golden image on demand.

## Requirements

- Linux host with KVM + libvirt
- `virt-install`, `virt-clone`, `virsh` (Debian/Ubuntu:
  `sudo apt install libvirt-clients libvirt-daemon-system virtinst qemu-kvm`)
- An Ubuntu cloud image in `/var/lib/libvirt/images/`
  (download: <https://cloud-images.ubuntu.com/>)
- A `user-data.yaml` (path is set near the top of `create.py`)
- An SSH **public** key to inject into the golden image
  (default `~/.ssh/prod_server.pub`; override with `--ssh-key` or `$VM_SSH_KEY`)

## Install

```bash
chmod +x create.py
```

## Quick start

```bash
# Create / refresh the golden image — fully interactive
sudo python create.py
sudo python ~/dev/lethil/me/vm/create.py

# Same, but accept all defaults without prompting
sudo python create.py --yes

# Clone a new VM — interactive
sudo python create.py --clone

# Clone with a specific name + custom resources
sudo python create.py --clone vm1 --memory 4096 --vcpus 2 --disk 20
sudo python create.py --clone my-vm-01 --source ubuntu-25.10-golden --memory 4096 --vcpus 2 --disk 20

sudo apt update && sudo apt upgrade -y

sudo python create.py --clone ubuntu-26.04 --source ubuntu-26.04-golden --memory 2048 --vcpus 2 --disk 20
sudo python create.py --clone ubuntu-25.10 --source ubuntu-25.10-golden --memory 2048 --vcpus 2 --disk 20
```

## SSH key & password authentication

When building the golden image, `create.py` reads `user-data.yaml`, applies
two substitutions **in memory**, and feeds a temporary patched copy to
`virt-install`. **`user-data.yaml` on disk is never modified.** The temp
file is deleted after the build (its path is printed while building).

The two substitutions:

1. **SSH public key** — the `YOUR_SSH_PUBLIC_KEY_HERE` placeholder in
   `user-data.yaml` is replaced with the contents of the public key
   (default `~/.ssh/prod_server.pub`). The script validates the file looks
   like a public key and refuses anything that looks like a private key.
2. **`ssh_pwauth`** — flipped to `true`/`false` based on the chosen value. This
   only controls whether `sshd` accepts passwords over the network; the
   account's `hashed_passwd` and `lock_passwd` are left **untouched**, so
   the password still works on the serial console as a break-glass fallback.
3. **`hostname` / `fqdn`** — the golden build prompts for a hostname
   (default read from `user-data.yaml`). The fqdn is **auto-derived** as
   `<hostname>.<suffix>`, reusing the domain suffix already present in the
   template's `fqdn` (e.g. `vm.local` → suffix `local`, so hostname `web01`
   yields fqdn `web01.local`). There is no separate fqdn prompt. Override
   the hostname non-interactively with `--hostname NAME`.

Interactive runs prompt `Enable SSH password authentication? [y/N]`
(defaults to **No** = key-only). Override non-interactively with flags:

```bash
# Key-only SSH (the default), explicit key path — ideal for unattended /
# robotic deploys via GitHub workflow + Cloudflare tunnel:
sudo python create.py --yes --no-ssh-pwauth --ssh-key ~/.ssh/prod_server.pub

# Or via env var:
sudo VM_SSH_KEY=~/.ssh/prod_server.pub python create.py --yes

# Keep password auth enabled if desired:
sudo python create.py --yes --ssh-pwauth
```

> **Note:** these features apply to **golden image creation only**. Clones
> inherit whatever was baked into the golden.

## All commands

| Command | What it does |
| --- | --- |
| `./create.py` | Build the golden image (interactive prompts for name, memory, vCPUs, disk) |
| `./create.py --yes` | Same, non-interactive — accept defaults |
| `./create.py --image ubuntu-25.10-server-cloudimg-amd64.img` | Use a specific base image |
| `./create.py --list-images` | List available base cloud images |
| `./create.py --list-vms` | List existing libvirt domains |
| `./create.py --clone [NAME]` | Clone a new VM from the golden image |
| `./create.py --delete NAME` | Delete a VM (and its disks) |

### Flags

| Flag | Meaning |
| --- | --- |
| `--image / -i` | Base image filename (in `IMAGE_DIR`) or full path |
| `--name / -n` | Golden image name, or new VM name when cloning |
| `--source` | Which golden domain to clone from (auto-detected by default) |
| `--memory / -m` | Memory in MB |
| `--vcpus / -v` | Number of vCPUs |
| `--disk / -d` | Disk size in GB |
| `--user-data / -u` | Path to cloud-init `user-data.yaml` (overrides `$VM_USER_DATA`) |
| `--ssh-key` | Path to the SSH **public** key to inject (overrides `$VM_SSH_KEY`; default `~/.ssh/prod_server.pub`) |
| `--hostname` | Hostname for the golden image (default from `user-data.yaml`); fqdn auto-derived as `<hostname>.<suffix>` |
| `--ssh-pwauth` | Enable SSH password authentication in the golden image |
| `--no-ssh-pwauth` | Disable SSH password authentication — key-only (the default) |
| `--yes / -y` | Non-interactive: accept all defaults, skip confirmations |

## Defaults

Configurable at the top of `create.py`:

| Setting | Golden image | Clone |
| --- | --- | --- |
| Memory | 8192 MB | 4096 MB |
| vCPUs | 6 | 2 |
| Disk | 40 GB | 20 GB |
| SSH key | `~/.ssh/prod_server.pub` | (inherited from golden) |
| SSH password auth | disabled (key-only) | (inherited from golden) |

The golden image name is derived from the base image — e.g.
`ubuntu-26.04-server-cloudimg-amd64.img` → `ubuntu-26.04-golden`.
This allows multiple golden images side-by-side (one per Ubuntu
release) without name collisions.

## After cloning

```bash
virsh start my-vm-01           # power it on
virsh console my-vm-01         # serial console
virsh domifaddr my-vm-01       # find its IP
```

## What's improved vs. the original

- **Multiple base images supported** — auto-detects available cloud images
  in `IMAGE_DIR`, or pick one with `--image`. Golden image name is derived
  from the chosen base so different Ubuntu versions don't collide.
- **Interactive prompts with defaults** — for name, memory, vCPUs, disk
  on both golden creation and cloning. `--yes` skips prompts entirely.
- **CLI flags** for every prompted value, so it scripts cleanly.
- **Safety checks** — validates VM names, checks if a domain already
  exists before overwriting, confirms destructive actions.
- **Dependency checks** — bails out early with a useful message if
  `virt-install` / `virsh` etc. are missing.
- **Helper actions** — `--list-images`, `--list-vms`, `--delete`.
- **Clone resources are tunable** — `virt-clone` copies the source specs,
  but the script then runs `virsh setmaxmem` / `setvcpus` so clones can
  be smaller than the golden.
- **SSH key injection + password-auth toggle** — injects the public key
  over the placeholder and flips `ssh_pwauth` at build time, all via a
  temporary patched copy so `user-data.yaml` on disk is never modified.
  `hashed_passwd` is preserved for break-glass console access.
- **Hostname prompt with auto-derived fqdn** — prompts for a hostname
  (default from `user-data.yaml`) and derives `<hostname>.<suffix>` for the
  fqdn, reusing the suffix already in the template. Also patched in the
  temporary copy only.
- **Better output** — colored, clearly sectioned, and shows every libvirt
  command it runs (handy for learning + debugging).
- **Full docstrings and inline comments** explaining the why, not just the what.