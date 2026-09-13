"""
app/agents/claims_agent/business_rules.py

Fonctions métier déterministes de l'AI Claims Agent :
    check_duplicates, amount_analysis, indemnity_calc

Volontairement séparées des noeuds LangGraph et du LLM : ce sont ces
fonctions (et non le modèle génératif) qui décident des chiffres et des
seuils. Le LLM (dans nodes.py) ne fait qu'interpréter et expliquer leurs
résultats — il ne recalcule jamais un montant lui-même. C'est le principe
central de l'architecture : "les règles métier et calculs déterministes
sont exécutés par des fonctions dédiées, le LLM raisonne et explique."

Tous les seuils ci-dessous sont des valeurs de départ à ajuster avec vos
équipes sinistres/actuariat.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models import Sinistre

# Fenêtre (en jours) pour considérer deux sinistres du même véhicule comme
# potentiellement liés/dupliqués.
DUPLICATE_WINDOW_DAYS = 5

# Seuils d'alerte sur les montants (MAD).
MAX_REASONABLE_COST_MAD = 300_000
AMOUNT_DEVIATION_ALERT_RATIO = 0.35  # 35% d'écart entre coût estimé et facture garage

# Règles de franchise (exemple simplifié — à remplacer par vos barèmes réels
# par type de contrat / garantie).
DEDUCTIBLE_RATE = 0.10
DEDUCTIBLE_MIN_MAD = 1000
DEDUCTIBLE_MAX_MAD = 5000
SEVERITY_FACTORS = {"leger": 1.0, "modere": 0.95, "severe": 0.9}


def check_duplicates(
    db: Session, *, claim_id: int, vehicle_id: int | None, accident_date: date | None
) -> list[dict[str, Any]]:
    """Recherche d'autres sinistres déclarés pour le même véhicule sur une
    fenêtre de temps rapprochée — signal classique de double déclaration ou
    de sinistre fractionné."""
    if vehicle_id is None or accident_date is None:
        return []

    window_start = accident_date - timedelta(days=DUPLICATE_WINDOW_DAYS)
    window_end = accident_date + timedelta(days=DUPLICATE_WINDOW_DAYS)

    candidates = (
        db.query(Sinistre)
        .filter(
            and_(
                Sinistre.vehicle_id == vehicle_id,
                Sinistre.id != claim_id,
                Sinistre.accident_date.isnot(None),
                Sinistre.accident_date >= window_start,
                Sinistre.accident_date <= window_end,
            )
        )
        .all()
    )
    return [
        {
            "type": "duplicate_claim",
            "related_claim_id": candidate.id,
            "related_claim_number": candidate.claim_number,
            "accident_date": str(candidate.accident_date),
            "detail": (
                f"Sinistre {candidate.claim_number} déclaré pour le même véhicule "
                f"le {candidate.accident_date} (fenêtre de {DUPLICATE_WINDOW_DAYS} jours)."
            ),
        }
        for candidate in candidates
    ]


def amount_analysis(
    *, estimated_cost: float | None, garage_cost_ttc: float | None, invoice_amounts: list[float]
) -> dict[str, Any]:
    """Compare le coût estimé du sinistre, le coût de réparation déclaré par
    le garage et les montants des factures déposées ; signale les écarts
    significatifs entre ces trois sources."""
    values: dict[str, Any] = {"estimated_cost": estimated_cost, "garage_cost_ttc": garage_cost_ttc}
    flags: list[str] = []

    if estimated_cost is not None and garage_cost_ttc is not None and estimated_cost > 0:
        deviation = abs(garage_cost_ttc - estimated_cost) / estimated_cost
        values["deviation_ratio"] = round(deviation, 3)
        if deviation > AMOUNT_DEVIATION_ALERT_RATIO:
            flags.append(
                f"Écart de {round(deviation * 100)}% entre le coût estimé déclaré "
                f"et la facture garage (seuil : {int(AMOUNT_DEVIATION_ALERT_RATIO * 100)}%)."
            )

    if garage_cost_ttc is not None and garage_cost_ttc > MAX_REASONABLE_COST_MAD:
        flags.append(f"Montant de réparation ({garage_cost_ttc} MAD) supérieur au seuil habituel.")

    if invoice_amounts and garage_cost_ttc is not None:
        total_invoices = sum(invoice_amounts)
        tolerance = max(500.0, garage_cost_ttc * 0.05)
        if abs(total_invoices - garage_cost_ttc) > tolerance:
            flags.append("Le total des factures déposées ne correspond pas au coût de réparation déclaré.")

    return {"values": values, "flags": flags, "coherent": len(flags) == 0}


def indemnity_calc(
    *, garage_cost_ttc: float | None, approved_amount: float | None, damage_level: str | None
) -> dict[str, Any]:
    """Applique les règles métier déterministes pour estimer l'indemnisation
    potentielle : franchise selon le montant, pondération selon la gravité
    des dommages. C'est une ESTIMATION indicative pour aider le gestionnaire,
    pas une décision d'indemnisation finale."""
    base = garage_cost_ttc if garage_cost_ttc is not None else approved_amount
    if base is None:
        return {"estimate": None, "deductible": None, "note": "Coût de réparation inconnu, calcul impossible."}

    deductible = min(max(base * DEDUCTIBLE_RATE, DEDUCTIBLE_MIN_MAD), DEDUCTIBLE_MAX_MAD)
    severity_factor = SEVERITY_FACTORS.get((damage_level or "").strip().lower(), 1.0)
    estimate = round(max(base - deductible, 0) * severity_factor, 2)

    return {
        "base_amount": round(base, 2),
        "deductible": round(deductible, 2),
        "severity_factor": severity_factor,
        "estimate": estimate,
    }
