"use client";

/**
 * PlatformWorkspace — the main application logic component.
 * Shared across all route pages (/dashboard, /clients, /vehicules, etc.)
 * Props control which view is shown based on the current route.
 */

import { useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileStack, Plus, Save, Search, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { api, Claim, Client, DocumentItem, fetchPlatformData, Vehicle } from "@/lib/api";
import { nextClaimNumber, splitClientName } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { DocumentsView } from "@/components/documents-view";
import { DossiersView } from "@/components/dossiers-view";
import { DocumentCard } from "@/components/document-card";
import { DocUploadChip, type ChipTone } from "@/components/upload-dropzone";
import { Badge, Button, EmptyState, Panel, PanelBody, PanelHead, SegmentedTabs } from "@/components/ui";
import { ALL_CARDS, cardsFor, matchDocuments, type CardDef } from "@/lib/document-schema";
import { usePlatformStore } from "@/store/platform-store";
import { AuthGuard } from "@/components/auth-guard";

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "dashboard" | "workspace" | "documents" | "dossiers";
type Tab = "client" | "vehicle" | "claim";
type JsonRecord = Record<string, unknown>;

type ClientForm = {
  nom: string; prenom: string; cin_number: string; birth_date: string; sex: string;
  expiration_date: string; cin_address: string; city: string; domicile_address: string;
  domicile_type: string; domicile_issuer: string; domicile_date: string; phone: string;
  email: string; profession: string; client_type: string;
};

type VehicleForm = {
  registration_number: string; make: string; model: string; vin: string; year: string;
  usage: string; cg_type: string; cg_cv: string; cg_energie: string; cg_ptac: string;
  cg_places: string; cg_couleur: string; cg_genre: string; cg_proprietaire: string;
  cg_adresse_proprietaire: string; notes: string; permis_conducteur: string; permis_numero: string;
  permis_categories: string; permis_autorite: string; permis_delivrance: string; permis_expiration: string;
  ct_date_visite: string; ct_resultat: string; ct_expiration: string; ct_kilometrage: string;
  ct_anomalies: string; att_assureur: string; att_contrat: string; att_debut: string;
  att_fin: string; att_bonus_malus: string; att_sinistres: string; facture_proprietaire: string;
  facture_prix: string; facture_date_achat: string; facture_vendeur: string; facture_vehicule_concerne: string;
};

type ClaimForm = {
  claim_number: string; accident_date: string; location: string; description: string;
  constat_heure: string; constat_conducteur_a: string; constat_conducteur_b: string;
  constat_assureur_a: string; constat_assureur_b: string; constat_croquis: string;
  pv_numero: string; pv_responsabilite: string; pv_parties: string; pv_expert_nom: string;
  pv_expertise_date: string; pv_cout_estime: string; pv_infractions: string;
  photos_commentaire: string; garage_nom: string; garage_cout_ht: string; garage_tva: string;
  garage_cout_ttc: string; garage_pieces: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function valueOf(meta: JsonRecord | null | undefined, key: string) {
  const v = meta?.[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}
function subMeta(meta: JsonRecord | null | undefined, key: string): JsonRecord {
  const v = meta?.[key];
  return v && typeof v === "object" ? (v as JsonRecord) : {};
}
function toNumber(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fuzzy lookup across raw_fields returned by the OCR/Gemini pipeline.
 */
function rawValue(raw: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const direct = raw[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
    const norm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"");
    for (const rawKey of Object.keys(raw)) {
      const comp = rawKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"");
      if ((comp.includes(norm) || norm.includes(comp)) && raw[rawKey]) return String(raw[rawKey]);
    }
  }
  return "";
}

/**
 * Task 3 helper — normalizes a free-text "oui/non" style value coming back
 * from Gemini into the exact option string expected by the <select> field
 * (constat_croquis has options: ["Oui", "Non"]).
 */
function normalizeOuiNon(value: string): "" | "Oui" | "Non" {
  const v = value.toLowerCase().trim();
  if (!v) return "";
  if (/(^|\b)(oui|yes|true|present|présent|avec croquis)(\b|$)/.test(v)) return "Oui";
  if (/(^|\b)(non|no|false|absent|sans croquis)(\b|$)/.test(v)) return "Non";
  return "";
}

function isoDate(v?: string) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : "";
}
function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

const CARD_TONE: Record<string, ChipTone> = {
  cin:"blue", domicile:"teal", cg:"blue", permis:"teal", ct:"amber",
  att:"green", facture:"red", constat:"blue", pv:"red", photos:"teal", garage:"green",
};
const CARD_BY_KEY = new Map(ALL_CARDS.map((c) => [c.key, c]));

// ── Props ─────────────────────────────────────────────────────────────────────

type PlatformWorkspaceProps = {
  initialView: View;
  initialTab?: Tab;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlatformWorkspace({ initialView, initialTab = "client" }: PlatformWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    search,
    setSearch,
    activeClientId, activeVehicleId, activeClaimId,
    tab, pendingDocs, ocr,
    setActive, setTab, setPendingDocs, setOcr,
  } = usePlatformStore();

  const view = initialView;
  const currentTab = initialTab || tab;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["platform"],
    queryFn: fetchPlatformData,
  });

  const clients = data?.clients ?? [];
  const vehicles = data?.vehicles ?? [];
  const claims = data?.claims ?? [];
  const documents = data?.documents ?? [];

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;
  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId) ?? null;
  const activeClaim = claims.find((c) => c.id === activeClaimId) ?? null;
  const vehiclesOf = (clientId: number) => vehicles.filter((v) => v.client_id === clientId);
  const claimsOf = (vehicleId: number) => claims.filter((c) => c.vehicle_id === vehicleId);

  const clientForm = useForm<ClientForm>({ defaultValues: { client_type: "individual" } });
  const vehicleForm = useForm<VehicleForm>();
  const claimForm = useForm<ClaimForm>({ defaultValues: { claim_number: nextClaimNumber(), garage_tva: "20" } });
  const lastAiAppliedAtRef = useRef<number | null>(null);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["platform"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
    await refetch();
  }, [queryClient, refetch]);

  useEffect(() => {
    if (!data) return;
    if (activeClientId && !clients.some((c) => c.id === activeClientId)) {
      setActive({ activeClientId: clients[0]?.id ?? null, activeVehicleId: null, activeClaimId: null });
    }
  }, [data, activeClientId, clients, setActive]);

  useEffect(() => {
    const cin = subMeta(activeClient?.metadata, "cin");
    const parts = splitClientName(valueOf(cin, "full_name") || activeClient?.full_name);
    const domicile = subMeta(activeClient?.metadata, "domicile");
    const comp = subMeta(activeClient?.metadata, "complementaires");
    clientForm.reset({
      nom: parts.nom, prenom: parts.prenom,
      cin_number: activeClient?.cin_number || valueOf(cin, "number"),
      birth_date: valueOf(cin, "birth_date"), sex: valueOf(cin, "sex"),
      expiration_date: valueOf(cin, "cin_expiration") || valueOf(cin, "expiration"),
      cin_address: valueOf(cin, "cin_address") || valueOf(cin, "address") || activeClient?.address || "",
      city: valueOf(cin, "city"),
      domicile_address: valueOf(domicile, "domicile_address") || valueOf(domicile, "address") || activeClient?.address || "",
      domicile_type: valueOf(domicile, "domicile_type") || valueOf(domicile, "type_document") || valueOf(domicile, "type") || "",
      domicile_issuer: valueOf(domicile, "domicile_issuer") || valueOf(domicile, "issuer") || "",
      domicile_date: valueOf(domicile, "domicile_date") || valueOf(domicile, "date") || "",
      phone: activeClient?.phone ?? "", email: activeClient?.email ?? "",
      profession: valueOf(comp, "profession"),
      client_type: activeClient?.client_type ?? "individual",
    });
  }, [activeClient]);

  useEffect(() => {
    const cg = subMeta(activeVehicle?.metadata, "cg");
    const permis = subMeta(activeVehicle?.metadata, "permis");
    const ct = subMeta(activeVehicle?.metadata, "ct");
    const att = subMeta(activeVehicle?.metadata, "att");
    const facture = subMeta(activeVehicle?.metadata, "facture");
    vehicleForm.reset({
      registration_number: activeVehicle?.registration_number ?? "",
      make: activeVehicle?.make ?? "", model: activeVehicle?.model ?? "",
      vin: activeVehicle?.vin ?? "",
      year: activeVehicle?.year ? String(activeVehicle.year) : "",
      usage: activeVehicle?.usage ?? "",
      cg_type: valueOf(cg,"type"), cg_cv: valueOf(cg,"cv"), cg_energie: valueOf(cg,"energie"),
      cg_ptac: valueOf(cg,"ptac"), cg_places: valueOf(cg,"places"), cg_couleur: valueOf(cg,"couleur"),
      cg_genre: valueOf(cg,"genre"), cg_proprietaire: valueOf(cg,"proprietaire"),
      cg_adresse_proprietaire: valueOf(cg,"adresse_proprietaire"), notes: valueOf(cg,"notes"),
      permis_conducteur: valueOf(permis,"conducteur"), permis_numero: valueOf(permis,"numero"),
      permis_categories: valueOf(permis,"categories"), permis_autorite: valueOf(permis,"autorite"),
      permis_delivrance: valueOf(permis,"delivrance"), permis_expiration: valueOf(permis,"expiration"),
      ct_date_visite: valueOf(ct,"date_visite"), ct_resultat: valueOf(ct,"resultat"),
      ct_expiration: valueOf(ct,"expiration"), ct_kilometrage: valueOf(ct,"kilometrage"),
      ct_anomalies: valueOf(ct,"anomalies"),
      att_assureur: valueOf(att,"assureur"), att_contrat: valueOf(att,"contrat"),
      att_debut: valueOf(att,"debut"), att_fin: valueOf(att,"fin"),
      att_bonus_malus: valueOf(att,"bonus_malus"), att_sinistres: valueOf(att,"sinistres"),
      facture_proprietaire: valueOf(facture,"proprietaire"), facture_prix: valueOf(facture,"prix"),
      facture_date_achat: valueOf(facture,"date_achat"), facture_vendeur: valueOf(facture,"vendeur"),
      facture_vehicule_concerne: valueOf(facture,"vehicule_concerne"),
    });
  }, [activeVehicle]);

  useEffect(() => {
    const claimMetadata = ((activeClaim?.metadata as JsonRecord) || {}) as JsonRecord;
    const metadataConstat = subMeta(claimMetadata, "constat");
    const metadataPv = subMeta(claimMetadata, "pv");
    const metadataGarage = subMeta(claimMetadata, "garage");
    const metadataPhotos = subMeta(claimMetadata, "photos");

    const persistedValues = {
      accident_date: (activeClaim?.accident_date ?? valueOf(metadataConstat, "date_accident")) || isoDate(rawValue(({} as JsonRecord), "date accident", "date_accident", "date")),
      location: (activeClaim?.location ?? valueOf(metadataConstat, "lieu")) || rawValue(({} as JsonRecord), "lieu", "location"),
      description:
        (activeClaim?.description ??
          String(valueOf(metadataConstat, "description") || valueOf(metadataConstat, "accident_summary") || "").trim()) ||
        "",
      constat_heure: valueOf(metadataConstat, "heure"),
      constat_conducteur_a: valueOf(metadataConstat, "conducteur_a"),
      constat_conducteur_b: valueOf(metadataConstat, "conducteur_b"),
      constat_assureur_a: valueOf(metadataConstat, "assureur_a"),
      constat_assureur_b: valueOf(metadataConstat, "assureur_b"),
      constat_croquis: valueOf(metadataConstat, "croquis"),
      pv_numero: valueOf(metadataPv, "numero"),
      pv_responsabilite: valueOf(metadataPv, "responsabilite"),
      pv_parties: valueOf(metadataPv, "parties"),
      pv_expert_nom: valueOf(metadataPv, "expert_nom"),
      pv_expertise_date: valueOf(metadataPv, "expertise_date"),
      pv_cout_estime: valueOf(metadataPv, "cout_estime"),
      pv_infractions: valueOf(metadataPv, "infractions"),
      photos_commentaire: valueOf(metadataPhotos, "commentaire"),
      garage_nom: valueOf(metadataGarage, "nom"),
      garage_cout_ht: valueOf(metadataGarage, "cout_ht"),
      garage_tva: valueOf(metadataGarage, "tva") || "20",
      garage_cout_ttc: valueOf(metadataGarage, "cout_ttc"),
      garage_pieces: valueOf(metadataGarage, "pieces"),
    };

    const hydrated = {
      claim_number: activeClaim?.claim_number ?? nextClaimNumber(),
      accident_date: persistedValues.accident_date,
      location: persistedValues.location,
      description: persistedValues.description,
      constat_heure: persistedValues.constat_heure,
      constat_conducteur_a: persistedValues.constat_conducteur_a,
      constat_conducteur_b: persistedValues.constat_conducteur_b,
      constat_assureur_a: persistedValues.constat_assureur_a,
      constat_assureur_b: persistedValues.constat_assureur_b,
      constat_croquis: persistedValues.constat_croquis,
      pv_numero: persistedValues.pv_numero,
      pv_responsabilite: persistedValues.pv_responsabilite,
      pv_parties: persistedValues.pv_parties,
      pv_expert_nom: persistedValues.pv_expert_nom,
      pv_expertise_date: persistedValues.pv_expertise_date,
      pv_cout_estime: persistedValues.pv_cout_estime,
      pv_infractions: persistedValues.pv_infractions,
      photos_commentaire: persistedValues.photos_commentaire,
      garage_nom: persistedValues.garage_nom,
      garage_cout_ht: persistedValues.garage_cout_ht,
      garage_tva: persistedValues.garage_tva,
      garage_cout_ttc: persistedValues.garage_cout_ttc,
      garage_pieces: persistedValues.garage_pieces,
    };

    claimForm.reset(hydrated);
  }, [activeClaim, claimForm]);

  const garageHt = claimForm.watch("garage_cout_ht");
  const garageTva = claimForm.watch("garage_tva");
  useEffect(() => {
    const ht = parseFloat(garageHt) || 0;
    const rate = parseFloat(garageTva) || 20;
    claimForm.setValue("garage_cout_ttc", ht ? (ht * (1 + rate / 100)).toFixed(2) : "");
  }, [garageHt, garageTva]);

  const filteredClients = useMemo(() => {
    const q = (search ?? "").trim().toLowerCase();
    return clients.filter((c) => {
      const text = [c.full_name, c.cin_number, c.email, c.phone,
        ...vehiclesOf(c.id).map((v) => v.registration_number)].join(" ").toLowerCase();
      return !q || text.includes(q);
    });
  }, [clients, search, vehicles]);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["platform"] });
  }

  function pickClient(client: Client) {
    const firstVehicle = vehiclesOf(client.id)[0];
    const firstClaim = firstVehicle ? claimsOf(firstVehicle.id)[0] : null;
    setActive({ activeClientId: client.id, activeVehicleId: firstVehicle?.id ?? null, activeClaimId: firstClaim?.id ?? null });
    setTab("client");
    router.push("/clients");
  }
  function pickVehicle(vehicle: Vehicle) {
    setActive({ activeClientId: vehicle.client_id, activeVehicleId: vehicle.id, activeClaimId: claimsOf(vehicle.id)[0]?.id ?? null });
    setTab("vehicle");
    router.push("/vehicules");
  }
  function pickClaim(claim: Claim) {
    setActive({ activeClientId: claim.client_id, activeVehicleId: claim.vehicle_id, activeClaimId: claim.id });
    setTab("claim");
    router.push("/sinistres");
  }

  function handleNav(key: string) {
    if (key === "clients") setTab("client");
    if (key === "vehicles") setTab("vehicle");
    if (key === "claims") setTab("claim");
  }

  const navActive = view === "dashboard" ? "overview"
    : view === "documents" ? "documents"
    : view === "dossiers" ? "dossiers"
    : currentTab === "client" ? "clients"
    : currentTab === "vehicle" ? "vehicles"
    : "claims";

  async function assignPending(scope: Tab, refs: JsonRecord) {
    const docs = pendingDocs.filter((d) => d.scope === scope);
    await Promise.all(docs.map((d) => api.post(`/documents/${d.id}/assign-refs`, refs).catch(() => null)));
    setPendingDocs(pendingDocs.filter((d) => d.scope !== scope));
  }
  
  async function saveClient(values: ClientForm, { navigate = true } = {}) {
    const payload = {
      full_name: [values.nom, values.prenom].filter(Boolean).join(" ") || "Nouveau client",
      cin_number: values.cin_number || null, phone: values.phone || null,
      email: values.email || null, address: values.domicile_address || values.cin_address || null,
      client_type: values.client_type,
      metadata: {
        cin: { sex: values.sex||null, birth_date: values.birth_date||null, cin_expiration: values.expiration_date||null, cin_address: values.cin_address||null, city: values.city||null },
        domicile: { domicile_address: values.domicile_address||null, domicile_type: values.domicile_type||null, domicile_issuer: values.domicile_issuer||null, domicile_date: values.domicile_date||null },
        complementaires: { profession: values.profession||null },
        ocr_cache: ocr.client || ocr,
      },
    };
    const response = activeClientId
      ? await api.patch<Client>(`/clients/${activeClientId}`, payload)
      : await api.post<Client>("/clients", payload);
    setActive({ activeClientId: response.data.id });
    await assignPending("client", { client_id: response.data.id, validated_data: { scope:"client", values } });
    await invalidate();
    if (navigate) {
      setTab("vehicle");
      router.push("/vehicules");
      toast.success("Client enregistré.");
    }
  }

  async function saveVehicle(values: VehicleForm, { navigate = true } = {}) {
    if (!activeClientId) throw new Error("Enregistrez d'abord le client.");
    const payload = {
      client_id: activeClientId, registration_number: values.registration_number||null,
      vin: values.vin||null, make: values.make||null, model: values.model||null,
      year: values.year ? Number(values.year) : null, usage: values.usage||null,
      metadata: {
        cg: { type:values.cg_type||null, cv:toNumber(values.cg_cv), energie:values.cg_energie||null, ptac:toNumber(values.cg_ptac), places:toNumber(values.cg_places), couleur:values.cg_couleur||null, genre:values.cg_genre||null, proprietaire:values.cg_proprietaire||null, adresse_proprietaire:values.cg_adresse_proprietaire||null, notes:values.notes||null },
        permis: { conducteur:values.permis_conducteur||null, numero:values.permis_numero||null, categories:values.permis_categories||null, autorite:values.permis_autorite||null, delivrance:values.permis_delivrance||null, expiration:values.permis_expiration||null },
        ct: { date_visite:values.ct_date_visite||null, resultat:values.ct_resultat||null, expiration:values.ct_expiration||null, kilometrage:toNumber(values.ct_kilometrage), anomalies:values.ct_anomalies||null },
        att: { assureur:values.att_assureur||null, contrat:values.att_contrat||null, debut:values.att_debut||null, fin:values.att_fin||null, bonus_malus:values.att_bonus_malus||null, sinistres:values.att_sinistres||null },
        facture: { proprietaire:values.facture_proprietaire||null, prix:toNumber(values.facture_prix), date_achat:values.facture_date_achat||null, vendeur:values.facture_vendeur||null, vehicule_concerne:values.facture_vehicule_concerne||null },
        ocr_cache: ocr.vehicle || ocr,
      },
    };
    const response = activeVehicleId
      ? await api.patch<Vehicle>(`/vehicles/${activeVehicleId}`, payload)
      : await api.post<Vehicle>("/vehicles", payload);
    setActive({ activeVehicleId: response.data.id });
    await assignPending("vehicle", { client_id: activeClientId, vehicle_id: response.data.id, validated_data: { scope:"vehicle", values } });
    await invalidate();
    if (navigate) {
      setTab("claim");
      router.push("/sinistres");
      toast.success("Véhicule enregistré.");
    }
  }

  async function saveClaim(values: ClaimForm) {
    if (!activeClientId || !activeVehicleId) throw new Error("Sélectionnez un client et un véhicule.");
    const payload: JsonRecord = {
      client_id: activeClientId, vehicle_id: activeVehicleId,
      claim_number: values.claim_number || nextClaimNumber(),
      accident_date: values.accident_date || null, location: values.location || null,
      description: values.description || null,
      metadata: {
        constat: { heure:values.constat_heure||null, conducteur_a:values.constat_conducteur_a||null, conducteur_b:values.constat_conducteur_b||null, assureur_a:values.constat_assureur_a||null, assureur_b:values.constat_assureur_b||null, croquis:values.constat_croquis||null },
        pv: { numero:values.pv_numero||null, responsabilite:values.pv_responsabilite||null, parties:values.pv_parties||null, expert_nom:values.pv_expert_nom||null, expertise_date:values.pv_expertise_date||null, cout_estime:toNumber(values.pv_cout_estime), infractions:values.pv_infractions||null },
        garage: { nom:values.garage_nom||null, cout_ht:toNumber(values.garage_cout_ht), tva:toNumber(values.garage_tva), cout_ttc:toNumber(values.garage_cout_ttc), pieces:values.garage_pieces||null },
        photos: { commentaire:values.photos_commentaire||null },
        ocr_cache: ocr.claim || ocr,
      },
    };
    const response = activeClaimId
      ? await api.patch<Claim>(`/claims/${activeClaimId}`, payload)
      : await api.post<Claim>("/claims", payload);
    setActive({ activeClaimId: response.data.id });
    await assignPending("claim", { client_id: activeClientId, vehicle_id: activeVehicleId, sinistre_id: response.data.id, validated_data: { scope:"claim", values } });
    await invalidate();
    toast.success("Sinistre enregistré.");
  }

  async function saveAndClose(values: ClaimForm) {
    try {
      await saveClaim(values);
      clientForm.reset({ client_type: "individual" });
      vehicleForm.reset({});
      claimForm.reset({ claim_number: nextClaimNumber(), garage_tva: "20" });
      setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null });
      setTab("client");
      setPendingDocs([]);
      setOcr({});
      router.push("/dashboard");
      toast.success("Dossier clôturé avec succès. Prêt pour un nouveau dossier.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la clôture du dossier.");
    }
  }

  async function deleteClient(client: Client) {
    await api.delete(`/clients/${client.id}`);
    if (activeClientId === client.id) setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null });
    await invalidate();
    toast.success("Dossier supprimé.");
  }

  async function removeActive(kind: Tab) {
    if (kind === "client" && activeClient) { await deleteClient(activeClient); return; }
    if (kind === "vehicle" && activeVehicleId) { await api.delete(`/vehicles/${activeVehicleId}`); setActive({ activeVehicleId: null, activeClaimId: null }); }
    if (kind === "claim" && activeClaimId) { await api.delete(`/claims/${activeClaimId}`); setActive({ activeClaimId: null }); }
    await invalidate();
    toast.success("Suppression effectuée.");
  }

  async function handleDeleteDocument(doc: DocumentItem): Promise<void> {
    await api.delete(`/documents/${doc.id}`);
    setPendingDocs(pendingDocs.filter((d) => d.id !== doc.id));
    // The API atomically clears persisted AI mappings. Do not repopulate the
    // forms from the session OCR cache after a document has been removed.
    setOcr({});
    await invalidate();
    toast.success(`Document "${doc.original_filename}" supprimé et données AI réinitialisées.`);
    return;
    /* Legacy client-side deletion path intentionally disabled: cleanup is now
       performed atomically by the API, before the document is deleted.

    const scope = (
      doc.sinistre_id != null ? "claim"
      : doc.vehicle_id  != null ? "vehicle"
      : "client"
    ) as Tab;

    const card = ALL_CARDS.find(c => c.documentType === doc.document_type);

    if (card) {
      // Clean up OCR cache for this document's card
      const scopeOcr = (ocr[scope] as JsonRecord | undefined) ?? {};
      // @ts-ignore Legacy branch retained below is unreachable after API cleanup.
      if (scopeOcr[card.key]) {
          const newScopeOcr = { ...scopeOcr };
          // @ts-ignore Legacy branch retained below is unreachable after API cleanup.
          delete newScopeOcr[card.key];
          setOcr({ ...ocr, [scope]: newScopeOcr });
      }

      // Clear form fields associated with the card
      // @ts-ignore Legacy branch retained below is unreachable after API cleanup.
      const fieldNames = card.fields.map(f => f.name);
      let formToSave: 'client' | 'vehicle' | 'claim' | null = null;

      switch (scope) {
        case "client":
          fieldNames.forEach(name => clientForm.setValue(name as keyof ClientForm, ""));
          formToSave = 'client';
          break;
        case "vehicle":
          fieldNames.forEach(name => vehicleForm.setValue(name as keyof VehicleForm, ""));
          formToSave = 'vehicle';
          break;
        case "claim":
          fieldNames.forEach(name => {
            if (name === 'garage_tva') {
              claimForm.setValue(name, "20");
            } else {
              claimForm.setValue(name as keyof ClaimForm, "");
            }
          });
          formToSave = 'claim';
          break;
      }

      // Persist the cleared fields by re-saving the parent entity
      try {
        if (formToSave === 'client' && activeClient) {
          await saveClient(clientForm.getValues(), { navigate: false });
        } else if (formToSave === 'vehicle' && activeVehicle) {
          await saveVehicle(vehicleForm.getValues(), { navigate: false });
        } else if (formToSave === 'claim' && activeClaim) {
          await saveClaim(claimForm.getValues());
        }
      } catch (err) {
        // @ts-ignore Legacy branch retained below is unreachable after API cleanup.
        toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde après suppression.");
      }
    }

    await invalidate();
    toast.success(`« ${doc.original_filename} » supprimé et données associées réinitialisées.`);
    */
  }

  async function ensureClaimForDocumentUpload() {
    if (activeClaimId) return activeClaimId;
    if (!activeClientId || !activeVehicleId) throw new Error("Sélectionnez un client et un véhicule avant d'uploader une pièce sinistre.");
    const response = await api.post<Claim>("/claims", { client_id: activeClientId, vehicle_id: activeVehicleId, claim_number: nextClaimNumber(), metadata: { created_from_document_upload: true } });
    setActive({ activeClaimId: response.data.id });
    await invalidate();
    return response.data.id;
  }

  async function pollAi(id: number, scope: Tab, docKey: string) {
    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const resp = await api.get<DocumentItem>(`/documents/${id}`).catch(() => null);
      const doc = resp?.data;
      if (!doc || doc.processing_status === "PENDING" || doc.processing_status === "PROCESSING") continue;
      if (doc.processing_status === "COMPLETED" && doc.ai_result) { applyAi(doc.ai_result, scope, docKey); await invalidate(); toast.success("OCR appliqué."); }
      if (doc.processing_status === "FAILED") toast.error(`OCR échoué: ${doc.processing_error || "erreur"}`);
      break;
    }
  }

  function applyConstatFields(raw: JsonRecord, claimForm: ReturnType<typeof useForm<ClaimForm>>) {
    claimForm.setValue("accident_date", isoDate(rawValue(raw,"date accident","date_accident","date")));
    claimForm.setValue("location", rawValue(raw,"lieu","location"));

    const heure = rawValue(raw, "heure", "heure accident", "heure_accident", "time");
    if (heure) claimForm.setValue("constat_heure", heure);

    const conducteurA = rawValue(raw, "conducteur_a", "conducteur a", "vehicule a", "vehicule_a", "conducteur vehicule a", "identite conducteur a");
    if (conducteurA) claimForm.setValue("constat_conducteur_a", conducteurA);

    const conducteurB = rawValue(raw, "conducteur_b", "conducteur b", "vehicule b", "vehicule_b", "conducteur vehicule b", "identite conducteur b");
    if (conducteurB) claimForm.setValue("constat_conducteur_b", conducteurB);

    const assureurA = rawValue(raw, "assureur_a", "assureur a", "compagnie a", "compagnie assurance a");
    if (assureurA) claimForm.setValue("constat_assureur_a", assureurA);

    const assureurB = rawValue(raw, "assureur_b", "assureur b", "compagnie b", "compagnie assurance b");
    if (assureurB) claimForm.setValue("constat_assureur_b", assureurB);

    const croquisRaw = rawValue(raw, "croquis", "croquis inclus", "schema", "dessin");
    const croquisNormalized = normalizeOuiNon(croquisRaw);
    if (croquisNormalized) claimForm.setValue("constat_croquis", croquisNormalized);

    const responsabilite = rawValue(raw, "responsabilite_probable", "responsabilite");
    const currentDescription = claimForm.getValues("description");
    if (responsabilite && currentDescription && !currentDescription.toLowerCase().includes(responsabilite.toLowerCase())) {
      claimForm.setValue("description", `${currentDescription}\n\nResponsabilité probable (IA): ${responsabilite}`);
    }
  }

  function applyAi(ai: JsonRecord, scope: Tab, docKey: string) {
    const raw = (ai.raw_fields as JsonRecord) || ai;
    lastAiAppliedAtRef.current = Date.now();
    setOcr({ ...ocr, [scope]: { ...((ocr[scope] as JsonRecord) || {}), [docKey]: ai } });

    const isConstatResult = String(ai.document_type || docKey || "").toLowerCase() === "constat"
      || Object.keys(raw).some((key) => ["heure","conducteur_a","conducteur_b","assureur_a","assureur_b","croquis"].includes(key.toLowerCase()));

    if (docKey === "cin") {
      const name = String(ai.name || rawValue(raw,"full_name","name","nom complet"));
      const parts = splitClientName(name);
      clientForm.setValue("nom", rawValue(raw,"nom","last_name","surname") || parts.nom);
      clientForm.setValue("prenom", rawValue(raw,"prenom","first_name","given_name") || parts.prenom);
      clientForm.setValue("cin_number", String(ai.cin_number || rawValue(raw,"cin_number","numero cin","cin")));
      clientForm.setValue("birth_date", isoDate(rawValue(raw,"date naissance","birth_date")));
      clientForm.setValue("expiration_date", isoDate(rawValue(raw,"date expiration","valid_until","expiration")));
      clientForm.setValue("cin_address", rawValue(raw,"adresse","address"));
      clientForm.setValue("city", rawValue(raw,"ville","city"));
    }
    if (docKey === "cg") {
      vehicleForm.setValue("registration_number", String(ai.vehicle || rawValue(raw,"immatriculation","registration_number")));
      vehicleForm.setValue("make", rawValue(raw,"marque","make","brand"));
      vehicleForm.setValue("model", rawValue(raw,"modele","model"));
      vehicleForm.setValue("vin", rawValue(raw,"chassis","vin"));
      vehicleForm.setValue("cg_energie", rawValue(raw,"carburant","energie","fuel"));
    }

    // ────────────────────────────────────────────────────────────────────────
    // Task 3 — Constat amiable : auto-remplissage complet de tous les champs
    // liés à la carte "constat" à partir de la réponse Gemini (raw_fields).
    // Auparavant seuls accident_date / location / description étaient remplis.
    // Désormais : heure, conducteur A/B, assureur A/B et croquis le sont aussi.
    // ────────────────────────────────────────────────────────────────────────
    if (isConstatResult || docKey === "constat") {
      applyConstatFields(raw, claimForm);
      // The top-level `accident_summary` is the narrative description for the claim.
      const constatDescription = String(ai.accident_summary || rawValue(raw, "description", "circonstances") || "").trim();
      if (constatDescription) claimForm.setValue("description", constatDescription);
    }

    if (docKey === "garage") {
      claimForm.setValue("garage_nom", String(ai.garage_name || rawValue(raw,"garage","nom garage")));
      if (ai.total_cost) claimForm.setValue("garage_cout_ttc", String(ai.total_cost));
    }
    if (docKey === "photos") {
      // For accident photos, the `accident_summary` from AI is used as a comment.
      const photoComment = String(ai.accident_summary || rawValue(raw, "description", "commentaire", "circonstances") || "").trim();
      if (photoComment) claimForm.setValue("photos_commentaire", photoComment);
    }
  }

  async function uploadDocument(file: File, docKey: string) {
    const card = CARD_BY_KEY.get(docKey);
    const scope = (card?.scope ?? "client") as Tab;
    const storedType = card?.documentType ?? docKey;
    const claimId = scope === "claim" ? await ensureClaimForDocumentUpload() : activeClaimId;
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", storedType);
    if (activeClientId) form.append("client_id", String(activeClientId));
    if (scope === "vehicle" && activeVehicleId) form.append("vehicle_id", String(activeVehicleId));
    if (scope === "claim" && claimId) form.append("sinistre_id", String(claimId));
    toast.info(`Upload en cours: ${file.name}`);
    const response = await api.post<DocumentItem>("/documents/upload", form);
    setPendingDocs([...pendingDocs.filter((d) => d.id !== response.data.id), { id: response.data.id, scope, document_type: response.data.document_type }]);
    void pollAi(response.data.id, scope, docKey);
    await invalidate();
    toast.success("Document uploadé. Traitement OCR lancé.");
  }

  async function exportClaimReport(claim: Claim) {
    toast.info("Génération du rapport PDF en cours...");
    try {
      const response = await api.get(`/claims/${claim.id}/report`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url; link.setAttribute("download", `Rapport-Sinistre-${claim.claim_number}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Rapport PDF téléchargé.");
    } catch { toast.error("Erreur lors de la génération du rapport PDF."); }
  }

  function handleDownloadDocument(document: DocumentItem) {
    window.open(`/api/v1/documents/${document.id}/download`, "_blank");
  }

  const submit = <T,>(handler: (values: T) => Promise<void>) => async (values: T) => {
    try { await handler(values); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Erreur inconnue"); }
  };

  const workspaceTab = initialView === "workspace"
    ? (initialTab ?? currentTab)
    : tab;

  return (
    <AuthGuard>
      <AppShell
        active={navActive}
        onNavigate={handleNav}
        onSelectClient={pickClient}
        onSelectVehicle={pickVehicle}
        onSelectClaim={pickClaim}
        onRefresh={handleRefresh}
        stats={{ clients: clients.length, vehicles: vehicles.length, claims: claims.length }}
      >
        <div className="h-full overflow-y-auto scrollbar-thin">
          {view === "dashboard" && (
            <DashboardView clients={clients} vehicles={vehicles} claims={claims} documents={documents} onOpenClient={pickClient} onExportClaim={exportClaimReport} />
          )}

          {view === "documents" && (
            <DocumentsView clients={clients} vehicles={vehicles} claims={claims} documents={documents} onDownload={handleDownloadDocument} />
          )}

          {view === "dossiers" && (
            <DossiersView clients={clients} vehicles={vehicles} claims={claims} documents={documents} onOpenInWorkspace={pickClient} onExportClaim={exportClaimReport} onDeleteClient={deleteClient} />
          )}

          {view === "workspace" && (
            <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                <Panel className="max-h-[calc(100vh-140px)]">
                  <PanelHead>
                    <div className="flex items-center gap-2 font-extrabold text-ink"><User size={17} /> Dossiers</div>
                    <Button variant="primary" size="sm" onClick={() => { setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null }); setTab("client"); router.push("/clients"); }}>
                      <Plus size={14} /> Client
                    </Button>
                  </PanelHead>
                  <PanelBody>
                    <label className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3">
                      <Search size={16} className="text-ink3" />
                      <input className="w-full border-0 bg-transparent px-0 py-2 text-sm text-ink outline-none placeholder:text-ink3" placeholder="Rechercher..." value={search ?? ""} onChange={(e) => setSearch?.(e.target.value)} />
                    </label>
                    <div className="flex flex-col gap-2">
                      {isLoading && <div className="p-4 text-sm text-ink3">Chargement...</div>}
                      {!isLoading && filteredClients.length === 0 && <EmptyState icon={User} title="Aucun dossier" description="Créez votre premier client pour démarrer." />}
                      {filteredClients.map((client) => (
                        <div key={client.id} className="overflow-hidden rounded-xl border border-line bg-surface2/40">
                          <button className={`flex w-full items-start gap-3 p-3 text-left transition hover:bg-brand-500/10 ${client.id === activeClientId ? "bg-brand-500/10" : ""}`} onClick={() => pickClient(client)}>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">{initials(client.full_name)}</span>
                            <span className="min-w-0">
                              <b className={`block truncate text-sm ${client.id === activeClientId ? "text-brand-300" : "text-ink"}`}>{client.full_name}</b>
                              <span className="text-xs text-ink3">{client.cin_number || "Sans CIN"} · {vehiclesOf(client.id).length} véhicule(s)</span>
                            </span>
                          </button>
                          <div className="border-t border-line bg-surface2/40 p-2">
                            {vehiclesOf(client.id).map((vehicle) => (
                              <div key={vehicle.id}>
                                <button className={`flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-surface3 ${vehicle.id === activeVehicleId ? "bg-surface3 text-brand-300" : "text-ink2"}`} onClick={() => pickVehicle(vehicle)}>
                                  <ChevronRight size={14} className="mt-0.5 shrink-0" />
                                  <span className="min-w-0">
                                    <b className="block truncate">{vehicle.registration_number || "Sans plaque"}</b>
                                    <span className="text-xs text-ink3">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Modèle non renseigné"}</span>
                                  </span>
                                </button>
                                {claimsOf(vehicle.id).map((claim) => (
                                  <button key={claim.id} className={`ml-6 flex w-[calc(100%-1.5rem)] items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-surface3 ${claim.id === activeClaimId ? "bg-surface3 text-brand-300" : "text-ink2"}`} onClick={() => pickClaim(claim)}>
                                    <ChevronRight size={13} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                      <b className="block truncate">{claim.claim_number}</b>
                                      <span className="text-xs text-ink3">{claim.accident_date || "Date inconnue"}</span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            {vehiclesOf(client.id).length === 0 && <div className="p-2 text-sm text-ink3">Aucun véhicule</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </PanelBody>
                </Panel>

                <div className="space-y-4">
                  {activeClient && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink2">
                      <button onClick={() => { setTab("client"); router.push("/clients"); }} className="font-semibold text-ink hover:text-brand-300">{activeClient.full_name}</button>
                      {activeVehicle && (<><ChevronRight size={13} className="text-ink3" /><button onClick={() => { setTab("vehicle"); router.push("/vehicules"); }} className="font-semibold text-ink hover:text-brand-300">{activeVehicle.registration_number || `Véhicule #${activeVehicle.id}`}</button></>)}
                      {activeClaim && (<><ChevronRight size={13} className="text-ink3" /><button onClick={() => { setTab("claim"); router.push("/sinistres"); }} className="font-semibold text-ink hover:text-brand-300">{activeClaim.claim_number}</button></>)}
                    </div>
                  )}

                  <SegmentedTabs<Tab>
                    value={workspaceTab as Tab}
                    onChange={(t) => { setTab(t); if (t === "client") router.push("/clients"); else if (t === "vehicle") router.push("/vehicules"); else router.push("/sinistres"); }}
                    items={[
                      { key: "client", label: "Client", icon: User },
                      { key: "vehicle", label: "Véhicule" },
                      { key: "claim", label: "Sinistre" },
                    ]}
                  />

                  {workspaceTab === "client" && (
                    <form onSubmit={clientForm.handleSubmit(submit(saveClient))} className="space-y-4">
                      <UploadSection scope="client" onUpload={uploadDocument} documents={documents} ids={{ clientId: activeClientId }} />
                      <div className="grid gap-4">
                        {cardsFor("client").map((card) => (
                          <DocumentCard key={card.key} def={card} register={clientForm.register} resetFields={(names) => names.forEach((n) => clientForm.setValue(n as keyof ClientForm, ""))}
                            matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId })} ocrExtracted={!!(ocr.client as JsonRecord | undefined)?.[card.key]} onDownload={handleDownloadDocument} onDeleteDocument={handleDeleteDocument} />
                        ))}
                      </div>
                      <FormActions deleteLabel="Supprimer client" dangerDisabled={!activeClient} onDelete={() => removeActive("client")}>
                        <Button type="button" onClick={() => setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null })}>Nouveau</Button>
                        <Button variant="primary" type="submit"><Save size={16} />Enregistrer client</Button>
                      </FormActions>
                    </form>
                  )}

                  {workspaceTab === "vehicle" && (
                    <form onSubmit={vehicleForm.handleSubmit(submit(saveVehicle))} className="space-y-4">
                      <Notice>{activeClient ? `Véhicule rattaché au client: ${activeClient.full_name}` : "Sélectionnez ou enregistrez un client avant d'ajouter un véhicule."}</Notice>
                      <UploadSection scope="vehicle" onUpload={uploadDocument} documents={documents} ids={{ clientId: activeClientId, vehicleId: activeVehicleId }}
                        action={<Button size="sm" type="button" onClick={() => { setActive({ activeVehicleId: null, activeClaimId: null }); setTab("vehicle"); }}><Plus size={14} />Nouveau véhicule</Button>} />
                      <div className="grid gap-4">
                        {cardsFor("vehicle").map((card) => (
                          <DocumentCard key={card.key} def={card} register={vehicleForm.register} resetFields={(names) => names.forEach((n) => vehicleForm.setValue(n as keyof VehicleForm, ""))}
                            matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId, vehicleId: activeVehicleId })} ocrExtracted={!!(ocr.vehicle as JsonRecord | undefined)?.[card.key]} onDownload={handleDownloadDocument} onDeleteDocument={handleDeleteDocument} />
                        ))}
                      </div>
                      <FormActions deleteLabel="Supprimer véhicule" dangerDisabled={!activeVehicle} onDelete={() => removeActive("vehicle")}>
                        <Button type="button" disabled={!activeVehicle} onClick={() => { setActive({ activeClaimId: null }); setTab("claim"); router.push("/sinistres"); }}><Plus size={16} />Déclarer sinistre</Button>
                        <Button variant="primary" disabled={!activeClient} type="submit"><Save size={16} />Enregistrer véhicule</Button>
                      </FormActions>
                    </form>
                  )}

                  {workspaceTab === "claim" && (
                    <form onSubmit={claimForm.handleSubmit(submit(saveAndClose))} className="space-y-4">
                      <Notice>{activeVehicle ? `Sinistre rattaché au véhicule: ${activeVehicle.registration_number || `#${activeVehicle.id}`}` : "Sélectionnez un véhicule pour déclarer un sinistre."}</Notice>
                      <UploadSection scope="claim" onUpload={uploadDocument} documents={documents} ids={{ clientId: activeClientId, vehicleId: activeVehicleId, claimId: activeClaimId }}
                        action={<Button size="sm" type="button" onClick={() => { setActive({ activeClaimId: null }); setTab("claim"); }}><Plus size={14} />Nouveau sinistre</Button>} />
                      <div className="grid gap-4">
                        {cardsFor("claim").map((card) => (
                          <DocumentCard key={card.key} def={card} register={claimForm.register} resetFields={(names) => names.forEach((n) => claimForm.setValue(n as keyof ClaimForm, ""))}
                            matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId, vehicleId: activeVehicleId, claimId: activeClaimId })} ocrExtracted={!!(ocr.claim as JsonRecord | undefined)?.[card.key]} onDownload={handleDownloadDocument} onDeleteDocument={handleDeleteDocument} />
                        ))}
                      </div>
                      <FormActions deleteLabel="Supprimer sinistre" dangerDisabled={!activeClaim} onDelete={() => removeActive("claim")}>
                        <Button type="button" disabled={!activeClaim} onClick={() => activeClaim && exportClaimReport(activeClaim)}><FileStack size={16} />Exporter rapport PDF</Button>
                        <Button variant="primary" disabled={!activeClient || !activeVehicle} type="submit"><Save size={16} />Enregistrer et clôturer le dossier</Button>
                      </FormActions>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 p-3 text-sm font-medium text-brand-200">{children}</div>;
}

function UploadSection({ scope, onUpload, documents, ids, action }: {
  scope: Tab; onUpload: (file: File, key: string) => Promise<void>;
  documents: DocumentItem[]; ids: { clientId?: number | null; vehicleId?: number | null; claimId?: number | null };
  action?: React.ReactNode;
}) {
  const cards = cardsFor(scope).filter((c): c is CardDef & { documentType: string } => Boolean(c.documentType));
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-extrabold text-ink">Import de documents</div>
          <div className="text-sm text-ink3">Déposez ou choisissez les pièces — l&apos;OCR remplit automatiquement les cartes ci-dessous.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">OCR automatique</Badge>
          {action}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.map((card) => (
          <DocUploadChip key={card.key} label={card.title} icon={card.icon} tone={CARD_TONE[card.key] ?? "blue"} multiple={card.multiple} done={matchDocuments(documents, card, ids).length > 0}
            onFile={(file) => void onUpload(file, card.key).catch((err) => toast.error(err instanceof Error ? err.message : "Erreur upload"))} />
        ))}
      </div>
    </section>
  );
}

function FormActions({ children, deleteLabel, dangerDisabled, onDelete }: {
  children: React.ReactNode; deleteLabel: string; dangerDisabled: boolean; onDelete: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-t border-line pt-4 md:flex-row">
      <Button type="button" variant="danger" disabled={dangerDisabled} onClick={() => window.confirm(`${deleteLabel} ?`) && onDelete().catch((err) => toast.error(err instanceof Error ? err.message : "Erreur suppression"))}>
        <Trash2 size={16} />{deleteLabel}
      </Button>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
