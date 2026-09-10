---
title: "Virtual Machine Manager"
description: "QEMU/KVM with a GUI - snapshots, ISO installs, bridged networking."
group: "Remote & VMs"
category: "Linux"
nav_order: 6
tags: [kvm, qemu, virtualization, vm]
---

Full VM control including snapshots and ISO installs. For a throwaway VM with
no GUI, [[Multipass]] is quicker.

## Install

```bash
sudo apt update
sudo apt install -y \
    qemu-system-x86 libvirt-daemon-system libvirt-clients \
    virtinst virt-manager \
    ovmf libosinfo-bin cpu-checker
```

`qemu-kvm` was a transitional package and no longer exists on Ubuntu 24.04 or
Debian 11 and later — `apt` will say *"Note, selecting 'qemu-system-x86'
instead of 'qemu-kvm'"* at best, and fail outright at worst. Install
`qemu-system-x86` directly.

On a hardware enablement kernel, use the matching HWE build so the userspace
tracks the backported kernel:

```bash
sudo apt install -y qemu-system-x86-hwe
```

To install for whatever architecture the host happens to be, `qemu-system`
pulls in the right `qemu-system-<arch>` without naming x86 explicitly.

`ovmf` provides UEFI firmware, which modern server images expect.

`bridge-utils` is not in the list: it is deprecated, `brctl` is superseded by
`ip link` and `bridge link`, and libvirt does not need it. See
[[Provisioning a host]] for the checks that replace it.

## Check KVM

```bash
kvm-ok      # expect "KVM acceleration can be used"
```

## Groups and services

```bash
sudo systemctl enable --now libvirtd
sudo systemctl enable --now virtlogd

sudo usermod -aG libvirt $USER
sudo adduser $USER kvm
```

Log out and back in — group changes do not apply to the running session.

## Networking

For a VM that needs an address on the LAN, choose network source **Bridge
device** with device name `virbr0`. See [[Static networking]] for pinning the
address.

## Guest additions

```bash
sudo apt install spice-vdagent   # inside the guest, then reboot
```

Gives auto screen resizing, clipboard sharing, and display sync. Resizing does
not work properly without it.
