---
title: "Virtual Machine Manager"
description: "QEMU/KVM with a GUI - snapshots, ISO installs, bridged networking."
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
    qemu-kvm libvirt-daemon-system libvirt-clients \
    virtinst virt-manager bridge-utils \
    ovmf libosinfo-bin cpu-checker
```

`ovmf` provides UEFI firmware, which modern server images expect.

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
