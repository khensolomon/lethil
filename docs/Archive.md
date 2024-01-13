# Archive

- [Getting started](Readme.md)

## curl

```sh
# download
curl https://github.com/rep/name/archive/master.tar.gz -output master.tar.gz

# download & extract
curl -L https://github.com/rep/name/archive/master.tar.gz | tar zx

# download, extract then strip
curl -L https://github.com/rep/name/archive/master.tar.gz | tar zx --strip-components=1
```

## wget

```sh
# download
wget https://github.com/rep/name/archive/master.tar.gz
# extract
tar xf master.tar.gz --strip-components=1
```

## Install

```sh
# curl
sudo apt-get install curl software-properties-common

# wget
sudo apt-get install wget
```

## Each Archive (use in bible)

```shell
# Compress multiple folders, each into its own zip archive
for i in */; do tar -czvf "${i%/}.tar.gz" "$i"; done

# Compress multiple files, each into its own zip archive
for i in *; do tar -czf $i.tar.gz $i; done
# Or provide extension eg. .json instead of every files
for i in *.json; do tar -czf $i.tar.gz $i; done

  # Single folder compress
  tar -czvf 1.tar.gz 1
  # Change output directory
  tar -czvf output/1.tar.gz 1 

# Decompress each zip archive, into its own folder
for i in *.tar.gz; do tar -xvf "$i"; done
  # or
for i in *.tar.gz; do tar xf "$i"; done

  # Single archive decompress
  tar -xvf 1.tar.gz
  # Change output directory
  tar -xvf 1.tar.gz -C output/

```
