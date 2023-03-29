# rsync

- [Getting started](Readme.md)

## Install

```sh
sudo apt update
sudo apt-get install rsync
```

## Cli

more info on mounting `/var/www/storage` please see [Cloud Storage FUSE](gcsfuse.md).

```sh
# copy
$ rsync -avP storage/media/ media
# backup (font-view,download)
$ rsync -avP media storage/media/

# media
# copy all media
rsync -avP /var/www/storage/media/ /var/www/media
# copy just dictionary-definition data 
rsync -avP /var/www/storage/media/glossary/ /var/www/media/glossary
# backup media (fonts hits count, log change)
# rsync -avP /var/www/media/ /var/www/storage/media

# copy just music map
# rsync -avP /var/www/storage/media/store/ /var/www/media/store

# backup log (log change)
rsync -avP /var/www/media/log/ /var/www/storage/media/log
# copy
rsync -avP /var/www/storage/media/log/ /var/www/media/log

# copy (glossary)
rsync -avP /var/www/storage/media/glossary/ /var/www/media/glossary

# backup log (fonts & hits count )
rsync -avP /var/www/media/fonts/ /var/www/storage/media/fonts

# backup log (just hits count )
rsync -avP /var/www/media/fonts/*.json /var/www/storage/media/fonts
```

## Structure

```sh
# Local Sync
rsync {options} {Source} {Destination}

# Remote Sync pull
rsync {options} [User_Name]@[Remote-Host][Source-Files-Dir] {Destination}

# Remote Sync Push
rsync {options} [Source-Files-Dir] [User_Name]@[Remote-Host]:{Destination}
```

## Params

param | name | description
---|---|---
-v | –verbose | Verbose output
-q | –quiet | suppress message output
-a | –archive | archive files and directory while synchronizing ( -a equal to following options -rlptgoD)
-r | –recursive | sync files and directories recursively
-b | –backup | take the backup during synchronization
-u | –update | don’t copy the files from source to destination if destination files are newer
-l | –links | copy symlinks as symlinks during the sync
-n | –dry-run | perform a trial run without synchronization
-e | –rsh=COMMAND | mention the remote shell to use in rsync
-z | –compress | compress file data during the transfer
-h | –human-readable | display the output numbers in a human-readable format
–progress | ? | show the sync progress during transfer

## Other

```sh
rsync -avP /var/path-src?/ /var/path-tar?
