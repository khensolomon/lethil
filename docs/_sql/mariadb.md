---
title: "MariaDB setup"
description: "Installing and securing MariaDB on the host."
group: "Operations"
category: "SQL"
nav_order: 3
tags: [mysql, install]
---

```bash
sudo apt update
sudo apt install mariadb-server mariadb-client

sudo mariadb-secure-installation

sudo systemctl status mariadb
mariadb -u root -p
```

`mariadb-secure-installation` removes anonymous users, blocks remote root
login, and drops the test database. Run it before the host is reachable.

Since MariaDB 10.5 the tools are named `mariadb`, `mariadb-dump` and
`mariadb-admin`. The `mysql*` names still work as symlinks, but they are the
legacy spelling and MariaDB has said they will not last forever — prefer the
`mariadb-*` names in anything scripted. See [[MySQL backups]].

GUI clients: HeidiSQL, DBeaver CE.
