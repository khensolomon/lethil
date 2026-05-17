# Utilities Automation

## Automate installation

```bash
chmod +x iso/ubuntu.py
chmod +x iso/debian.py
iso/debian --dry-run
iso/ubuntu --dry-run
./ubuntu.sh

# Ubuntu Environment Interactive Setup Script
curl https://raw.githubusercontent.com/khensolomon/auto/make/dev/ubuntu-setup.py | python3 -
```

## Desktop

... [Autoinstall][autoinstall],

## Server

... [R2][r2], [Secrets][secrets], [Setup][setup]

## Framework

... Looking for Node.js [framework]

[autoinstall]: ./iso/README.md
[r2]: ./server/r2.md
[secrets]: ./server/secrets.md
[setup]: ./server/setup.md
[framework]: https://github.com/khensolomon/lethil/tree/framework
