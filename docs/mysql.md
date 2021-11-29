# Database

- [Getting started](Readme.md)

## Install

### MySQL

```sh

```

### MariaDB

```sh
sudo apt install mysql-server
sudo apt install mariadb-server mariadb-client
sudo mysql_secure_installation
systemctl restart mariadb
```

## remote2SQL

```sql
mysql -u root

SELECT User,Password,Host FROM mysql.user;
CREATE USER 'lethil' IDENTIFIED BY 'password';

GRANT ALL PRIVILEGES ON *.* to 'lethil'@'%';
GRANT USAGE ON *.* TO 'lethil'@'%' IDENTIFIED BY 'password';


SET PASSWORD FOR 'lethil'@'%' = PASSWORD('password');
UPDATE mysql.user SET plugin = '' WHERE user = 'lethil';
FLUSH PRIVILEGES;

SHOW GRANTS FOR 'root'@'localhost';
```

## root@localhost

... remove password

```sql
USE mysql;
UPDATE user SET password=PASSWORD('') WHERE User='root' AND Host = 'localhost';
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
