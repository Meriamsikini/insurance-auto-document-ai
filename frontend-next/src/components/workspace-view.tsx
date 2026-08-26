"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileStack, Plus, Save, Search, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { usePlatform } from "./platform-provider";
import { Badge, Button, EmptyState, Panel, PanelBody, PanelHead, SegmentedTabs } from "@/components/ui";
import { DocumentCard } from "@/components/document-card";
import { DocUploadChip, type ChipTone } from "@/components/upload-dropzone";
import { cardsFor, matchDocuments, type CardDef } from "@/lib/document-schema";
import type { Claim, Client, Vehicle } from "@/lib/api";

type Tab = "client" | "vehicle" | "claim";
type JsonRecord = Record<string, unknown>;

const CARD_TONE: Record<string, ChipTone> = {
  cin: "blue",
  domicile: "teal",
  cg: "blue",
  permis: "teal",
  ct: "amber",
  att: "green",
  facture: "red",
  constat: "blue",
  pv: "red",
  photos: "teal",
  garage: "green",
};

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 p-2.5 text-xs font-medium text-brand-200">{children}</div>;
}

function UploadSection({
  scope,
  onUpload,
  documents,
  ids,
  action,
}: {
  scope: Tab;
  onUpload: (file: File, key: string) => Promise<void>;
  documents: import("@/lib/api").DocumentItem[];
  ids: { clientId?: number | null; vehicleId?: number | null; claimId?: number | null };
  action?: React.ReactNode;
}) {
  const cards = cardsFor(scope).filter((card): card is CardDef & { documentType: string } => Boolean(card.documentType));
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-extrabold text-ink">Import de documents</div>
          <div className="text-xs text-ink3">Deposez ou choisissez les pieces du dossier — l&apos;OCR remplit automatiquement les cartes ci-dessous.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">OCR automatique</Badge>
          {action}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.map((card) => (
          <DocUploadChip
            key={card.key}
            label={card.title}
            icon={card.icon}
            tone={CARD_TONE[card.key] ?? "blue"}
            multiple={card.multiple}
            done={matchDocuments(documents, card, ids).length > 0}
            onFile={(file) => void onUpload(file, card.key).catch((error) => toast.error(error instanceof Error ? error.message : "Erreur upload"))}
          />
        ))}
      </div>
    </section>
  );
}

function FormActions({
  children,
  deleteLabel,
  dangerDisabled,
  onDelete,
}: {
  children: React.ReactNode;
  deleteLabel: string;
  dangerDisabled: boolean;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-t border-line pt-4 md:flex-row">
      <Button
        type="button"
        variant="danger"
        disabled={dangerDisabled}
        onClick={() => window.confirm(`${deleteLabel} ?`) && onDelete().catch((error) => toast.error(error instanceof Error ? error.message : "Erreur suppression"))}
      >
        <Trash2 size={16} />
        {deleteLabel}
      </Button>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function WorkspaceView() {
  const {
    isLoading,
    search,
    setSearch,
    filteredClients,
    activeClientId,
    pickClient,
    vehiclesOf,
    activeVehicleId,
    pickVehicle,
    claimsOf,
    activeClaimId,
    pickClaim,
    activeClient,
    activeVehicle,
    activeClaim,
    tab,
    setTab,
    clientForm,
    submit,
    saveClient,
    uploadDocument,
    documents,
    ocr,
    handleDownloadDocument,
    removeActive,
    setActive,
    vehicleForm,
    saveVehicle,
    claimForm,
    saveClaim,
    exportClaimReport,
  } = usePlatform();

  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [expandedVehicles, setExpandedVehicles] = useState<Set<number>>(new Set());
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());

  const handleClientClick = (client: Client) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(client.id)) {
        next.delete(client.id);
      } else {
        next.add(client.id);
      }
      return next;
    });
    pickClient(client);
  };

  const handleVehicleClick = (vehicle: Vehicle) => {
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(vehicle.id)) {
        next.delete(vehicle.id);
      } else {
        next.add(vehicle.id);
      }
      return next;
    });
    pickVehicle(vehicle);
  };

  const handleClaimClick = (claim: Claim) => {
    setExpandedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(claim.id)) {
        next.delete(claim.id);
      } else {
        next.add(claim.id);
      }
      return next;
    });
    pickClaim(claim);
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel className="max-h-[calc(100vh-140px)]">
          <PanelHead>
            <div className="flex items-center gap-2 font-extrabold text-ink">
              <User size={17} /> Dossiers
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null });
                setTab("client");
              }}
            >
              <Plus size={14} />
              Client
            </Button>
          </PanelHead>
          <PanelBody>
            <label className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3">
              <Search size={16} className="text-ink3" />
              <input
                className="w-full border-0 bg-transparent px-0 py-2 text-sm text-ink outline-none placeholder:text-ink3"
                placeholder="Rechercher client, CIN, plaque..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-2">
              {isLoading && <div className="flex items-center gap-2 rounded-lg border border-dashed border-line p-4 text-sm text-ink3">Chargement...</div>}
              {!isLoading && filteredClients.length === 0 && <EmptyState icon={User} title="Aucun dossier" description="Creez votre premier client pour demarrer." />}
              {filteredClients.map((client) => {
                const isClientOpen = expandedClients.has(client.id);
                return (
                  <div key={client.id} className="overflow-hidden rounded-xl border border-line bg-surface2/40">
                    <button
                      className={`flex w-full items-center gap-2.5 p-2.5 text-left transition hover:bg-brand-500/10 ${client.id === activeClientId ? "bg-brand-500/10" : ""}`}
                      onClick={() => handleClientClick(client)}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">
                        {initials(client.full_name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className={`block truncate text-sm ${client.id === activeClientId ? "text-brand-300" : "text-ink"}`}>{client.full_name}</b>
                        <span className="text-xs text-ink3">
                          {client.cin_number || "Sans CIN"} &middot; {vehiclesOf(client.id).length} vehicule(s)
                        </span>
                      </span>
                      {isClientOpen ? <ChevronDown size={16} className="shrink-0 text-ink3" /> : <ChevronRight size={16} className="shrink-0 text-ink3" />}
                    </button>
                    {isClientOpen && (
                      <div className="border-t border-line bg-surface2/40 p-2">
                        {vehiclesOf(client.id).map((vehicle) => {
                          const isVehicleOpen = expandedVehicles.has(vehicle.id);
                          return (
                            <div key={vehicle.id}>
                              <button
                                className={`flex w-full items-start gap-1.5 rounded-lg p-1.5 text-left text-sm hover:bg-surface3 ${vehicle.id === activeVehicleId ? "bg-surface3 text-brand-300" : "text-ink2"}`}
                                onClick={() => handleVehicleClick(vehicle)}
                              >
                                {isVehicleOpen ? <ChevronDown size={14} className="mt-0.5 shrink-0" /> : <ChevronRight size={14} className="mt-0.5 shrink-0" />}
                                <span className="min-w-0">
                                  <b className="block truncate">{vehicle.registration_number || "Vehicule sans plaque"}</b>
                                  <span className="text-xs text-ink3">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Modele non renseigne"}</span>
                                </span>
                              </button>
                              {isVehicleOpen &&
                                claimsOf(vehicle.id).map((claim) => {
                                  const isClaimOpen = expandedClaims.has(claim.id);
                                  return (
                                    <button
                                      key={claim.id}
                                      className={`ml-6 flex w-[calc(100%-1.5rem)] items-start gap-1.5 rounded-lg p-1.5 text-left text-sm hover:bg-surface3 ${claim.id === activeClaimId ? "bg-surface3 text-brand-300" : "text-ink2"}`}
                                      onClick={() => handleClaimClick(claim)}
                                    >
                                      {isClaimOpen ? <ChevronDown size={13} className="mt-0.5 shrink-0" /> : <ChevronRight size={13} className="mt-0.5 shrink-0" />}
                                      <span className="min-w-0">
                                        <b className="block truncate">{claim.claim_number}</b>
                                        <span className="text-xs text-ink3">{claim.accident_date || "Date inconnue"}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                            </div>
                          );
                        })}
                        {vehiclesOf(client.id).length === 0 && <div className="p-2 text-sm text-ink3">Aucun vehicule</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          {activeClient && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink2">
              <button onClick={() => setTab("client")} className="font-semibold text-ink hover:text-brand-300">
                {activeClient.full_name}
              </button>
              {activeVehicle && (
                <>
                  <ChevronRight size={13} className="text-ink3" />
                  <button onClick={() => setTab("vehicle")} className="font-semibold text-ink hover:text-brand-300">
                    {activeVehicle.registration_number || `Vehicule #${activeVehicle.id}`}
                  </button>
                </>
              )}
              {activeClaim && (
                <>
                  <ChevronRight size={13} className="text-ink3" />
                  <button onClick={() => setTab("claim")} className="font-semibold text-ink hover:text-brand-300">
                    {activeClaim.claim_number}
                  </button>
                </>
              )}
            </div>
          )}

          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { key: "client", label: "Client", icon: User },
              { key: "vehicle", label: "Vehicule" },
              { key: "claim", label: "Sinistre" },
            ]}
          />

          {tab === "client" && (
            <form onSubmit={clientForm.handleSubmit(submit(saveClient))} className="space-y-4">
              <UploadSection scope="client" onUpload={uploadDocument} documents={documents} ids={{ clientId: activeClientId }} />
              <div className="grid gap-4">
                {cardsFor("client").map((card) => (
                  <DocumentCard
                    key={card.key}
                    def={card}
                    register={clientForm.register}
                    resetFields={(names) => names.forEach((n) => clientForm.setValue(n as any, "" as any))}
                    matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId })}
                    ocrExtracted={!!(ocr.client as JsonRecord | undefined)?.[card.key]}
                    onDownload={handleDownloadDocument}
                  />
                ))}
              </div>
              <FormActions deleteLabel="Supprimer client" dangerDisabled={!activeClient} onDelete={() => removeActive("client")}>
                <Button type="button" onClick={() => setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null })}>
                  Nouveau
                </Button>
                <Button variant="primary" type="submit">
                  <Save size={16} />
                  Enregistrer client
                </Button>
              </FormActions>
            </form>
          )}

          {tab === "vehicle" && (
            <form onSubmit={vehicleForm.handleSubmit(submit(saveVehicle))} className="space-y-4">
              <Notice>{activeClient ? `Vehicule rattache au client: ${activeClient.full_name}` : "Selectionnez ou enregistrez un client avant d'ajouter un vehicule."}</Notice>
              <UploadSection
                scope="vehicle"
                onUpload={uploadDocument}
                documents={documents}
                ids={{ clientId: activeClientId, vehicleId: activeVehicleId }}
                action={
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      setActive({ activeVehicleId: null, activeClaimId: null });
                      setTab("vehicle");
                    }}
                  >
                    <Plus size={14} />
                    Nouveau vehicule
                  </Button>
                }
              />
              <div className="grid gap-4">
                {cardsFor("vehicle").map((card) => (
                  <DocumentCard
                    key={card.key}
                    def={card}
                    register={vehicleForm.register}
                    resetFields={(names) => names.forEach((n) => vehicleForm.setValue(n as any, "" as any))}
                    matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId, vehicleId: activeVehicleId })}
                    ocrExtracted={!!(ocr.vehicle as JsonRecord | undefined)?.[card.key]}
                    onDownload={handleDownloadDocument}
                  />
                ))}
              </div>
              <FormActions deleteLabel="Supprimer vehicule" dangerDisabled={!activeVehicle} onDelete={() => removeActive("vehicle")}>
                <Button
                  type="button"
                  disabled={!activeVehicle}
                  onClick={() => {
                    setActive({ activeClaimId: null });
                    setTab("claim");
                  }}
                >
                  <Plus size={16} />
                  Declarer sinistre
                </Button>
                <Button variant="primary" disabled={!activeClient} type="submit">
                  <Save size={16} />
                  Enregistrer vehicule
                </Button>
              </FormActions>
            </form>
          )}

          {tab === "claim" && (
            <form onSubmit={claimForm.handleSubmit(submit(saveClaim))} className="space-y-4">
              <Notice>{activeVehicle ? `Sinistre rattache au vehicule: ${activeVehicle.registration_number || `#${activeVehicle.id}`}` : "Selectionnez un vehicule pour declarer un sinistre."}</Notice>
              <UploadSection
                scope="claim"
                onUpload={uploadDocument}
                documents={documents}
                ids={{ clientId: activeClientId, vehicleId: activeVehicleId, claimId: activeClaimId }}
                action={
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      setActive({ activeClaimId: null });
                      setTab("claim");
                    }}
                  >
                    <Plus size={14} />
                    Nouveau sinistre
                  </Button>
                }
              />
              <div className="grid gap-4">
                {cardsFor("claim").map((card) => (
                  <DocumentCard
                    key={card.key}
                    def={card}
                    register={claimForm.register}
                    resetFields={(names) => names.forEach((n) => claimForm.setValue(n as any, "" as any))}
                    matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId, vehicleId: activeVehicleId, claimId: activeClaimId })}
                    ocrExtracted={!!(ocr.claim as JsonRecord | undefined)?.[card.key]}
                    onDownload={handleDownloadDocument}
                  />
                ))}
              </div>
              <FormActions deleteLabel="Supprimer sinistre" dangerDisabled={!activeClaim} onDelete={() => removeActive("claim")}>
                <Button type="button" disabled={!activeClaim} onClick={() => activeClaim && exportClaimReport(activeClaim)}>
                  <FileStack size={16} />
                  Exporter le rapport PDF
                </Button>
                <Button variant="primary" disabled={!activeClient || !activeVehicle} type="submit">
                  <Save size={16} />
                  Enregistrer sinistre
                </Button>
              </FormActions>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}