from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Document, ProcessingStatus, Sinistre, Vehicle, Client
from app.services.audit import write_audit_log
from app.services.notifications import create_notification, push_event
from app.services.pipeline import process_uploaded_document

logger = logging.getLogger(__name__)

IMAGE_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
PDF_MIME_TYPE = "application/pdf"
ACCIDENT_TYPES = {"accident", "accidents", "accident_photo", "accident_photos", "sinistre_photo"}
INVOICE_TYPES = {"devis", "repair_invoice", "facture_reparation", "facture_garage", "invoice"}
VEHICLE_DOC_TYPES = {"cg", "carte_grise", "permis", "ct", "att", "attestation", "facture", "facture_achat"}
CLIENT_DOC_TYPES = {"cin", "domicile", "proof_of_residence"}


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


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return " ".join(str(item) for item in value if item not in (None, "", []))
    return str(value)


def _extract_ai_metadata(result: dict[str, Any]) -> dict[str, Any]:
    raw = result.get("raw_fields") if isinstance(result.get("raw_fields"), dict) else {}
    accident_summary = _as_text(result.get("accident_summary") or raw.get("accident_summary") or raw.get("description") or "").strip()
    photo_comment = _as_text(raw.get("commentaire") or raw.get("commentary") or accident_summary).strip()

    constat = {
        "heure": _as_text(raw.get("heure") or raw.get("heure_accident") or raw.get("time") or "").strip(),
        "conducteur_a": _as_text(raw.get("conducteur_a") or raw.get("conducteur a") or raw.get("vehicule_a") or "").strip(),
        "conducteur_b": _as_text(raw.get("conducteur_b") or raw.get("conducteur b") or raw.get("vehicule_b") or "").strip(),
        "assureur_a": _as_text(raw.get("assureur_a") or raw.get("assureur a") or raw.get("compagnie a") or "").strip(),
        "assureur_b": _as_text(raw.get("assureur_b") or raw.get("assureur b") or raw.get("compagnie b") or "").strip(),
        "croquis": _as_text(raw.get("croquis") or raw.get("croquis inclus") or raw.get("schema") or "").strip(),
        "date_accident": _as_text(raw.get("date_accident") or raw.get("date accident") or raw.get("date") or result.get("accident_date") or "").strip(),
        "lieu": _as_text(raw.get("lieu") or raw.get("location") or "").strip(),
    }
    constat = {key: value for key, value in constat.items() if value}

    metadata: dict[str, Any] = {}
    if constat:
        metadata["constat"] = constat
    if photo_comment:
        metadata["photos"] = {"commentaire": photo_comment}
    if accident_summary:
        metadata["accident_summary"] = accident_summary
    return metadata


def _apply_ai_result_to_vehicle(db: Session, document: Document, result: dict[str, Any]) -> None:
    """Persist AI-extracted vehicle document data to vehicle.metadata_."""
    if document.vehicle_id is None:
        return
    vehicle = db.get(Vehicle, document.vehicle_id)
    if vehicle is None:
        return

    doc_type = document.document_type.lower()
    metadata = dict(vehicle.metadata_ or {})
    raw = result.get("raw_fields") if isinstance(result.get("raw_fields"), dict) else {}

    if doc_type in {"cg", "carte_grise"}:
        metadata["cg"] = {
            "type": _as_text(raw.get("type") or result.get("type") or "").strip(),
            "cv": _as_text(raw.get("cv") or result.get("cv") or "").strip(),
            "energie": _as_text(raw.get("energie") or result.get("energie") or raw.get("carburant") or "").strip(),
            "ptac": _as_text(raw.get("ptac") or result.get("ptac") or "").strip(),
            "places": _as_text(raw.get("places") or result.get("places") or "").strip(),
            "couleur": _as_text(raw.get("couleur") or result.get("couleur") or "").strip(),
            "genre": _as_text(raw.get("genre") or result.get("genre") or "").strip(),
            "proprietaire": _as_text(raw.get("proprietaire") or result.get("proprietaire") or "").strip(),
            "adresse_proprietaire": _as_text(raw.get("adresse_proprietaire") or result.get("adresse") or "").strip(),
        }
        if not vehicle.make:
            vehicle.make = _as_text(result.get("make") or raw.get("marque") or "").strip() or None
        if not vehicle.model:
            vehicle.model = _as_text(result.get("model") or raw.get("modele") or "").strip() or None
        if not vehicle.vin:
            vehicle.vin = _as_text(result.get("vin") or raw.get("chassis") or "").strip() or None
        if not vehicle.year and result.get("year"):
            try:
                vehicle.year = int(result["year"])
            except (ValueError, TypeError):
                pass

    if doc_type == "permis":
        metadata["permis"] = {
            "conducteur": _as_text(raw.get("nom") or raw.get("conducteur") or result.get("name") or "").strip(),
            "numero": _as_text(raw.get("numero permis") or raw.get("numero") or result.get("permis_number") or "").strip(),
            "categories": _as_text(raw.get("categories") or raw.get("categorie") or result.get("categories") or "").strip(),
            "autorite": _as_text(raw.get("autorite") or result.get("autorite") or "").strip(),
            "delivrance": _as_text(raw.get("date delivrance") or raw.get("delivrance") or result.get("delivrance") or "").strip(),
            "expiration": _as_text(raw.get("date expiration") or raw.get("expiration") or result.get("expiration") or "").strip(),
        }
        metadata["permis"] = {k: v for k, v in metadata["permis"].items() if v}

    if doc_type == "ct":
        metadata["ct"] = {
            "date_visite": _as_text(raw.get("date visite") or raw.get("date") or result.get("date_visite") or "").strip(),
            "resultat": _as_text(raw.get("resultat") or result.get("resultat") or "").strip(),
            "expiration": _as_text(raw.get("date expiration") or raw.get("expiration") or result.get("expiration") or "").strip(),
            "kilometrage": _as_text(raw.get("kilometrage") or result.get("kilometrage") or "").strip(),
            "anomalies": _as_text(raw.get("anomalies") or result.get("anomalies") or "").strip(),
        }
        metadata["ct"] = {k: v for k, v in metadata["ct"].items() if v}

    if doc_type in {"att", "attestation"}:
        metadata["att"] = {
            "assureur": _as_text(raw.get("assureur") or raw.get("compagnie") or result.get("assureur") or "").strip(),
            "contrat": _as_text(raw.get("contrat") or raw.get("police") or raw.get("numero contrat") or result.get("contrat") or "").strip(),
            "debut": _as_text(raw.get("date debut") or raw.get("debut") or result.get("debut") or "").strip(),
            "fin": _as_text(raw.get("date fin") or raw.get("fin") or result.get("fin") or "").strip(),
            "bonus_malus": _as_text(raw.get("bonus_malus") or raw.get("bonus malus") or result.get("bonus_malus") or "").strip(),
            "sinistres": _as_text(raw.get("sinistres") or result.get("sinistres") or "").strip(),
        }
        metadata["att"] = {k: v for k, v in metadata["att"].items() if v}

    if doc_type in {"facture", "facture_achat", "invoice"}:
        metadata["facture"] = {
            "proprietaire": _as_text(raw.get("proprietaire") or raw.get("acheteur") or result.get("proprietaire") or "").strip(),
            "prix": _as_text(raw.get("prix") or raw.get("montant") or result.get("prix") or "").strip(),
            "date_achat": _as_text(raw.get("date achat") or raw.get("date") or result.get("date_achat") or "").strip(),
            "vendeur": _as_text(raw.get("vendeur") or raw.get("concessionnaire") or result.get("vendeur") or "").strip(),
            "vehicule_concerne": _as_text(raw.get("vehicule_concerne") or raw.get("vehicule concerne") or result.get("vehicule_concerne") or "").strip(),
        }
        metadata["facture"] = {k: v for k, v in metadata["facture"].items() if v}

    vehicle.metadata_ = metadata
    write_audit_log(
        db,
        action="vehicle.ai_result_applied",
        entity_type="vehicle",
        entity_id=vehicle.id,
        payload={"document_id": document.id, "document_type": document.document_type},
    )


def _apply_ai_result_to_client(db: Session, document: Document, result: dict[str, Any]) -> None:
    """Persist AI-extracted client document data to client.metadata_."""
    if document.client_id is None:
        return
    # Only process if this is not tied to a vehicle or claim
    if document.vehicle_id is not None or document.sinistre_id is not None:
        return

    client = db.get(Client, document.client_id)
    if client is None:
        return

    doc_type = document.document_type.lower()
    metadata = dict(client.metadata_ or {})
    raw = result.get("raw_fields") if isinstance(result.get("raw_fields"), dict) else {}

    if doc_type == "cin":
        metadata["cin"] = {
            "full_name": _as_text(result.get("name") or raw.get("full_name") or raw.get("nom complet") or "").strip(),
            "number": _as_text(result.get("cin_number") or raw.get("cin_number") or raw.get("numero cin") or raw.get("cin") or "").strip(),
            "birth_date": _as_text(raw.get("date naissance") or raw.get("birth_date") or result.get("birth_date") or "").strip(),
            "expiration": _as_text(raw.get("date expiration") or raw.get("expiration") or result.get("expiration") or "").strip(),
            "address": _as_text(raw.get("adresse") or raw.get("address") or result.get("address") or "").strip(),
            "sex": _as_text(raw.get("sexe") or raw.get("sex") or result.get("sex") or "").strip(),
            "city": _as_text(raw.get("ville") or raw.get("city") or result.get("city") or "").strip(),
        }
        metadata["cin"] = {k: v for k, v in metadata["cin"].items() if v}

    if doc_type == "domicile":
        metadata["domicile"] = {
            "address": _as_text(raw.get("adresse") or raw.get("address") or result.get("address") or "").strip(),
            "issuer": _as_text(raw.get("emetteur") or raw.get("issuer") or result.get("issuer") or "").strip(),
            "date": _as_text(raw.get("date") or result.get("date") or "").strip(),
        }
        metadata["domicile"] = {k: v for k, v in metadata["domicile"].items() if v}

    client.metadata_ = metadata
    write_audit_log(
        db,
        action="client.ai_result_applied",
        entity_type="client",
        entity_id=client.id,
        payload={"document_id": document.id, "document_type": document.document_type},
    )


def _apply_ai_result_to_claim(db: Session, document: Document, result: dict[str, Any]) -> None:
    if document.sinistre_id is None:
        return
    claim = db.get(Sinistre, document.sinistre_id)
    if claim is None:
        return

    doc_type = document.document_type.lower()
    metadata = dict(claim.metadata_ or {})
    raw = result.get("raw_fields") if isinstance(result.get("raw_fields"), dict) else {}
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

    if doc_type == "constat":
        ai_metadata = _extract_ai_metadata(result)
        if result.get("accident_summary"):
            claim.description = result["accident_summary"]
            metadata.setdefault("constat", {})["description"] = result["accident_summary"]
        if result.get("damage_level"):
            claim.damage_level = result["damage_level"]
        if ai_metadata.get("constat"):
            metadata["constat"] = {**metadata.get("constat", {}), **ai_metadata["constat"]}

    if doc_type in ACCIDENT_TYPES:
        ai_metadata = _extract_ai_metadata(result)
        if result.get("damage_level"):
            claim.damage_level = result["damage_level"]
        if ai_metadata.get("photos"):
            metadata["photos"] = {**metadata.get("photos", {}), **ai_metadata["photos"]}
        metadata["last_accident_photo_analysis"] = ai_updates[str(document.id)]

    if doc_type == "pv":
        metadata["pv"] = {
            "numero": _as_text(raw.get("numero pv") or raw.get("numero") or raw.get("numero_pv") or result.get("pv_number") or "").strip(),
            "responsabilite": _as_text(raw.get("responsabilite_probable") or raw.get("responsabilite") or result.get("responsabilite") or "").strip(),
            "parties": _as_text(raw.get("parties") or raw.get("parties_impliquees") or result.get("parties") or "").strip(),
            "expert_nom": _as_text(raw.get("expert_nom") or raw.get("expert") or result.get("expert_nom") or "").strip(),
            "expertise_date": _as_text(raw.get("date expertise") or raw.get("expertise_date") or raw.get("date_expertise") or result.get("expertise_date") or "").strip(),
            "cout_estime": _as_text(raw.get("cout_estime") or raw.get("cout estime") or result.get("total_cost") or "").strip(),
            "infractions": _as_text(raw.get("infractions") or raw.get("infractions_relevees") or result.get("infractions") or "").strip(),
        }
        metadata["pv"] = {k: v for k, v in metadata["pv"].items() if v}

    if doc_type in INVOICE_TYPES:
        amount = _to_decimal(result.get("total_cost"))
        if amount is not None:
            claim.estimated_cost = amount
        if result.get("garage_name") or (raw.get("garage") or raw.get("nom garage")):
            metadata["garage_name"] = _as_text(result.get("garage_name") or raw.get("garage") or raw.get("nom garage") or "").strip()
        metadata["garage"] = {
            "nom": _as_text(raw.get("garage") or raw.get("nom garage") or result.get("garage_name") or "").strip(),
            "cout_ht": _as_text(raw.get("cout_ht") or raw.get("cout ht") or raw.get("ht") or result.get("cout_ht") or "").strip(),
            "tva": _as_text(raw.get("tva") or raw.get("tv") or result.get("tva") or "20").strip(),
            "cout_ttc": _as_text(raw.get("cout_ttc") or raw.get("cout ttc") or result.get("total_cost") or "").strip(),
            "pieces": _as_text(raw.get("pieces") or raw.get("pieces_changees") or result.get("repair_items") or "").strip(),
        }
        metadata["garage"] = {k: v for k, v in metadata["garage"].items() if v}
        if result.get("repair_items"):
            metadata["repair_items"] = result["repair_items"]
        if result.get("accident_summary") and not claim.description:
            claim.description = result["accident_summary"]

    if not claim.accident_date and (result.get("accident_date") or (result.get("raw_fields") or {}).get("date_accident")):
        claim.accident_date = str(result.get("accident_date") or (result.get("raw_fields") or {}).get("date_accident"))
    if not claim.location and (result.get("raw_fields") or {}).get("lieu"):
        claim.location = str((result.get("raw_fields") or {}).get("lieu"))

    claim.metadata_ = metadata
    write_audit_log(
        db,
        action="claim.ai_result_applied",
        entity_type="sinistre",
        entity_id=claim.id,
        payload={"document_id": document.id, "document_type": document.document_type},
    )


def remove_document_ai_result(db: Session, document: Document) -> None:
    """Remove every persisted card value that was derived from *document*.

    Document deletion must not leave AI values in a parent record: those values
    would otherwise be re-hydrated when the dossier is opened again.
    """
    doc_type = document.document_type.lower()

    if document.vehicle_id is not None:
        vehicle = db.get(Vehicle, document.vehicle_id)
        if vehicle is not None:
            metadata = dict(vehicle.metadata_ or {})
            metadata_key = {
                "cg": "cg", "carte_grise": "cg", "permis": "permis", "ct": "ct",
                "att": "att", "attestation": "att", "facture": "facture",
                "facture_achat": "facture", "invoice": "facture",
            }.get(doc_type)
            if metadata_key:
                metadata.pop(metadata_key, None)
                # These columns are populated by the carte grise extraction.
                if metadata_key == "cg":
                    vehicle.make = vehicle.model = vehicle.vin = vehicle.year = None
                vehicle.metadata_ = metadata

    if document.client_id is not None and document.vehicle_id is None and document.sinistre_id is None:
        client = db.get(Client, document.client_id)
        if client is not None:
            metadata = dict(client.metadata_ or {})
            metadata_key = {"cin": "cin", "domicile": "domicile", "proof_of_residence": "domicile"}.get(doc_type)
            if metadata_key:
                metadata.pop(metadata_key, None)
                if metadata_key == "cin":
                    client.cin_number = None
                if metadata_key == "domicile":
                    client.address = None
                client.metadata_ = metadata

    if document.sinistre_id is not None:
        claim = db.get(Sinistre, document.sinistre_id)
        if claim is not None:
            metadata = dict(claim.metadata_ or {})
            ai_updates = dict(metadata.get("ai_updates") or {})
            ai_updates.pop(str(document.id), None)
            if ai_updates:
                metadata["ai_updates"] = ai_updates
            else:
                metadata.pop("ai_updates", None)

            if doc_type == "constat":
                metadata.pop("constat", None)
                metadata.pop("accident_summary", None)
                claim.description = None
                claim.accident_date = None
                claim.location = None
                claim.damage_level = None
            elif doc_type in ACCIDENT_TYPES:
                metadata.pop("photos", None)
                metadata.pop("last_accident_photo_analysis", None)
                claim.damage_level = None
            elif doc_type == "pv":
                metadata.pop("pv", None)
            elif doc_type in INVOICE_TYPES:
                for key in ("garage", "garage_name", "repair_items"):
                    metadata.pop(key, None)
                claim.estimated_cost = None

            claim.metadata_ = metadata


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
        _apply_ai_result_to_vehicle(db, document, result)
        _apply_ai_result_to_client(db, document, result)
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
