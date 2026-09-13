"""
app/api/routes/claims_agent.py

Expose l'AI Claims Agent au frontend :

    POST /api/v1/claims/{claim_id}/analyze    → déclenche l'analyse, stream
                                                  chaque étape en SSE au fur
                                                  et à mesure de son exécution
    GET  /api/v1/claims/{claim_id}/analysis   → relit le dernier rapport
                                                  déjà sauvegardé

À enregistrer dans app/main.py aux côtés des autres routers :

    from app.api.routes import claims_agent
    app.include_router(claims_agent.router, prefix=settings.api_prefix)
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agents.claims_agent.graph import build_claims_agent_graph
from app.api.routes.auth import get_current_active_employee
from app.db.session import get_db
from app.models import Employee, Sinistre
from app.models_claims_agent import ClaimAnalysisReport

router = APIRouter(prefix="/claims", tags=["claims-agent"])


@router.post("/{claim_id}/analyze")
def analyze_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    employee: Employee = Depends(get_current_active_employee),
) -> StreamingResponse:
    if db.get(Sinistre, claim_id) is None:
        raise HTTPException(status_code=404, detail="Sinistre introuvable.")

    graph = build_claims_agent_graph(db)
    config = {"configurable": {"thread_id": f"claim-analysis-{claim_id}"}}
    initial_state = {
        "claim_id": claim_id,
        "requested_by": employee.full_name,
        "steps_log": [],
        "anomalies": [],
        "errors": [],
    }

    def event_stream():
        # stream_mode="updates" : à chaque noeud terminé, LangGraph émet
        # {nom_du_noeud: état_partiel_retourné_par_ce_noeud}. On relaie ça
        # tel quel au frontend, qui peut ainsi afficher une timeline en
        # temps réel (voir ClaimAnalysisPanel.tsx côté frontend).
        for step_output in graph.stream(initial_state, config=config, stream_mode="updates"):
            for node_name, node_state in step_output.items():
                yield f"data: {json.dumps({'step': node_name, 'data': node_state}, default=str, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{claim_id}/analysis")
def get_latest_analysis(
    claim_id: int,
    db: Session = Depends(get_db),
    employee: Employee = Depends(get_current_active_employee),
) -> dict:
    report = (
        db.query(ClaimAnalysisReport)
        .filter(ClaimAnalysisReport.sinistre_id == claim_id)
        .order_by(ClaimAnalysisReport.created_at.desc())
        .first()
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Aucune analyse disponible pour ce sinistre.")

    return {
        "id": report.id,
        "coherence_summary": report.coherence_summary,
        "anomalies": report.anomalies,
        "fraud_risk_score": report.fraud_risk_score,
        "fraud_risk_level": report.fraud_risk_level,
        "amount_analysis": report.amount_analysis,
        "indemnity_estimate": report.indemnity_estimate,
        "requires_human_review": report.requires_human_review,
        "recommendation": report.recommendation,
        "requested_by": report.requested_by,
        "created_at": report.created_at.isoformat(),
    }
