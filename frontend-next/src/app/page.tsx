"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Files,
  IdCard,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { api, Claim, Client, DocumentItem, fetchPlatformData, Vehicle } from "@/lib/api";
import { nextClaimNumber, splitClientName } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { DocUploadChip } from "@/components/upload-dropzone";
import { Badge, Button, Card, EmptyState, Field, Input, Panel, PanelBody, PanelHead, Select, SegmentedTabs, StatCard, Textarea } from "@/components/ui";
import { usePlatformStore } from "@/store/platform-store";

type Tab = "client" | "vehicle" | "claim";

const DOC_SCOPE: Record<string, Tab> = { cin: "client", domicile: "client", cg: "vehicle", permis: "vehicle", ct: "vehicle", att: "vehicle", constat: "claim", photos: "claim", pv: "claim", garage: "claim" };
const DOC_TYPE: Record<string, string> = { photos: "accidents", garage: "repair_invoice" };

type ClientForm = {
  nom: string;
  prenom: string;
  cin_number: string;
  birth_date: string;
  sex: string;
  expiration_date: string;
  cin_address: string;
  city: string;
  domicile_address: string;
  domicile_type: string;
  domicile_issuer: string;
  domicile_date: string;
  phone: string;
  email: string;
  profession: string;
  client_type: string;
};

type VehicleForm = {
  registration_number: string;
  make: string;
  model: string;
  vin: string;
  year: string;
  usage: string;
  fuel_type: string;
  notes: string;
};

type ClaimForm = {
  claim_number: string;
  accident_date: string;
  location: string;
  description: string;
};

function valueOf(meta: Client["metadata"], key: string) {
  const value = meta?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function statusTone(status?: string | null) {
  if (status === "COMPLETED" || status === "APPROVED" || status === "CLOSED") return "green" as const;
  if (status === "FAILED") return "red" as const;
  if (status === "PROCESSING") return "blue" as const;
  return "amber" as const;
}

function rawValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const direct = raw[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
    const norm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
    for (const rawKey of Object.keys(raw)) {
      const comparable = rawKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
      if ((comparable.includes(norm) || norm.includes(comparable)) && raw[rawKey]) return String(raw[rawKey]);
    }
  }
  return "";
}

function isoDate(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function AssurAutoPlatform() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [autoOcr, setAutoOcr] = useState(true);
  const documentsRef = useRef<HTMLDivElement>(null);
  const { activeClientId, activeVehicleId, activeClaimId, tab, pendingDocs, ocr, setActive, setTab, setPendingDocs, setOcr } = usePlatformStore();

  const { data, isLoading, refetch } = useQuery({ queryKey: ["platform"], queryFn: fetchPlatformData });
  const clients = data?.clients ?? [];
  const vehicles = data?.vehicles ?? [];
  const claims = data?.claims ?? [];
  const documents = data?.documents ?? [];

  const activeClient = clients.find((client) => client.id === activeClientId) ?? null;
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? null;
  const activeClaim = claims.find((claim) => claim.id === activeClaimId) ?? null;
  const vehiclesOf = (clientId: number) => vehicles.filter((vehicle) => vehicle.client_id === clientId);
  const claimsOf = (vehicleId: number) => claims.filter((claim) => claim.vehicle_id === vehicleId);

  const clientForm = useForm<ClientForm>({ defaultValues: { client_type: "individual" } });
  const vehicleForm = useForm<VehicleForm>();
  const claimForm = useForm<ClaimForm>({ defaultValues: { claim_number: nextClaimNumber() } });

  useEffect(() => {
    if (!data) return;
    if (activeClientId && !clients.some((client) => client.id === activeClientId)) {
      setActive({ activeClientId: clients[0]?.id ?? null, activeVehicleId: null, activeClaimId: null });
    }
  }, [data, activeClientId, clients, setActive]);

  useEffect(() => {
    const parts = splitClientName(activeClient?.full_name);
    clientForm.reset({
      nom: parts.nom,
      prenom: parts.prenom,
      cin_number: activeClient?.cin_number ?? "",
      birth_date: valueOf(activeClient?.metadata, "birth_date"),
      sex: valueOf(activeClient?.metadata, "sex"),
      expiration_date: valueOf(activeClient?.metadata, "cin_expiration"),
      cin_address: valueOf(activeClient?.metadata, "cin_address") || activeClient?.address || "",
      city: valueOf(activeClient?.metadata, "city"),
      domicile_address: valueOf(activeClient?.metadata, "domicile_address") || activeClient?.address || "",
      domicile_type: valueOf(activeClient?.metadata, "domicile_type"),
      domicile_issuer: valueOf(activeClient?.metadata, "domicile_issuer"),
      domicile_date: valueOf(activeClient?.metadata, "domicile_date"),
      phone: activeClient?.phone ?? "",
      email: activeClient?.email ?? "",
      profession: valueOf(activeClient?.metadata, "profession"),
      client_type: activeClient?.client_type ?? "individual",
    });
  }, [activeClient, clientForm]);

  useEffect(() => {
    vehicleForm.reset({
      registration_number: activeVehicle?.registration_number ?? "",
      make: activeVehicle?.make ?? "",
      model: activeVehicle?.model ?? "",
      vin: activeVehicle?.vin ?? "",
      year: activeVehicle?.year ? String(activeVehicle.year) : "",
      usage: activeVehicle?.usage ?? "",
      fuel_type: valueOf(activeVehicle?.metadata, "fuel_type"),
      notes: valueOf(activeVehicle?.metadata, "notes"),
    });
  }, [activeVehicle, vehicleForm]);

  useEffect(() => {
    claimForm.reset({
      claim_number: activeClaim?.claim_number ?? nextClaimNumber(),
      accident_date: activeClaim?.accident_date ?? "",
      location: activeClaim?.location ?? "",
      description: activeClaim?.description ?? "",
    });
  }, [activeClaim, claimForm]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const text = [client.full_name, client.cin_number, client.email, client.phone, ...vehiclesOf(client.id).map((vehicle) => vehicle.registration_number)].join(" ").toLowerCase();
      return !query || text.includes(query);
    });
  }, [clients, search, vehicles]);

  const scopedDocuments = documents.filter((document) => {
    if (activeClaimId) return document.sinistre_id === activeClaimId;
    if (activeVehicleId) return document.vehicle_id === activeVehicleId;
    if (activeClientId) return document.client_id === activeClientId;
    return false;
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["platform"] });
  }

  function pickClient(client: Client) {
    const firstVehicle = vehiclesOf(client.id)[0];
    const firstClaim = firstVehicle ? claimsOf(firstVehicle.id)[0] : null;
    setActive({ activeClientId: client.id, activeVehicleId: firstVehicle?.id ?? null, activeClaimId: firstClaim?.id ?? null });
    setTab("client");
  }

  function pickVehicle(vehicle: Vehicle) {
    setActive({ activeClientId: vehicle.client_id, activeVehicleId: vehicle.id, activeClaimId: claimsOf(vehicle.id)[0]?.id ?? null });
    setTab("vehicle");
  }

  function pickClaim(claim: Claim) {
    setActive({ activeClientId: claim.client_id, activeVehicleId: claim.vehicle_id, activeClaimId: claim.id });
    setTab("claim");
  }

  function handleNav(key: string) {
    if (key === "clients") setTab("client");
    if (key === "vehicles") setTab("vehicle");
    if (key === "claims") setTab("claim");
    if (key === "documents") documentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const navActive = tab === "client" ? "clients" : tab === "vehicle" ? "vehicles" : "claims";

  async function assignPending(scope: Tab, refs: Record<string, unknown>) {
    const docs = pendingDocs.filter((doc) => doc.scope === scope);
    await Promise.all(docs.map((doc) => api.post(`/documents/${doc.id}/assign-refs`, refs).catch(() => null)));
    setPendingDocs(pendingDocs.filter((doc) => doc.scope !== scope));
  }

  async function saveClient(values: ClientForm) {
    const payload = {
      full_name: [values.nom, values.prenom].filter(Boolean).join(" ") || "Nouveau client",
      cin_number: values.cin_number || null,
      phone: values.phone || null,
      email: values.email || null,
      address: values.domicile_address || values.cin_address || null,
      client_type: values.client_type,
      metadata: {
        birth_date: values.birth_date || null,
        sex: values.sex || null,
        cin_expiration: values.expiration_date || null,
        cin_address: values.cin_address || null,
        city: values.city || null,
        domicile_address: values.domicile_address || null,
        domicile_type: values.domicile_type || null,
        domicile_issuer: values.domicile_issuer || null,
        domicile_date: values.domicile_date || null,
        profession: values.profession || null,
        ocr_cache: ocr.client || ocr,
      },
    };
    const response = activeClientId ? await api.patch<Client>(`/clients/${activeClientId}`, payload) : await api.post<Client>("/clients", payload);
    setActive({ activeClientId: response.data.id });
    await assignPending("client", { client_id: response.data.id, validated_data: { scope: "client", values } });
    await invalidate();
    setTab("vehicle");
    toast.success("Client enregistre. Vous pouvez ajouter ses vehicules.");
  }

  async function saveVehicle(values: VehicleForm) {
    if (!activeClientId) throw new Error("Enregistrez d'abord le client.");
    const payload = {
      client_id: activeClientId,
      registration_number: values.registration_number || null,
      vin: values.vin || null,
      make: values.make || null,
      model: values.model || null,
      year: values.year ? Number(values.year) : null,
      usage: values.usage || null,
      metadata: { fuel_type: values.fuel_type || null, notes: values.notes || null, ocr_cache: ocr.vehicle || ocr },
    };
    const response = activeVehicleId ? await api.patch<Vehicle>(`/vehicles/${activeVehicleId}`, payload) : await api.post<Vehicle>("/vehicles", payload);
    setActive({ activeVehicleId: response.data.id });
    await assignPending("vehicle", { client_id: activeClientId, vehicle_id: response.data.id, validated_data: { scope: "vehicle", values } });
    await invalidate();
    setTab("claim");
    toast.success("Vehicule enregistre. Vous pouvez declarer un sinistre.");
  }

  async function saveClaim(values: ClaimForm) {
    if (!activeClientId || !activeVehicleId) throw new Error("Selectionnez un client et un vehicule.");
    const payload: Record<string, unknown> = {
      client_id: activeClientId,
      vehicle_id: activeVehicleId,
      claim_number: values.claim_number || nextClaimNumber(),
      accident_date: values.accident_date || null,
      location: values.location || null,
      description: values.description || null,
      metadata: {
        ocr_cache: ocr.claim || ocr,
        damage_level: valueOf(activeClaim?.metadata, "damage_level"),
        garage_name: valueOf(activeClaim?.metadata, "garage_name"),
        estimated_cost: valueOf(activeClaim?.metadata, "estimated_cost"),
      },
    };
    const response = activeClaimId ? await api.patch<Claim>(`/claims/${activeClaimId}`, payload) : await api.post<Claim>("/claims", payload);
    setActive({ activeClaimId: response.data.id });
    await assignPending("claim", { client_id: activeClientId, vehicle_id: activeVehicleId, sinistre_id: response.data.id, validated_data: { scope: "claim", values } });
    await invalidate();
    toast.success("Sinistre enregistre et lie au vehicule.");
  }

  async function removeActive(kind: Tab) {
    if (kind === "client" && activeClientId) {
      await api.delete(`/clients/${activeClientId}`);
      setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null });
    }
    if (kind === "vehicle" && activeVehicleId) {
      await api.delete(`/vehicles/${activeVehicleId}`);
      setActive({ activeVehicleId: null, activeClaimId: null });
    }
    if (kind === "claim" && activeClaimId) {
      await api.delete(`/claims/${activeClaimId}`);
      setActive({ activeClaimId: null });
    }
    await invalidate();
    toast.success("Suppression effectuee.");
  }

  async function closeAndReset() {
    if (!activeClaimId) return;
    setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null });
    setTab("client");
    toast.success("Dossier reinitialise.");
  }

  async function ensureClaimForDocumentUpload() {
    if (activeClaimId) return activeClaimId;
    if (!activeClientId || !activeVehicleId) throw new Error("Selectionnez un client et un vehicule avant d'uploader une piece sinistre.");
    const response = await api.post<Claim>("/claims", {
      client_id: activeClientId,
      vehicle_id: activeVehicleId,
      claim_number: nextClaimNumber(),
      metadata: { created_from_document_upload: true },
    });
    setActive({ activeClaimId: response.data.id });
    await invalidate();
    setTab("claim");
    return response.data.id;
  }

  async function pollAi(id: number, scope: Tab, docKey: string) {
    for (let i = 0; i < 18; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const response = await api.get<DocumentItem>(`/documents/${id}`).catch(() => null);
      const doc = response?.data;
      if (!doc || doc.processing_status === "PENDING" || doc.processing_status === "PROCESSING") continue;
      if (doc.processing_status === "COMPLETED" && doc.ai_result) {
        applyAi(doc.ai_result, scope, docKey);
        await invalidate();
        setTab(scope);
        toast.success("OCR applique au formulaire.");
      }
      if (doc.processing_status === "FAILED") toast.error(`OCR echoue: ${doc.processing_error || "erreur inconnue"}`);
      break;
    }
  }

  function applyAi(ai: Record<string, unknown>, scope: Tab, docKey: string) {
    const raw = (ai.raw_fields as Record<string, unknown>) || ai;
    setOcr({ ...ocr, [scope]: { ...((ocr[scope] as Record<string, unknown>) || {}), [docKey]: ai } });
    if (scope === "client") {
      const name = String(ai.name || rawValue(raw, "full_name", "name", "nom complet"));
      const parts = splitClientName(name);
      clientForm.setValue("nom", rawValue(raw, "nom", "last_name", "surname") || parts.nom);
      clientForm.setValue("prenom", rawValue(raw, "prenom", "first_name", "given_name") || parts.prenom);
      clientForm.setValue("cin_number", String(ai.cin_number || rawValue(raw, "cin_number", "numero cin", "cin")));
      clientForm.setValue("birth_date", isoDate(rawValue(raw, "date naissance", "birth_date")));
      clientForm.setValue("expiration_date", isoDate(rawValue(raw, "date expiration", "valid_until", "expiration")));
      clientForm.setValue("cin_address", rawValue(raw, "adresse", "address"));
      clientForm.setValue("city", rawValue(raw, "ville", "city"));
    }
    if (scope === "vehicle") {
      vehicleForm.setValue("registration_number", String(ai.vehicle || rawValue(raw, "immatriculation", "registration_number")));
      vehicleForm.setValue("make", rawValue(raw, "marque", "make", "brand"));
      vehicleForm.setValue("model", rawValue(raw, "modele", "model"));
      vehicleForm.setValue("vin", rawValue(raw, "chassis", "vin"));
      vehicleForm.setValue("fuel_type", rawValue(raw, "carburant", "energie", "fuel"));
    }
    if (scope === "claim") {
      claimForm.setValue("accident_date", isoDate(rawValue(raw, "date accident", "date_accident", "date")));
      claimForm.setValue("location", rawValue(raw, "lieu", "location"));
      claimForm.setValue("description", String(ai.accident_summary || rawValue(raw, "description", "accident_summary")));
    }
  }

  async function uploadDocument(file: File, docKey: string) {
    const scope = DOC_SCOPE[docKey] || "client";
    const claimId = scope === "claim" ? await ensureClaimForDocumentUpload() : activeClaimId;
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", DOC_TYPE[docKey] || docKey);
    if (activeClientId) form.append("client_id", String(activeClientId));
    if (scope === "vehicle" && activeVehicleId) form.append("vehicle_id", String(activeVehicleId));
    if (scope === "claim" && claimId) form.append("sinistre_id", String(claimId));
    toast.info(`Upload en cours: ${file.name}`);
    const response = await api.post<DocumentItem>("/documents/upload", form);
    setPendingDocs([...pendingDocs.filter((doc) => doc.id !== response.data.id), { id: response.data.id, scope, document_type: response.data.document_type }]);
    if (autoOcr) void pollAi(response.data.id, scope, docKey);
    await invalidate();
    toast.success("Document uploade. Traitement OCR lance.");
  }

  async function exportPdfReport() {
    if (!activeClaimId || !activeClaim) return;
    toast.info("Generation du rapport PDF en cours...");
    try {
      const response = await api.get(`/claims/${activeClaimId}/report`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const fileName = `Rapport-Sinistre-${activeClaim.claim_number}.pdf`;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Rapport PDF telecharge.");
    } catch {
      toast.error("Erreur lors de la generation du rapport PDF.");
    }
  }

  const submit = <T,>(handler: (values: T) => Promise<void>) => async (values: T) => {
    try {
      await handler(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur inconnue");
    }
  };

  return (
    <AppShell
      active={navActive}
      onNavigate={handleNav}
      onSelectClient={pickClient}
      onSelectVehicle={pickVehicle}
      onSelectClaim={pickClaim}
      onRefresh={() => refetch()}
      stats={{ clients: clients.length, vehicles: vehicles.length, claims: claims.length }}
    >
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 lg:p-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Clients" value={clients.length} icon={User} tone="brand" />
            <StatCard label="Vehicules" value={vehicles.length} icon={Car} tone="teal" />
            <StatCard label="Sinistres" value={claims.length} icon={ClipboardCheck} tone="amber" />
            <StatCard label="Documents" value={documents.length} icon={Files} tone="slate" />
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_400px]">
            <Panel className="max-h-[calc(100vh-220px)]">
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
                <label className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-white px-3">
                  <Search size={16} className="text-slate-400" />
                  <Input className="border-0 px-0 shadow-none focus:ring-0" placeholder="Rechercher client, CIN, plaque..." value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <div className="flex flex-col gap-2">
                  {isLoading && (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line p-4 text-sm text-slate-500">
                      <Loader2 size={14} className="animate-spin" /> Chargement...
                    </div>
                  )}
                  {!isLoading && filteredClients.length === 0 && <EmptyState icon={User} title="Aucun dossier" description="Creez votre premier client pour demarrer." />}
                  {filteredClients.map((client) => (
                    <div key={client.id} className="overflow-hidden rounded-xl border border-line bg-white">
                      <button
                        className={`flex w-full items-start gap-3 p-3 text-left transition hover:bg-brand-50 ${client.id === activeClientId ? "bg-brand-50" : ""}`}
                        onClick={() => pickClient(client)}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">
                          {initials(client.full_name)}
                        </span>
                        <span className="min-w-0">
                          <b className={`block truncate text-sm ${client.id === activeClientId ? "text-brand-700" : "text-ink"}`}>{client.full_name}</b>
                          <span className="text-xs text-slate-500">
                            {client.cin_number || "Sans CIN"} &middot; {vehiclesOf(client.id).length} vehicule(s)
                          </span>
                        </span>
                      </button>
                      <div className="border-t border-line bg-slate-50 p-2">
                        {vehiclesOf(client.id).map((vehicle) => (
                          <div key={vehicle.id}>
                            <button
                              className={`flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-white ${vehicle.id === activeVehicleId ? "bg-white text-brand-700 shadow-card" : ""}`}
                              onClick={() => pickVehicle(vehicle)}
                            >
                              <Car size={16} className="mt-0.5 shrink-0 text-slate-400" />
                              <span className="min-w-0">
                                <b className="block truncate">{vehicle.registration_number || "Vehicule sans plaque"}</b>
                                <span className="text-xs text-slate-500">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Modele non renseigne"}</span>
                              </span>
                            </button>
                            {claimsOf(vehicle.id).map((claim) => (
                              <button
                                key={claim.id}
                                className={`ml-6 flex w-[calc(100%-1.5rem)] items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-white ${claim.id === activeClaimId ? "bg-white text-brand-700 shadow-card" : ""}`}
                                onClick={() => pickClaim(claim)}
                              >
                                <FileText size={15} className="mt-0.5 shrink-0 text-slate-400" />
                                <span className="min-w-0">
                                  <b className="block truncate">{claim.claim_number}</b>
                                  <span className="text-xs text-slate-500">{claim.accident_date || "Date inconnue"}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                        {vehiclesOf(client.id).length === 0 && <div className="p-2 text-sm text-slate-500">Aucun vehicule</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <div className="border-b border-line bg-slate-50/70 p-3">
                <SegmentedTabs<Tab>
                  value={tab}
                  onChange={setTab}
                  items={[
                    { key: "client", label: "Client", icon: User },
                    { key: "vehicle", label: "Vehicule", icon: Car },
                    { key: "claim", label: "Sinistre", icon: ClipboardCheck },
                  ]}
                />
              </div>
              <PanelBody className="p-5">
                {tab === "client" && (
                  <form onSubmit={clientForm.handleSubmit(submit(saveClient))} className="space-y-4">
                    <UploadBlock
                      title="Pieces client"
                      subtitle="Upload OCR avant ou apres sauvegarde"
                      autoOcr={autoOcr}
                      setAutoOcr={setAutoOcr}
                      docs={[
                        ["cin", "CIN / Passeport", IdCard],
                        ["domicile", "Justificatif domicile", FileText],
                      ]}
                      onUpload={uploadDocument}
                    />
                    <FormSection
                      title="Informations CIN / Passeport"
                      icon={<IdCard size={17} />}
                      action={
                        <Button size="sm" type="button" onClick={() => clientForm.reset({ client_type: "individual" })}>
                          Reinitialiser
                        </Button>
                      }
                    >
                      <Field label="Nom *"><Input {...clientForm.register("nom")} required /></Field>
                      <Field label="Prenom *"><Input {...clientForm.register("prenom")} required /></Field>
                      <Field label="N CIN / Passeport *"><Input {...clientForm.register("cin_number")} required /></Field>
                      <Field label="Date de naissance"><Input type="date" {...clientForm.register("birth_date")} /></Field>
                      <Field label="Sexe">
                        <Select {...clientForm.register("sex")}>
                          <option value="">-</option>
                          <option>Masculin</option>
                          <option>Feminin</option>
                        </Select>
                      </Field>
                      <Field label="Date d'expiration"><Input type="date" {...clientForm.register("expiration_date")} /></Field>
                      <Field label="Adresse"><Input {...clientForm.register("cin_address")} /></Field>
                      <Field label="Ville"><Input {...clientForm.register("city")} /></Field>
                    </FormSection>
                    <FormSection title="Justificatif de domicile" icon={<FileText size={17} />}>
                      <Field label="Adresse confirmee" full><Input {...clientForm.register("domicile_address")} /></Field>
                      <Field label="Type de document">
                        <Select {...clientForm.register("domicile_type")}>
                          <option value="">-</option>
                          <option>Facture electricite</option>
                          <option>Facture eau</option>
                          <option>Quittance de loyer</option>
                          <option>Releve bancaire</option>
                          <option>Attestation residence</option>
                        </Select>
                      </Field>
                      <Field label="Emetteur"><Input {...clientForm.register("domicile_issuer")} /></Field>
                      <Field label="Date du document"><Input type="month" {...clientForm.register("domicile_date")} /></Field>
                    </FormSection>
                    <FormSection title="Informations complementaires" icon={<User size={17} />}>
                      <Field label="Telephone"><Input {...clientForm.register("phone")} placeholder="+212 6XX XXX XXX" /></Field>
                      <Field label="Email"><Input type="email" {...clientForm.register("email")} placeholder="client@email.ma" /></Field>
                      <Field label="Profession"><Input {...clientForm.register("profession")} /></Field>
                      <Field label="Statut client">
                        <Select {...clientForm.register("client_type")}>
                          <option value="individual">Particulier</option>
                          <option value="professional">Professionnel</option>
                          <option value="company">Entreprise</option>
                        </Select>
                      </Field>
                    </FormSection>
                    <Actions dangerDisabled={!activeClient} onDelete={() => removeActive("client")} deleteLabel="Supprimer client">
                      <Button type="button" onClick={() => setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null })}>
                        Nouveau
                      </Button>
                      <Button variant="primary" type="submit">
                        <Save size={16} />
                        Enregistrer client
                      </Button>
                    </Actions>
                  </form>
                )}

                {tab === "vehicle" && (
                  <form onSubmit={vehicleForm.handleSubmit(submit(saveVehicle))} className="space-y-4">
                    <Notice>{activeClient ? `Vehicule rattache au client: ${activeClient.full_name}` : "Selectionnez ou enregistrez un client avant d'ajouter un vehicule."}</Notice>
                    <UploadBlock
                      title="Documents vehicule"
                      subtitle="Lies au client actif et au vehicule sauvegarde"
                      docs={[
                        ["cg", "Carte grise", FileText],
                        ["permis", "Permis", IdCard],
                        ["ct", "Controle technique", Wrench],
                        ["att", "Attestation", ShieldCheck],
                      ]}
                      onUpload={uploadDocument}
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Client lie"><Input disabled readOnly value={activeClient ? `${activeClient.full_name} (#${activeClient.id})` : ""} /></Field>
                      <Field label="Immatriculation *"><Input {...vehicleForm.register("registration_number")} required /></Field>
                      <Field label="Marque"><Input {...vehicleForm.register("make")} /></Field>
                      <Field label="Modele"><Input {...vehicleForm.register("model")} /></Field>
                      <Field label="VIN / Chassis"><Input {...vehicleForm.register("vin")} /></Field>
                      <Field label="Annee"><Input type="number" min={1900} max={2100} {...vehicleForm.register("year")} /></Field>
                      <Field label="Usage">
                        <Select {...vehicleForm.register("usage")}>
                          <option value="">-</option>
                          <option>VP - Tourisme</option>
                          <option>VUL</option>
                          <option>PL</option>
                          <option>Moto</option>
                        </Select>
                      </Field>
                      <Field label="Energie"><Input {...vehicleForm.register("fuel_type")} /></Field>
                      <Field label="Notes vehicule" full><Textarea {...vehicleForm.register("notes")} /></Field>
                    </div>
                    <Actions dangerDisabled={!activeVehicle} onDelete={() => removeActive("vehicle")} deleteLabel="Supprimer vehicule">
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
                    </Actions>
                  </form>
                )}

                {tab === "claim" && (
                  <form onSubmit={claimForm.handleSubmit(submit(saveClaim))} className="space-y-4">
                    <Notice>{activeVehicle ? `Sinistre rattache au vehicule: ${activeVehicle.registration_number || `#${activeVehicle.id}`}` : "Selectionnez un vehicule pour declarer un sinistre."}</Notice>
                    <UploadBlock
                      title="Pieces sinistre"
                      subtitle="Constat, photos, PV et devis lies au sinistre actif"
                      docs={[
                        ["constat", "Constat", FileText],
                        ["photos", "Photos", Upload],
                        ["pv", "PV police", ShieldCheck],
                        ["garage", "Devis / facture", FileText],
                      ]}
                      onUpload={uploadDocument}
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Vehicule lie">
                        <Input disabled readOnly value={activeVehicle ? `${activeVehicle.registration_number || `Vehicule #${activeVehicle.id}`} - ${[activeVehicle.make, activeVehicle.model].filter(Boolean).join(" ")}` : ""} />
                      </Field>
                      <Field label="Reference"><Input disabled {...claimForm.register("claim_number")} /></Field>
                      <Field label="Date accident"><Input type="date" {...claimForm.register("accident_date")} /></Field>
                      <Field label="Lieu"><Input {...claimForm.register("location")} /></Field>
                      <Field label="Description" full><Textarea {...claimForm.register("description")} /></Field>
                    </div>
                    <Actions dangerDisabled={!activeClaim} onDelete={() => removeActive("claim")} deleteLabel="Supprimer sinistre">
                      <Button type="button" disabled={!activeClaim} onClick={exportPdfReport}>
                        <FileText size={16} />
                        Exporter le rapport PDF
                      </Button>
                      <Button type="button" disabled={!activeClaim} onClick={closeAndReset}>
                        <CheckCircle2 size={16} />
                        Reinitialiser
                      </Button>
                      <Button variant="primary" disabled={!activeClient || !activeVehicle} type="submit">
                        <Save size={16} />
                        Enregistrer sinistre
                      </Button>
                    </Actions>
                  </form>
                )}
              </PanelBody>
            </Panel>

            <div className="flex min-h-0 flex-col gap-4">
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                  <ClipboardCheck size={17} /> Relation active
                </div>
                <ActivePath client={activeClient} vehicle={activeVehicle} claim={activeClaim} />
              </Card>

              <div ref={documentsRef}>
                <Panel className="max-h-[420px]">
                  <PanelHead>
                    <div className="flex items-center gap-2 font-extrabold text-ink">
                      <FileText size={17} /> Documents
                    </div>
                    <Badge tone="slate">{scopedDocuments.length}</Badge>
                  </PanelHead>
                  <PanelBody>
                    <div className="flex flex-col gap-2">
                      {scopedDocuments.length === 0 && <EmptyState icon={FileText} title="Aucun document" description="Selectionnez un dossier pour voir ses pieces." />}
                      {scopedDocuments.map((document) => (
                        <DocumentRow key={document.id} document={document} />
                      ))}
                    </div>
                  </PanelBody>
                </Panel>
              </div>

              <Panel className="max-h-[260px]">
                <PanelHead>
                  <div className="flex items-center gap-2 font-extrabold text-ink">
                    <Loader2 size={17} /> Cache OCR
                  </div>
                  <Button size="sm" onClick={() => setOcr({})}>
                    Vider
                  </Button>
                </PanelHead>
                <PanelBody>
                  <pre className="rounded-lg bg-ink p-3 text-xs text-slate-100">{Object.keys(ocr).length ? JSON.stringify(ocr, null, 2) : "Aucun resultat OCR en cache."}</pre>
                </PanelBody>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FormSection({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-4 py-3">
        <div className="flex items-center gap-2 font-extrabold text-ink">
          {icon}
          {title}
        </div>
        {action}
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm font-medium text-brand-900">{children}</div>;
}

function UploadBlock({
  title,
  subtitle,
  docs,
  onUpload,
  action,
  autoOcr,
  setAutoOcr,
}: {
  title: string;
  subtitle: string;
  docs: Array<[string, string, ComponentType<{ size?: number; className?: string }>]>;
  onUpload: (file: File, key: string) => Promise<void>;
  action?: ReactNode;
  autoOcr?: boolean;
  setAutoOcr?: (value: boolean) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-extrabold text-ink">{title}</div>
          <div className="text-sm text-slate-500">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {setAutoOcr && (
            <label className="flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-700">
              <input type="checkbox" checked={autoOcr} onChange={(event) => setAutoOcr(event.target.checked)} />
              OCR auto
            </label>
          )}
          {action}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {docs.map(([key, label, Icon]) => (
          <DocUploadChip
            key={key}
            label={label}
            icon={Icon}
            onFile={(file) => void onUpload(file, key).catch((error) => toast.error(error instanceof Error ? error.message : "Erreur upload"))}
          />
        ))}
      </div>
    </section>
  );
}

function Actions({ children, deleteLabel, dangerDisabled, onDelete }: { children: ReactNode; deleteLabel: string; dangerDisabled: boolean; onDelete: () => Promise<void> }) {
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

function ActivePath({ client, vehicle, claim }: { client: Client | null; vehicle: Vehicle | null; claim: Claim | null }) {
  if (!client) return <Notice>Aucun client selectionne.</Notice>;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-950">
      <b>{client.full_name}</b>
      <br />
      <span className="text-brand-800">Client #{client.id}</span>
      {vehicle && (
        <>
          <br />
          <br />
          <b>Vehicule:</b> {vehicle.registration_number || `#${vehicle.id}`}
          <br />
          <span className="text-brand-800">{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</span>
        </>
      )}
      {claim && (
        <>
          <br />
          <br />
          <b>Sinistre:</b> {claim.claim_number}
        </>
      )}
    </div>
  );
}

function DocumentRow({ document }: { document: DocumentItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-3">
      <span className="min-w-0">
        <b className="block truncate text-sm text-ink">{document.original_filename}</b>
        <span className="text-xs text-slate-500">
          {document.document_type} &middot; #{document.id}
        </span>
      </span>
      <Badge tone={statusTone(document.processing_status)}>{document.processing_status}</Badge>
    </div>
  );
}
