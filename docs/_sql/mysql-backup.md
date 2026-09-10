---
title: "MySQL backups"
description: "Dumping and restoring, in containers and on the host."
group: "Operations"
category: "SQL"
nav_order: 2
tags: [mysql, backup, docker, cron]
---

## From a container

Read the password from the container's own environment rather than typing it —
a password on the command line lands in shell history and `ps` output.

```bash
# Uses the container's MYSQL_ROOT_PASSWORD
docker exec mysql_db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" dbName' \
  > /mnt/bucket/mysql/latest.sql

# Gzipped
docker exec mysql_db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" dbName | gzip' \
  > /mnt/bucket/mysql/latest.sql.gz
```

For cron, `MYSQL_PWD` avoids the password-in-argv warning:

```bash
docker exec mysql_db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root dbName | gzip' \
  > /mnt/bucket/mysql/latest.sql.gz
```

## On the host

```bash
mysqldump -u root -p zaideih  | gzip > /mnt/keep/storage/zaideih/mysql/latest.sql.gz
mysqldump -u root -p myordbok | gzip > /mnt/keep/storage/myordbok/mysql/latest.sql.gz
```

## Restore

```bash
gunzip < backup.sql.gz | mysql -u <user> -p <database>

# With a progress bar, worth it on large dumps
pv backup.sql.gz | gunzip | mysql -u <user> -p <database>
```

Dumps are synced to R2 — see [[Storage and buckets]].

## Held snapshots

| Database | Taken | Source | Path |
| :--- | :--- | :--- | :--- |
| MyOrdbok | 2026.04.13 | GCE | `storage/myordbok/mysql/gce-final.sql.gz` |
| Zaideih  | 2026.04.13 | GCE | `storage/zaideih/mysql/gce-final.sql.gz` |
