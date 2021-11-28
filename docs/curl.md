# curl

- [Getting started](Readme.md)

## Installation

```sh
sudo apt update
sudo apt-get install curl
```

additional | description
--- | ---
-z | Compress archive using gzip program in Linux or Unix
-c | Create archive on Linux
-v | Verbose i.e display progress while creating archive
-f | Archive File name
-x | Extract files to the given archive

```sh
curl -L https://github.com/scriptive/zaideih/archive/master.tar.gz | tar zx --strip-components=1
curl -L https://github.com/scriptive/myordbok/archive/master.tar.gz | tar zx --strip-components=1

tar cvzf download.gz access.myordbok.log.*.gz

curl -L https://github.com/scriptive/www/archive/master.tar.gz | tar zx --strip-components=1