"""
app/api/router.py  — Replace existing file with this version (adds auth router).
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import claims, clients, contracts, documents, notifications, search, vehicles
from app.api.routes.auth import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router)          # /auth/login, /auth/me, /auth/change-password …
api_router.include_router(clients.router)
api_router.include_router(vehicles.router)
api_router.include_router(contracts.router)
api_router.include_router(claims.router)
api_router.include_router(documents.router)
api_router.include_router(notifications.router)
api_router.include_router(search.router)
