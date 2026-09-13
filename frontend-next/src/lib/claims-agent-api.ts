/**
 * src/lib/claims-agent-api.ts
 *
 * Client pour l'AI Claims Agent. Le streaming SSE passe par `fetch` brut
 * (pas par l'instance axios `api` de src/lib/api.ts) car axios ne gère pas
 * nativement la lecture incrémentale d'un ReadableStream dans le navigateur.
 * La lecture du dernier rapport, elle, réutilise `api` normalement.
 */
import { loadStoredToken } from "@/lib/auth";
import { api } from "@/lib/api";

export type AnalysisAnomaly = {
  type: string;
  detail: string;
  related_claim_id?: number;
  related_claim_number?: string;
};

export type AnalysisStepEvent = {
  step:
    | "gather_context"
    | "coherence_analysis"
    | "fraud_risk_analysis"
    | "financial_analysis"
    | "indemnity_calculation"
    | "routing"
    | "human_review"
    | "generate_report";
  data: Record<string, unknown>;
};

export type ClaimAnalysisReport = {
  id: number;
  coherence_summary: string | null;
  anomalies: AnalysisAnomaly[];
  fraud_risk_score: number | null;
  fraud_risk_level: "low" | "medium" | "high" | null;
  amount_analysis: { values: Record<string, number | null>; flags: string[]; coherent: boolean } | null;
  indemnity_estimate: { base_amount?: number; deductible?: number; estimate?: number; note?: string } | null;
  requires_human_review: boolean;
  recommendation: string | null;
  requested_by: string | null;
  created_at: string;
};

/**
 * Déclenche l'analyse d'un sinistre et appelle `onStep` à chaque étape
 * terminée du graphe LangGraph (SSE). La promesse se résout une fois le
 * flux terminé ([DONE]).
 */
export async function streamClaimAnalysis(
  claimId: number,
  onStep: (event: AnalysisStepEvent) => void,
): Promise<void> {
  const response = await fetch(`/api/v1/claims/${claimId}/analyze`, {
    method: "POST",
    headers: { Authorization: `Bearer ${loadStoredToken() ?? ""}` },
  });

  if (!response.ok) {
    throw new Error(`Erreur lors du lancement de l'analyse (HTTP ${response.status}).`);
  }
  if (!response.body) {
    throw new Error("Flux de réponse indisponible pour ce navigateur.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const line = rawEvent.trim();
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice("data: ".length);
      if (payload === "[DONE]") return;
      onStep(JSON.parse(payload) as AnalysisStepEvent);
    }
  }
}

export async function fetchLatestAnalysis(claimId: number): Promise<ClaimAnalysisReport | null> {
  try {
    const response = await api.get<ClaimAnalysisReport>(`/claims/${claimId}/analysis`);
    return response.data;
  } catch {
    return null;
  }
}
