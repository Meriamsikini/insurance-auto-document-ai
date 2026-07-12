"use client";

import type { ReactNode } from "react";
import { ShieldCheck, LayoutDashboard, Users, Car, ClipboardCheck, FileStack, RefreshCw } from "lucide-react";
import type { Client, Vehicle, Claim } from "@/lib/api";
import { GlobalSearch } from "./global-search";
import { NotificationsBell } from "./notifications-bell";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { key: "clients", label: "Clients", icon: Users },
  { key: "vehicles", label: "Vehicules", icon: Car },
  { key: "claims", label: "Sinistres", icon: ClipboardCheck },
  { key: "documents", label: "Documents", icon: FileStack },
];

export function AppShell({
  active,
  onNavigate,
  onSelectClient,
  onSelectVehicle,
  onSelectClaim,
  onRefresh,
  stats,
  children,
}: {
  active: string;
  onNavigate: (key: string) => void;
  onSelectClient: (client: Client) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onSelectClaim: (claim: Claim) => void;
  onRefresh: () => void;
  stats: { clients: number; vehicles: number; claims: number };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-64 shrink-0 flex-col bg-ink text-slate-200 lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-glow">
            <ShieldCheck size={20} />
          </span>
          <div>
            <div className="text-base font-extrabold text-white">AssurAuto</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Espace gestion</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mx-3 mb-4 mt-6 grid grid-cols-3 gap-2 rounded-xl bg-white/5 p-3 text-center">
          <MiniStat label="Clients" value={stats.clients} />
          <MiniStat label="Vehic." value={stats.vehicles} />
          <MiniStat label="Sinis." value={stats.claims} />
        </div>

        <div className="border-t border-white/10 px-5 py-4 text-[11px] text-slate-500">AssurAuto Pro &middot; v2.0</div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur lg:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-teal-500 text-white lg:hidden">
            <ShieldCheck size={18} />
          </span>
          <GlobalSearch onSelectClient={onSelectClient} onSelectVehicle={onSelectVehicle} onSelectClaim={onSelectClaim} />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-slate-600 shadow-card transition hover:border-brand-300 hover:text-brand-700"
            >
              <RefreshCw size={15} /> <span className="hidden sm:inline">Rafraichir</span>
            </button>
            <NotificationsBell />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">AA</span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm font-extrabold text-white">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
