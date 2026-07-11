from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Client
from app.schemas import ClientCreate, ClientRead, ClientUpdate
from app.services.audit import write_audit_log

router = APIRouter(prefix="/clients", tags=["clients"])

def _get_client(db: Session, client_id: int) -> Client:
    """Helper function to retrieve a client by ID or raise HTTPException."""
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found.")
    return client

def _client_model_to_read_schema(client_model: Client) -> ClientRead:
    """Converts a SQLAlchemy Client model instance to a Pydantic ClientRead schema."""
    return ClientRead(
        id=client_model.id,
        client_type=client_model.client_type,
        full_name=client_model.full_name,
        cin_number=client_model.cin_number,
        email=client_model.email,
        phone=client_model.phone,
        address=client_model.address,
        metadata=client_model.metadata_, # Explicitly map metadata_ from model to metadata for schema
        created_at=client_model.created_at,
        updated_at=client_model.updated_at,
    )


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)) -> ClientRead:
    client = Client(**payload.model_dump(by_alias=False))
    db.add(client)
    db.flush()
    write_audit_log(db, action="client.created", entity_type="client", entity_id=client.id)
    db.commit()
    db.refresh(client)
    return _client_model_to_read_schema(client)


@router.get("", response_model=list[ClientRead])
def list_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> list[ClientRead]:
    clients = db.scalars(
        select(Client)
        .where(Client.metadata_["temporary"].as_boolean().is_not(True))
        .offset(skip)
        .limit(limit)
    ).all()
    return [_client_model_to_read_schema(c) for c in clients]


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, db: Session = Depends(get_db)) -> ClientRead:
    client = _get_client(db, client_id)
    return _client_model_to_read_schema(client)


@router.patch("/{client_id}", response_model=ClientRead)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db)) -> ClientRead:
    client = _get_client(db, client_id)
    for key, value in payload.model_dump(exclude_unset=True, by_alias=False).items():
        if key == "metadata": # The payload uses 'metadata', but the SQLAlchemy model attribute is 'metadata_'
            setattr(client, "metadata_", value)
        else:
            setattr(client, key, value)
    write_audit_log(db, action="client.updated", entity_type="client", entity_id=client.id)
    db.commit()
    db.refresh(client)
    return _client_model_to_read_schema(client)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)) -> None:
    client = _get_client(db, client_id)
    write_audit_log(db, action="client.deleted", entity_type="client", entity_id=client.id)
    db.delete(client)
    db.commit()
