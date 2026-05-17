# Ubuntu Cloud VM Manager

A small Python helper for building **golden** Ubuntu cloud VMs with
libvirt/KVM and cloning fresh VMs from them on demand.

## What it does

1. Takes an Ubuntu cloud image (e.g. `ubuntu-26.04-server-cloudimg-amd64.img`
   or `ubuntu-25.10-server-cloudimg-amd64.img`) and a cloud-init `user-data.yaml`.
2. Builds a **golden image** — a fully provisioned, reusable template VM.
3. Clones lightweight VMs from that golden image whenever you need one.

## Requirements

- Linux host with KVM + libvirt
- `virt-install`, `virt-clone`, `virsh` (Debian/Ubuntu:
  `sudo apt install libvirt-clients libvirt-daemon-system virtinst qemu-kvw`)
- An Ubuntu cloud image in `/var/lib/libvirt/images/`
  (download: <https://cloud-images.ubuntu.com/>)
- A `user-data.yaml` (path is set near the top of `create.py`)

## Install

```bash
chmod +x create.py
```

## Quick start

```bash
# Create / refresh the golden image — fully interactive
sudo python create.py

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
| `--yes / -y` | Non-interactive: accept all defaults, skip confirmations |

## Defaults

Configurable at the top of `create.py`:

| Setting | Golden image | Clone |
| --- | --- | --- |
| Memory | 8192 MB | 4096 MB |
| vCPUs | 6 | 2 |
| Disk | 40 GB | 20 GB |

The golden image name is derived from the base image — e.g.
`ubuntu-26.04-server-cloudimg-amd64.img` → `ubuntu-26.04-golden`.
This lets you keep multiple golden images side-by-side (one per Ubuntu
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
- **Better output** — colored, clearly sectioned, and shows every libvirt
  command it runs (handy for learning + debugging).
- **Full docstrings and inline comments** explaining the why, not just the what.
