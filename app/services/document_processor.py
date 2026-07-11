from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Document, ProcessingStatus, Sinistre
from app.services.audit import write_audit_log
from app.services.notifications import create_notification, push_event
from app.services.pipeline import process_uploaded_document

logger = logging.getLogger(__name__)

IMAGE_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
PDF_MIME_TYPE = "application/pdf"
ACCIDENT_TYPES = {"accident", "accidents", "accident_photo", "accident_photos", "sinistre_photo"}
INVOICE_TYPES = {"devis", "repair_invoice", "facture_reparation", "facture_garage", "invoice"}


def _is_pdf(document: Document, path: Path) -> bool:
    return document.content_type == PDF_MIME_TYPE or path.suffix.lower() == ".pdf"


def _is_image(document: Document, path: Path) -> bool:
    return (document.content_type or "").lower() in IMAGE_MIME_TYPES or path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}


def _to_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).replace(",", "."))
    except (InvalidOperation, ValueError):
        return None


def _apply_ai_result_to_claim(db: Session, document: Document, result: dict[str, Any]) -> None:
    if document.sinistre_id is None:
        return
    claim = db.get(Sinistre, document.sinistre_id)
    if claim is None:
        return

    doc_type = document.document_type.lower()
    metadata = dict(claim.metadata_ or {})
    ai_updates = dict(metadata.get("ai_updates") or {})
    ai_updates[str(document.id)] = {
        "document_type": document.document_type,
        "summary": result.get("accident_summary") or "",
        "damage_level": result.get("damage_level") or "",
        "damaged_parts": result.get("damaged_parts") or [],
        "garage_name": result.get("garage_name") or "",
        "total_cost": result.get("total_cost"),
        "repair_items": result.get("repair_items") or [],
    }
    metadata["ai_updates"] = ai_updates

    if doc_type in ACCIDENT_TYPES:
        if result.get("accident_summary"):
            claim.description = result["accident_summary"]
        if result.get("damage_level"):
            claim.damage_level = result["damage_level"]
        metadata["last_accident_photo_analysis"] = ai_updates[str(document.id)]

    if doc_type in INVOICE_TYPES:
        amount = _to_decimal(result.get("total_cost"))
        if amount is not None:
            claim.estimated_cost = amount
        if result.get("garage_name"):
            metadata["garage_name"] = result["garage_name"]
        if result.get("repair_items"):
            metadata["repair_items"] = result["repair_items"]
        if result.get("accident_summary") and not claim.description:
            claim.description = result["accident_summary"]

    claim.metadata_ = metadata
    write_audit_log(
        db,
        action="claim.ai_result_applied",
        entity_type="sinistre",
        entity_id=claim.id,
        payload={"document_id": document.id, "document_type": document.document_type},
    )


def process_document(document_id: int) -> None:
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            return
        _process_document(db, document)
    finally:
        db.close()


async def process_document_async(document_id: int) -> None:
    await asyncio.to_thread(process_document, document_id)


def _process_document(db: Session, document: Document) -> None:
    path = Path(document.file_path)
    logger.info(f"Début du traitement AI pour le document ID: {document.id} ({document.document_type})")
    document.processing_status = ProcessingStatus.PROCESSING
    document.processing_error = None
    create_notification(
        db,
        event_type="ai_processing_started",
        title="AI processing started",
        client_id=document.client_id,
        payload={"document_id": document.id, "document_type": document.document_type},
    )
    write_audit_log(
        db,
        action="document.processing_started",
        entity_type="document",
        entity_id=document.id,
        payload={"document_type": document.document_type},
    )
    db.commit()
    asyncio.run(
        push_event(
            "ai_processing_started",
            client_id=document.client_id,
            title="AI processing started",
            payload={"document_id": document.id, "document_type": document.document_type},
        )
    )

    try:
        extracted_text, result = process_uploaded_document(document)

        document.processing_status = ProcessingStatus.COMPLETED
        document.extracted_text = extracted_text
        document.ai_result = result
        _apply_ai_result_to_claim(db, document, result)
        create_notification(
            db,
            event_type="ai_processing_completed",
            title="AI processing completed",
            client_id=document.client_id,
            payload={"document_id": document.id, "document_type": document.document_type, "ai_result": result},
        )
        write_audit_log(
            db,
            action="document.processing_completed",
            entity_type="document",
            entity_id=document.id,
            payload={"document_type": document.document_type},
        )
        db.commit()
        asyncio.run(
            push_event(
                "ai_processing_completed",
                client_id=document.client_id,
                title="AI processing completed",
                payload={"document_id": document.id, "document_type": document.document_type, "ai_result": result},
            )
        )
        logger.info(f"Traitement réussi pour le document ID: {document.id}")

    except Exception as exc:
        logger.error(f"ÉCHEC CRITIQUE lors du traitement du document {document.id}: {str(exc)}", exc_info=True)
        document.processing_status = ProcessingStatus.FAILED
        document.processing_error = str(exc)
        create_notification(
            db,
            event_type="ai_processing_failed",
            title="AI processing failed",
            client_id=document.client_id,
            message=str(exc),
            payload={"document_id": document.id, "document_type": document.document_type},
        )
        write_audit_log(
            db,
            action="document.processing_failed",
            entity_type="document",
            entity_id=document.id,
            payload={"error": str(exc)},
        )
        db.commit()
        asyncio.run(
            push_event(
                "ai_processing_failed",
                client_id=document.client_id,
                title="AI processing failed",
                message=str(exc),
                payload={"document_id": document.id, "document_type": document.document_type},
            )
        )
