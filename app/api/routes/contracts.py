from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Client, InsuranceContract, Vehicle
from app.schemas import ContractCreate, ContractRead, ContractUpdate
from app.services.audit import write_audit_log

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _get_contract(db: Session, contract_id: int) -> InsuranceContract:
    contract = db.get(InsuranceContract, contract_id)
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found.")
    return contract


def _assert_refs(db: Session, client_id: int | None = None, vehicle_id: int | None = None) -> None:
    if client_id is not None and db.get(Client, client_id) is None:
        raise HTTPException(status_code=404, detail="Client not found.")
    if vehicle_id is not None and db.get(Vehicle, vehicle_id) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")


@router.post("", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)) -> InsuranceContract:
    _assert_refs(db, client_id=payload.client_id, vehicle_id=payload.vehicle_id)
    contract = InsuranceContract(**payload.model_dump())
    db.add(contract)
    db.flush()
    write_audit_log(db, action="contract.created", entity_type="insurance_contract", entity_id=contract.id)
    db.commit()
    db.refresh(contract)
    return contract


@router.get("", response_model=list[ContractRead])
def list_contracts(client_id: int | None = None, db: Session = Depends(get_db)) -> list[InsuranceContract]:
    stmt = select(InsuranceContract)
    if client_id is not None:
        stmt = stmt.where(InsuranceContract.client_id == client_id)
    return list(db.scalars(stmt))


@router.get("/{contract_id}", response_model=ContractRead)
def get_contract(contract_id: int, db: Session = Depends(get_db)) -> InsuranceContract:
    return _get_contract(db, contract_id)


@router.patch("/{contract_id}", response_model=ContractRead)
def update_contract(contract_id: int, payload: ContractUpdate, db: Session = Depends(get_db)) -> InsuranceContract:
    contract = _get_contract(db, contract_id)
    updates = payload.model_dump(exclude_unset=True)
    _assert_refs(db, client_id=updates.get("client_id"), vehicle_id=updates.get("vehicle_id"))
    for key, value in updates.items():
        setattr(contract, key, value)
    write_audit_log(db, action="contract.updated", entity_type="insurance_contract", entity_id=contract.id)
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(contract_id: int, db: Session = Depends(get_db)) -> None:
    contract = _get_contract(db, contract_id)
    write_audit_log(db, action="contract.deleted", entity_type="insurance_contract", entity_id=contract.id)
    db.delete(contract)
    db.commit()
