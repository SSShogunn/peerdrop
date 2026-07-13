# Deployment notes

Production is Docker-only (`docker-compose.yml`) — dev is run manually
(`pnpm dev` / `uv run uvicorn`, see [README](README.md)). The two never mix.

## Redeploying after a change

```bash
docker compose up -d --build
```

To only rebuild one side: `docker compose up -d --build frontend` (or
`backend`). `cloudflared` doesn't need rebuilding unless the tunnel token
changed — it stays untouched by this command.

`frontend`/`backend` are `expose`-only, not `ports:` — nothing is reachable
from the host directly. `cloudflared` is the only way in from the internet,
routing to the containers by their Docker service name.

## Cloudflare Tunnel

Ingress rules live in the Cloudflare dashboard (Zero Trust → Networks →
Tunnels → your tunnel → Public Hostname), **not** in this repo:

| Hostname | Service |
|---|---|
| `peerdrop.sshogunn.org` | `http://frontend:80` |
| `peerdrop-api.sshogunn.org` | `http://backend:8000` |

If the frontend's internal port ever changes (e.g. nginx config), that
`Service` field has to be updated by hand in the dashboard — nothing here
does it automatically.

## Gotchas already hit once

- **`client/.env` must reach the Docker build context.** It's not a secret
  — it's public `VITE_*` config Vite bakes into the JS bundle at build
  time. If `.dockerignore` ever excludes it again, every `VITE_*` value
  compiles to `undefined` and the app white-screens with no server-side
  error to show for it. Only the *root* `.env` (real secrets: Cloudflare
  tokens) should be ignored.
- **Service worker caching survives a redeploy in already-open tabs.** If a
  visitor's browser registered an old service worker before a deploy, it
  can keep serving stale content indefinitely. `index.html` is served with
  `Cache-Control: no-cache` for this reason — but an already-active SW can
  still mask it. If something looks stale after a deploy, hard refresh /
  clear site data before assuming the server is wrong.

## Environment variables

See [`.env.example`](.env.example) (backend: CORS, rate limits, room TTL,
Cloudflare TURN) and [`client/.env.example`](client/.env.example)
(signaling URL, STUN/TURN, chunk size). All have working defaults except
the Cloudflare tokens.
