from __future__ import annotations

from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.models import Notification


class ConnectionManager:
    def __init__(self) -> None:
        self._global: set[WebSocket] = set()
        self._by_client: dict[int, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, client_id: int | None = None) -> None:
        await websocket.accept()
        if client_id is None:
            self._global.add(websocket)
        else:
            self._by_client.setdefault(client_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, client_id: int | None = None) -> None:
        if client_id is None:
            self._global.discard(websocket)
            for sockets in self._by_client.values():
                sockets.discard(websocket)
        else:
            self._by_client.get(client_id, set()).discard(websocket)

    async def broadcast(self, event: dict[str, Any], client_id: int | None = None) -> None:
        targets = set(self._global)
        if client_id is not None:
            targets |= self._by_client.get(client_id, set())

        stale: list[WebSocket] = []
        for websocket in targets:
            try:
                await websocket.send_json(event)
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            self.disconnect(websocket)


manager = ConnectionManager()


def create_notification(
    db: Session,
    *,
    event_type: str,
    title: str,
    client_id: int | None = None,
    message: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    notification = Notification(
        client_id=client_id,
        event_type=event_type,
        title=title,
        message=message,
        payload=payload or {},
    )
    db.add(notification)
    return notification


async def push_event(
    event_type: str,
    *,
    client_id: int | None = None,
    title: str,
    message: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    await manager.broadcast(
        {
            "event_type": event_type,
            "client_id": client_id,
            "title": title,
            "message": message,
            "payload": payload or {},
        },
        client_id=client_id,
    )
