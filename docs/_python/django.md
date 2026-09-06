---
title: "Django"
description: "Project bootstrap and the management commands used most."
category: "Python"
nav_order: 4
tags: [python, django, mysql]
---

```bash
pip install django djangorestframework mysqlclient django-storages \
            google-cloud-storage django-cors-headers python-dotenv

django-admin startproject config .
python manage.py startapp core apps/core
python manage.py startapp api apps/api
```

## Day to day

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
python manage.py check
```

Inside a container, prefix with `docker compose exec web` — see
[[Docker Compose]].

## Static files

```bash
npm run build && python manage.py collectstatic --noinput
npm run build && python manage.py collectstatic --clear --noinput
```

## Linking python to python3

```bash
sudo ln -s /usr/bin/python3 /usr/bin/python
```

## Environment

```
DEBUG    = false
DB_USER  = admin
DB_HOST  = db
```

Keep `.env` out of the image and out of version control; inject it at deploy
time.
