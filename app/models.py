from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProcessingStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── Authentication ─────────────────────────────────────────────────────────────

class Employee(TimestampMixin, Base):
    """Internal employee / user account. No self-registration — admin only."""

    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(600), nullable=True)
    theme: Mapped[str] = mapped_column(String(20), default="dark", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ── Business models ────────────────────────────────────────────────────────────

class Client(TimestampMixin, Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_type: Mapped[str] = mapped_column(String(30), default="individual", nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cin_number: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(80), index=True)
    address: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    contracts: Mapped[list["InsuranceContract"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    sinistres: Mapped[list["Sinistre"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class Vehicle(TimestampMixin, Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True, nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(80), index=True)
    vin: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    make: Mapped[str | None] = mapped_column(String(120), index=True)
    model: Mapped[str | None] = mapped_column(String(120), index=True)
    year: Mapped[int | None] = mapped_column(Integer)
    usage: Mapped[str | None] = mapped_column(String(120))
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    client: Mapped[Client] = relationship(back_populates="vehicles")
    contracts: Mapped[list["InsuranceContract"]] = relationship(back_populates="vehicle")
    sinistres: Mapped[list["Sinistre"]] = relationship(back_populates="vehicle")
    documents: Mapped[list["Document"]] = relationship(back_populates="vehicle")


class InsuranceContract(TimestampMixin, Base):
    __tablename__ = "insurance_contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True, nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), index=True)
    policy_number: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(180), index=True)
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    premium_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    coverage: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    client: Mapped[Client] = relationship(back_populates="contracts")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="contracts")
    sinistres: Mapped[list["Sinistre"]] = relationship(back_populates="contract")
    documents: Mapped[list["Document"]] = relationship(back_populates="contract")


class Sinistre(TimestampMixin, Base):
    __tablename__ = "sinistres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True, nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), index=True)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("insurance_contracts.id", ondelete="SET NULL"), index=True)
    claim_number: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    accident_date: Mapped[date | None] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    damage_level: Mapped[str | None] = mapped_column(String(80))
    estimated_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    client: Mapped[Client] = relationship(back_populates="sinistres")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="sinistres")
    contract: Mapped[InsuranceContract | None] = relationship(back_populates="sinistres")
    documents: Mapped[list["Document"]] = relationship(back_populates="sinistre")


class Document(TimestampMixin, Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True, nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), index=True)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("insurance_contracts.id", ondelete="SET NULL"), index=True)
    sinistre_id: Mapped[int | None] = mapped_column(ForeignKey("sinistres.id", ondelete="SET NULL"), index=True)
    document_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(600), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120))
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus, name="processing_status"), default=ProcessingStatus.PENDING, nullable=False, index=True
    )
    extracted_text: Mapped[str | None] = mapped_column(Text)
    ai_result: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    validated_data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    processing_error: Mapped[str | None] = mapped_column(Text)

    client: Mapped[Client] = relationship(back_populates="documents")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="documents")
    contract: Mapped[InsuranceContract | None] = relationship(back_populates="documents")
    sinistre: Mapped[Sinistre | None] = relationship(back_populates="documents")


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    client: Mapped[Client | None] = relationship(back_populates="notifications")


class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor: Mapped[str | None] = mapped_column(String(120), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
