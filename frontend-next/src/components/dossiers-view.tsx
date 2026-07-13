"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Car, CheckCircle2, CheckSquare, ClipboardCheck, Files, FileWarning, FolderKanban, Search, Trash2, User, XCircle } from "lucide-react";
import type { Claim, Client, DocumentItem, Vehicle } from "@/lib/api";
import { computeDossier, type DossierSummary } from "@/lib/document-schema";
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, StatCard } from "@/components/ui";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function DossiersView({
  clients,
  vehicles,
  claims,
  documents,
  onOpenInWorkspace,
  onExportClaim,
  onDeleteClient,
}: {
  clients: Client[];
  vehicles: Vehicle[];
  claims: Claim[];
  documents: DocumentItem[];
  onOpenInWorkspace: (client: Client) => void;
  onExportClaim: (claim: Claim) => void;
  onDeleteClient: (client: Client) => Promise<void>;
}) {
  const [openClientId, setOpenClientId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "complete" | "incomplete">("all");

  const dossiers = useMemo(
    () =>
      clients.map((client) => {
        const clientVehicles = vehicles.filter((vehicle) => vehicle.client_id === client.id);
        const vehicleIds = new Set(clientVehicles.map((vehicle) => vehicle.id));
        const clientClaims = claims.filter((claim) => vehicleIds.has(claim.vehicle_id) || claim.client_id === client.id);
        return computeDossier(client, clientVehicles, clientClaims, documents);
      }),
    [clients, vehicles, claims, documents],
  );

  const openDossier = dossiers.find((dossier) => dossier.client.id === openClientId) ?? null;

  if (openDossier) {
    return <DossierDetail dossier={openDossier} documents={documents} onBack={() => setOpenClientId(null)} onOpenInWorkspace={onOpenInWorkspace} onExportClaim={onExportClaim} onDeleteClient={onDeleteClient} />;
  }

  const completeCount = dossiers.filter((dossier) => dossier.percent === 100).length;
  const incompleteCount = dossiers.length - completeCount;
  const avgPercent = dossiers.length ? Math.round(dossiers.reduce((sum, dossier) => sum + dossier.percent, 0) / dossiers.length) : 0;

  const filtered = dossiers
    .filter((dossier) => {
      if (status === "complete" && dossier.percent !== 100) return false;
      if (status === "incomplete" && dossier.percent === 100) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [dossier.client.full_name, dossier.client.cin_number].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => a.percent - b.percent);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 lg:p-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Dossiers" value={dossiers.length} icon={FolderKanban} tone="brand" />
        <StatCard label="Complets" value={completeCount} icon={CheckCircle2} tone="teal" />
        <StatCard label="Incomplets" value={incompleteCount} icon={FileWarning} tone="amber" />
        <StatCard label="Completude moyenne" value={`${avgPercent}%`} icon={Files} tone="slate" />
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="font-extrabold text-ink">Tous les dossiers</div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-line bg-surface2 px-3 sm:max-w-xs">
              <Search size={15} className="text-ink3" />
              <Input className="border-0 px-0 shadow-none focus:ring-0" placeholder="Nom, CIN..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <Select value={status} onChange={(event) => setStatus(event.target.value as "all" | "complete" | "incomplete")} className="sm:w-48">
              <option value="all">Tous les statuts</option>
              <option value="complete">Complets</option>
              <option value="incomplete">Incomplets</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FolderKanban} title="Aucun dossier ne correspond" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface2/50 text-left text-[11px] font-extrabold uppercase tracking-wide text-ink3">
                  <th className="px-4 py-3">Dossier</th>
                  <th className="px-4 py-3">Vehicules</th>
                  <th className="px-4 py-3">Sinistres</th>
                  <th className="px-4 py-3">Documents requis</th>
                  <th className="px-4 py-3">Completude</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dossier) => (
                  <tr key={dossier.client.id} className="border-b border-line/70 last:border-0 hover:bg-surface2/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">
                          {initials(dossier.client.full_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">{dossier.client.full_name}</div>
                          <div className="truncate text-xs text-ink3">{dossier.client.cin_number || "Sans CIN"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink2">{dossier.vehicles.length}</td>
                    <td className="px-4 py-3 text-ink2">{dossier.claims.length}</td>
                    <td className="px-4 py-3 text-ink2">
                      {dossier.done}/{dossier.total}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24"><ProgressBar percent={dossier.percent} /></div>
                        <Badge tone={dossier.percent === 100 ? "green" : "amber"}>{dossier.percent}%</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => setOpenClientId(dossier.client.id)}>
                        Ouvrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DossierDetail({
  dossier,
  documents,
  onBack,
  onOpenInWorkspace,
  onExportClaim,
  onDeleteClient,
}: {
  dossier: DossierSummary;
  documents: DocumentItem[];
  onBack: () => void;
  onOpenInWorkspace: (client: Client) => void;
  onExportClaim: (claim: Claim) => void;
  onDeleteClient: (client: Client) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const latestClaim = [...dossier.claims].sort((a, b) => b.id - a.id)[0];
  const clientDocCount = documents.filter((document) => document.client_id === dossier.client.id).length;

  async function handleDelete() {
    if (!window.confirm(`Supprimer definitivement le dossier de ${dossier.client.full_name} ?`)) return;
    setDeleting(true);
    try {
      await onDeleteClient(dossier.client);
      onBack();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 lg:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-ink2 hover:text-ink">
        <ArrowLeft size={15} /> Retour aux dossiers
      </button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-extrabold text-white">
              {dossier.client.full_name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </span>
            <div>
              <div className="text-lg font-extrabold text-ink">{dossier.client.full_name}</div>
              <div className="text-sm text-ink3">
                {dossier.client.cin_number || "Sans CIN"} &middot; {dossier.vehicles.length} vehicule(s) &middot; {dossier.claims.length} sinistre(s) &middot; {clientDocCount} document(s)
              </div>
            </div>
          </div>
          <Badge tone={dossier.percent === 100 ? "green" : "amber"}>{dossier.percent}% complet</Badge>
        </div>
        <div className="mt-4">
          <ProgressBar percent={dossier.percent} />
          <p className="mt-1.5 text-xs text-ink3">
            {dossier.done} / {dossier.total} pieces requises fournies
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="primary" onClick={() => onOpenInWorkspace(dossier.client)}>
            <CheckSquare size={15} /> Completer le dossier
          </Button>
          <Button disabled={!latestClaim} onClick={() => latestClaim && onExportClaim(latestClaim)} title={latestClaim ? undefined : "Aucun sinistre a exporter"}>
            Generer le rapport PDF
          </Button>
          <Button variant="danger" disabled={deleting} onClick={handleDelete} className="ml-auto">
            <Trash2 size={15} /> Supprimer le dossier
          </Button>
        </div>
      </Card>

      <Card>
        <div className="border-b border-line px-4 py-3 font-extrabold text-ink">Pieces du dossier</div>
        <div className="divide-y divide-line">
          {dossier.checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-3 px-4 py-3">
              {item.done ? <CheckCircle2 size={17} className="shrink-0 text-emerald-400" /> : <XCircle size={17} className="shrink-0 text-amber-400" />}
              <span className="shrink-0 text-ink3">
                {item.scope === "client" && <User size={14} />}
                {item.scope === "vehicle" && <Car size={14} />}
                {item.scope === "claim" && <ClipboardCheck size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{item.label}</div>
                <div className="text-xs text-ink3">{item.scopeLabel}</div>
              </div>
              <Badge tone={item.done ? "green" : "amber"}>{item.done ? "Fourni" : "A deposer"}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
