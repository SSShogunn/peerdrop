import json
import logging
import random
import string
import time

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect


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


START_TIME = time.time()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms: dict = {}

peer_room: dict = {}


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


async def handle_create_room(websocket: WebSocket):
    code = generate_room_code()
    rooms[code] = {"peer_a": websocket, "peer_b": None}
    peer_room[websocket] = code
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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    log_event("client_connected")

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

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


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "active_rooms": len(rooms),
        "connected_peers": len(peer_room),
    }
