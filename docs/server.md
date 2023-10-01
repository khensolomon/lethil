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
```

## Package

[ ] Nginx
[ ] Python
[ ] MySQL
[ ] Node.js
[ ] pm2
