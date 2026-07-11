from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260608_0001"
down_revision = None
branch_labels = None
depends_on = None


claim_status = sa.Enum(
    "DECLARED",
    "UNDER_REVIEW",
    "DOCUMENTS_PENDING",
    "APPROVED",
    "REJECTED",
    "CLOSED",
    name="claim_status",
)
processing_status = sa.Enum("PENDING", "PROCESSING", "COMPLETED", "FAILED", name="processing_status")


def upgrade() -> None:
    claim_status.create(op.get_bind(), checkfirst=True)
    processing_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_type", sa.String(length=30), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("cin_number", sa.String(length=80), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=80), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cin_number"),
    )
    op.create_index(op.f("ix_clients_full_name"), "clients", ["full_name"])
    op.create_index(op.f("ix_clients_email"), "clients", ["email"])
    op.create_index(op.f("ix_clients_phone"), "clients", ["phone"])

    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("registration_number", sa.String(length=80), nullable=True),
        sa.Column("vin", sa.String(length=80), nullable=True),
        sa.Column("make", sa.String(length=120), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("usage", sa.String(length=120), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vin"),
    )
    op.create_index(op.f("ix_vehicles_client_id"), "vehicles", ["client_id"])
    op.create_index(op.f("ix_vehicles_registration_number"), "vehicles", ["registration_number"])
    op.create_index(op.f("ix_vehicles_make"), "vehicles", ["make"])
    op.create_index(op.f("ix_vehicles_model"), "vehicles", ["model"])

    op.create_table(
        "insurance_contracts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("policy_number", sa.String(length=120), nullable=False),
        sa.Column("provider", sa.String(length=180), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("premium_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("coverage", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("policy_number"),
    )
    op.create_index(op.f("ix_insurance_contracts_client_id"), "insurance_contracts", ["client_id"])
    op.create_index(op.f("ix_insurance_contracts_vehicle_id"), "insurance_contracts", ["vehicle_id"])
    op.create_index(op.f("ix_insurance_contracts_provider"), "insurance_contracts", ["provider"])
    op.create_index(op.f("ix_insurance_contracts_status"), "insurance_contracts", ["status"])

    op.create_table(
        "sinistres",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("contract_id", sa.Integer(), nullable=True),
        sa.Column("claim_number", sa.String(length=120), nullable=False),
        sa.Column("status", claim_status, nullable=False),
        sa.Column("accident_date", sa.Date(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("damage_level", sa.String(length=80), nullable=True),
        sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("approved_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contract_id"], ["insurance_contracts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("claim_number"),
    )
    op.create_index(op.f("ix_sinistres_client_id"), "sinistres", ["client_id"])
    op.create_index(op.f("ix_sinistres_vehicle_id"), "sinistres", ["vehicle_id"])
    op.create_index(op.f("ix_sinistres_contract_id"), "sinistres", ["contract_id"])
    op.create_index(op.f("ix_sinistres_status"), "sinistres", ["status"])

    op.create_table(
        "claim_status_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sinistre_id", sa.Integer(), nullable=False),
        sa.Column("from_status", claim_status, nullable=True),
        sa.Column("to_status", claim_status, nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("changed_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sinistre_id"], ["sinistres.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_claim_status_history_sinistre_id"), "claim_status_history", ["sinistre_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("contract_id", sa.Integer(), nullable=True),
        sa.Column("sinistre_id", sa.Integer(), nullable=True),
        sa.Column("document_type", sa.String(length=80), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=600), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("processing_status", processing_status, nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("ai_result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("validated_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contract_id"], ["insurance_contracts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sinistre_id"], ["sinistres.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_client_id"), "documents", ["client_id"])
    op.create_index(op.f("ix_documents_document_type"), "documents", ["document_type"])
    op.create_index(op.f("ix_documents_processing_status"), "documents", ["processing_status"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_client_id"), "notifications", ["client_id"])
    op.create_index(op.f("ix_notifications_event_type"), "notifications", ["event_type"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor", sa.String(length=120), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_actor"), "audit_logs", ["actor"])
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"])
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"])
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("documents")
    op.drop_table("claim_status_history")
    op.drop_table("sinistres")
    op.drop_table("insurance_contracts")
    op.drop_table("vehicles")
    op.drop_table("clients")
    processing_status.drop(op.get_bind(), checkfirst=True)
    claim_status.drop(op.get_bind(), checkfirst=True)
