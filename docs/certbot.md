# Certbot

- [Getting started](Readme.md)
- [Nginx](nginx.md)
  - [configuration](nginx-configuration.md)

Installation

```sh
# sudo apt install certbot python3-certbot-nginx

# Install snapd
sudo apt update
sudo apt install snapd
# install the core snap in order to get the latest snapd.
sudo snap install core
sudo snap refresh core

# Install Certbot
sudo snap install --classic certbot
# Prepare the Certbot command
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

Option

```sh
# sudo certbot --nginx --cert-name lethil -d lethil.com -d *.lethil.me
sudo certbot --nginx --cert-name lethil -d lethil.me -d www.lethil.me -d myordbok.lethil.me -d zaideih.lethil.me
sudo certbot --nginx --cert-name myordbok -d myordbok.com -d www.myordbok.com
sudo certbot --nginx --cert-name zaideih -d zaideih.com -d www.zaideih.com
