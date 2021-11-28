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

## installation

```sh
# curl
sudo apt-get install curl software-properties-common

# wget
sudo apt-get install wget
```
