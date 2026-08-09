# Getting started

## 1. VM

```bash
> ~/.ssh/known_hosts
sudo python ~/dev/lethil/me/vm/create.py
```

## 2. Secrets

... [more info](secrets.md)

```bash
cd /app?
python3 ~/dev/lethil/script/secrets.py --push
python3 ~/dev/lethil/script/secrets.py --update
```

## 3. Setup

...[more info](setup.md)

```bash
python3 ~/dev/lethil/server/setup.py --show-command

cd ~/
wget https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py
curl -O https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py

python3 -c "import urllib.request as r,os,sys;u=sys.argv[1];r.urlretrieve(u,os.path.basename(u))" https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py

python3 -c "import sys,urllib.request as r;r.urlretrieve(u:=sys.argv[1],u.split('/')[-1])" https://raw.githubusercontent.com/khensolomon/lethil/master/server/setup.py
```

## 4. rclone config

```bash
rclone copy r2:storage/zaideih/mysql/ /opt/bucket/storage/zaideih/mysql/
rclone copy r2:storage/zaideih/store/ /opt/bucket/storage/zaideih/store/
rclone copy r2:storage/myordbok/mysql/ /opt/bucket/storage/myordbok/mysql/
# see more at rclone.md
```

> For local VM the "rclone config" is not needed, as the "vm/create.py" done linking it.

## Export and Import DB

```bash
python3 /opt/apps/swarm/db.py export zaideih
python3 /opt/apps/swarm/db.py import zaideih
cd zaideih
python3 /opt/apps/swarm/db.py list

cd ~/dev/zaideih
python3 ~/dev/lethil/apps/swarm/db.py list
python3 ~/dev/lethil/apps/swarm/db.py exec ~/dev/zaideih/assets/queries/test.v01.sql
```

## Management command

```bash
cd ~/
python3 ~/dev/lethil/apps/swarm/django.py ~/dev/zaideih healthcheck
cd ~/dev/zaideih
python3 ~/dev/lethil/apps/swarm/django.py healthcheck
```

## Hash

```bash
python3 ~/dev/lethil/script/hash.py
python3 ~/dev/lethil/script/hash.py -s "test"
python3 ~/dev/lethil/script/hash.py -s "test" -t 21
```
