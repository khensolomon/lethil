---
title: "Nginx and Gunicorn"
description: "Serving Django directly from systemd, without containers."
group: "Serving & storage"
category: "Server"
nav_order: 7
tags: [server, nginx, gunicorn, django, systemd]
---

The pre-container setup, kept for hosts that run Django straight on the OS.

## Gunicorn service

One unit per site. `ExecReload` gives zero-downtime reloads.

`/etc/systemd/system/domain-one.service`:

```ini
[Unit]
Description=Gunicorn for domain-one
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/domain-one
ExecStart=/var/www/domain-one/venv/bin/gunicorn \
          --workers 3 \
          --bind unix:/run/domain-one.sock \
          my_app_name.wsgi:application

ExecReload=/bin/kill -s HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

For a second site, copy the file and change the paths and socket name.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now domain-one

sudo systemctl reload domain-one   # apply code changes, no dropped connections

ls /run/*.sock                     # expect domain-one.sock
```

## Nginx site

```bash
sudo nano /etc/nginx/sites-available/myapp
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/

sudo nginx -t                      # always test before restarting
sudo systemctl restart nginx
```

```nginx
server {
    listen 80;
    server_name localhost;

    location /static/ {
        alias /var/www/myproject/static/;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/run/domain-one.sock;
    }
}
```
