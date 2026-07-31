"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardCheck,
  FileStack,
  FolderKanban,
  RefreshCw,
  ChevronDown,
  LogOut,
  UserCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Client, Vehicle, Claim } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { GlobalSearch } from "./global-search";
import { NotificationsBell } from "./notifications-bell";
import { cn } from "@/lib/utils";

// ── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "overview",   label: "Dashboard",  icon: LayoutDashboard, href: "/dashboard" },
  { key: "clients",    label: "Clients",    icon: Users,           href: "/clients" },
  { key: "vehicles",   label: "Vehicules",  icon: Car,             href: "/vehicules" },
  { key: "claims",     label: "Sinistres",  icon: ClipboardCheck,  href: "/sinistres" },
  { key: "documents",  label: "Documents",  icon: FileStack,       href: "/documents" },
  { key: "dossiers",   label: "Dossiers",   icon: FolderKanban,    href: "/dossiers" },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

type NavKey = typeof NAV_ITEMS[number]["key"];

type AppShellProps = {
  active: NavKey | string;
  onNavigate: (key: string) => void;
  onSelectClient: (client: Client) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onSelectClaim: (claim: Claim) => void;
  /** Task 2: real refresh callback — must return a Promise */
  onRefresh: () => Promise<void>;
  stats: { clients: number; vehicles: number; claims: number };
  children: ReactNode;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AppShell({
  active,
  onNavigate,
  onSelectClient,
  onSelectVehicle,
  onSelectClaim,
  onRefresh,
  stats,
  children,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { employee, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Task 2: Real refresh ───────────────────────────────────────────────────
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success("Données actualisées avec succès.");
    } catch {
      toast.error("Erreur lors du rafraîchissement des données.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Task 4: Navigate with URL update ──────────────────────────────────────
  function handleNav(key: string) {
    const item = NAV_ITEMS.find((n) => n.key === key);
    if (item) {
      router.push(item.href);
    }
    onNavigate(key);
  }

  // Derive active key from pathname for URL-driven navigation
  const activeFromUrl = NAV_ITEMS.find((n) => pathname?.startsWith(n.href))?.key ?? active;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const initials = (employee?.full_name ?? "AA")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={cn("hidden lg:flex flex-col border-r border-line bg-surface transition-all duration-300 ease-in-out", isSidebarExpanded ? "w-64" : "w-20")}
      >
        <div className={cn("flex h-[88px] shrink-0 items-center gap-3 overflow-hidden", isSidebarExpanded ? "px-6" : "px-5")}>
          <Image src="/logo.jpeg" alt="AssurAuto Logo" width={40} height={40} className="shrink-0 scale-110 rounded-md" />
          <div className={cn("whitespace-nowrap transition-opacity", isSidebarExpanded ? "opacity-100 duration-200 delay-100" : "opacity-0 duration-100")}>
            <div className="text-base font-extrabold text-ink">AssurAuto</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">Espace gestion</div>
          </div>
        </div>

        <nav className={cn("flex-1 space-y-1 transition-all", isSidebarExpanded ? "px-3" : "px-5")}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeFromUrl === item.key;
            return (
              <div key={item.key} className="group relative">
                <button
                  onClick={() => handleNav(item.key)}
                  className={cn(
                    "flex w-full items-center rounded-xl py-2.5 text-sm font-semibold transition",
                    isSidebarExpanded ? "gap-3 px-3" : "justify-center px-0",
                    isActive ? "bg-brand-500/12 text-brand-300" : "text-ink2 hover:bg-surface2 hover:text-ink",
                  )}
                >
                  <Icon size={17} />
                  <span className={cn("whitespace-nowrap transition-opacity", isSidebarExpanded ? "opacity-100 duration-200 delay-100" : "w-0 opacity-0")}>
                    {item.label}
                  </span>
                </button>
                {!isSidebarExpanded && (
                  <div className="absolute left-full top-1/2 z-50 ml-4 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-surface3 px-2 py-1 text-xs font-semibold text-ink shadow-lg group-hover:block">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Stats */}
        <div
          className={cn(
            "mb-4 mt-6 grid grid-cols-3 gap-2 rounded-xl bg-surface2 p-3 text-center transition-opacity duration-200",
            isSidebarExpanded ? "mx-3 opacity-100" : "mx-auto opacity-0",
          )}
        >
          <MiniStat label="Clients" value={stats.clients} />
          <MiniStat label="Vehic." value={stats.vehicles} />
          <MiniStat label="Sinis." value={stats.claims} />
        </div>

        {/* Employee info in sidebar */}
        {employee && (
          <button
            onClick={() => router.push("/profile")}
            className={cn(
              "mb-3 flex items-center gap-2 rounded-xl border border-line bg-surface2/50 p-3 text-left transition hover:border-brand-400 hover:bg-surface2",
              isSidebarExpanded ? "mx-3" : "mx-auto w-14 justify-center",
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-sky-400 text-xs font-extrabold text-white">
              {initials}
            </span>
            <div className={cn("min-w-0", isSidebarExpanded ? "opacity-100" : "pointer-events-none hidden opacity-0")}>
              <p className="truncate text-xs font-bold text-ink">{employee.full_name}</p>
              <p className="truncate text-[10px] text-ink3">{employee.department ?? employee.email}</p>
            </div>
          </button>
        )}

        <div className={cn("border-t border-line py-4 text-[11px] text-ink3 transition-all", isSidebarExpanded ? "px-5" : "px-2 text-center")}>
          {isSidebarExpanded ? "AssurAuto Pro · v2.0" : "v2.0"}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface lg:hidden">
            <Image src="/logo.jpeg" alt="AssurAuto Logo" width={32} height={32} className="rounded-md" />
          </span>

          <GlobalSearch
            onSelectClient={onSelectClient}
            onSelectVehicle={onSelectVehicle}
            onSelectClaim={onSelectClaim}
          />

          <div className="ml-auto flex items-center gap-2">
            {/* Task 2: Real refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface2 px-3 text-sm font-semibold text-ink2 shadow-card transition hover:border-brand-400 hover:text-ink disabled:cursor-wait disabled:opacity-60"
              title="Rafraîchir toutes les données"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">
                {refreshing ? "En cours…" : "Rafraîchir"}
              </span>
            </button>

            <NotificationsBell />

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface2 px-2.5 text-sm font-semibold text-ink2 transition hover:border-brand-400 hover:text-ink"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300">
                  {initials}
                </span>
                <span className="hidden max-w-[120px] truncate sm:block">
                  {employee?.full_name?.split(" ")[0] ?? "Profil"}
                </span>
                <ChevronDown size={13} className={cn("transition-transform", profileOpen && "rotate-180")} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 animate-slide-down overflow-hidden rounded-2xl border border-line bg-surface shadow-popover">
                  {/* Employee info */}
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-bold text-ink">{employee?.full_name}</p>
                    <p className="truncate text-xs text-ink3">{employee?.email}</p>
                    {employee?.department && (
                      <p className="mt-0.5 truncate text-[11px] text-ink3">{employee.department}</p>
                    )}
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); router.push("/profile"); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink2 transition hover:bg-surface2 hover:text-ink"
                    >
                      <UserCircle size={15} />
                      Mon profil
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10"
                    >
                      <LogOut size={15} />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
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
      <div className="text-sm font-extrabold text-ink">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink3">{label}</div>
    </div>
  );
}
