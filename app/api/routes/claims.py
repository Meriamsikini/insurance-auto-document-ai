from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Client, InsuranceContract, Sinistre, Vehicle
from app.schemas import SinistreCreate, SinistreRead, SinistreUpdate
from app.services.audit import write_audit_log

router = APIRouter(prefix="/claims", tags=["claims"])


def _get_claim(db: Session, claim_id: int) -> Sinistre:
    claim = db.get(Sinistre, claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return claim


def _assert_refs(
    db: Session,
    *,
    client_id: int | None = None,
    vehicle_id: int | None = None,
    contract_id: int | None = None,
) -> None:
    if client_id is not None and db.get(Client, client_id) is None:
        raise HTTPException(status_code=404, detail="Client not found.")
    if vehicle_id is not None and db.get(Vehicle, vehicle_id) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    if contract_id is not None and db.get(InsuranceContract, contract_id) is None:
        raise HTTPException(status_code=404, detail="Contract not found.")


@router.post("", response_model=SinistreRead, status_code=status.HTTP_201_CREATED)
def create_claim(payload: SinistreCreate, db: Session = Depends(get_db)) -> Sinistre:
    _assert_refs(db, client_id=payload.client_id, vehicle_id=payload.vehicle_id, contract_id=payload.contract_id)
    claim = Sinistre(**payload.model_dump(by_alias=False))
    db.add(claim)    
    write_audit_log(db, action="claim.created", entity_type="sinistre", entity_id=claim.id)
    db.commit()
    db.refresh(claim)
    return claim


@router.get("", response_model=list[SinistreRead])
def list_claims(client_id: int | None = None, db: Session = Depends(get_db)) -> list[Sinistre]:
    stmt = select(Sinistre)
    if client_id is not None:
        stmt = stmt.where(Sinistre.client_id == client_id)
    return list(db.scalars(stmt))


@router.get("/{claim_id}", response_model=SinistreRead)
def get_claim(claim_id: int, db: Session = Depends(get_db)) -> Sinistre:
    return _get_claim(db, claim_id)


@router.patch("/{claim_id}", response_model=SinistreRead)
def update_claim(claim_id: int, payload: SinistreUpdate, db: Session = Depends(get_db)) -> Sinistre:
    claim = _get_claim(db, claim_id)
    updates = payload.model_dump(exclude_unset=True, by_alias=False)
    _assert_refs(
        db,
        client_id=updates.get("client_id"),
        vehicle_id=updates.get("vehicle_id"),
        contract_id=updates.get("contract_id"),
    )
    for key, value in updates.items():
        setattr(claim, key, value)
    write_audit_log(db, action="claim.updated", entity_type="sinistre", entity_id=claim.id)
    db.commit()
    db.refresh(claim)
    return claim


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_claim(claim_id: int, db: Session = Depends(get_db)) -> None:
    claim = _get_claim(db, claim_id)
    write_audit_log(db, action="claim.deleted", entity_type="sinistre", entity_id=claim.id)
    db.delete(claim)
    db.commit()
