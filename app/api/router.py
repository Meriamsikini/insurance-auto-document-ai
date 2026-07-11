from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import claims, clients, contracts, documents, notifications, search, vehicles

api_router = APIRouter()
api_router.include_router(clients.router)
api_router.include_router(vehicles.router)
api_router.include_router(contracts.router)
api_router.include_router(claims.router)
api_router.include_router(documents.router)
api_router.include_router(notifications.router)
api_router.include_router(search.router)
