from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import ClaimStatus, ClaimStatusHistory, Sinistre
from app.services.audit import write_audit_log
from app.services.notifications import create_notification


ALLOWED_TRANSITIONS: dict[ClaimStatus, set[ClaimStatus]] = {
    ClaimStatus.DECLARED: {ClaimStatus.UNDER_REVIEW, ClaimStatus.DOCUMENTS_PENDING, ClaimStatus.REJECTED},
    ClaimStatus.UNDER_REVIEW: {ClaimStatus.DOCUMENTS_PENDING, ClaimStatus.APPROVED, ClaimStatus.REJECTED},
    ClaimStatus.DOCUMENTS_PENDING: {ClaimStatus.UNDER_REVIEW, ClaimStatus.REJECTED},
    ClaimStatus.APPROVED: {ClaimStatus.CLOSED},
    ClaimStatus.REJECTED: {ClaimStatus.CLOSED},
    ClaimStatus.CLOSED: set(),
}


def transition_claim(
    db: Session,
    *,
    sinistre: Sinistre,
    to_status: ClaimStatus,
    reason: str | None = None,
    changed_by: str | None = None,
) -> ClaimStatusHistory:
    from_status = sinistre.status
    if from_status == to_status:
        raise HTTPException(status_code=400, detail="Claim already has this status.")
    if to_status not in ALLOWED_TRANSITIONS[from_status]:
        raise HTTPException(status_code=409, detail=f"Invalid transition from {from_status} to {to_status}.")

    sinistre.status = to_status
    history = ClaimStatusHistory(
        sinistre_id=sinistre.id,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        changed_by=changed_by,
    )
    db.add(history)
    create_notification(
        db,
        event_type="claim_status_updated",
        title="Claim status updated",
        client_id=sinistre.client_id,
        payload={"claim_id": sinistre.id, "from_status": from_status.value, "to_status": to_status.value},
    )
    write_audit_log(
        db,
        action="claim.status_updated",
        entity_type="sinistre",
        entity_id=sinistre.id,
        actor=changed_by,
        payload={"from_status": from_status.value, "to_status": to_status.value, "reason": reason},
    )
    return history
