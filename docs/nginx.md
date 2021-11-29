# Nginx

- [Getting started](Readme.md)
- [Configuration](nginx-configuration.md)
- [shell](nginx.sh.md)
- [log](nginx-log.md)

## Install

```sh
sudo apt update
sudo apt install nginx

# Init (WSL/mini)
sudo add-apt-repository ppa:nginx/stable
sudo apt-get update
sudo apt-get install nginx
sudo service nginx start
```

## Cli

```sh
# start
sudo service nginx start
sudo systemctl start nginx

# restart
sudo service nginx restart
sudo systemctl restart nginx

# reload
sudo systemctl reload nginx

# status
systemctl status nginx
```

## Local(win)

```sh
# test config
sudo nginx -t

## windows
start nginx

## fast shutdown
nginx -s stop

# ... graceful shutdown
nginx -s quit

# ... changing configuration, starting new worker processes
#     with a new configuration,
#     graceful shutdown of old worker processes
nginx -s reload

# ... re-opening log files
nginx -s reopen
```
