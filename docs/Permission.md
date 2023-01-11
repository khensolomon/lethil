# Permission

- [Getting started](Readme.md)
  
... Directory

```sh
chown -R www-data:www-data /var/path-?
chown -R www-data:$USER /var/path-?
chown -R $USER:www-data *.log

# or
chown -R $(whoami) /var/path-?
```

```sh
sudo chown $(whoami) /etc/letsencrypt/live/ -R
sudo chown $(whoami) /etc/letsencrypt/archive/ -R

# change to executable
chmod +x update-html.sh
```

## Object read, wirte and execute

param | Name
---|---
r | read
w | write
x | execute
\- | remove
\+ | add

> **r**: read, **w**: write, and **x**: execute

```sh
# add permissions
chmod +rwx filename

# remove permissions
chmod -rwx directoryname

# executable permissions
chmod +x filename

# take out write and executable permissions
chmod -wx filename
