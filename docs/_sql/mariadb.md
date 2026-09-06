---
title: "MariaDB setup"
description: "Installing and securing MariaDB on the host."
category: "SQL"
nav_order: 3
tags: [mysql, mariadb, install]
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

GUI clients: HeidiSQL, DBeaver CE.
