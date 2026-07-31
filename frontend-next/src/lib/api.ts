/**
 * src/lib/api.ts
 * Main API client — re-exports authApi so all business requests carry the JWT.
 */
import { authApi } from "@/lib/auth";

export type JsonRecord = Record<string, unknown>;

export type Client = {
  id: number;
  full_name: string;
  cin_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  client_type?: string | null;
  metadata?: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: number;
  client_id: number;
  registration_number?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  usage?: string | null;
  metadata?: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type Claim = {
  id: number;
  client_id: number;
  vehicle_id: number;
  claim_number: string;
  accident_date?: string | null;
  location?: string | null;
  description?: string | null;
  damage_level?: string | null;
  estimated_cost?: number | string | null;
  status?: string | null;
  metadata?: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type DocumentItem = {
  id: number;
  client_id?: number | null;
  vehicle_id?: number | null;
  sinistre_id?: number | null;
  original_filename: string;
  document_type: string;
  processing_status: string;
  processing_error?: string | null;
  ai_result?: JsonRecord | null;
  created_at: string;
};

/**
 * `api` — authenticated axios instance.
 * All requests automatically include `Authorization: Bearer <token>` via
 * the interceptor defined in src/lib/auth.ts.
 */
export const api = authApi;

export async function fetchPlatformData() {
  const [clients, vehicles, claims, documents] = await Promise.all([
    api.get<Client[]>("/clients"),
    api.get<Vehicle[]>("/vehicles"),
    api.get<Claim[]>("/claims"),
    api.get<DocumentItem[]>("/documents"),
  ]);

  return {
    clients: clients.data,
    vehicles: vehicles.data,
    claims: claims.data,
    documents: documents.data,
  };
}
