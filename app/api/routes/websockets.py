from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.notifications import manager

router = APIRouter(tags=["websockets"])


@router.websocket("/ws/notifications")
async def notifications_socket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.websocket("/ws/notifications/{client_id}")
async def client_notifications_socket(websocket: WebSocket, client_id: int) -> None:
    await manager.connect(websocket, client_id=client_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id=client_id)
