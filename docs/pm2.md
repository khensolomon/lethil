# pm2

- [Getting started](Readme.md)
  
Install globally

```sh
sudo npm install -g pm2
```

...?

```sh
pm2 startup                   # Detect init system, generate and configure pm2 boot on startup
pm2 save                      # Save current process list
pm2 resurrect                 # Restore previously saved processes
pm2 unstartup                 # Disable and remove startup system
# pm2 unstartup systemd
```

... list

```sh
pm2 list

# if ecosystem.config.js is commonjs
pm2 start
# if ecosystem.json exist 
pm2 start ecosystem.json
```

... reload

```properties
pm2 reload appName/appId
```

```sh
# enable PM2 to start at system boot
pm2 startup
pm2 save
pm2 update

# disable PM2 to start at system boot
pm2 unstartup systemd


# Setup
pm2 deploy ecosystem.json production setup
# Update
pm2 deploy ecosystem.json production
```

Please make sure you have the correct access rights and the repository exists.

```sh
# on production server generate ssh-key and add the ssh-key to github->settings->deploy keys
ssh-keygen -t ed25519
# then  clone init, lets say /var/www
# cd /var/www

git clone git@github.com:<user>/<project>.git <directory>

```
