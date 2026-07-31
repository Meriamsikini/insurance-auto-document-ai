"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Search, X, User, Car, FileText, ClipboardCheck, ShieldCheck, Loader2 } from "lucide-react";
import { api, type Client, type Vehicle, type Claim, type DocumentItem } from "@/lib/api";

type Contract = { id: number; policy_number: string; provider?: string | null; status?: string | null };

type SearchApiResults = {
  clients: Client[];
  vehicles: Vehicle[];
  contracts: Contract[];
  sinistres: Claim[];
  documents: DocumentItem[];
};

export function GlobalSearch({
  onSelectClient,
  onSelectVehicle,
  onSelectClaim,
}: {
  onSelectClient: (client: Client) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onSelectClaim: (claim: Claim) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchApiResults | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => {
      setLoading(true);
      api
        .get<SearchApiResults>("/search", { params: { q: query.trim() } })
        .then((response) => setResults(response.data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const activeResults = query.trim().length >= 2 ? results : null;

  function select<T>(handler: (value: T) => void, value: T) {
    handler(value);
    setOpen(false);
    setQuery("");
    setResults(null);
  }

  const hasResults =
    !!activeResults &&
    (activeResults.clients.length > 0 || activeResults.vehicles.length > 0 || activeResults.sinistres.length > 0 || activeResults.documents.length > 0 || activeResults.contracts.length > 0);

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface2 px-3 text-sm text-ink3 shadow-card transition hover:border-brand-400"
      >
        <Search size={16} />
        <span className="flex-1 truncate text-left">Rechercher un client, vehicule, sinistre...</span>
        <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink3 sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 animate-slide-down overflow-hidden rounded-xl border border-line bg-surface shadow-popover">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search size={16} className="text-ink3" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, CIN, plaque, N de sinistre..."
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
            />
            {loading && <Loader2 size={14} className="animate-spin text-ink3" />}
            <button onClick={() => setOpen(false)} className="text-ink3 hover:text-ink">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {query.trim().length < 2 && <div className="p-4 text-center text-sm text-ink3">Tapez au moins 2 caracteres.</div>}
            {query.trim().length >= 2 && !loading && !hasResults && (
              <div className="p-4 text-center text-sm text-ink3">Aucun resultat pour &laquo;&nbsp;{query}&nbsp;&raquo;.</div>
            )}

            {activeResults && activeResults.clients.length > 0 && (
              <ResultGroup label="Clients" icon={<User size={13} />}>
                {activeResults.clients.map((client) => (
                  <ResultRow key={client.id} title={client.full_name} subtitle={client.cin_number || "Sans CIN"} onClick={() => select(onSelectClient, client)} />
                ))}
              </ResultGroup>
            )}
            {activeResults && activeResults.vehicles.length > 0 && (
              <ResultGroup label="Vehicules" icon={<Car size={13} />}>
                {activeResults.vehicles.map((vehicle) => (
                  <ResultRow
                    key={vehicle.id}
                    title={vehicle.registration_number || `Vehicule #${vehicle.id}`}
                    subtitle={[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                    onClick={() => select(onSelectVehicle, vehicle)}
                  />
                ))}
              </ResultGroup>
            )}
            {activeResults && activeResults.sinistres.length > 0 && (
              <ResultGroup label="Sinistres" icon={<ClipboardCheck size={13} />}>
                {activeResults.sinistres.map((claim) => (
                  <ResultRow key={claim.id} title={claim.claim_number} subtitle={claim.location || "Lieu inconnu"} onClick={() => select(onSelectClaim, claim)} />
                ))}
              </ResultGroup>
            )}
            {activeResults && activeResults.contracts.length > 0 && (
              <ResultGroup label="Contrats" icon={<ShieldCheck size={13} />}>
                {activeResults.contracts.map((contract) => (
                  <ResultRow
                    key={contract.id}
                    title={contract.policy_number}
                    subtitle={contract.provider || contract.status || ""}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </ResultGroup>
            )}
            {activeResults && activeResults.documents.length > 0 && (
              <ResultGroup label="Documents" icon={<FileText size={13} />}>
                {activeResults.documents.map((document) => (
                  <ResultRow
                    key={document.id}
                    title={document.original_filename}
                    subtitle={document.document_type}
                    onClick={() => window.open(`/api/v1/documents/${document.id}/download`, "_blank")}
                  />
                ))}
              </ResultGroup>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink3">
        {icon}
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ResultRow({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col rounded-lg px-3 py-2 text-left transition hover:bg-surface2">
      <span className="truncate text-sm font-semibold text-ink">{title}</span>
      {subtitle && <span className="truncate text-xs text-ink3">{subtitle}</span>}
    </button>
  );
}
