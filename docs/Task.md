# Task

- [Getting started](Readme.md)

```sh
sudo apt-get update
python log.py myordbok word scan
python log.py myordbok visit scan
```

## Dictionary

...local

```sh
npm run build
node run export_definition
```

...glossary(definition), grammar and fonts [rsync](rsync.md#media) ...

```sh
# update glossary
rsync -avP /var/www/storage/media/glossary/ /var/www/media/glossary
# backup zero
rsync -avP /var/www/media/glossary/zero.*.csv /var/www/storage/media/glossary

# update grammar
rsync -avP /var/www/storage/media/grammar/ /var/www/media/grammar

# update store
rsync -avP /var/www/storage/media/store/ /var/www/media/store

# backup fonts-JSON
rsync -avP /var/www/media/fonts/*.json /var/www/storage/media/fonts
rsync -avP fonts/*.json test

# backup log
rsync -avP /var/www/media/log/ /var/www/storage/media/log
```

...log word and visit `/var/www/html`

```sh
cd /var/www/html
python log.py myordbok visit
python log.py myordbok word
```

mv zero.*.csv zero-v1.

...`/var/www/myordbok` update repository, PM2 [reload](PM2.md#reload), NGINX [restart](Nginx.md#restart)

```sh
# repository
node update-repository

# reload
pm2 reload MyOrdbok

# restart
sudo systemctl reload nginx
sudo systemctl restart nginx
```

## Music

To update store [rsync](rsync.md#media)...

```sh
2020/03/24 02:54:24 [error] 1713#1713: *421 connect() failed (111: Connection refused) while connecting to upstream, client: 81.166.141.178, ser
ver: www.myordbok.com, request: "GET /api/suggestion?q=lo HTTP/1.1", upstream: "http://[::1]:8082/api/suggestion?q=lo", host: "www.myordbok.com"
, referrer: "https://www.myordbok.com/definition?q=soundest"
