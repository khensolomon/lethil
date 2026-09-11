---
title: "Docker Swarm"
description: "Single-node swarm running the zaideih and myordbok stacks."
group: "Containers"
category: "Server"
nav_order: 3
tags: [server, docker]
---

Production runs a single-node swarm with [[Cloudflare Tunnel]] for ingress, so
no port is published to the internet. Give the node a stable address first —
see [[Static networking]]. Deployment scripts are Python; see
[[Packaging scripts]].

## Init

```bash
sudo docker swarm init
sudo usermod -aG docker $USER
docker compose config          # validate before deploying
```

## Deploy and watch

```bash
docker stack deploy -c docker-compose.yml zaideih
watch docker service ls

docker service ps zaideih_web --no-trunc
docker inspect --format '{% raw %}{{.Status.Err}}{% endraw %}' <task-id>
```

## Logs

```bash
docker service logs -f zaideih_web
docker service logs --since 1h zaideih_web
docker service logs -f zaideih_web --tail 100
docker service logs -f myordbok_web --tail 100
```

## Updates and rollback

```bash
docker service update --force zaideih_web
docker service update --rollback zaideih_web
```

## Checking a running task

Swarm assigns new container IDs on every deploy, so look the ID up rather than
keeping one around.

```bash
CONTAINER_ID=$(docker ps -q -f name=zaideih_web)

docker exec -it $CONTAINER_ID python manage.py check
docker exec $CONTAINER_ID env | grep DEBUG
docker exec $CONTAINER_ID env | grep STORAGE_DIR
docker exec $CONTAINER_ID ls -R /code/static/.vite/
```

Inspecting `env` prints secrets to the terminal. Grep for the specific variable
rather than dumping the whole environment.

## Static files

```bash
find static -mindepth 1 ! -path "static/.vite*" -delete
npm run build && python manage.py collectstatic --clear --noinput
python manage.py check

docker run --rm -it ghcr.io/<owner>/zaideih/django-app:latest cat /code/staticfiles/.vite/manifest.json
```

## Tearing a stack down

```bash
docker stack rm zaideih

# Deletes all database data in that volume
docker volume rm zaideih_mysql_data
docker volume prune -f

# If a container still holds the volume
docker rm -f <container-id>
```
