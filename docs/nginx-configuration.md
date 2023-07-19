# Nginx configuration

- [Getting started](Readme.md)
- [Nginx](nginx.md)
- [sample](nginx.sample.md)

## clean

```sh
# copy default config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/myordbok

# modify
sudo nano /etc/nginx/sites-available/myordbok
sudo nano /etc/nginx/sites-available/zaideih

# enable by linking
sudo ln -s /etc/nginx/sites-available/myordbok /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/zaideih /etc/nginx/sites-enabled/
```

## default

```sh
server {
    listen       80 default_server;
    # listen       [::]:80;
    server_name  _;
    # return 301 $scheme://$host$request_uri;

    # server_name   ~^(www\.)?(?<domain>.+)$;
    # server_name   ~^(www\.)?(?P<domain>\w+);
    # server_name   ~^(?<subdomain>\.)?(?P<domain>\w+);
    # root C:/server/$domain/static;
    # set $common_static "C:/server/www";
    set $common_static "/var/www/html";
    root $common_static;

    index index.html;

    location / {
        # First attempt to serve request as file, then
        # as directory, then fall back to displaying a 404.
        # try_files $uri $uri/ =404;
        
        # try_files $uri @node;
        # try_files index.html $uri/ @node;

        # First attempt to serve request as file, then
        # check index, then fall back to displaying a 404.
        try_files $uri $uri/index.html =404;
    }
    location /hooks/ {
        proxy_pass http://127.0.0.1:9000/hooks/;
    }
    error_page 403 404 /notfound.html;
        location = /notfound.html {
    }
    error_page   500 501 502 503 504  /maintain.html;
        location = /maintain.html {
    }
    
    # deny access to .htaccess files, if Apache's document root
    # concurs with nginx's one
    
    # location ~ /\.ht {
    #     deny all;
    # }
}
```

## var/www/example

```sh
upstream example {
    server localhost:8081;
}
server {
    listen 80;
    server_name example.*;
    return 301 $scheme://www.$host$request_uri;
}
server {
    if ($host = www.example.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot
    if ($host = example.com) {
        return 301 https://www.$host$request_uri;
    } # managed by Certbot
    listen 80;
    server_name example.com www.example.com;
    return 404; # managed by Certbot
}
server {
    listen 80;
    server_name example.zotune.* example.* www.example.*;
    root C:/server/example/static;
    set $common_static "C:/server/www";
    # root /var/www/example/static;
    # set $common_static "/var/www/html";

    access_log /var/log/nginx/access.example.log;
    access_log /var/log/nginx/access.myordbok.log;
    access_log /var/log/nginx/access.zaideih.log;

    location / {
        try_files $uri @node;
        access_log off;
        autoindex off;
        add_header Cache-Control "public";
    }
    location @node {
        if (-f $document_root/maintain) {
            return 503;
        }
        # proxy_pass http://localhost:8081;
        proxy_pass http://example;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
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
    error_page   500 501 502 503 504  /under-construction.html;
    location = /under-construction.html {
      root $common_static;
    }
}
```

`/etc/nginx/sites-available/myordbok`

```sh
upstream myordbok {
    server localhost:8082;
}

server {
    listen 80;
    server_name myordbok.lethil.me;
    return 307 https://myordbok.com$request_uri;
}

server {
    server_name  www.myordbok.com;
    listen 80;
    return 301 https://myordbok.com$request_uri;
}

server {
    # server_name myordbok.com;
    # server_name myordbok.lethil.me;
    server_name myordbok.com myordbok.lethil.me;
    # server_name myordbok.com www.myordbok.com myordbok.lethil.me;
    root /var/www/myordbok/static;
    set $common_static "/var/www/html";
    access_log /var/log/nginx/access.myordbok.log;
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
        proxy_pass http://myordbok;
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
    error_page   500 501 502 503 504  /under-construction.html;
    location = /under-construction.html {
        root $common_static;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/myordbok/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/myordbok/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

```

```sh
upstream zaideih {
    server localhost:8081;
}

server {
    listen 80;
    server_name zaideih.lethil.me;
    return 307 https://zaideih.com$request_uri;
}

server {
    server_name  www.zaideih.com;
    listen 80;
    return 301 https://zaideih.com$request_uri;
}

server {
    # server_name www.zaideih.com;
    # server_name zaideih.zotune.* zaideih.* www.zaideih.*;
    # server_name zaideih.com www.zaideih.com zaideih.lethil.me
    server_name zaideih.com zaideih.lethil.me;
    root /var/www/zaideih/static;
    set $common_static "/var/www/html";
    access_log /var/log/nginx/access.zaideih.log;
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
        proxy_pass http://zaideih;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
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
    error_page   500 501 502 503 504  /under-construction.html;
    location = /under-construction.html {
        root $common_static;
    }
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/zaideih/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/zaideih/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# server {
#     if ($host = www.zaideih.com) {
#         return 301 https://$host$request_uri;
#     } # managed by Certbot
#     if ($host = zaideih.com) {
#         return 301 https://www.$host$request_uri;
#     } # managed by Certbot
#     listen 80;
#     server_name zaideih.com www.zaideih.com;
#     return 404; # managed by Certbot
# }

```
