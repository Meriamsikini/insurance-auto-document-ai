from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Client, Document, InsuranceContract, Sinistre, Vehicle
from app.schemas import SearchResults

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResults)
def search_system(q: str = Query(..., min_length=2), db: Session = Depends(get_db)) -> SearchResults:
    term = f"%{q}%"
    clients = list(
        db.scalars(
            select(Client)
            .where(
                Client.metadata_["temporary"].as_boolean().is_not(True),
                or_(Client.full_name.ilike(term), Client.cin_number.ilike(term), Client.email.ilike(term), Client.phone.ilike(term)),
            )
            .limit(25)
        )
    )
    vehicles = list(
        db.scalars(
            select(Vehicle)
            .where(or_(Vehicle.registration_number.ilike(term), Vehicle.vin.ilike(term), Vehicle.make.ilike(term), Vehicle.model.ilike(term)))
            .limit(25)
        )
    )
    contracts = list(
        db.scalars(
            select(InsuranceContract)
            .where(or_(InsuranceContract.policy_number.ilike(term), InsuranceContract.provider.ilike(term), InsuranceContract.status.ilike(term)))
            .limit(25)
        )
    )
    sinistres = list(
        db.scalars(
            select(Sinistre)
            .where(or_(Sinistre.claim_number.ilike(term), Sinistre.location.ilike(term), Sinistre.description.ilike(term)))
            .limit(25)
        )
    )
    documents = list(
        db.scalars(
            select(Document)
            .where(or_(Document.original_filename.ilike(term), Document.document_type.ilike(term)))
            .limit(25)
        )
    )
    return SearchResults(
        clients=clients,
        vehicles=vehicles,
        contracts=contracts,
        sinistres=sinistres,
        documents=documents,
    )
