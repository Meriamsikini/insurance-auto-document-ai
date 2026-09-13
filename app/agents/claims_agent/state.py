"""
app/agents/claims_agent/state.py

Définit ClaimAnalysisState : l'état partagé qui circule entre tous les noeuds
du graphe LangGraph. Chaque noeud lit une partie de cet état et retourne un
dict partiel qui vient le mettre à jour (comportement standard LangGraph).

`total=False` : tous les champs sont optionnels au démarrage, ils se
remplissent progressivement au fil de l'exécution du graphe.
"""
from __future__ import annotations

from typing import Any, TypedDict


class ClaimAnalysisState(TypedDict, total=False):
    # ── Entrée ────────────────────────────────────────────────────────────
    claim_id: int
    requested_by: str  # nom du gestionnaire qui a déclenché l'analyse

    # ── Contexte récupéré (noeud gather_context) ────────────────────────
    claim_data: dict[str, Any]
    client_data: dict[str, Any]
    vehicle_data: dict[str, Any]
    contract_data: dict[str, Any] | None
    documents: list[dict[str, Any]]
    ocr_texts: dict[str, str]  # {document_id: texte déjà extrait par OCR/Gemini}

    # ── Résultats d'analyse (produits par les noeuds suivants) ──────────
    coherence_summary: str
    anomalies: list[dict[str, Any]]
    fraud_risk_score: float  # 0.0 - 1.0
    fraud_risk_level: str  # "low" | "medium" | "high"
    amount_analysis: dict[str, Any]
    indemnity_estimate: dict[str, Any]

    # ── Décision finale (noeud routing) ──────────────────────────────────
    requires_human_review: bool
    recommendation: str
    final_report: dict[str, Any]

    # ── Traçabilité / debug ──────────────────────────────────────────────
    steps_log: list[dict[str, Any]]
    errors: list[str]
