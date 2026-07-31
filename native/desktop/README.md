# PeerDrop desktop (Wails)

Desktop wrapper around the [client/](../../client) web app, built with
[Wails](https://wails.io) — replaces the previous Tauri build. There's no
separate frontend source here: `frontend/build.mjs` builds `client/` with
pnpm and copies its `dist/` output into `frontend/dist`, which `main.go`
embeds.

## Build

```sh
wails build
```

Produces `build/bin/PeerDrop.exe` (or platform equivalent).

## Dev

```sh
wails dev
```

Config knobs (`VITE_SIGNALING_SERVER`, `VITE_ICE_SERVERS`, etc.) come from
`client/.env` same as the web build.
