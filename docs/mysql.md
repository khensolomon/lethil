# Database

- [Getting started](Readme.md)

## Install

### MySQL

```sh

```

### MariaDB

```sh
# sudo apt install mysql-server
sudo apt install mariadb-server mariadb-client
# sudo mysql_secure_installation
# systemctl restart mysqld
systemctl restart mariadb
```

## remote2SQL

```sql
mysql -u root

-- check users
SELECT User,Password,Host FROM mysql.user;
-- create user
CREATE USER 'lethil' IDENTIFIED BY 'password';
-- grant user
GRANT ALL PRIVILEGES ON *.* to 'lethil'@'%';
GRANT USAGE ON *.* TO 'lethil'@'%' IDENTIFIED BY 'password';


-- SET PASSWORD FOR 'lethil'@'%' = PASSWORD('password');
-- UPDATE mysql.user SET plugin = '' WHERE user = 'lethil';
FLUSH PRIVILEGES;

SHOW GRANTS FOR 'root'@'localhost';
```

## root@localhost

... remove password

```sql
USE mysql;
-- UPDATE mysql.user SET password=PASSWORD('') WHERE User='root' AND Host = 'localhost';
SET PASSWORD FOR root@localhost=PASSWORD('');
FLUSH PRIVILEGES;
```

... export CSV

```sql
SELECT *
FROM senses
INTO OUTFILE '/tmp/csv/sense.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

Enabling remote access to MariaDB

```sh
ps -ef | grep -i mysql
# check MariaDB server is running

# mysql        595       1  0 04:17 ?        00:00:00 /usr/sbin/mysqld
# root        1350    1337  0 04:22 pts/0    00:00:00 grep --color=auto -i mysql

# check MariaDB server listening
netstat -ant | grep 3306

# tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN

nano /etc/mysql/my.cnf
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf

# bind-address = 127.0.0.1 to 0.0.0.0
sudo systemctl restart mariadb

netstat -ant | grep 3306
# tcp        0      0 0.0.0.0:3306          0.0.0.0:*               LISTEN
```
