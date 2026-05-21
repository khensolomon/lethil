# apps/default

The catch-all landing page. Anything that reaches the server with a hostname the Cloudflare tunnel doesn't recognise falls through to `localhost:80`, where the landing nginx serves this app's files.

## Target

`/opt/bucket/html` on the server (read-only bind mount into the landing nginx container).

## Build

Currently no build step. The files in this directory are deployed as-is to the server.

When this app grows a `package.json` and a real build pipeline, the workflow handles it — `npm install && npm run build` and rsync `dist/`. Nothing here needs to change on the workflow side; the structure follows convention.

## Source files

- `index.html` — the page
- `style.css` — styles
- `script.js` — any client-side scripting

These are placeholders. Replace with your actual landing page content.
