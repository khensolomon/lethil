# webhook

installing, if not successed, try updating `sudo apt update`

```sh
# sudo apt install webhook
# back to home
cd ~/
mkdir webhook
cd webhook
# create 2 files
touch update-html.sh hooks.json
```

The `update-?.sh` must be executable

```sh
chmod +x update-html.sh
```

`update-html.sh`

```sh
#!/bin/bash
# if you prefer -> /bin/sh

# 1. Fetch the latest origin from [master/main/branch-name]
git pull -f origin html

# 2. Install dependencies
# npm install
# (Optional) Build step that compiles code, bundles assets, etc.
# npm run build

# 3. restart the application
# with pm reload is ok
# pm2 reload html
# or restart
# pm2 restrt html
# if you are configuration 1st time
# pm2 save
```

start listening webhook config

```sh
# webhook -hooks hooks.json -hotreload -verbose -http-methods post
webhook -hooks /etc/webhook.conf -hotreload -verbose -ip 127.0.0.1
```

Webhook reverse proxy `/etc/nginx/sites-available/default`

```sh
server {
  ...
  location /hooks/ {
    proxy_pass http://127.0.0.1:9000/hooks/;
  }
  ...
}
```

`hooks.json` or `/etc/webhook.conf` holds all the configurations

```json
[
  {
    "id": "update-html",
    "execute-command": "/var/www/html/webhook.sh",
    "command-working-directory": "/var/www/html",
    "response-message":"Updated html...",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "hello-world",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/html",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  },
  {
    "id": "update-myordbok",
    "execute-command": "/var/www/myordbok/webhook.sh",
    "command-working-directory": "/var/www/myordbok",
    "response-message":"Updated myordbok...",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "mysupersecret",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/master",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  },
  {
    "id": "update-zaideih",
    "execute-command": "/var/www/zaideih/webhook.sh",
    "command-working-directory": "/var/www/zaideih",
    "response-message":"Updated zaideih...",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "mysupersecret",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/master",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
```

Do the webhook thing in background as a service

```sh
sudo nano /lib/systemd/system/webhook.service
# this file should have -rw-r–-r–- which is (644), if not apply with the following
# sudo chmod 0644 webhook.service
```

`webhook.service`

```sh
[Unit]
Description= Github webhook
Documentation=https://github.com/adnanh/webhook
ConditionPathExists=/etc/webhook.conf
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=khensolomon
Restart=on-failure
RestartSec=5
ExecStart=/usr/local/bin/webhook -verbose -hotreload -hooks /etc/webhook.conf -port 9000 -ip "127.0.0.1"
# ExecStart=/usr/local/bin/webhook -verbose -hotreload -hooks /home/khensolomon/webhook/hooks.json -port 9000 -ip "127.0.0.1" -http-mothods post
# ExecStart=/usr/bin/webhook -verbose -hotreload -hooks /etc/webhook.conf -port 9000 -ip "127.0.0.1" -http-mothods post
# ExecStart=/usr/bin/webhook -nopanic -hooks /etc/webhook.conf -ip "127.0.0.1"
# ExecStart=/usr/bin/webhook -nopanic -hooks /etc/webhook.conf -ip "127.0.0.1"
# ExecStart=/usr/bin/webhook -nopanic -hooks /etc/webhook.conf

[Install]
WantedBy=multi-user.target
```

now

```sh
# check status
sudo systemctl status webhook.service
# start
sudo systemctl start webhook.service
# enable
sudo systemctl enable webhook.service
# stop
sudo systemctl stop webhook.service
```

Updating webhook new version

```sh
cd ~/
# download
curl -L https://github.com/adnanh/webhook/releases/download/2.8.0/webhook-linux-amd64.tar.gz > webhook-linux-amd64.tar.gz
# extract
tar -xvf webhook-linux-amd64.tar.gz
# then move to user bins
sudo mv webhook-linux-amd64/webhook /usr/local/bin/
# sudo mv webhook-linux-amd64/webhook /usr/bin/

# check you have to right version
webhook --version
```
