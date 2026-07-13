"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileStack, Plus, Save, Search, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
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

type Tab = "client" | "vehicle" | "claim";
type View = "dashboard" | "workspace" | "documents" | "dossiers";

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

const CARD_BY_KEY = new Map(ALL_CARDS.map((card) => [card.key, card]));

export default function AssurAutoPlatform() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("dashboard");
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
  }, [clients, search, vehicles]);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["platform"] });
  }

  function pickClient(client: Client) {
    const firstVehicle = vehiclesOf(client.id)[0];
    const firstClaim = firstVehicle ? claimsOf(firstVehicle.id)[0] : null;
    setActive({ activeClientId: client.id, activeVehicleId: firstVehicle?.id ?? null, activeClaimId: firstClaim?.id ?? null });
    setTab("client");
    setView("workspace");
  }

  function pickVehicle(vehicle: Vehicle) {
    setActive({ activeClientId: vehicle.client_id, activeVehicleId: vehicle.id, activeClaimId: claimsOf(vehicle.id)[0]?.id ?? null });
    setTab("vehicle");
    setView("workspace");
  }

  function pickClaim(claim: Claim) {
    setActive({ activeClientId: claim.client_id, activeVehicleId: claim.vehicle_id, activeClaimId: claim.id });
    setTab("claim");
    setView("workspace");
  }

  function handleNav(key: string) {
    if (key === "overview") setView("dashboard");
    if (key === "documents") setView("documents");
    if (key === "dossiers") setView("dossiers");
    if (key === "clients") {
      setView("workspace");
      setTab("client");
    }
    if (key === "vehicles") {
      setView("workspace");
      setTab("vehicle");
    }
    if (key === "claims") {
      setView("workspace");
      setTab("claim");
    }
  }

  const navActive =
    view === "dashboard" ? "overview" : view === "documents" ? "documents" : view === "dossiers" ? "dossiers" : tab === "client" ? "clients" : tab === "vehicle" ? "vehicles" : "claims";

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
        ocr_cache: ocr.vehicle || ocr,
      },
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
        ocr_cache: ocr.claim || ocr,
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
        {view === "dashboard" && (
          <DashboardView
            clients={clients}
            vehicles={vehicles}
            claims={claims}
            documents={documents}
            onOpenClient={pickClient}
            onExportClaim={exportClaimReport}
          />
        )}

        {view === "documents" && <DocumentsView clients={clients} vehicles={vehicles} claims={claims} documents={documents} onDownload={handleDownloadDocument} />}

        {view === "dossiers" && (
          <DossiersView
            clients={clients}
            vehicles={vehicles}
            claims={claims}
            documents={documents}
            onOpenInWorkspace={pickClient}
            onExportClaim={exportClaimReport}
            onDeleteClient={deleteClient}
          />
        )}

        {view === "workspace" && (
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
                    {isLoading && (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-line p-4 text-sm text-ink3">Chargement...</div>
                    )}
                    {!isLoading && filteredClients.length === 0 && <EmptyState icon={User} title="Aucun dossier" description="Creez votre premier client pour demarrer." />}
                    {filteredClients.map((client) => (
                      <div key={client.id} className="overflow-hidden rounded-xl border border-line bg-surface2/40">
                        <button
                          className={`flex w-full items-start gap-3 p-3 text-left transition hover:bg-brand-500/10 ${client.id === activeClientId ? "bg-brand-500/10" : ""}`}
                          onClick={() => pickClient(client)}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">
                            {initials(client.full_name)}
                          </span>
                          <span className="min-w-0">
                            <b className={`block truncate text-sm ${client.id === activeClientId ? "text-brand-300" : "text-ink"}`}>{client.full_name}</b>
                            <span className="text-xs text-ink3">
                              {client.cin_number || "Sans CIN"} &middot; {vehiclesOf(client.id).length} vehicule(s)
                            </span>
                          </span>
                        </button>
                        <div className="border-t border-line bg-surface2/40 p-2">
                          {vehiclesOf(client.id).map((vehicle) => (
                            <div key={vehicle.id}>
                              <button
                                className={`flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-surface3 ${vehicle.id === activeVehicleId ? "bg-surface3 text-brand-300" : "text-ink2"}`}
                                onClick={() => pickVehicle(vehicle)}
                              >
                                <ChevronRight size={14} className="mt-0.5 shrink-0" />
                                <span className="min-w-0">
                                  <b className="block truncate">{vehicle.registration_number || "Vehicule sans plaque"}</b>
                                  <span className="text-xs text-ink3">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Modele non renseigne"}</span>
                                </span>
                              </button>
                              {claimsOf(vehicle.id).map((claim) => (
                                <button
                                  key={claim.id}
                                  className={`ml-6 flex w-[calc(100%-1.5rem)] items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-surface3 ${claim.id === activeClaimId ? "bg-surface3 text-brand-300" : "text-ink2"}`}
                                  onClick={() => pickClaim(claim)}
                                >
                                  <ChevronRight size={13} className="mt-0.5 shrink-0" />
                                  <span className="min-w-0">
                                    <b className="block truncate">{claim.claim_number}</b>
                                    <span className="text-xs text-ink3">{claim.accident_date || "Date inconnue"}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ))}
                          {vehiclesOf(client.id).length === 0 && <div className="p-2 text-sm text-ink3">Aucun vehicule</div>}
                        </div>
                      </div>
                    ))}
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
                          matchedDocuments={matchDocuments(documents, card, { clientId: activeClientId })}
                          ocrExtracted={!!(ocr.client as JsonRecord | undefined)?.[card.key]}
                          onDownload={handleDownloadDocument}
                        />
                      ))}
                    </div>
                    <FormActions
                      deleteLabel="Supprimer client"
                      dangerDisabled={!activeClient}
                      onDelete={() => removeActive("client")}
                    >
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
        )}
      </div>
    </AppShell>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 p-3 text-sm font-medium text-brand-200">{children}</div>;
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
  documents: DocumentItem[];
  ids: { clientId?: number | null; vehicleId?: number | null; claimId?: number | null };
  action?: React.ReactNode;
}) {
  const cards = cardsFor(scope).filter((card): card is CardDef & { documentType: string } => Boolean(card.documentType));
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-extrabold text-ink">Import de documents</div>
          <div className="text-sm text-ink3">Deposez ou choisissez les pieces du dossier — l&apos;OCR remplit automatiquement les cartes ci-dessous.</div>
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
