# Log

- [Getting started](Readme.md)

## Visit

> app.visit.csv

...records

format: `ip requests`

> app.visit.log

...production

format: `datetime visits requests totalvisits totalrequests`

## Word

> app.word.csv

...records

format: `word count`

> app.word.log

...production

format: `datetime wordCount`

## Cli

```sh
cd /var/www/html
# python log.py myordbok
python log.py myordbok visit scan
python log.py myordbok word scan
python log.py zaideih visit scan

python log.py myordbok word sortedToJSON

# Backup
rsync -avP /var/www/media/log/ /var/www/storage/media/log
```

## Other

```sh
1577105824 1 10
3 368564

sed -e 's/\s\+/,/g' myordbok.ip.log > myordbok.visit.csv
sed -e 's/\s\+/,/g' zaideih.ip.log > zaideih.visit.csv

myordbok:visit
0.0.0.0,889993835920279
::1,889993835920279

zaideih:visit
1576839650850,993835240704

https://linuxconfig.org/how-to-change-default-python-version-on-debian-9-stretch-linux
update-alternatives --install /usr/bin/python python /usr/bin/python3.7 2
