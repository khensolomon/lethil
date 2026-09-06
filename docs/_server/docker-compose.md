---
title: "Docker Compose"
description: "Everyday Compose commands for the Django stacks, plus cleanup."
category: "Server"
nav_order: 2
tags: [server, docker, compose, django]
---

Used for local development. Production runs the same images under
[[Docker Swarm]].

## Lifecycle

```bash
docker compose up -d --build
docker compose build --no-cache
docker compose restart web

docker compose stop            # keep containers
docker compose down            # remove containers
docker compose down -v         # also drop volumes — wipes the database
docker compose down -v --rmi all
docker compose down -v --remove-orphans
```

## Django management commands

```bash
npm run build && python manage.py collectstatic --noinput

docker compose exec web python manage.py makemigrations
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

## Inspecting a container

```bash
docker compose ps
docker compose logs web --tail=100
docker compose logs db --tail=100
docker compose logs -f db

docker exec -it <container> cat /etc/nginx/conf.d/default.conf
docker exec <container> env | grep MEDIA_DIR
docker exec <container> ls -la /storage/media/store/albums.json
```

## MySQL import and export

```bash
# Straight into an existing container
docker exec -i <container> mysql -u root -p<password> <database> < ./dump.sql

# Large files: copy first, then source
docker cp ./huge_dump.sql <container>:/tmp/dump.sql
docker exec -it <container> mysql -u root -p <database> -e "source /tmp/dump.sql"
docker exec -it <container> rm /tmp/dump.sql

docker exec <container> mysqldump -u root -p <database> > backup.sql
```

See [[MySQL backups]] for the scheduled version.

## Cleanup

Ordered from safe to destructive.

```bash
docker ps -a                   # stopped containers still hold volumes
docker image prune
docker network prune
docker volume prune
docker system prune            # unused containers and networks
docker system prune -a         # also all unused images
docker system prune -af --volumes   # also volumes — deletes unused data
```

Reach for the last one only when a volume is stuck and the data is expendable.
