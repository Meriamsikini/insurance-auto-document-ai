"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Moon,
  Sun,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/app-shell";

export default function ProfilePage() {
  const router = useRouter();
  const { employee, isAuthenticated, hydrate, updateProfile, changePassword, logout } =
    useAuthStore();

  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (employee) {
      setFullName(employee.full_name);
      setPhone(employee.phone ?? "");
      setDepartment(employee.department ?? "");
      setTheme(employee.theme ?? "dark");
    }
  }, [isAuthenticated, employee, router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName, phone: phone || null, department: department || null, theme });
      toast.success("Profil mis à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPwd.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setChangingPwd(true);
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      toast.success("Mot de passe modifié avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setChangingPwd(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (!employee) return null;

  const initials = employee.full_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:px-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2 text-sm font-semibold text-ink2 transition hover:border-brand-400 hover:text-ink"
        >
          <ArrowLeft size={15} /> Retour
        </button>
        <h1 className="text-base font-extrabold text-ink">Mon Profil</h1>
        <button
          onClick={handleLogout}
          className="ml-auto flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20"
        >
          Déconnexion
        </button>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 lg:p-8">
        {/* ── Avatar + identity ── */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
          <div className="flex items-center gap-5">
            <div className="relative">
              <span className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-400 text-2xl font-extrabold text-white shadow-glow">
                {initials}
              </span>
              {/* Photo placeholder — future upload */}
              <button
                type="button"
                title="Changer la photo (bientôt disponible)"
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-line bg-surface2 text-ink3 hover:text-ink"
              >
                <Camera size={13} />
              </button>
            </div>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-ink">{employee.full_name}</p>
              <p className="mt-0.5 text-sm text-ink3">{employee.email}</p>
              {employee.is_admin && (
                <span className="mt-1.5 inline-block rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-bold text-brand-300">
                  Administrateur
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Personal information ── */}
        <form onSubmit={handleSaveProfile} className="rounded-2xl border border-line bg-surface p-6 shadow-soft space-y-5">
          <div className="flex items-center gap-2 font-extrabold text-ink">
            <User size={17} />
            Informations personnelles
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Prénom Nom"
                required
                className={inputCls}
              />
            </Field>
            <Field label="Email professionnel">
              <input
                value={employee.email}
                readOnly
                className={`${inputCls} cursor-not-allowed opacity-60`}
              />
            </Field>
            <Field label="Téléphone professionnel">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+212 6XX XXX XXX"
                className={inputCls}
              />
            </Field>
            <Field label="Service / Département">
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex: Sinistres, Commercial…"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Theme toggle */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">Thème</p>
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    theme === t
                      ? "border-brand-500/50 bg-brand-500/15 text-brand-300"
                      : "border-line bg-surface2 text-ink2 hover:border-brand-400"
                  }`}
                >
                  {t === "dark" ? <Moon size={14} /> : <Sun size={14} />}
                  {t === "dark" ? "Sombre" : "Clair"}
                  {theme === t && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer
            </button>
          </div>
        </form>

        {/* ── Change password ── */}
        <form onSubmit={handleChangePassword} className="rounded-2xl border border-line bg-surface p-6 shadow-soft space-y-5">
          <div className="flex items-center gap-2 font-extrabold text-ink">
            <KeyRound size={17} />
            Changer le mot de passe
          </div>

          <Field label="Mot de passe actuel">
            <PasswordInput
              value={currentPwd}
              onChange={setCurrentPwd}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nouveau mot de passe">
              <PasswordInput
                value={newPwd}
                onChange={setNewPwd}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                placeholder="Min. 8 caractères"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmer le nouveau mot de passe">
              <PasswordInput
                value={confirmPwd}
                onChange={setConfirmPwd}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                placeholder="Répéter le mot de passe"
                autoComplete="new-password"
              />
            </Field>
          </div>

          {newPwd && confirmPwd && newPwd !== confirmPwd && (
            <p className="text-xs font-semibold text-rose-400">
              Les mots de passe ne correspondent pas.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changingPwd || !currentPwd || !newPwd || !confirmPwd}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {changingPwd ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <KeyRound size={15} />
              )}
              Modifier le mot de passe
            </button>
          </div>
        </form>

        {/* ── Danger zone ── */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
          <p className="mb-3 text-sm font-bold text-rose-400">Zone de déconnexion</p>
          <p className="mb-4 text-xs text-ink3">
            Cette action met fin à votre session active. Vos données sont conservées.
          </p>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20"
          >
            Se déconnecter
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink3 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 read-only:cursor-not-allowed";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink3">{label}</span>
      {children}
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}
