from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from app.models import ProcessingStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ClientBase(BaseModel):
    client_type: str = "individual"
    full_name: str
    cin_number: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    metadata_: dict[str, Any] = Field(
        default_factory=dict,
        alias="metadata",
        validation_alias=AliasChoices("metadata_", "metadata"),
    )


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    client_type: str | None = None
    full_name: str | None = None
    cin_number: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    metadata_: dict[str, Any] | None = Field(
        default=None,
        alias="metadata",
        validation_alias=AliasChoices("metadata_", "metadata"),
    )


class ClientRead(ClientBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class VehicleBase(BaseModel):
    client_id: int
    registration_number: str | None = None
    vin: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    usage: str | None = None
    metadata_: dict[str, Any] = Field(
        default_factory=dict,
        alias="metadata",
        validation_alias=AliasChoices("metadata_", "metadata"),
    )


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    client_id: int | None = None
    registration_number: str | None = None
    vin: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    usage: str | None = None
    metadata_: dict[str, Any] | None = Field(
        default=None,
        alias="metadata",
        validation_alias=AliasChoices("metadata_", "metadata"),
    )


class VehicleRead(VehicleBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class ContractBase(BaseModel):
    client_id: int
    vehicle_id: int | None = None
    policy_number: str
    provider: str | None = None
    status: str = "ACTIVE"
    start_date: date | None = None
    end_date: date | None = None
    premium_amount: Decimal | None = None
    coverage: dict[str, Any] = Field(default_factory=dict)


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    client_id: int | None = None
    vehicle_id: int | None = None
    policy_number: str | None = None
    provider: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    premium_amount: Decimal | None = None
    coverage: dict[str, Any] | None = None


class ContractRead(ContractBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class SinistreBase(BaseModel):
    client_id: int
    vehicle_id: int | None = None
    contract_id: int | None = None
    claim_number: str
    accident_date: date | None = None
    location: str | None = None
    description: str | None = None
    damage_level: str | None = None
    estimated_cost: Decimal | None = None
    approved_amount: Decimal | None = None
    metadata_: dict[str, Any] = Field(
        default_factory=dict,
        alias="metadata",
        validation_alias=AliasChoices("metadata_", "metadata"),
    )


class SinistreCreate(SinistreBase):
    pass


class SinistreUpdate(BaseModel):
    client_id: int | None = None
    vehicle_id: int | None = None
    contract_id: int | None = None
    claim_number: str | None = None
    accident_date: date | None = None
    location: str | None = None
    description: str | None = None
    damage_level: str | None = None
    estimated_cost: Decimal | None = None
    approved_amount: Decimal | None = None
    metadata_: dict[str, Any] | None = Field(
        default=None,
        alias="metadata",
        validation_alias=AliasChoices("metadata_", "metadata"),
    )


class SinistreRead(SinistreBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class DocumentRead(ORMModel):
    id: int
    client_id: int
    vehicle_id: int | None
    contract_id: int | None
    sinistre_id: int | None
    document_type: str
    original_filename: str
    stored_filename: str
    file_path: str
    content_type: str | None
    file_size: int
    processing_status: ProcessingStatus
    extracted_text: str | None
    ai_result: dict[str, Any]
    validated_data: dict[str, Any]
    processing_error: str | None
    created_at: datetime
    updated_at: datetime


class DocumentAssignRefs(BaseModel):
    client_id: int | None = None
    vehicle_id: int | None = None
    contract_id: int | None = None
    sinistre_id: int | None = None
    validated_data: dict[str, Any] | None = None


class NotificationRead(ORMModel):
    id: int
    client_id: int | None
    event_type: str
    title: str
    message: str | None
    payload: dict[str, Any]
    is_read: bool
    created_at: datetime


class SearchResults(BaseModel):
    clients: list[ClientRead]
    vehicles: list[VehicleRead]
    contracts: list[ContractRead]
    sinistres: list[SinistreRead]
    documents: list[DocumentRead]
