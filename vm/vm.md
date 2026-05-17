# ?

```bash
echo "yourpassword" | mkpasswd -m sha-512 -s
```

```bash
# Step 1: Download Ubuntu 25.10 Cloud Image (on your host)
# ubuntu-26.04-server-cloudimg-amd64.img
cd /var/lib/libvirt/images
wget https://cloud-images.ubuntu.com/releases/25.10/release/ubuntu-25.10-server-cloudimg-amd64.img
wget https://cloud-images.ubuntu.com/releases/26.04/release/ubuntu-26.04-server-cloudimg-amd64.img


# Step 2: Create your Golden Template (one time)
# Use this command to create the base VM with cloud-init:
# virt-install \
#   --name ubuntu-26.04-golden \
#   --memory 4096 --vcpus 4 \
#   --disk path=ubuntu-26.04-golden.qcow2,size=30,backing_store=ubuntu-26.04-server-cloudimg-amd64.img,format=qcow2 \
#   --cloud-init user-data=/home/khensolomon/dev/lets/vm/user-data.yaml \
#   --network network=default,model=virtio \
#   --osinfo detect=on,require=off \
#   --graphics none \
#   --console pty,target_type=serial \
#   --import

# virt-install \
#   --name ubuntu-25.10-golden \
#   --memory 4096 --vcpus 2 \
#   --disk path=ubuntu-25.10-golden.qcow2,size=30,backing_store=ubuntu-25.10-server-cloudimg-amd64.img,format=qcow2 \
#   --cloud-init user-data=/home/khensolomon/dev/lets/vm/user-data.yaml \
#   --network network=default,model=virtio \
#   --osinfo detect=on,require=off \
#   --graphics none \
#   --console pty,target_type=serial \
#   --import

sudo ~/dev/lets/vm/create.py

sudo virt-install \
  --name ubuntu-26.04-golden \
  --memory 4096 \
  --vcpus 2 \
  --disk path=ubuntu-26.04-golden.qcow2,size=40,backing_store=/var/lib/libvirt/images/ubuntu-26.04-server-cloudimg-amd64.img,format=qcow2,bus=virtio \
  --filesystem /opt/bucket/storage,bucket_storage,driver.type=virtiofs \
  --filesystem /opt/bucket/media,bucket_media,driver.type=virtiofs \
  --memorybacking source.type=memfd,access.mode=shared \
  --cloud-init user-data=/home/khensolomon/dev/lets/vm/user-data.yaml \
  --network network=default,model=virtio \
  --osinfo detect=on,require=off \
  --graphics none \
  --console pty,target_type=serial \
  --import \
  --noautoconsole

sudo virt-install \
  --name ubuntu-25.10-golden \
  --memory 4096 \
  --vcpus 2 \
  --disk path=ubuntu-25.10-golden.qcow2,size=40,backing_store=/var/lib/libvirt/images/ubuntu-25.10-server-cloudimg-amd64.img,format=qcow2,bus=virtio \
  --filesystem /opt/bucket/storage,bucket_storage,driver.type=virtiofs \
  --filesystem /opt/bucket/media,bucket_media,driver.type=virtiofs \
  --memorybacking source.type=memfd,access.mode=shared \
  --cloud-init user-data=/home/khensolomon/dev/lets/vm/user-data.yaml \
  --network network=default,model=virtio \
  --osinfo detect=on,require=off \
  --graphics none \
  --console pty,target_type=serial \
  --import \
  --noautoconsole
```

Recommended minimal user-data.yaml (create this file)

```yaml
#cloud-config
autoinstall:
  version: 1
users:
  - name: yourusername
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh-authorized-keys:
      - ssh-rsa YOUR_SSH_PUBLIC_KEY_HERE

# Enable password login if you want (optional)
ssh_pwauth: true
chpasswd:
  list: |
    yourusername:yourpassword
  expire: false

package_update: true
package_upgrade: true

# Make sure network works reliably
write_files:
  - path: /etc/netplan/99-custom.yaml
    content: |
      network:
        version: 2
        ethernets:
          en*:
            dhcp4: true
            dhcp-identifier: mac
