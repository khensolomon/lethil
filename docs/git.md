# git

```sh
# install
sudo apt install git
```

Deploy keys

```sh
# generate
ssh-keygen -t ed25519
cat ~/.ssh/id_ed25519.pub

# then copy the .pub content to github Deploy keys
cd /var/www
git clone git@github.com:khensolomon/myordbok.git myordbok
# clone a branch
# git clone --branch html git@github.com:khensolomon/lethil.git html
cd myordbok
npm install

# now start creating .env
