"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

const STEP_LABELS: Record<string, string> = {
  gather_context: "Collecte du contexte (client, véhicule, contrat, documents)",
  coherence_analysis: "Analyse de cohérence du dossier",
  fraud_risk_analysis: "Évaluation du risque de fraude",
  financial_analysis: "Analyse financière (montants)",
  indemnity_calculation: "Calcul de l'indemnisation",
  routing: "Décision de routage",
  human_review: "Notification du gestionnaire",
  generate_report: "Génération du rapport",
};

const STEP_ORDER = Object.keys(STEP_LABELS);

/**
 * Affiche l'avancement du graphe LangGraph sous forme de checklist.
 * `completedSteps` est alimenté au fil des événements SSE reçus par
 * streamClaimAnalysis (voir lib/claims-agent-api.ts).
 * `human_review` n'apparaît que si le dossier a effectivement été routé
 * vers cette branche — il est simplement ignoré sinon.
 */
export function AnalysisTimeline({ completedSteps }: { completedSteps: string[] }) {
  const visibleSteps = STEP_ORDER.filter(
    (step) => step !== "human_review" || completedSteps.includes("human_review"),
  );

  return (
    <div className="space-y-1.5">
      {visibleSteps.map((step) => {
        const done = completedSteps.includes(step);
        const nextIndex = visibleSteps.findIndex((s) => !completedSteps.includes(s));
        const isNext = !done && visibleSteps.indexOf(step) === nextIndex;

        return (
          <div key={step} className="flex items-center gap-2 text-sm">
            {done ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            ) : isNext ? (
              <Loader2 size={15} className="shrink-0 animate-spin text-brand-400" />
            ) : (
              <Circle size={15} className="shrink-0 text-ink3" />
            )}
            <span className={done ? "text-ink" : "text-ink3"}>{STEP_LABELS[step]}</span>
          </div>
        );
      })}
    </div>
  );
}
