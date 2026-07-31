"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, CalendarClock, Car, CheckCircle2, ClipboardCheck, Files, FileWarning, Search, User } from "lucide-react";
import type { Claim, Client, DocumentItem, Vehicle } from "@/lib/api";
import { computeDossier } from "@/lib/document-schema";
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, StatCard } from "@/components/ui";

type StatusFilter = "all" | "complete" | "incomplete";
type SortMode = "recent" | "name" | "completeness";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export function DashboardView({
  clients,
  vehicles,
  claims,
  documents,
  onOpenClient,
  onExportClaim,
}: {
  clients: Client[];
  vehicles: Vehicle[];
  claims: Claim[];
  documents: DocumentItem[];
  onOpenClient: (client: Client) => void;
  onExportClaim: (claim: Claim) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");

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

  const completeCount = dossiers.filter((dossier) => dossier.percent === 100).length;
  const incompleteCount = dossiers.length - completeCount;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = dossiers.filter((dossier) => {
      if (status === "complete" && dossier.percent !== 100) return false;
      if (status === "incomplete" && dossier.percent === 100) return false;
      if (!query) return true;
      const plates = dossier.vehicles.map((vehicle) => vehicle.registration_number || "").join(" ");
      const text = [dossier.client.full_name, dossier.client.cin_number, dossier.client.email, dossier.client.phone, plates].join(" ").toLowerCase();
      return text.includes(query);
    });
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.client.full_name.localeCompare(b.client.full_name);
      if (sort === "completeness") return a.percent - b.percent;
      return new Date(b.client.created_at).getTime() - new Date(a.client.created_at).getTime();
    });
    return list;
  }, [dossiers, search, status, sort]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 ">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Clients" value={clients.length} icon={User} tone="brand" />
        <StatCard label="Vehicules" value={vehicles.length} icon={Car} tone="teal" />
        <StatCard label="Sinistres" value={claims.length} icon={ClipboardCheck} tone="amber" />
        <StatCard label="Documents" value={documents.length} icon={Files} tone="slate" />
        <StatCard label="Dossiers complets" value={completeCount} icon={CheckCircle2} tone="teal" />
        <StatCard label="Dossiers incomplets" value={incompleteCount} icon={FileWarning} tone="amber" />
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="font-extrabold text-ink">Clients actifs</div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-line bg-surface2 px-3 sm:max-w-xs">
              <Search size={15} className="text-ink3" />
              <Input className="border-0 px-0 shadow-none focus:ring-0" placeholder="Nom, CIN, plaque..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <Select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="sm:w-48">
              <option value="all">Tous les statuts</option>
              <option value="complete">Dossiers complets</option>
              <option value="incomplete">Dossiers incomplets</option>
            </Select>
            <Select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="sm:w-48">
              <option value="recent">Plus recents</option>
              <option value="name">Nom (A-Z)</option>
              <option value="completeness">Completude croissante</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={User} title="Aucun client ne correspond" description="Ajustez la recherche ou les filtres." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface2/50 text-left text-[11px] font-extrabold uppercase tracking-wide text-ink3">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Vehicules</th>
                  <th className="px-4 py-3">Sinistres</th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={12} /> Cree le
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <ArrowDownAZ size={12} /> Statut dossier
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dossier) => {
                  const latestClaim = [...dossier.claims].sort((a, b) => b.id - a.id)[0];
                  return (
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
                      <td className="px-4 py-3 text-ink2">
                        {dossier.vehicles.length}
                        {dossier.vehicles[0]?.registration_number && <span className="ml-1 text-xs text-ink3">({dossier.vehicles[0].registration_number})</span>}
                      </td>
                      <td className="px-4 py-3 text-ink2">{dossier.claims.length}</td>
                      <td className="px-4 py-3 text-ink3">{formatDate(dossier.client.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24"><ProgressBar percent={dossier.percent} /></div>
                          <Badge tone={dossier.percent === 100 ? "green" : "amber"}>{dossier.percent}%</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => onOpenClient(dossier.client)}>
                            Voir dossier
                          </Button>
                          <Button size="sm" disabled={!latestClaim} onClick={() => latestClaim && onExportClaim(latestClaim)} title={latestClaim ? "Exporter le dernier sinistre" : "Aucun sinistre a exporter"}>
                            Export PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
