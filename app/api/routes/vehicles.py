from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Client, Vehicle
from app.schemas import VehicleCreate, VehicleRead, VehicleUpdate
from app.services.audit import write_audit_log

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _get_vehicle(db: Session, vehicle_id: int) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return vehicle


def _assert_client(db: Session, client_id: int) -> None:
    if db.get(Client, client_id) is None:
        raise HTTPException(status_code=404, detail="Client not found.")


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)) -> Vehicle:
    _assert_client(db, payload.client_id)
    vehicle = Vehicle(**payload.model_dump(by_alias=False))
    db.add(vehicle)
    db.flush()
    write_audit_log(db, action="vehicle.created", entity_type="vehicle", entity_id=vehicle.id)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("", response_model=list[VehicleRead])
def list_vehicles(client_id: int | None = None, db: Session = Depends(get_db)) -> list[Vehicle]:
    stmt = select(Vehicle)
    if client_id is not None:
        stmt = stmt.where(Vehicle.client_id == client_id)
    return list(db.scalars(stmt))


@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)) -> Vehicle:
    return _get_vehicle(db, vehicle_id)


@router.patch("/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: Session = Depends(get_db)) -> Vehicle:
    vehicle = _get_vehicle(db, vehicle_id)
    updates = payload.model_dump(exclude_unset=True, by_alias=False)
    if "client_id" in updates and updates["client_id"] is not None:
        _assert_client(db, updates["client_id"])
    for key, value in updates.items():
        setattr(vehicle, key, value)
    write_audit_log(db, action="vehicle.updated", entity_type="vehicle", entity_id=vehicle.id)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)) -> None:
    vehicle = _get_vehicle(db, vehicle_id)
    write_audit_log(db, action="vehicle.deleted", entity_type="vehicle", entity_id=vehicle.id)
    db.delete(vehicle)
    db.commit()
