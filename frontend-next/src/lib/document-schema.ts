import type { ComponentType } from "react";
import { Car, ClipboardCheck, FileText, IdCard, Receipt, ShieldCheck, Camera, Wrench, Home, UserRound } from "lucide-react";
import type { Claim, Client, DocumentItem, Vehicle } from "./api";

export type Scope = "client" | "vehicle" | "claim";
export type FieldType = "text" | "date" | "month" | "number" | "select" | "textarea";

export type CardField = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  full?: boolean;
  readOnly?: boolean;
  placeholder?: string;
};

export type CardDef = {
  key: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  scope: Scope;
  /** backend `document_type` this card is tied to; omitted = pure entity card (no file expected) */
  documentType?: string;
  /** counts toward dossier completeness */
  required: boolean;
  /** accepts multiple files (galleries) */
  multiple?: boolean;
  fields: CardField[];
};

/* --------------------------------------------------------------------- */
/*  CLIENT                                                                */
/* --------------------------------------------------------------------- */

export const CLIENT_CARDS: CardDef[] = [
  {
    key: "cin",
    title: "CIN / Passeport",
    description: "Identite officielle du client",
    icon: IdCard,
    scope: "client",
    documentType: "cin",
    required: true,
    fields: [
      { name: "nom", label: "Nom", type: "text", required: true },
      { name: "prenom", label: "Prenom", type: "text", required: true },
      { name: "cin_number", label: "N CIN / Passeport", type: "text", required: true },
      { name: "birth_date", label: "Date de naissance", type: "date" },
      { name: "sex", label: "Sexe", type: "select", options: ["Masculin", "Feminin"] },
      { name: "expiration_date", label: "Date d'expiration", type: "date" },
      { name: "cin_address", label: "Adresse", type: "text", full: true },
      { name: "city", label: "Ville", type: "text" },
    ],
  },
  {
    key: "domicile",
    title: "Justificatif de domicile",
    description: "Facture, quittance ou attestation de residence",
    icon: Home,
    scope: "client",
    documentType: "domicile",
    required: true,
    fields: [
      { name: "domicile_address", label: "Adresse confirmee", type: "text", full: true },
      {
        name: "domicile_type",
        label: "Type de document",
        type: "select",
        options: ["Facture electricite", "Facture eau", "Quittance de loyer", "Releve bancaire", "Attestation residence"],
      },
      { name: "domicile_issuer", label: "Emetteur", type: "text" },
      { name: "domicile_date", label: "Date du document", type: "month" },
    ],
  },
  {
    key: "complementaires",
    title: "Informations complementaires",
    description: "Coordonnees et statut client",
    icon: UserRound,
    scope: "client",
    required: false,
    fields: [
      { name: "phone", label: "Telephone", type: "text", placeholder: "+212 6XX XXX XXX" },
      { name: "email", label: "Email", type: "text", placeholder: "client@email.ma" },
      { name: "profession", label: "Profession", type: "text" },
      { name: "client_type", label: "Statut client", type: "select", options: ["individual", "professional", "company"] },
    ],
  },
];

/* --------------------------------------------------------------------- */
/*  VEHICLE                                                               */
/* --------------------------------------------------------------------- */

export const VEHICLE_CARDS: CardDef[] = [
  {
    key: "cg",
    title: "Carte grise",
    description: "Identification officielle du vehicule",
    icon: FileText,
    scope: "vehicle",
    documentType: "cg",
    required: true,
    fields: [
      { name: "registration_number", label: "Immatriculation", type: "text", required: true },
      { name: "make", label: "Marque", type: "text" },
      { name: "model", label: "Modele", type: "text" },
      { name: "cg_type", label: "Type vehicule", type: "select", options: ["VP - Tourisme", "VUL", "PL", "Moto"] },
      { name: "vin", label: "N Chassis (VIN)", type: "text", full: true },
      { name: "cg_cv", label: "Puissance fiscale (CV)", type: "number" },
      { name: "cg_energie", label: "Energie / Carburant", type: "select", options: ["Essence", "Diesel", "Electrique", "Hybride", "GPL"] },
      { name: "year", label: "Annee / 1ere mise en circulation", type: "number" },
      { name: "cg_ptac", label: "PTAC (kg)", type: "number" },
      { name: "cg_places", label: "Nb de places", type: "number" },
      { name: "cg_couleur", label: "Couleur", type: "text" },
      { name: "cg_genre", label: "Genre", type: "select", options: ["VP", "VU", "CTTE", "TCP"] },
      { name: "usage", label: "Usage", type: "select", options: ["VP - Tourisme", "VUL", "PL", "Moto"] },
      { name: "cg_proprietaire", label: "Proprietaire", type: "text", full: true },
      { name: "cg_adresse_proprietaire", label: "Adresse proprietaire", type: "text", full: true },
      { name: "notes", label: "Observations", type: "textarea", full: true },
    ],
  },
  {
    key: "permis",
    title: "Permis de conduire",
    description: "Conducteur habituel du vehicule",
    icon: IdCard,
    scope: "vehicle",
    documentType: "permis",
    required: false,
    fields: [
      { name: "permis_conducteur", label: "Nom / Prenom conducteur", type: "text" },
      { name: "permis_numero", label: "N Permis", type: "text" },
      { name: "permis_categories", label: "Categories", type: "text", placeholder: "B, BE, C..." },
      { name: "permis_autorite", label: "Autorite delivrance", type: "text" },
      { name: "permis_delivrance", label: "Date delivrance", type: "date" },
      { name: "permis_expiration", label: "Date expiration", type: "date" },
    ],
  },
  {
    key: "ct",
    title: "Controle technique",
    description: "Derniere visite technique",
    icon: Wrench,
    scope: "vehicle",
    documentType: "ct",
    required: true,
    fields: [
      { name: "ct_date_visite", label: "Date de visite", type: "date" },
      { name: "ct_resultat", label: "Resultat", type: "select", options: ["Favorable", "Defavorable", "Contre-visite requise"] },
      { name: "ct_expiration", label: "Date expiration CT", type: "date" },
      { name: "ct_kilometrage", label: "Kilometrage", type: "number" },
      { name: "ct_anomalies", label: "Anomalies eventuelles", type: "textarea", full: true },
    ],
  },
  {
    key: "att",
    title: "Attestation d'assurance",
    description: "Couverture precedente",
    icon: ShieldCheck,
    scope: "vehicle",
    documentType: "att",
    required: true,
    fields: [
      { name: "att_assureur", label: "Ancien assureur", type: "text" },
      { name: "att_contrat", label: "N Contrat", type: "text" },
      { name: "att_debut", label: "Debut couverture", type: "date" },
      { name: "att_fin", label: "Fin couverture", type: "date" },
      { name: "att_bonus_malus", label: "Bonus / Malus", type: "text", placeholder: "Ex: Bonus 15%" },
      { name: "att_sinistres", label: "Historique sinistres", type: "text" },
    ],
  },
  {
    key: "facture",
    title: "Facture d'achat",
    description: "Acte de vente / propriete",
    icon: Receipt,
    scope: "vehicle",
    documentType: "facture",
    required: false,
    fields: [
      { name: "facture_proprietaire", label: "Proprietaire", type: "text" },
      { name: "facture_prix", label: "Prix d'achat (MAD)", type: "number" },
      { name: "facture_date_achat", label: "Date d'achat", type: "date" },
      { name: "facture_vendeur", label: "Vendeur", type: "text" },
      { name: "facture_vehicule_concerne", label: "Vehicule concerne", type: "text", full: true },
    ],
  },
];

/* --------------------------------------------------------------------- */
/*  CLAIM                                                                 */
/* --------------------------------------------------------------------- */

export const CLAIM_CARDS: CardDef[] = [
  {
    key: "declaration",
    title: "Declaration du sinistre",
    description: "Reference et resume du dossier",
    icon: ClipboardCheck,
    scope: "claim",
    required: true,
    fields: [
      { name: "claim_number", label: "Reference", type: "text", readOnly: true },
      { name: "accident_date", label: "Date accident", type: "date" },
      { name: "location", label: "Lieu", type: "text", full: true },
      { name: "description", label: "Description", type: "textarea", full: true },
    ],
  },
  {
    key: "constat",
    title: "Constat amiable",
    description: "Circonstances de l'accident",
    icon: FileText,
    scope: "claim",
    documentType: "constat",
    required: true,
    fields: [
      { name: "constat_heure", label: "Heure", type: "text", placeholder: "14:32" },
      { name: "constat_conducteur_a", label: "Conducteur A", type: "text", placeholder: "Nom - Plaque" },
      { name: "constat_conducteur_b", label: "Conducteur B", type: "text", placeholder: "Nom - Plaque" },
      { name: "constat_assureur_a", label: "Assureur A", type: "text" },
      { name: "constat_assureur_b", label: "Assureur B", type: "text" },
      { name: "constat_croquis", label: "Croquis inclus", type: "select", options: ["Oui", "Non"] },
    ],
  },
  {
    key: "pv",
    title: "Rapport de police / Expertise",
    description: "PV et conclusions d'expertise",
    icon: ShieldCheck,
    scope: "claim",
    documentType: "pv",
    required: false,
    fields: [
      { name: "pv_numero", label: "N PV", type: "text" },
      { name: "pv_responsabilite", label: "Responsabilite", type: "select", options: ["Conducteur A (100%)", "Conducteur B (100%)", "Partagee (50/50)", "A determiner"] },
      { name: "pv_parties", label: "Parties impliquees", type: "text" },
      { name: "pv_expert_nom", label: "Expert mandate", type: "text" },
      { name: "pv_expertise_date", label: "Date d'expertise", type: "date" },
      { name: "pv_cout_estime", label: "Cout estime (MAD)", type: "number" },
      { name: "pv_infractions", label: "Infractions relevees", type: "textarea", full: true },
    ],
  },
  {
    key: "photos",
    title: "Photos accident",
    description: "Constat visuel des degats",
    icon: Camera,
    scope: "claim",
    documentType: "accidents",
    required: false,
    multiple: true,
    fields: [{ name: "photos_commentaire", label: "Commentaire", type: "textarea", full: true }],
  },
  {
    key: "garage",
    title: "Facture de reparation",
    description: "Devis / facture garage",
    icon: Car,
    scope: "claim",
    documentType: "repair_invoice",
    required: false,
    fields: [
      { name: "garage_nom", label: "Garage", type: "text" },
      { name: "garage_cout_ht", label: "Cout reparation HT (MAD)", type: "number" },
      { name: "garage_tva", label: "TVA (%)", type: "number", placeholder: "20" },
      { name: "garage_cout_ttc", label: "Total TTC (MAD)", type: "number", readOnly: true },
      { name: "garage_pieces", label: "Pieces changees", type: "textarea", full: true },
    ],
  },
];

export const CLIENT_DOC_TYPES = new Set(CLIENT_CARDS.map((c) => c.documentType).filter((v): v is string => !!v));
export const VEHICLE_DOC_TYPES = new Set([
  ...VEHICLE_CARDS.map((c) => c.documentType).filter((v): v is string => !!v),
  "carte_grise", // Also handle this possible value
]);
export const CLAIM_DOC_TYPES = new Set(CLAIM_CARDS.map((c) => c.documentType).filter((v): v is string => !!v));

export const ALL_CARDS: CardDef[] = [...CLIENT_CARDS, ...VEHICLE_CARDS, ...CLAIM_CARDS];

export function cardsFor(scope: Scope): CardDef[] {
  if (scope === "client") return CLIENT_CARDS;
  if (scope === "vehicle") return VEHICLE_CARDS;
  return CLAIM_CARDS;
}

/* --------------------------------------------------------------------- */
/*  Document matching + completeness                                     */
/* --------------------------------------------------------------------- */

export function matchDocuments(
  documents: DocumentItem[],
  card: CardDef,
  ids: { clientId?: number | null; vehicleId?: number | null; claimId?: number | null },
): DocumentItem[] {
  if (!card.documentType) return [];
  return documents
    .filter((document) => document.document_type === card.documentType)
    .filter((document) => {
      if (card.scope === "client") {
        return !!ids.clientId && document.client_id === ids.clientId;
      }
      if (card.scope === "vehicle") {
        return !!ids.vehicleId && document.vehicle_id === ids.vehicleId;
      }
      if (card.scope === "claim") {
        return !!ids.claimId && document.sinistre_id === ids.claimId;
      }
      return false;
    })
    .sort((a, b) => b.id - a.id);
}

export function cardIsProvided(
  card: CardDef,
  documents: DocumentItem[],
  ids: { clientId?: number | null; vehicleId?: number | null; claimId?: number | null },
): boolean {
  if (!card.documentType) return true;
  return matchDocuments(documents, card, ids).length > 0;
}

export type DossierChecklistItem = {
  key: string;
  label: string;
  scopeLabel: string;
  done: boolean;
  scope: Scope;
  cardKey: string;
  entityId: number;
};

export type DossierSummary = {
  client: Client;
  vehicles: Vehicle[];
  claims: Claim[];
  percent: number;
  done: number;
  total: number;
  checklist: DossierChecklistItem[];
};

export function computeDossier(client: Client, vehicles: Vehicle[], claims: Claim[], documents: DocumentItem[]): DossierSummary {
  const checklist: DossierChecklistItem[] = [];

  for (const card of CLIENT_CARDS.filter((c) => c.required)) {
    checklist.push({
      key: `client-${client.id}-${card.key}`,
      label: card.title,
      scopeLabel: "Client",
      scope: "client",
      cardKey: card.key,
      entityId: client.id,
      done: cardIsProvided(card, documents, { clientId: client.id }),
    });
  }

  for (const vehicle of vehicles) {
    for (const card of VEHICLE_CARDS.filter((c) => c.required)) {
      checklist.push({
        key: `vehicle-${vehicle.id}-${card.key}`,
        label: `${card.title} (${vehicle.registration_number || `Vehicule #${vehicle.id}`})`,
        scopeLabel: "Vehicule",
        scope: "vehicle",
        cardKey: card.key,
        entityId: vehicle.id,
        done: cardIsProvided(card, documents, { clientId: client.id, vehicleId: vehicle.id }),
      });
    }
  }

  for (const claim of claims) {
    for (const card of CLAIM_CARDS.filter((c) => c.required)) {
      checklist.push({
        key: `claim-${claim.id}-${card.key}`,
        label: `${card.title} (${claim.claim_number})`,
        scopeLabel: "Sinistre",
        scope: "claim",
        cardKey: card.key,
        entityId: claim.id,
        done: cardIsProvided(card, documents, { clientId: client.id, vehicleId: claim.vehicle_id, claimId: claim.id }),
      });
    }
  }

  const done = checklist.filter((item) => item.done).length;
  const total = checklist.length || 1;
  return { client, vehicles, claims, percent: Math.round((done / total) * 100), done, total, checklist };
}
