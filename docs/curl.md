# curl

- [Getting started](Readme.md)

## Install

```sh
sudo apt update
sudo apt-get install curl
```

## Cli

Check directories [permission](Permission.md).

```sh
chown -R $USER:$USER /var/www
cd /var/www/html
curl -L https://github.com/khensolomon/lethil/archive/refs/heads/html.tar.gz | tar zx --strip-components=1
```

## Params

param | description
--- | ---
-z | Compress archive using gzip program in Linux or Unix
-c | Create archive on Linux
-v | Verbose i.e display progress while creating archive
-f | Archive File name
-x | Extract files to the given archive

## Other

```sh
curl -L https://github.com/owner/zaideih/archive/master.tar.gz | tar zx --strip-components=1
curl -L https://github.com/owner/myordbok/archive/master.tar.gz | tar zx --strip-components=1

tar cvzf download.gz access.myordbok.log.*.gz
