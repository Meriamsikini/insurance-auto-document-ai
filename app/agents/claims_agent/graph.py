"""
app/agents/claims_agent/graph.py

Assemble les noeuds de nodes.py en un StateGraph LangGraph :

    gather_context → coherence_analysis → fraud_risk_analysis
    → financial_analysis → indemnity_calculation → routing
                                                       ├── human_review ──┐
                                                       └──────────────────┴─→ generate_report → END

Choix de conception : les deux branches de `routing` convergent vers
`generate_report`. Autrement dit, un rapport est TOUJOURS généré et
sauvegardé, que le dossier nécessite ou non une revue humaine — seul le
champ `requires_human_review` change. La branche `human_review` ajoute en
plus une notification temps réel au gestionnaire.
Si vous préférez qu'un rapport ne soit PAS auto-généré tant qu'un
gestionnaire n'a pas traité l'alerte, remplacez
`graph.add_edge("human_review", "generate_report")` par
`graph.add_edge("human_review", END)`.
"""
from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.agents.claims_agent.nodes import (
    financial_analysis_node,
    fraud_risk_node,
    indemnity_node,
    make_coherence_node,
    make_gather_context_node,
    make_generate_report_node,
    make_human_review_node,
    routing_node,
)
from app.agents.claims_agent.state import ClaimAnalysisState


def _route_after_analysis(state: ClaimAnalysisState) -> str:
    return "human_review" if state.get("requires_human_review") else "generate_report"


def build_claims_agent_graph(db: Session):
    """Construit et compile le graphe pour une session DB donnée.
    À appeler une fois par requête (voir app/api/routes/claims_agent.py),
    car les noeuds "factory" referment sur cette session."""
    graph = StateGraph(ClaimAnalysisState)

    graph.add_node("gather_context", make_gather_context_node(db))
    graph.add_node("coherence_analysis", make_coherence_node(db))
    graph.add_node("fraud_risk_analysis", fraud_risk_node)
    graph.add_node("financial_analysis", financial_analysis_node)
    graph.add_node("indemnity_calculation", indemnity_node)
    graph.add_node("routing", routing_node)
    graph.add_node("human_review", make_human_review_node(db))
    graph.add_node("generate_report", make_generate_report_node(db))

    graph.set_entry_point("gather_context")
    graph.add_edge("gather_context", "coherence_analysis")
    graph.add_edge("coherence_analysis", "fraud_risk_analysis")
    graph.add_edge("fraud_risk_analysis", "financial_analysis")
    graph.add_edge("financial_analysis", "indemnity_calculation")
    graph.add_edge("indemnity_calculation", "routing")
    graph.add_conditional_edges(
        "routing",
        _route_after_analysis,
        {"human_review": "human_review", "generate_report": "generate_report"},
    )
    graph.add_edge("human_review", "generate_report")
    graph.add_edge("generate_report", END)

    # MemorySaver = état d'exécution gardé en RAM (perdu au redémarrage du
    # serveur). Suffisant pour un WIP. En production, remplacez par
    # PostgresSaver pour pouvoir reprendre/consulter une exécution après un
    # redémarrage (voir requirements-agent.txt).
    return graph.compile(checkpointer=MemorySaver())
