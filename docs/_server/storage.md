---
title: "Storage and buckets"
description: "virtiofs shares into a VM, and R2 over rclone."
group: "Serving & storage"
category: "Server"
nav_order: 8
tags: [server, storage, backup]
---

Media and database dumps live outside the VM disk so a rebuild does not lose
them.

## Mount points

```bash
sudo mkdir -p /opt/bucket/storage /opt/bucket/media
sudo chown $USER:$USER /opt/bucket/storage /opt/bucket/media
sudo chmod -R 775 /opt/bucket/storage /opt/bucket/media
```

## Sharing a host directory into a VM

In [[Virtual Machine Manager]]: Add Hardware → Filesystem, driver `virtiofs`,
source the host path (`/opt/bucket`), target an arbitrary tag (`buckets`).

```bash
sudo mount -t virtiofs bucket_storage /opt/bucket/storage
sudo mount -t virtiofs bucket_media /opt/bucket/media
```

Persist in the guest's `/etc/fstab` — see [[Managing fstab]]:

```
bucket_storage  /opt/bucket/storage  virtiofs  defaults  0  0
bucket_media    /opt/bucket/media    virtiofs  defaults  0  0
```

## Symbolic links

```bash
ln -s /mnt/keep/storage /opt/bucket/storage
ln -s /storage/media /opt/bucket/media
```

## rclone and R2

```bash
sudo apt install -y unzip
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

`~/.config/rclone/rclone.conf`:

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <ACCESS_KEY_ID>
secret_access_key = <SECRET_ACCESS_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
region = auto
acl = private
```

This file holds live credentials in plain text. `chmod 600` it, and keep it out
of any synced or committed directory.

```bash
rclone copy r2:storage/zaideih/mysql/ /opt/bucket/storage/zaideih/mysql/
rclone copy r2:storage/zaideih/store/ /opt/bucket/storage/zaideih/store/
rclone copy r2:storage/myordbok/mysql/ /opt/bucket/storage/myordbok/mysql/
```
