"""
app/models_claims_agent.py

Modèle dédié à l'AI Claims Agent. Séparé de app/models.py pour ne pas modifier
un fichier existant volumineux — à fusionner dans app/models.py (ou à laisser
tel quel et simplement importer ce module) selon vos préférences.

IMPORTANT : ce module doit être importé quelque part avant l'appel à
`Base.metadata.create_all()` (voir init_db.py) ou avant de générer une
migration Alembic, sinon la table ne sera pas créée. Le plus simple est
d'ajouter :

    from app import models_claims_agent  # noqa: F401

dans init_db.py, juste après les autres imports de modèles.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClaimAnalysisReport(Base):
    """Rapport généré par l'AI Claims Agent (LangGraph) pour un sinistre donné.

    Un sinistre peut avoir plusieurs rapports au fil du temps (l'analyse peut
    être relancée après ajout de nouvelles pièces) : on ne met jamais à jour
    une ligne existante, on en insère une nouvelle et on lit la plus récente.
    """

    __tablename__ = "claim_analysis_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sinistre_id: Mapped[int] = mapped_column(
        ForeignKey("sinistres.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Étape 1 — cohérence (texte libre généré par le LLM)
    coherence_summary: Mapped[str | None] = mapped_column(String, nullable=True)

    # Étape 2 — anomalies / fraude
    anomalies: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    fraud_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fraud_risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # low | medium | high

    # Étape 3 — analyse financière
    amount_analysis: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    # Étape 4 — indemnisation
    indemnity_estimate: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    # Étape 5 — routage / décision
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recommendation: Mapped[str | None] = mapped_column(String, nullable=True)

    # Traçabilité
    requested_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
