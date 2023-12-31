# Server

## Clear RAM memory Cache

```sh
# Clear PageCache only
sudo sh -c 'echo 1 >  /proc/sys/vm/drop_caches'
sudo sync && echo 1 > /proc/sys/vm/drop_caches

# Clear dentries and inodes
sudo sh -c 'echo 2 >  /proc/sys/vm/drop_caches' 

# Clear PageCache, dentries and inodes
sudo sh -c 'echo 3 >  /proc/sys/vm/drop_caches'  
echo " echo 3 >  /proc/sys/vm/drop_caches"

# Check
free -h
```

## Disk

```sh
# disk
sudo df -h

# directory
du -h | sort -h
ls -lh

# Clean
du -sh /var/cache/apt/archives
sudo apt-get clean

# remove old kernels
sudo apt-get autoremove --purge


# sudo truncate --size 0 /var/log/nginx/access.log
```

## sharing

```sh
sudo gpasswd --add <username> sambashare
sudo smbpasswd -a <username>

# Restart
sudo service smbd restart

# Install
sudo apt install samba
```

## Package

[ ] Nginx
[ ] Python
[ ] MySQL
[ ] Node.js
[ ] pm2
