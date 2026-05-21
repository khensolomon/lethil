# apps/

Static sites and SPAs that get deployed to a server. Each subdirectory is one app — its own source files, its own deploy target.

## What's here

| App | Type | Server destination |
|---|---|---|
| `default/` | Static HTML/CSS/JS (no build step yet) | `/opt/bucket/html` — the catch-all landing page served by the landing nginx |

## Deploying an app

Use the GitHub Actions workflow `.github/workflows/apps-deploy.yml`. Dispatch from the Actions tab, pick which app, the workflow builds it (if it has a `package.json`) and rsyncs the result to the server.

The workflow owns the build-and-deploy logic. It's the same shape for every app (build → rsync → permissions), so each app doesn't need to repeat that.

## Adding an app

1. Create `apps/<name>/` with whatever source the app needs.
2. Add `<name>` to the `apps:` list in `config.yml` at the repo root.
3. Drop a `README.md` inside `apps/<name>/` explaining what it is, its target path on the server, and any build prerequisites.
4. Dispatch the deploy workflow. Done.

If the app needs a build step:
- Add a `package.json` (or whatever your toolchain uses).
- The workflow auto-detects `package.json` and runs `npm install && npm run build`.
- The build must produce a `dist/` directory inside the app. That's what gets rsynced.
