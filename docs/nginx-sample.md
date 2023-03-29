# Nginx configuration

- [Getting started](Readme.md)
- [Nginx](nginx.md)

## default

```sh
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name  _;
    location / {
        # First attempt to serve request as file, then
        # as directory, then fall back to displaying a 404.
        try_files $uri $uri/ =404;
    }
}
```

## example

```sh
upstream example {
    server localhost:8081;
}

server {
    # strip www from URL
    server_name  www.example.com;
    rewrite ^(.*) https://example.com$1 permanent;
}

server {
    # server_name example.com;
    # server_name example.parent.com;
    server_name example.com example.parent.com;
    # server_name example.com www.example.com example.parent.com;

    
    root /var/www/example/static;
    set $common_static "/var/www/html";
    access_log /var/log/nginx/access.example.log;
    location / {
        access_log off;
        autoindex off;
        expires 3d;
        add_header Cache-Control "public";
        try_files $uri @node;
    }
    location @node {
        if (-f $document_root/maintain) {
            return 503;
        }
        proxy_pass http://example;
        # proxy_set_header Host $http_host;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_cache_bypass $http_upgrade;
        # proxy_cache_bypass $http_cache_control;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $http_host;

        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
        proxy_intercept_errors on;
        proxy_connect_timeout 1;
    }
    error_page 503 /maintain.html;
    location = /maintain.html {
        root $common_static;
    }
    error_page 403 404 /notfound.html;
    location = /notfound.html {
        root $common_static;
    }
    error_page 500 501 502 503 504  /under-construction.html;
    location = /under-construction.html {
        root $common_static;
    }
}
