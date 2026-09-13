"""
app/agents/claims_agent/tools.py

Tools "données + actions" de l'AI Claims Agent, tels que décrits dans
l'architecture :

    get_claim_tool, get_client_tool, get_documents_tool, ocr_text_tool
    push_notification, save_report

On y ajoute get_vehicle_tool et get_contract_tool (mentionnés dans le texte
d'architecture : "accéder aux informations du client, du véhicule, du
contrat et des documents").

Ces fonctions sont volontairement de simples fonctions Python (pas des
noeuds LangGraph, pas des objets @tool LangChain) : elles sont appelées
directement par les noeuds du graphe (voir nodes.py), ce qui garde le
comportement 100% déterministe et testable. Si un jour vous voulez un mode
conversationnel où le LLM choisit lui-même quels outils appeler (cf.
l'Assistant Sinistre discuté précédemment), il suffit de les envelopper
avec le décorateur `@tool` de `langchain_core.tools`.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Client, Document, InsuranceContract, Sinistre, Vehicle


# ── Tools de lecture ──────────────────────────────────────────────────────


def get_claim_tool(db: Session, claim_id: int) -> dict[str, Any]:
    """Récupère les informations principales du sinistre : date, lieu,
    description, niveau de dommage, coût estimé/approuvé et métadonnées
    (constat, garage, PV...)."""
    claim = db.get(Sinistre, claim_id)
    if claim is None:
        return {"error": f"Sinistre {claim_id} introuvable."}
    return {
        "id": claim.id,
        "claim_number": claim.claim_number,
        "client_id": claim.client_id,
        "vehicle_id": claim.vehicle_id,
        "contract_id": claim.contract_id,
        "accident_date": str(claim.accident_date) if claim.accident_date else None,
        "location": claim.location,
        "description": claim.description,
        "damage_level": claim.damage_level,
        "estimated_cost": float(claim.estimated_cost) if claim.estimated_cost is not None else None,
        "approved_amount": float(claim.approved_amount) if claim.approved_amount is not None else None,
        "metadata": claim.metadata_ or {},
    }


def get_client_tool(db: Session, client_id: int) -> dict[str, Any]:
    """Récupère les informations du client concerné par le sinistre."""
    client = db.get(Client, client_id)
    if client is None:
        return {"error": f"Client {client_id} introuvable."}
    return {
        "id": client.id,
        "full_name": client.full_name,
        "cin_number": client.cin_number,
        "client_type": client.client_type,
        "email": client.email,
        "phone": client.phone,
        "address": client.address,
        "metadata": client.metadata_ or {},
    }


def get_vehicle_tool(db: Session, vehicle_id: int | None) -> dict[str, Any]:
    """Récupère les informations du véhicule assuré."""
    if vehicle_id is None:
        return {}
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        return {"error": f"Véhicule {vehicle_id} introuvable."}
    return {
        "id": vehicle.id,
        "registration_number": vehicle.registration_number,
        "vin": vehicle.vin,
        "make": vehicle.make,
        "model": vehicle.model,
        "year": vehicle.year,
        "usage": vehicle.usage,
        "metadata": vehicle.metadata_ or {},
    }


def get_contract_tool(db: Session, contract_id: int | None) -> dict[str, Any] | None:
    """Récupère le contrat d'assurance lié au sinistre, pour vérifier que la
    couverture était active à la date de l'accident."""
    if contract_id is None:
        return None
    contract = db.get(InsuranceContract, contract_id)
    if contract is None:
        return {"error": f"Contrat {contract_id} introuvable."}
    return {
        "id": contract.id,
        "policy_number": contract.policy_number,
        "provider": contract.provider,
        "status": contract.status,
        "start_date": str(contract.start_date) if contract.start_date else None,
        "end_date": str(contract.end_date) if contract.end_date else None,
        "premium_amount": float(contract.premium_amount) if contract.premium_amount is not None else None,
        "coverage": contract.coverage or {},
    }


def get_documents_tool(db: Session, claim_id: int) -> list[dict[str, Any]]:
    """Récupère l'ensemble des documents associés au sinistre et le résultat
    déjà produit par le pipeline OCR/Gemini pour chacun d'eux."""
    documents = db.query(Document).filter(Document.sinistre_id == claim_id).all()
    return [
        {
            "id": document.id,
            "document_type": document.document_type,
            "original_filename": document.original_filename,
            "processing_status": str(document.processing_status),
            "ai_result": document.ai_result or {},
        }
        for document in documents
    ]


def ocr_text_tool(db: Session, claim_id: int) -> dict[str, str]:
    """Réutilise les textes déjà extraits par le pipeline OCR Mistral + Gemini
    (voir app/services/pipeline.py) sans relancer d'analyse documentaire —
    évite un appel OCR redondant et coûteux."""
    documents = db.query(Document).filter(Document.sinistre_id == claim_id).all()
    return {
        str(document.id): document.extracted_text
        for document in documents
        if document.extracted_text
    }


# ── Tools d'action ────────────────────────────────────────────────────────


def push_notification(
    db: Session,
    *,
    claim_id: int,
    client_id: int | None,
    title: str,
    message: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Notifie le gestionnaire (via le système de notifications existant —
    app/services/notifications.py, déjà relié au WebSocket temps réel) qu'une
    intervention humaine est nécessaire sur ce sinistre."""
    from app.services.notifications import create_notification

    create_notification(
        db,
        event_type="claim_analysis_alert",
        title=title,
        client_id=client_id,
        message=message,
        payload={"claim_id": claim_id, **(payload or {})},
    )
    db.commit()


def save_report(db: Session, *, claim_id: int, report: dict[str, Any], requested_by: str | None = None) -> int:
    """Enregistre le rapport final produit par l'agent dans PostgreSQL
    (table claim_analysis_reports, voir app/models_claims_agent.py).
    Retourne l'id du rapport créé."""
    from app.models_claims_agent import ClaimAnalysisReport

    record = ClaimAnalysisReport(
        sinistre_id=claim_id,
        coherence_summary=report.get("coherence_summary"),
        anomalies=report.get("anomalies", []),
        fraud_risk_score=report.get("fraud_risk_score"),
        fraud_risk_level=report.get("fraud_risk_level"),
        amount_analysis=report.get("amount_analysis", {}),
        indemnity_estimate=report.get("indemnity_estimate", {}),
        requires_human_review=report.get("requires_human_review", False),
        recommendation=report.get("recommendation"),
        requested_by=requested_by,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record.id
