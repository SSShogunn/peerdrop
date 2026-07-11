import asyncio
import contextlib
import json
import logging
import os
import random
import string
import time

import httpx
from fastapi import FastAPI, Response, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect
from starlette.websockets import WebSocketState


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        payload.update(getattr(record, "fields", {}))
        return json.dumps(payload)


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("peerdrop")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.propagate = False
    return logger


logger = _build_logger()


def log_event(event: str, **fields) -> None:
    logger.info(event, extra={"fields": fields})


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _env_list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


ALLOWED_ORIGINS = _env_list(
    "ALLOWED_ORIGINS",
    "https://peerdrop.sshogunn.org,http://localhost:5173,http://localhost:20015",
)
MAX_ROOMS = _env_int("MAX_ROOMS", 500)
RATE_LIMIT_MAX = _env_int("RATE_LIMIT_MAX", 30)
RATE_LIMIT_WINDOW = _env_int("RATE_LIMIT_WINDOW", 60)
ROOM_TTL_SECONDS = _env_int("ROOM_TTL_SECONDS", 600)
CLEANUP_INTERVAL = _env_int("ROOM_CLEANUP_INTERVAL", 60)

CF_TURN_KEY_ID = os.environ.get("CF_TURN_KEY_ID", "")
CF_TURN_API_TOKEN = os.environ.get("CF_TURN_API_TOKEN", "")
TURN_CREDENTIAL_TTL = _env_int("TURN_CREDENTIAL_TTL", 86400)


START_TIME = time.time()

rooms: dict = {}

peer_room: dict = {}

rate_limits: dict[str, list[float]] = {}

counters = {"rooms_created": 0, "peers_joined": 0, "rate_limited": 0}


def generate_room_code(length: int = 4) -> str:
    characters = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(characters, k=length))
        if code not in rooms:
            return code


def get_other_peer(room: dict, sender: WebSocket):
    if room["peer_a"] == sender:
        return room["peer_b"]
    return room["peer_a"]


def _is_disconnected(ws: WebSocket | None) -> bool:
    return ws is None or ws.client_state == WebSocketState.DISCONNECTED


def check_rate_limit(ip: str) -> bool:
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW
    window = rate_limits.setdefault(ip, [])
    while window and window[0] < cutoff:
        window.pop(0)
    if len(window) >= RATE_LIMIT_MAX:
        return False
    window.append(now)
    return True


async def handle_create_room(websocket: WebSocket):
    if len(rooms) >= MAX_ROOMS:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "server_busy"})
        )
        log_event("create_room_rejected", reason="max_rooms", active_rooms=len(rooms))
        return

    code = generate_room_code()
    rooms[code] = {"peer_a": websocket, "peer_b": None, "created_at": time.time()}
    peer_room[websocket] = code
    counters["rooms_created"] += 1
    await websocket.send_text(json.dumps({"type": "room_created", "code": code}))
    log_event("room_created", code=code)


async def handle_join_room(websocket: WebSocket, code: str):
    if code not in rooms:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "room_not_found"})
        )
        log_event("room_join_failed", code=code, reason="room_not_found")
        return

    room = rooms[code]

    if room["peer_b"] is not None:
        await websocket.send_text(json.dumps({"type": "error", "message": "room_full"}))
        log_event("room_join_failed", code=code, reason="room_full")
        return

    room["peer_b"] = websocket
    peer_room[websocket] = code

    counters["peers_joined"] += 1
    await websocket.send_text(json.dumps({"type": "room_joined"}))
    await room["peer_a"].send_text(json.dumps({"type": "peer_joined"}))
    log_event("peer_joined", code=code)


async def handle_relay(websocket: WebSocket, raw: str):
    code = peer_room.get(websocket)
    if code is None:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "no_in_room"})
        )
        log_event("relay_failed", reason="no_in_room")
        return

    room = rooms.get(code)
    if room is None:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "not_in_room"})
        )
        log_event("relay_failed", code=code, reason="not_in_room")
        return

    other_peer = get_other_peer(room, websocket)
    if other_peer is None:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "not_in_room"})
        )
        log_event("relay_failed", code=code, reason="peer_missing")
        return

    await other_peer.send_text(raw)


async def handle_disconnect(websocket: WebSocket):
    code = peer_room.get(websocket)

    if code is None:
        return

    room = rooms.get(code)

    if room is not None:
        other = get_other_peer(room, websocket)
        if other is not None:
            await other.send_text(json.dumps({"type": "peer_disconnected"}))
        del rooms[code]

    del peer_room[websocket]
    log_event("room_closed", code=code)


async def _reap_room(code: str, room: dict, reason: str) -> None:
    peer_a = room.get("peer_a")
    peer_b = room.get("peer_b")

    if peer_a is not None and not _is_disconnected(peer_a):
        with contextlib.suppress(Exception):
            await peer_a.send_text(
                json.dumps({"type": "error", "message": "room_expired"})
            )
            await peer_a.close()

    for peer in (peer_a, peer_b):
        if peer is not None:
            peer_room.pop(peer, None)

    rooms.pop(code, None)
    log_event("room_reaped", code=code, reason=reason)


async def cleanup_rooms() -> None:
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        now = time.time()

        for code, room in list(rooms.items()):
            age = now - room.get("created_at", now)
            peer_a = room.get("peer_a")
            peer_b = room.get("peer_b")

            if peer_b is None and age > ROOM_TTL_SECONDS:
                await _reap_room(code, room, reason="ttl_no_peer")
            elif _is_disconnected(peer_a) and _is_disconnected(peer_b):
                await _reap_room(code, room, reason="both_closed")

        cutoff = now - RATE_LIMIT_WINDOW
        for ip in list(rate_limits.keys()):
            window = rate_limits[ip]
            while window and window[0] < cutoff:
                window.pop(0)
            if not window:
                del rate_limits[ip]


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_rooms())
    log_event("startup", max_rooms=MAX_ROOMS, room_ttl_seconds=ROOM_TTL_SECONDS)
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    log_event("client_connected")

    ip = websocket.client.host if websocket.client else "unknown"

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            if msg_type in ("create_room", "join_room"):
                if not check_rate_limit(ip):
                    counters["rate_limited"] += 1
                    await websocket.send_text(
                        json.dumps({"type": "error", "message": "rate_limited"})
                    )
                    log_event("rate_limited", ip=ip, msg_type=msg_type)
                    continue

            if msg_type == "create_room":
                await handle_create_room(websocket)

            elif msg_type == "join_room":
                code = message.get("code", "").upper()
                await handle_join_room(websocket, code)

            elif msg_type in ("offer", "answer", "ice"):
                await handle_relay(websocket, raw)

            else:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "unknown_message_type"})
                )
                log_event("unknown_message_type", msg_type=msg_type)

    except WebSocketDisconnect as e:
        log_event("client_disconnected", close_code=e.code)
        await handle_disconnect(websocket)


@app.get("/")
async def get():
    return "Hello from the server !"


@app.get("/turn-credentials")
async def turn_credentials():
    if not CF_TURN_KEY_ID or not CF_TURN_API_TOKEN:
        return {"iceServers": []}

    url = f"https://rtc.live.cloudflare.com/v1/turn/keys/{CF_TURN_KEY_ID}/credentials/generate"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {CF_TURN_API_TOKEN}"},
                json={"ttl": TURN_CREDENTIAL_TTL},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        log_event("turn_credentials_failed", error=str(e))
        return {"iceServers": []}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "active_rooms": len(rooms),
        "connected_peers": len(peer_room),
    }


@app.get("/metrics")
async def metrics():
    lines = [
        "# HELP peerdrop_uptime_seconds Process uptime in seconds.",
        "# TYPE peerdrop_uptime_seconds gauge",
        f"peerdrop_uptime_seconds {round(time.time() - START_TIME, 1)}",
        "# HELP peerdrop_active_rooms Rooms currently held in memory.",
        "# TYPE peerdrop_active_rooms gauge",
        f"peerdrop_active_rooms {len(rooms)}",
        "# HELP peerdrop_connected_peers Peers currently connected.",
        "# TYPE peerdrop_connected_peers gauge",
        f"peerdrop_connected_peers {len(peer_room)}",
        "# HELP peerdrop_rooms_created_total Rooms created since startup.",
        "# TYPE peerdrop_rooms_created_total counter",
        f"peerdrop_rooms_created_total {counters['rooms_created']}",
        "# HELP peerdrop_peers_joined_total Successful room joins since startup.",
        "# TYPE peerdrop_peers_joined_total counter",
        f"peerdrop_peers_joined_total {counters['peers_joined']}",
        "# HELP peerdrop_rate_limited_total Requests rejected by the rate limiter.",
        "# TYPE peerdrop_rate_limited_total counter",
        f"peerdrop_rate_limited_total {counters['rate_limited']}",
    ]
    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")
