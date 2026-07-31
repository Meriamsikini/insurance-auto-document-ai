"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useForm, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { api, Claim, Client, DocumentItem, fetchPlatformData, Vehicle } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { nextClaimNumber, splitClientName } from "@/lib/utils";
import { usePlatformStore } from "@/store/platform-store";
import { ALL_CARDS, CardDef } from "@/lib/document-schema";

type Tab = "client" | "vehicle" | "claim";
type JsonRecord = Record<string, unknown>;

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
  cg_type: string;
  cg_cv: string;
  cg_energie: string;
  cg_ptac: string;
  cg_places: string;
  cg_couleur: string;
  cg_genre: string;
  cg_proprietaire: string;
  cg_adresse_proprietaire: string;
  notes: string;
  permis_conducteur: string;
  permis_numero: string;
  permis_categories: string;
  permis_autorite: string;
  permis_delivrance: string;
  permis_expiration: string;
  ct_date_visite: string;
  ct_resultat: string;
  ct_expiration: string;
  ct_kilometrage: string;
  ct_anomalies: string;
  att_assureur: string;
  att_contrat: string;
  att_debut: string;
  att_fin: string;
  att_bonus_malus: string;
  att_sinistres: string;
  facture_proprietaire: string;
  facture_prix: string;
  facture_date_achat: string;
  facture_vendeur: string;
  facture_vehicule_concerne: string;
};

type ClaimForm = {
  claim_number: string;
  accident_date: string;
  location: string;
  description: string;
  constat_heure: string;
  constat_conducteur_a: string;
  constat_conducteur_b: string;
  constat_assureur_a: string;
  constat_assureur_b: string;
  constat_croquis: string;
  pv_numero: string;
  pv_responsabilite: string;
  pv_parties: string;
  pv_expert_nom: string;
  pv_expertise_date: string;
  pv_cout_estime: string;
  pv_infractions: string;
  photos_commentaire: string;
  garage_nom: string;
  garage_cout_ht: string;
  garage_tva: string;
  garage_cout_ttc: string;
  garage_pieces: string;
};

function valueOf(meta: JsonRecord | null | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function subMeta(metadata: JsonRecord | null | undefined, key: string): JsonRecord {
  const value = metadata?.[key];
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function toNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rawValue(raw: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const direct = raw[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
    const norm = key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
    for (const rawKey of Object.keys(raw)) {
      const comparable = rawKey
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
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

const CARD_BY_KEY = new Map(ALL_CARDS.map((card) => [card.key, card]));

interface PlatformContextType {
  clients: Client[];
  vehicles: Vehicle[];
  claims: Claim[];
  documents: DocumentItem[];
  isLoading: boolean;

  activeClient: Client | null;
  activeVehicle: Vehicle | null;
  activeClaim: Claim | null;

  clientForm: UseFormReturn<ClientForm>;
  vehicleForm: UseFormReturn<VehicleForm>;
  claimForm: UseFormReturn<ClaimForm>;

  pickClient: (client: Client) => void;
  pickVehicle: (vehicle: Vehicle) => void;
  pickClaim: (claim: Claim) => void;

  deleteClient: (client: Client) => Promise<void>;
  removeActive: (kind: Tab) => Promise<void>;

  uploadDocument: (file: File, docKey: string) => Promise<void>;
  exportClaimReport: (claim: Claim) => Promise<void>;
  handleDownloadDocument: (document: DocumentItem) => void;

  saveClient: (values: ClientForm) => Promise<void>;
  saveVehicle: (values: VehicleForm) => Promise<void>;
  saveClaim: (values: ClaimForm) => Promise<void>;

  submit: <T>(handler: (values: T) => Promise<void>) => (values: T) => Promise<void>;

  // From store
  activeClientId: number | null;
  activeVehicleId: number | null;
  activeClaimId: number | null;
  tab: Tab;
  pendingDocs: { id: number; scope: Tab; document_type: string }[];
  ocr: JsonRecord;
  setActive: (ids: { activeClientId?: number | null; activeVehicleId?: number | null; activeClaimId?: number | null }) => void;
  setTab: (tab: Tab) => void;
  setPendingDocs: (docs: { id: number; scope: Tab; document_type: string }[]) => void;
  setOcr: (ocr: JsonRecord) => void;

  // For the left panel in workspace
  search: string;
  setSearch: (search: string) => void;
  filteredClients: Client[];
  vehiclesOf: (clientId: number) => Vehicle[];
  claimsOf: (vehicleId: number) => Claim[];
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used inside a PlatformProvider");
  }
  return context;
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
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
  const claimForm = useForm<ClaimForm>({ defaultValues: { claim_number: nextClaimNumber(), garage_tva: "20" } });

  useEffect(() => {
    if (!data) return;
    if (activeClientId && !clients.some((client) => client.id === activeClientId)) {
      setActive({ activeClientId: clients[0]?.id ?? null, activeVehicleId: null, activeClaimId: null });
    }
  }, [data, activeClientId, clients, setActive]);

  useEffect(() => {
    const parts = splitClientName(activeClient?.full_name);
    const cin = subMeta(activeClient?.metadata, "cin");
    const domicile = subMeta(activeClient?.metadata, "domicile");
    const comp = subMeta(activeClient?.metadata, "complementaires");
    clientForm.reset({
      nom: parts.nom,
      prenom: parts.prenom,
      cin_number: activeClient?.cin_number ?? "",
      birth_date: valueOf(cin, "birth_date"),
      sex: valueOf(cin, "sex"),
      expiration_date: valueOf(cin, "cin_expiration"),
      cin_address: valueOf(cin, "cin_address") || activeClient?.address || "",
      city: valueOf(cin, "city"),
      domicile_address: valueOf(domicile, "domicile_address") || activeClient?.address || "",
      domicile_type: valueOf(domicile, "domicile_type"),
      domicile_issuer: valueOf(domicile, "domicile_issuer"),
      domicile_date: valueOf(domicile, "domicile_date"),
      phone: activeClient?.phone ?? "",
      email: activeClient?.email ?? "",
      profession: valueOf(comp, "profession"),
      client_type: activeClient?.client_type ?? "individual",
    });
  }, [activeClient, clientForm]);

  useEffect(() => {
    const cg = subMeta(activeVehicle?.metadata, "cg");
    const permis = subMeta(activeVehicle?.metadata, "permis");
    const ct = subMeta(activeVehicle?.metadata, "ct");
    const att = subMeta(activeVehicle?.metadata, "att");
    const facture = subMeta(activeVehicle?.metadata, "facture");
    vehicleForm.reset({
      registration_number: activeVehicle?.registration_number ?? "",
      make: activeVehicle?.make ?? "",
      model: activeVehicle?.model ?? "",
      vin: activeVehicle?.vin ?? "",
      year: activeVehicle?.year ? String(activeVehicle.year) : "",
      usage: activeVehicle?.usage ?? "",
      cg_type: valueOf(cg, "type"),
      cg_cv: valueOf(cg, "cv"),
      cg_energie: valueOf(cg, "energie"),
      cg_ptac: valueOf(cg, "ptac"),
      cg_places: valueOf(cg, "places"),
      cg_couleur: valueOf(cg, "couleur"),
      cg_genre: valueOf(cg, "genre"),
      cg_proprietaire: valueOf(cg, "proprietaire"),
      cg_adresse_proprietaire: valueOf(cg, "adresse_proprietaire"),
      notes: valueOf(cg, "notes"),
      permis_conducteur: valueOf(permis, "conducteur"),
      permis_numero: valueOf(permis, "numero"),
      permis_categories: valueOf(permis, "categories"),
      permis_autorite: valueOf(permis, "autorite"),
      permis_delivrance: valueOf(permis, "delivrance"),
      permis_expiration: valueOf(permis, "expiration"),
      ct_date_visite: valueOf(ct, "date_visite"),
      ct_resultat: valueOf(ct, "resultat"),
      ct_expiration: valueOf(ct, "expiration"),
      ct_kilometrage: valueOf(ct, "kilometrage"),
      ct_anomalies: valueOf(ct, "anomalies"),
      att_assureur: valueOf(att, "assureur"),
      att_contrat: valueOf(att, "contrat"),
      att_debut: valueOf(att, "debut"),
      att_fin: valueOf(att, "fin"),
      att_bonus_malus: valueOf(att, "bonus_malus"),
      att_sinistres: valueOf(att, "sinistres"),
      facture_proprietaire: valueOf(facture, "proprietaire"),
      facture_prix: valueOf(facture, "prix"),
      facture_date_achat: valueOf(facture, "date_achat"),
      facture_vendeur: valueOf(facture, "vendeur"),
      facture_vehicule_concerne: valueOf(facture, "vehicule_concerne"),
    });
  }, [activeVehicle, vehicleForm]);

  useEffect(() => {
    const constat = subMeta(activeClaim?.metadata, "constat");
    const pv = subMeta(activeClaim?.metadata, "pv");
    const garage = subMeta(activeClaim?.metadata, "garage");
    const photos = subMeta(activeClaim?.metadata, "photos");
    claimForm.reset({
      claim_number: activeClaim?.claim_number ?? nextClaimNumber(),
      accident_date: activeClaim?.accident_date ?? "",
      location: activeClaim?.location ?? "",
      description: activeClaim?.description ?? "",
      constat_heure: valueOf(constat, "heure"),
      constat_conducteur_a: valueOf(constat, "conducteur_a"),
      constat_conducteur_b: valueOf(constat, "conducteur_b"),
      constat_assureur_a: valueOf(constat, "assureur_a"),
      constat_assureur_b: valueOf(constat, "assureur_b"),
      constat_croquis: valueOf(constat, "croquis"),
      pv_numero: valueOf(pv, "numero"),
      pv_responsabilite: valueOf(pv, "responsabilite"),
      pv_parties: valueOf(pv, "parties"),
      pv_expert_nom: valueOf(pv, "expert_nom"),
      pv_expertise_date: valueOf(pv, "expertise_date"),
      pv_cout_estime: valueOf(pv, "cout_estime"),
      pv_infractions: valueOf(pv, "infractions"),
      photos_commentaire: valueOf(photos, "commentaire"),
      garage_nom: valueOf(garage, "nom"),
      garage_cout_ht: valueOf(garage, "cout_ht"),
      garage_tva: valueOf(garage, "tva") || "20",
      garage_cout_ttc: valueOf(garage, "cout_ttc"),
      garage_pieces: valueOf(garage, "pieces"),
    });
  }, [activeClaim, claimForm]);

  const garageHt = claimForm.watch("garage_cout_ht");
  const garageTva = claimForm.watch("garage_tva");
  useEffect(() => {
    const ht = parseFloat(garageHt) || 0;
    const tvaParsed = parseFloat(garageTva);
    const rate = Number.isFinite(tvaParsed) ? tvaParsed : 20;
    claimForm.setValue("garage_cout_ttc", ht ? (ht * (1 + rate / 100)).toFixed(2) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageHt, garageTva]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const text = [client.full_name, client.cin_number, client.email, client.phone, ...vehiclesOf(client.id).map((vehicle) => vehicle.registration_number)].join(" ").toLowerCase();
      return !query || text.includes(query);
    });
  }, [clients, search, vehicles, vehiclesOf]);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["platform"] });
  }

  useEffect(() => {
    const currentPath = pathname.split("/")[1];
    const newTab = (currentPath === "clients" ? "client" : currentPath === "vehicles" ? "vehicle" : currentPath === "claims" ? "claim" : null);
    if (newTab && newTab !== tab) {
      setTab(newTab);
    }
  }, [pathname, tab, setTab]);

  function pickClient(client: Client) {
    const firstVehicle = vehiclesOf(client.id)[0];
    const firstClaim = firstVehicle ? claimsOf(firstVehicle.id)[0] : null;
    setActive({ activeClientId: client.id, activeVehicleId: firstVehicle?.id ?? null, activeClaimId: firstClaim?.id ?? null });
    router.push("/clients");
  }

  function pickVehicle(vehicle: Vehicle) {
    setActive({ activeClientId: vehicle.client_id, activeVehicleId: vehicle.id, activeClaimId: claimsOf(vehicle.id)[0]?.id ?? null });
    router.push("/vehicles");
  }

  function pickClaim(claim: Claim) {
    setActive({ activeClientId: claim.client_id, activeVehicleId: claim.vehicle_id, activeClaimId: claim.id });
    router.push("/claims");
  }

  function handleNav(key: string) {
    const routes: Record<string, string> = {
      overview: "/dashboard",
      documents: "/documents",
      dossiers: "/dossiers",
      clients: "/clients",
      vehicles: "/vehicles",
      claims: "/claims",
    };
    if (routes[key]) {
      router.push(routes[key]);
    }
  }

  const navActive = useMemo(() => {
    const currentPath = pathname.split("/")[1] || "dashboard";
    const mapping: Record<string, string> = {
      dashboard: "overview",
      documents: "documents",
      dossiers: "dossiers",
      clients: "clients",
      vehicles: "vehicles",
      claims: "claims",
    };
    return mapping[currentPath] || "overview";
  }, [pathname]);

  async function assignPending(scope: Tab, refs: JsonRecord) {
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
        cin: { sex: values.sex || null, birth_date: values.birth_date || null, cin_expiration: values.expiration_date || null, cin_address: values.cin_address || null, city: values.city || null },
        domicile: { domicile_address: values.domicile_address || null, domicile_type: values.domicile_type || null, domicile_issuer: values.domicile_issuer || null, domicile_date: values.domicile_date || null },
        complementaires: { profession: values.profession || null },
        ocr_cache: ocr.client || null,
      },
    };
    const response = activeClientId ? await api.patch<Client>(`/clients/${activeClientId}`, payload) : await api.post<Client>("/clients", payload);
    setActive({ activeClientId: response.data.id });
    await assignPending("client", { client_id: response.data.id, validated_data: { scope: "client", values } });
    await invalidate();
    router.push("/vehicles");
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
      metadata: {
        cg: {
          type: values.cg_type || null,
          cv: toNumber(values.cg_cv),
          energie: values.cg_energie || null,
          ptac: toNumber(values.cg_ptac),
          places: toNumber(values.cg_places),
          couleur: values.cg_couleur || null,
          genre: values.cg_genre || null,
          proprietaire: values.cg_proprietaire || null,
          adresse_proprietaire: values.cg_adresse_proprietaire || null,
          notes: values.notes || null,
        },
        permis: {
          conducteur: values.permis_conducteur || null,
          numero: values.permis_numero || null,
          categories: values.permis_categories || null,
          autorite: values.permis_autorite || null,
          delivrance: values.permis_delivrance || null,
          expiration: values.permis_expiration || null,
        },
        ct: {
          date_visite: values.ct_date_visite || null,
          resultat: values.ct_resultat || null,
          expiration: values.ct_expiration || null,
          kilometrage: toNumber(values.ct_kilometrage),
          anomalies: values.ct_anomalies || null,
        },
        att: {
          assureur: values.att_assureur || null,
          contrat: values.att_contrat || null,
          debut: values.att_debut || null,
          fin: values.att_fin || null,
          bonus_malus: values.att_bonus_malus || null,
          sinistres: values.att_sinistres || null,
        },
        facture: {
          proprietaire: values.facture_proprietaire || null,
          prix: toNumber(values.facture_prix),
          date_achat: values.facture_date_achat || null,
          vendeur: values.facture_vendeur || null,
          vehicule_concerne: values.facture_vehicule_concerne || null,
        },
        ocr_cache: ocr.vehicle || null,
      },
    };
    const response = activeVehicleId ? await api.patch<Vehicle>(`/vehicles/${activeVehicleId}`, payload) : await api.post<Vehicle>("/vehicles", payload);
    setActive({ activeVehicleId: response.data.id });
    await assignPending("vehicle", { client_id: activeClientId, vehicle_id: response.data.id, validated_data: { scope: "vehicle", values } });
    await invalidate();
    router.push("/claims");
    toast.success("Vehicule enregistre. Vous pouvez declarer un sinistre.");
  }

  async function saveClaim(values: ClaimForm) {
    if (!activeClientId || !activeVehicleId) throw new Error("Selectionnez un client et un vehicule.");
    const payload: JsonRecord = {
      client_id: activeClientId,
      vehicle_id: activeVehicleId,
      claim_number: values.claim_number || nextClaimNumber(),
      accident_date: values.accident_date || null,
      location: values.location || null,
      description: values.description || null,
      metadata: {
        constat: {
          heure: values.constat_heure || null,
          conducteur_a: values.constat_conducteur_a || null,
          conducteur_b: values.constat_conducteur_b || null,
          assureur_a: values.constat_assureur_a || null,
          assureur_b: values.constat_assureur_b || null,
          croquis: values.constat_croquis || null,
        },
        pv: {
          numero: values.pv_numero || null,
          responsabilite: values.pv_responsabilite || null,
          parties: values.pv_parties || null,
          expert_nom: values.pv_expert_nom || null,
          expertise_date: values.pv_expertise_date || null,
          cout_estime: toNumber(values.pv_cout_estime),
          infractions: values.pv_infractions || null,
        },
        garage: {
          nom: values.garage_nom || null,
          cout_ht: toNumber(values.garage_cout_ht),
          tva: toNumber(values.garage_tva),
          cout_ttc: toNumber(values.garage_cout_ttc),
          pieces: values.garage_pieces || null,
        },
        photos: { commentaire: values.photos_commentaire || null },
        ocr_cache: ocr.claim || null,
      },
    };
    const response = activeClaimId ? await api.patch<Claim>(`/claims/${activeClaimId}`, payload) : await api.post<Claim>("/claims", payload);
    setActive({ activeClaimId: response.data.id });
    await assignPending("claim", { client_id: activeClientId, vehicle_id: activeVehicleId, sinistre_id: response.data.id, validated_data: { scope: "claim", values } });
    await invalidate();
    toast.success("Sinistre enregistre et lie au vehicule.");
  }

  async function deleteClient(client: Client) {
    await api.delete(`/clients/${client.id}`);
    if (activeClientId === client.id) setActive({ activeClientId: null, activeVehicleId: null, activeClaimId: null });
    await invalidate();
    toast.success("Dossier supprime.");
  }

  async function removeActive(kind: Tab) {
    if (kind === "client" && activeClient) {
      await deleteClient(activeClient);
      return;
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
        toast.success("OCR applique a la carte correspondante.");
      }
      if (doc.processing_status === "FAILED") toast.error(`OCR echoue: ${doc.processing_error || "erreur inconnue"}`);
      break;
    }
  }

  function applyAi(ai: JsonRecord, scope: Tab, docKey: string) {
    const raw = (ai.raw_fields as JsonRecord) || ai;
    setOcr({ ...ocr, [scope]: { ...((ocr[scope] as JsonRecord) || {}), [docKey]: ai } });

    if (docKey === "cin") {
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
    if (docKey === "domicile") {
      clientForm.setValue("domicile_address", rawValue(raw, "adresse", "address"));
      clientForm.setValue("domicile_issuer", rawValue(raw, "emetteur", "issuer", "societe"));
      clientForm.setValue("domicile_date", isoDate(rawValue(raw, "date", "date document")).slice(0, 7));
    }
    if (docKey === "cg") {
      vehicleForm.setValue("registration_number", String(ai.vehicle || rawValue(raw, "immatriculation", "registration_number")));
      vehicleForm.setValue("make", rawValue(raw, "marque", "make", "brand"));
      vehicleForm.setValue("model", rawValue(raw, "modele", "model"));
      vehicleForm.setValue("vin", rawValue(raw, "chassis", "vin"));
      vehicleForm.setValue("cg_energie", rawValue(raw, "carburant", "energie", "fuel"));
      vehicleForm.setValue("cg_proprietaire", rawValue(raw, "proprietaire", "owner"));
    }
    if (docKey === "permis") {
      vehicleForm.setValue("permis_conducteur", rawValue(raw, "nom", "conducteur", "nom complet"));
      vehicleForm.setValue("permis_numero", rawValue(raw, "numero permis", "permis"));
      vehicleForm.setValue("permis_categories", rawValue(raw, "categories", "categorie"));
    }
    if (docKey === "ct") {
      vehicleForm.setValue("ct_date_visite", isoDate(rawValue(raw, "date visite", "date")));
      vehicleForm.setValue("ct_resultat", rawValue(raw, "resultat", "result"));
      vehicleForm.setValue("ct_expiration", isoDate(rawValue(raw, "date expiration", "expiration")));
    }
    if (docKey === "att") {
      vehicleForm.setValue("att_assureur", rawValue(raw, "assureur", "compagnie"));
      vehicleForm.setValue("att_contrat", rawValue(raw, "contrat", "police", "numero contrat"));
      vehicleForm.setValue("att_debut", isoDate(rawValue(raw, "date debut", "debut")));
      vehicleForm.setValue("att_fin", isoDate(rawValue(raw, "date fin", "fin")));
    }
    if (docKey === "facture") {
      vehicleForm.setValue("facture_proprietaire", rawValue(raw, "proprietaire", "acheteur"));
      vehicleForm.setValue("facture_prix", rawValue(raw, "prix", "montant"));
      vehicleForm.setValue("facture_vendeur", rawValue(raw, "vendeur", "concessionnaire"));
    }
    if (docKey === "constat") {
      claimForm.setValue("accident_date", isoDate(rawValue(raw, "date accident", "date_accident", "date")));
      claimForm.setValue("location", rawValue(raw, "lieu", "location"));
      claimForm.setValue("description", String(ai.accident_summary || rawValue(raw, "description", "accident_summary")));
      claimForm.setValue("constat_heure", rawValue(raw, "heure", "time"));
    }
    if (docKey === "pv") {
      claimForm.setValue("pv_numero", rawValue(raw, "numero pv", "reference"));
      claimForm.setValue("pv_responsabilite", rawValue(raw, "responsabilite"));
      claimForm.setValue("pv_infractions", rawValue(raw, "infractions"));
    }
    if (docKey === "garage") {
      claimForm.setValue("garage_nom", String(ai.garage_name || rawValue(raw, "garage", "nom garage")));
      if (ai.total_cost) claimForm.setValue("garage_cout_ttc", String(ai.total_cost));
    }
    if (docKey === "photos" && !claimForm.getValues("description")) {
      claimForm.setValue("description", String(ai.accident_summary || ""));
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
    setPendingDocs([...pendingDocs.filter((doc) => doc.id !== response.data.id), { id: response.data.id, scope, document_type: response.data.document_type }]);
    void pollAi(response.data.id, scope, docKey);
    await invalidate();
    toast.success("Document uploade. Traitement OCR lance.");
  }

  async function exportClaimReport(claim: Claim) {
    toast.info("Generation du rapport PDF en cours...");
    try {
      const response = await api.get(`/claims/${claim.id}/report`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Rapport-Sinistre-${claim.claim_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Rapport PDF telecharge.");
    } catch {
      toast.error("Erreur lors de la generation du rapport PDF.");
    }
  }

  function handleDownloadDocument(document: DocumentItem) {
    window.open(`/api/v1/documents/${document.id}/download`, "_blank");
  }

  const submit = <T,>(handler: (values: T) => Promise<void>) => async (values: T) => {
    try {
      await handler(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur inconnue");
    }
  };

  const contextValue: PlatformContextType = {
    clients,
    vehicles,
    claims,
    documents,
    isLoading,
    activeClient,
    activeVehicle,
    activeClaim,
    clientForm,
    vehicleForm,
    claimForm,
    pickClient,
    pickVehicle,
    pickClaim,
    deleteClient,
    removeActive,
    saveClient,
    saveVehicle,
    saveClaim,
    uploadDocument,
    exportClaimReport,
    handleDownloadDocument,
    submit,
    activeClientId,
    activeVehicleId,
    activeClaimId,
    tab,
    pendingDocs,
    ocr,
    setActive,
    setTab,
    setPendingDocs,
    setOcr,
    search,
    setSearch,
    filteredClients,
    vehiclesOf,
    claimsOf,
  };

  return (
    <PlatformContext.Provider value={contextValue}>
      <AppShell
        active={navActive}
        onNavigate={handleNav}
        onSelectClient={pickClient}
        onSelectVehicle={pickVehicle}
        onSelectClaim={pickClaim}
        onRefresh={async () => { await refetch(); }}
        stats={{ clients: clients.length, vehicles: vehicles.length, claims: claims.length }}
      >
        {children}
      </AppShell>
    </PlatformContext.Provider>
  );
}