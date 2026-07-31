"""
app/services/auth.py
JWT + bcrypt authentication service.

Dependencies to add to requirements.txt:
    python-jose[cryptography]>=3.3.0
    passlib[bcrypt]>=1.7.4

Environment variables:
    SECRET_KEY                    (min 32 chars, required in production)
    JWT_ALGORITHM                 (default: HS256)
    ACCESS_TOKEN_EXPIRE_MINUTES   (default: 480  = 8 hours)
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

SECRET_KEY: str = os.getenv(
    "SECRET_KEY",
    "assurauto-change-me-in-production-must-be-at-least-32-chars!",
)
ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ──────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def get_password_hash(plain: str) -> str:
    return _pwd_context.hash(plain)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── Business logic ────────────────────────────────────────────────────────────

def authenticate_employee(db: Session, email: str, password: str):
    """Return the Employee if credentials are valid, else None."""
    from app.models import Employee  # local import avoids circular dependency

    employee = (
        db.query(Employee)
        .filter(Employee.email == email, Employee.is_active.is_(True))
        .first()
    )
    if not employee:
        return None
    if not verify_password(password, employee.hashed_password):
        return None
    return employee
