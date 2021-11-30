# Getting started

Setting up web server on Linux, [Nginx][nginx], [Node.js][nodejs] & [MySQL][mysql]
using `lethil` framework.

Back to [Readme](/README.md).

- Dependencies
  - Utilities
    - [x] [rsync][rsync]
    - [x] [curl][curl]
    - [ ] [wget][wget]
    - [ ] [ssh][ssh]
    - [ ] [log][log]
    - [ ] [Task][Task]
    - [ ] [Permission][Permission]
  - [x] [Nginx][nginx] Web Server
    - [Configuration][nginx-configuration]
  - [x] Manage [logs][log] with [Python][python]
  - [x] SSL Certificate from [Certbot][certbot] using **letsencrypt**
  - [x] Database using [MySQL][mysql]
  - [x] [Node.js][nodejs] scripting
    - [x] [npm][npm]
    - [x] [pm2][pm2]
  - [ ] Storage: [gcsfuse][gcsfuse]
  - [ ] [gcloud][gcloud]

## Directories

- Make the root directory, skip if Nginx already installed.

```sh
# start with
sudo apt-get update

sudo mkdir /var/www
```

- Update Read/Write [permission][Permission] to directories.

```sh
chown -R $USER:$USER /var/www

# drwxr-xr-x 1 $USER $USER 4096 Nov 27 09:22 www
# drwxr-xr-x 4 $USER $USER 4096 Aug  2  2020 html
# drwxr-xr-x 8 $USER $USER 4096 Nov 30  2020 media
# drwxrwxr-x 8 $USER $USER 4096 May  9  2020 myordbok
# drwxr-xr-x 2 $USER $USER 4096 Dec 16  2019 storage
# drwxr-xr-x 2 $USER $USER 4096 Dec 16  2019 zaideih

ls -l
```

> Structure for directories, storage

```sh
|var/www
└── html
    ├── log.py
    ├── index.html
    ├── maintain.html
    ├── notfound.html
    ├── underconstruction.html
    └── style.css
└── scriptive
    ├── .evn
    ├── serve.js
    ├── static
    ├── README.md
    └── app(?)
        └── default
        └── *
└── storage (link of storage-bucket)
    └── music
        └── m
        └── z
        └── e
        └── f
        └── h
        └── ?
    └── media
        └── fonts
            └── restrict.json
            └── primary.json
            └── secondary.json
            └── external.json
        └── grammar
            └── partsofspeech.json
        └── store
        └── etc
    └── ?
└── media (copy of storage/media/)
    └── fonts
    └── grammar
    └── store
        └── track.json
    └── etc
└── tmp
    └── ?
└── backup
    └── ?
└── one
    └── *
└── two
    └── *
```

## Enviroment

### Development

```sh
npm install nodemon -g
# npm install forever -g
```

### Production

```sh
npm install pm2 -g

# install all production dependencies
npm install --production
```

[rsync]: rsync.md
[curl]: curl.md
[wget]: wget.md
[ssh]: ssh.md
[log]: log.md

[Permission]: Permission.md

[nginx]: nginx.md
[nginx-configuration]: nginx-configuration.md

[python]: python.md

[nodejs]: nodejs.md
[pm2]: pm2.md
[npm]: npm.md
[tmp]: #directories

[certbot]: certbot.md

[mysql]: mysql.md

[gcloud]: gcloud.md
[gcsfuse]: gcsfuse.md
[ssh]: ssh.md

[Task]: Task.md
