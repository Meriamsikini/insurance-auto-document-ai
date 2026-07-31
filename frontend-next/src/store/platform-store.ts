/**
 * src/store/platform-store.ts
 * Extended platform store — adds `search` / `setSearch` for the workspace sidebar.
 */
import { create } from "zustand";

type Tab = "client" | "vehicle" | "claim";

type PendingDoc = {
  id: number;
  scope: Tab;
  document_type: string;
};

type PlatformState = {
  activeClientId: number | null;
  activeVehicleId: number | null;
  activeClaimId: number | null;
  pendingDocs: PendingDoc[];
  ocr: Record<string, unknown>;
  tab: Tab;
  /** Task 2 / workspace sidebar search */
  search: string;
  setActive: (ids: Partial<Pick<PlatformState, "activeClientId" | "activeVehicleId" | "activeClaimId">>) => void;
  setTab: (tab: Tab) => void;
  setPendingDocs: (docs: PendingDoc[]) => void;
  setOcr: (ocr: Record<string, unknown>) => void;
  setSearch: (s: string) => void;
};

const readNumber = (key: string) => {
  if (typeof window === "undefined") return null;
  const value = Number(localStorage.getItem(key));
  return value || null;
};

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(sessionStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
};

const persistSelection = (state: PlatformState) => {
  if (typeof window === "undefined") return;
  const pairs: Array<[string, number | null]> = [
    ["assurauto_client_id", state.activeClientId],
    ["assurauto_vehicle_id", state.activeVehicleId],
    ["assurauto_claim_id", state.activeClaimId],
  ];
  pairs.forEach(([key, value]) => {
    if (value) localStorage.setItem(key, String(value));
    else localStorage.removeItem(key);
  });
  sessionStorage.setItem("assurauto_pending_docs", JSON.stringify(state.pendingDocs));
  sessionStorage.setItem("assurauto_ocr_cache", JSON.stringify(state.ocr));
};

export const usePlatformStore = create<PlatformState>((set, get) => ({
  activeClientId: readNumber("assurauto_client_id"),
  activeVehicleId: readNumber("assurauto_vehicle_id"),
  activeClaimId: readNumber("assurauto_claim_id"),
  pendingDocs: readJson("assurauto_pending_docs", []),
  ocr: readJson("assurauto_ocr_cache", {}),
  tab: "client",
  search: "",

  setActive: (ids) => {
    set(ids);
    persistSelection(get());
  },
  setTab: (tab) => set({ tab }),
  setPendingDocs: (pendingDocs) => {
    set({ pendingDocs });
    persistSelection(get());
  },
  setOcr: (ocr) => {
    set({ ocr });
    persistSelection(get());
  },
  setSearch: (search) => set({ search }),
}));
