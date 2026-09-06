---
title: "Multipass"
description: "Disposable Ubuntu VMs for testing production deploys locally."
category: "Linux"
nav_order: 7
tags: [multipass, vm, testing, ci]
---

Faster to stand up than [[Virtual Machine Manager]] when the VM is throwaway.

```bash
sudo snap install multipass
multipass launch --name production-test --cpus 1 --memory 1G --disk 10G
multipass shell production-test
```

## Prepare it like a server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv nginx git -y

sudo mkdir -p /var/www/myproject
sudo chown $USER:$USER /var/www/myproject
cd /var/www/myproject && python3 -m venv venv
```

## Let a workflow deploy into it

Generate a dedicated key on the host, not inside the VM:

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_deploy_key

multipass transfer ~/.ssh/github_deploy_key.pub production-test:/home/ubuntu/
multipass exec production-test -- bash -c "cat ~/github_deploy_key.pub >> ~/.ssh/authorized_keys"

multipass info production-test    # the IP goes in the SERVER_IP secret
```

The private half goes into the `SSH_PRIVATE_KEY` repository secret.

## Test a workflow without pushing

```bash
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

act push -s SSH_PRIVATE_KEY="$(cat ~/.ssh/github_deploy_key)" \
         -s SERVER_IP="<VM_IP>" \
         -s SERVER_USER="ubuntu"
```

Serving the app from the VM is covered in [[Nginx and Gunicorn]].
