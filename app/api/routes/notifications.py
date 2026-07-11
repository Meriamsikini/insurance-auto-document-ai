from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Notification
from app.schemas import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_notifications(client_id: int | None = None, unread_only: bool = False, db: Session = Depends(get_db)) -> list[Notification]:
    stmt = select(Notification)
    if client_id is not None:
        stmt = stmt.where(Notification.client_id == client_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return list(db.scalars(stmt.order_by(Notification.created_at.desc()).limit(100)).all())


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(notification_id: int, db: Session = Depends(get_db)) -> None:
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notification)
    db.commit()
