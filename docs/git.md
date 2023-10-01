# git

```sh
# install
sudo apt install git
```

Check status

```sh
# restore all files in the current directory
git restore .
# list of changed files
git show --name-only
```

Make it executable

```sh
chmod u+x <filename>
git update-index --chmod=+x <filename>
git add --chmod=+x <filename>
git commit -am "<filename> is executable."
git push
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
# git clone --branch html https://github.com/khensolomon/lethil.git html
cd myordbok
npm install

# now start creating .env


# git clone https://myrepo.com/git.git temp
# git clone https://github.com/scriptive/www.git temp

# git clone --bare https://github.com/scriptive/www.git

# git pull origin master
# git fetch origin master
