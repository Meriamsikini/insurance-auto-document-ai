"use client";

import { useState } from "react";
import { Car, ChevronDown, ChevronRight, ClipboardCheck, FileText, Loader2, User } from "lucide-react";
import type { Claim, Client, DocumentItem, Vehicle } from "@/lib/api";
import { Badge, Card, EmptyState } from "@/components/ui";

function statusTone(status: string): "green" | "amber" | "red" | "blue" {
  if (status === "COMPLETED") return "green";
  if (status === "FAILED") return "red";
  if (status === "PROCESSING") return "blue";
  return "amber";
}

function DocRow({ document, onDownload }: { document: DocumentItem; onDownload: (document: DocumentItem) => void }) {
  return (
    <button
      onClick={() => onDownload(document)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface2/50 px-3 py-2 text-left transition hover:border-brand-400 hover:bg-surface2"
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <FileText size={14} className="shrink-0 text-ink3" />
        <span className="truncate">{document.original_filename}</span>
        <span className="shrink-0 text-xs text-ink3">({document.document_type})</span>
      </span>
      <Badge tone={statusTone(document.processing_status)}>
        {document.processing_status === "PROCESSING" && <Loader2 size={10} className="animate-spin" />}
        {document.processing_status}
      </Badge>
    </button>
  );
}

function Branch({
  icon: Icon,
  label,
  count,
  depth,
  children,
}: {
  icon: typeof Car;
  label: string;
  count: number;
  depth: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={depth > 0 ? "ml-6 border-l border-line pl-4" : ""}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-surface2/60">
        {open ? <ChevronDown size={14} className="text-ink3" /> : <ChevronRight size={14} className="text-ink3" />}
        <Icon size={15} className="text-brand-300" />
        <span className="flex-1 truncate text-sm font-semibold text-ink">{label}</span>
        <Badge tone="slate">{count}</Badge>
      </button>
      {open && <div className="mt-1 space-y-2 pb-2 pl-1">{children}</div>}
    </div>
  );
}

export function DocumentsView({
  clients,
  vehicles,
  claims,
  documents,
  onDownload,
}: {
  clients: Client[];
  vehicles: Vehicle[];
  claims: Claim[];
  documents: DocumentItem[];
  onDownload: (document: DocumentItem) => void;
}) {
  if (clients.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <EmptyState icon={FileText} title="Aucun dossier" description="Les documents apparaitront ici une fois des clients crees." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 p-4 lg:p-6">
      <p className="text-sm text-ink3">Documents regroupes par dossier client. Ouvrez un dossier pour afficher ses pieces.</p>
      {clients.map((client) => {
        const clientVehicles = vehicles.filter((vehicle) => vehicle.client_id === client.id);
        const clientClaims = claims.filter((claim) => claim.client_id === client.id);
        const clientDocs = documents.filter((document) => document.client_id === client.id && !document.vehicle_id && !document.sinistre_id);
        const total =
          clientDocs.length +
          clientVehicles.reduce((sum, vehicle) => sum + documents.filter((document) => document.vehicle_id === vehicle.id).length, 0) +
          clientClaims.reduce((sum, claim) => sum + documents.filter((document) => document.sinistre_id === claim.id).length, 0);

        return (
          <Card key={client.id} className="overflow-hidden">
            <Branch icon={User} label={`${client.full_name} - ${client.cin_number || "Sans CIN"}`} count={total} depth={0}>
              {clientDocs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink3">Documents client</div>
                  {clientDocs.map((document) => (
                    <DocRow key={document.id} document={document} onDownload={onDownload} />
                  ))}
                </div>
              )}
              {clientVehicles.map((vehicle) => {
                const vehicleDocs = documents.filter((document) => document.vehicle_id === vehicle.id);
                return (
                  <Branch key={vehicle.id} icon={Car} label={vehicle.registration_number || `Vehicule #${vehicle.id}`} count={vehicleDocs.length} depth={1}>
                    {vehicleDocs.length === 0 ? (
                      <p className="text-xs text-ink3">Aucun document.</p>
                    ) : (
                      vehicleDocs.map((document) => <DocRow key={document.id} document={document} onDownload={onDownload} />)
                    )}
                  </Branch>
                );
              })}
              {clientClaims.map((claim) => {
                const claimDocs = documents.filter((document) => document.sinistre_id === claim.id);
                return (
                  <Branch key={claim.id} icon={ClipboardCheck} label={claim.claim_number} count={claimDocs.length} depth={1}>
                    {claimDocs.length === 0 ? (
                      <p className="text-xs text-ink3">Aucun document.</p>
                    ) : (
                      claimDocs.map((document) => <DocRow key={document.id} document={document} onDownload={onDownload} />)
                    )}
                  </Branch>
                );
              })}
              {total === 0 && <p className="px-2 text-xs text-ink3">Aucun document pour ce dossier.</p>}
            </Branch>
          </Card>
        );
      })}
    </div>
  );
}
