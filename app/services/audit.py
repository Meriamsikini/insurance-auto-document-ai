from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog


def write_audit_log(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    actor: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
    )
    db.add(entry)
    return entry
