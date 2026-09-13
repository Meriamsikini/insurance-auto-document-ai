"""
app/agents/claims_agent/nodes.py

Chaque fonction ci-dessous est un noeud du graphe LangGraph (voir graph.py).
Un noeud reçoit l'état courant (ClaimAnalysisState) et retourne un dict
partiel qui vient le fusionner.

Certains noeuds ont besoin d'une session SQLAlchemy (accès DB) : ils sont
donc écrits comme des "factories" (`make_xxx_node(db)`) qui referment sur la
session et retournent la vraie fonction-noeud. Les noeuds purement
calculatoires (fraud_risk_node, financial_analysis_node, indemnity_node,
routing_node) n'ont pas besoin de DB et sont des fonctions directes.

Répartition volontaire LLM vs déterministe :
  - gather_context        : 100% déterministe (lecture DB)
  - coherence_analysis     : check_duplicates (déterministe) + LLM pour la
                              synthèse en langage naturel
  - fraud_risk_analysis    : scoring déterministe simple (pondération des
                              anomalies) — le LLM n'invente jamais le chiffre
  - financial_analysis     : amount_analysis (100% déterministe)
  - indemnity_calculation  : indemnity_calc (100% déterministe)
  - routing                : règle déterministe sur les résultats précédents
  - human_review           : notification (déterministe)
  - generate_report        : assemblage + sauvegarde (déterministe)
"""
from __future__ import annotations

from datetime import date
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy.orm import Session

from app.agents.claims_agent.business_rules import amount_analysis, check_duplicates, indemnity_calc
from app.agents.claims_agent.state import ClaimAnalysisState
from app.agents.claims_agent.tools import (
    get_claim_tool,
    get_client_tool,
    get_contract_tool,
    get_documents_tool,
    get_vehicle_tool,
    ocr_text_tool,
    push_notification,
    save_report,
)
from app.config import settings

FRAUD_RISK_HIGH_THRESHOLD = 0.5
FRAUD_RISK_MEDIUM_THRESHOLD = 0.25


def _log(state: ClaimAnalysisState, step: str) -> list[dict[str, Any]]:
    return [*state.get("steps_log", []), {"step": step, "status": "done"}]


def _llm() -> ChatGoogleGenerativeAI:
    # Réutilise le même modèle Gemini que app/services/gemini_processor.py
    # (settings.gemini_model / settings.gemini_api_key), température basse
    # car on veut du raisonnement factuel, pas de créativité.
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.1,
    )


# ── Noeud 1 : collecte de contexte ───────────────────────────────────────


def make_gather_context_node(db: Session):
    def gather_context(state: ClaimAnalysisState) -> dict[str, Any]:
        claim_id = state["claim_id"]
        claim_data = get_claim_tool(db, claim_id)
        if "error" in claim_data:
            return {"errors": [claim_data["error"]], "steps_log": _log(state, "gather_context")}

        return {
            "claim_data": claim_data,
            "client_data": get_client_tool(db, claim_data["client_id"]),
            "vehicle_data": get_vehicle_tool(db, claim_data.get("vehicle_id")),
            "contract_data": get_contract_tool(db, claim_data.get("contract_id")),
            "documents": get_documents_tool(db, claim_id),
            "ocr_texts": ocr_text_tool(db, claim_id),
            "steps_log": _log(state, "gather_context"),
        }

    return gather_context


# ── Noeud 2 : cohérence (déterministe + LLM) ─────────────────────────────


def make_coherence_node(db: Session):
    def coherence_analysis(state: ClaimAnalysisState) -> dict[str, Any]:
        claim = state["claim_data"]
        accident_date_str = claim.get("accident_date")
        accident_date = date.fromisoformat(accident_date_str) if accident_date_str else None

        duplicates = check_duplicates(
            db, claim_id=claim["id"], vehicle_id=claim.get("vehicle_id"), accident_date=accident_date
        )

        prompt = f"""Voici les données d'un sinistre automobile à analyser :

Sinistre : {claim}
Client : {state.get('client_data')}
Véhicule : {state.get('vehicle_data')}
Contrat : {state.get('contract_data')}
Documents déposés : {[d['document_type'] for d in state.get('documents', [])]}

Évalue la cohérence globale du dossier : la description correspond-elle au
niveau de dommage déclaré ? Le contrat couvrait-il le véhicule à la date de
l'accident ? Les documents essentiels (constat) sont-ils présents ?
Réponds en 3 à 4 phrases, en français, de façon factuelle, sans jamais
inventer une donnée absente du contexte fourni."""

        response = _llm().invoke(
            [
                SystemMessage(content="Tu es un analyste sinistre automobile rigoureux, tu ne spécules jamais."),
                HumanMessage(content=prompt),
            ]
        )

        return {
            "anomalies": duplicates,
            "coherence_summary": response.content,
            "steps_log": _log(state, "coherence_analysis"),
        }

    return coherence_analysis


# ── Noeud 3 : risque de fraude (déterministe) ────────────────────────────


def fraud_risk_node(state: ClaimAnalysisState) -> dict[str, Any]:
    anomalies = state.get("anomalies", [])
    has_duplicate = any(a.get("type") == "duplicate_claim" for a in anomalies)

    # Scoring simple et explicable — à affiner avec vos données historiques
    # (ex. modèle de scoring entraîné) sans changer l'interface du noeud.
    score = min(1.0, 0.2 * len(anomalies) + (0.3 if has_duplicate else 0.0))
    level = (
        "high"
        if score >= FRAUD_RISK_HIGH_THRESHOLD
        else "medium"
        if score >= FRAUD_RISK_MEDIUM_THRESHOLD
        else "low"
    )

    return {
        "fraud_risk_score": round(score, 2),
        "fraud_risk_level": level,
        "steps_log": _log(state, "fraud_risk_analysis"),
    }


# ── Noeud 4 : analyse financière (déterministe) ──────────────────────────


def financial_analysis_node(state: ClaimAnalysisState) -> dict[str, Any]:
    claim = state["claim_data"]
    metadata = claim.get("metadata") or {}
    garage = metadata.get("garage", {}) if isinstance(metadata, dict) else {}
    garage_cost_ttc = garage.get("cout_ttc")

    analysis = amount_analysis(
        estimated_cost=claim.get("estimated_cost"),
        garage_cost_ttc=float(garage_cost_ttc) if garage_cost_ttc not in (None, "") else None,
        invoice_amounts=[float(garage_cost_ttc)] if garage_cost_ttc not in (None, "") else [],
    )
    return {"amount_analysis": analysis, "steps_log": _log(state, "financial_analysis")}


# ── Noeud 5 : indemnisation (déterministe) ───────────────────────────────


def indemnity_node(state: ClaimAnalysisState) -> dict[str, Any]:
    claim = state["claim_data"]
    metadata = claim.get("metadata") or {}
    garage = metadata.get("garage", {}) if isinstance(metadata, dict) else {}
    garage_cost_ttc = garage.get("cout_ttc")

    estimate = indemnity_calc(
        garage_cost_ttc=float(garage_cost_ttc) if garage_cost_ttc not in (None, "") else None,
        approved_amount=claim.get("approved_amount"),
        damage_level=claim.get("damage_level"),
    )
    return {"indemnity_estimate": estimate, "steps_log": _log(state, "indemnity_calculation")}


# ── Noeud 6 : routage (déterministe) ─────────────────────────────────────


def routing_node(state: ClaimAnalysisState) -> dict[str, Any]:
    anomalies = state.get("anomalies", [])
    amount_flags = state.get("amount_analysis", {}).get("flags", [])
    fraud_level = state.get("fraud_risk_level", "low")

    requires_review = fraud_level in {"medium", "high"} or bool(anomalies) or bool(amount_flags)
    recommendation = (
        "Revue humaine recommandée avant toute décision d'indemnisation."
        if requires_review
        else "Dossier cohérent, aucune anomalie majeure détectée : traitement standard possible."
    )
    return {
        "requires_human_review": requires_review,
        "recommendation": recommendation,
        "steps_log": _log(state, "routing"),
    }


# ── Branche A : revue humaine (notification) ─────────────────────────────


def make_human_review_node(db: Session):
    def human_review(state: ClaimAnalysisState) -> dict[str, Any]:
        claim = state["claim_data"]
        push_notification(
            db,
            claim_id=claim["id"],
            client_id=claim.get("client_id"),
            title=f"Sinistre {claim['claim_number']} : revue humaine requise",
            message=state.get("recommendation", ""),
            payload={
                "fraud_risk_level": state.get("fraud_risk_level"),
                "anomalies_count": len(state.get("anomalies", [])),
            },
        )
        return {"steps_log": _log(state, "human_review")}

    return human_review


# ── Branche B (et suite de A) : génération + sauvegarde du rapport ───────


def make_generate_report_node(db: Session):
    def generate_report(state: ClaimAnalysisState) -> dict[str, Any]:
        report = {
            "coherence_summary": state.get("coherence_summary"),
            "anomalies": state.get("anomalies", []),
            "fraud_risk_score": state.get("fraud_risk_score"),
            "fraud_risk_level": state.get("fraud_risk_level"),
            "amount_analysis": state.get("amount_analysis"),
            "indemnity_estimate": state.get("indemnity_estimate"),
            "requires_human_review": state.get("requires_human_review"),
            "recommendation": state.get("recommendation"),
        }
        save_report(
            db,
            claim_id=state["claim_data"]["id"],
            report=report,
            requested_by=state.get("requested_by"),
        )
        return {"final_report": report, "steps_log": _log(state, "generate_report")}

    return generate_report
