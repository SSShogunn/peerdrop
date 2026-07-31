# peerdrop CLI

A command-line client for [PeerDrop](../../README.md) that speaks the same
signaling + WebRTC file-transfer protocol as the browser client, so it can
send/receive files with a browser tab or another `peerdrop` instance.

## Build

```sh
go build -o peerdrop .
```

## Usage

Send one or more files — creates a room and prints a code for the receiver:

```sh
peerdrop send file1.txt file2.png
```

Join a room and receive files into a directory:

```sh
peerdrop receive ABCD --out ./downloads
```

Flags (see `peerdrop --help`):

- `--signaling-server` — signaling server WebSocket URL (default points at
  the hosted instance; override for local dev, e.g.
  `ws://127.0.0.1:8787/ws`)
- `--stun-servers` — comma-separated STUN URLs
- `send --chunk-size-kb` — data channel chunk size
- `receive --out` — output directory
- `receive -y/--yes` — accept incoming transfers without prompting
