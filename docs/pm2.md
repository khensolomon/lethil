# pm2

- [Getting started](Readme.md)
  
Install globally

```sh
sudo npm install -g pm2
```

... list

```sh
pm2 list

# if ecosystem.config.js is commonjs
pm2 start
# if pm2.json exist 
pm2 start pm2.json
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
```
