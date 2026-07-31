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
`client/.env` same as the web build. Also set `VITE_PUBLIC_APP_URL` (e.g.
`https://peerdrop.sshogunn.org/app`) so invite links/QR codes point at the
real domain instead of the webview's internal `wails.localhost` origin.

## Note on releases

Release builds aren't code-signed, so Windows SmartScreen will warn that the
publisher is unknown. Click **More info → Run anyway** to launch.
