"use client";

/**
 * src/components/claims-agent/ClaimAnalysisPanel.tsx
 *
 * À intégrer dans l'onglet "claim" de platform-workspace.tsx, par exemple
 * juste avant <FormActions> :
 *
 *   {activeClaim && <ClaimAnalysisPanel claimId={activeClaim.id} />}
 *
 * Au montage, tente de charger le dernier rapport déjà sauvegardé
 * (fetchLatestAnalysis) pour ne pas repartir de zéro à chaque ouverture du
 * dossier. Le bouton "Lancer l'analyse" redéclenche le graphe LangGraph
 * complet et remplace le rapport affiché au fur et à mesure du streaming.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card } from "@/components/ui";
import { fetchLatestAnalysis, streamClaimAnalysis, type ClaimAnalysisReport } from "@/lib/claims-agent-api";
import { AnalysisTimeline } from "./AnalysisTimeline";

const RISK_TONE: Record<string, "green" | "amber" | "red"> = { low: "green", medium: "amber", high: "red" };

export function ClaimAnalysisPanel({ claimId }: { claimId: number }) {
  const [running, setRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [report, setReport] = useState<Partial<ClaimAnalysisReport> | null>(null);

  useEffect(() => {
    setReport(null);
    setCompletedSteps([]);
    fetchLatestAnalysis(claimId).then((existing) => {
      if (existing) setReport(existing);
    });
  }, [claimId]);

  async function runAnalysis() {
    setRunning(true);
    setCompletedSteps([]);
    setReport(null);
    try {
      await streamClaimAnalysis(claimId, ({ step, data }) => {
        setCompletedSteps((steps) => [...steps, step]);
        setReport((previous) => ({ ...previous, ...(data as Partial<ClaimAnalysisReport>) }));
      });
      toast.success("Analyse du sinistre terminée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'analyse.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-extrabold text-ink">
          <Bot size={17} /> Analyse IA du sinistre
        </div>
        <Button variant="primary" size="sm" disabled={running} onClick={runAnalysis}>
          {running ? "Analyse en cours…" : "Lancer l'analyse"}
        </Button>
      </div>

      {completedSteps.length > 0 && (
        <div className="mb-4 rounded-lg border border-line bg-surface2/50 p-3">
          <AnalysisTimeline completedSteps={completedSteps} />
        </div>
      )}

      {report?.fraud_risk_level && (
        <div className="space-y-3 border-t border-line pt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Risque de fraude :</span>
            <Badge tone={RISK_TONE[report.fraud_risk_level] ?? "slate"}>
              {report.fraud_risk_level.toUpperCase()} ({Math.round((report.fraud_risk_score ?? 0) * 100)}%)
            </Badge>
          </div>

          {report.coherence_summary && <p className="text-sm text-ink2">{report.coherence_summary}</p>}

          {!!report.anomalies?.length && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-2.5 text-sm text-amber-200">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} /> Anomalies détectées
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {report.anomalies.map((anomaly, index) => (
                  <li key={index}>{anomaly.detail}</li>
                ))}
              </ul>
            </div>
          )}

          {!!report.amount_analysis?.flags?.length && (
            <div className="rounded-lg border border-line bg-surface2/50 p-2.5 text-sm text-ink2">
              <div className="mb-1 font-semibold text-ink">Analyse financière</div>
              <ul className="list-inside list-disc space-y-0.5">
                {report.amount_analysis.flags.map((flag, index) => (
                  <li key={index}>{flag}</li>
                ))}
              </ul>
            </div>
          )}

          {report.indemnity_estimate?.estimate != null && (
            <div className="rounded-lg border border-line bg-surface2/50 p-2.5 text-sm">
              <div className="font-semibold text-ink">Estimation d&apos;indemnisation</div>
              <div className="text-ink2">
                {report.indemnity_estimate.estimate} MAD (franchise : {report.indemnity_estimate.deductible} MAD)
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-line p-2.5 text-sm">
            {report.requires_human_review ? (
              <ShieldAlert size={16} className="shrink-0 text-amber-400" />
            ) : (
              <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
            )}
            <span className="text-ink2">{report.recommendation}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
