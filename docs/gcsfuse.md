# Cloud Storage FUSE

- [Getting started](Readme.md)

Mount with read/write permission using *service account keys*.

...get it from  **IAM & Admin** -> **Service accounts**.

> gsaks: **google service account keys**
>
> help: <https://github.com/GoogleCloudPlatform/gcsfuse/blob/master/docs/installing.md>

## Install

```sh
export GCSFUSE_REPO=gcsfuse-`lsb_release -c -s`
echo "deb http://packages.cloud.google.com/apt $GCSFUSE_REPO main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -

sudo apt-get update
sudo apt-get install gcsfuse
```

## Credentials

```sh
nano /etc/profile
# nano ~/.profile
export GOOGLE_APPLICATION_CREDENTIALS="/var/www/media/gsaks.json"
echo $GOOGLE_APPLICATION_CREDENTIALS

# cmd
echo %GOOGLE_APPLICATION_CREDENTIALS%
```

## Cli

```sh
gcsfuse -o rw,allow_other --key-file=/home/<username>/gsaks.json bucket /path/to

gcsfuse -o rw,allow_other --key-file=/home/<username>/gsaks.p12 bucket /path/to

gcsfuse bucket storage/

fusermount -u /path/to

gcsfuse -o rw,allow_other --key-file=/home/<username>/gsaks.json storage.lethil.me /var/www/storage

# Umount
fusermount -u /var/www/storage

cd /var/www
mkdir storage
mkdir media
# mount
gcsfuse -o rw --key-file=~/gsaks.json storage.lethil.me /var/www/storage
# copy assets
cp -r storage/media/. media/
cp -r /var/www/storage/media/glossary/. /var/www/media/glossary
