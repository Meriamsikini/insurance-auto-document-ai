"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  Building2,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Moon,
  Phone,
  Shield,
  Sun,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const router = useRouter();
  const { employee, isAuthenticated, hydrate, updateProfile, changePassword, logout } =
    useAuthStore();

  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields — pre-filled from auth data
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
      // Pre-fill all fields from authentication data
      setFullName(employee.full_name);
      setPhone(employee.phone ?? "");
      setDepartment(employee.department ?? "");
      setTheme(employee.theme ?? "dark");
      if (employee.avatar_url) setAvatarPreview(employee.avatar_url);
    }
  }, [isAuthenticated, employee, router]);

  // Handle local avatar preview (stored client-side as base64 for now)
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La photo ne doit pas dépasser 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        phone: phone || null,
        department: department || null,
        theme,
        // avatar_url: avatarPreview  ← enable when backend supports file upload
      });
      toast.success("Profil mis à jour avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
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
      toast.error(err instanceof Error ? err.message : "Erreur lors du changement de mot de passe.");
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
      {/* ── Sticky header ── */}
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

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — Photo de profil + identité
        ══════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">

            {/* Avatar zone */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Photo de profil"
                    className="h-24 w-24 rounded-2xl object-cover shadow-glow ring-2 ring-brand-500/30"
                  />
                ) : (
                  <span className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-400 text-3xl font-extrabold text-white shadow-glow">
                    {initials}
                  </span>
                )}
                {/* Camera overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Changer la photo de profil"
                  className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-surface2 text-ink3 shadow-card transition hover:bg-brand-500/15 hover:text-brand-300"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              {/* Upload hint */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-semibold text-ink3 transition hover:text-brand-300"
              >
                <Upload size={11} />
                Changer la photo
              </button>
              <p className="text-[10px] text-ink3">JPG, PNG · max 2 Mo</p>
            </div>

            {/* Identity summary — auto-filled from auth */}
            <div className="min-w-0 flex-1 space-y-3">
              {/* Name */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink3">Nom complet</p>
                <p className="mt-0.5 truncate text-xl font-extrabold text-ink">{employee.full_name}</p>
              </div>

              {/* Email — read-only, filled from auth */}
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface2/60 px-3 py-2">
                <AtSign size={14} className="shrink-0 text-ink3" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink3">Email professionnel</p>
                  <p className="truncate text-sm font-semibold text-ink">{employee.email}</p>
                </div>
              </div>

              {/* Department (read-only summary line) */}
              {employee.department && (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface2/60 px-3 py-2">
                  <Building2 size={14} className="shrink-0 text-ink3" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink3">Service</p>
                    <p className="truncate text-sm font-semibold text-ink">{employee.department}</p>
                  </div>
                </div>
              )}

              {/* Role badge */}
              <div className="flex flex-wrap gap-2 pt-1">
                {employee.is_admin ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-bold text-brand-300">
                    <Shield size={11} /> Administrateur
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-surface3 px-3 py-1 text-[11px] font-bold text-ink2">
                    <User size={11} /> Collaborateur
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — Formulaire informations personnelles
            (Nom · Email lu seul · Téléphone · Département · Thème)
        ══════════════════════════════════════════════════════ */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-line bg-surface p-6 shadow-soft space-y-5"
        >
          <div className="flex items-center gap-2 font-extrabold text-ink">
            <User size={17} />
            Informations personnelles
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            {/* Nom complet — pré-rempli depuis l'authentification */}
            <Field label="Nom complet" hint="Pré-rempli depuis votre compte">
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prénom Nom"
                  required
                  className={`${inputCls} pl-9`}
                />
              </div>
            </Field>

            {/* Email professionnel — lecture seule, depuis l'auth */}
            <Field label="Email professionnel" hint="Non modifiable — géré par l'administrateur">
              <div className="relative">
                <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <input
                  value={employee.email}
                  readOnly
                  tabIndex={-1}
                  className={`${inputCls} cursor-not-allowed pl-9 opacity-60`}
                />
              </div>
            </Field>

            {/* Téléphone professionnel — optionnel */}
            <Field label="Téléphone professionnel" hint="Optionnel">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+212 6XX XXX XXX"
                  type="tel"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </Field>

            {/* Service / Département */}
            <Field label="Service / Département" hint="Ex: Sinistres, Commercial, RH…">
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Ex: Sinistres, Commercial…"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </Field>
          </div>

          {/* Thème clair / sombre */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">
              Thème de l&apos;interface
            </p>
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
                    theme === t
                      ? "border-brand-500/50 bg-brand-500/15 text-brand-300 shadow-card"
                      : "border-line bg-surface2 text-ink2 hover:border-brand-400 hover:text-ink"
                  }`}
                >
                  {t === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                  {t === "dark" ? "Sombre" : "Clair"}
                  {theme === t && <Check size={13} className="text-brand-400" />}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-ink3">
              {theme === "dark"
                ? "Interface sombre — recommandée pour un usage prolongé."
                : "Interface claire — adaptée aux environnements lumineux."}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <p className="text-xs text-ink3">
              Les modifications sont sauvegardées sur votre compte.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Enregistrer les modifications
            </button>
          </div>
        </form>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — Changer le mot de passe
        ══════════════════════════════════════════════════════ */}
        <form
          onSubmit={handleChangePassword}
          className="rounded-2xl border border-line bg-surface p-6 shadow-soft space-y-5"
        >
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
              placeholder="Votre mot de passe actuel"
              autoComplete="current-password"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nouveau mot de passe" hint="Minimum 8 caractères">
              <PasswordInput
                value={newPwd}
                onChange={setNewPwd}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                placeholder="Nouveau mot de passe"
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

          {/* Mismatch warning */}
          {newPwd && confirmPwd && newPwd !== confirmPwd && (
            <p className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-xs font-semibold text-rose-400">
              Les mots de passe ne correspondent pas.
            </p>
          )}

          {/* Strength hint */}
          {newPwd.length > 0 && newPwd.length < 8 && (
            <p className="text-xs text-amber-400">
              Le mot de passe doit contenir au moins 8 caractères.
            </p>
          )}

          <div className="flex justify-end border-t border-line pt-4">
            <button
              type="submit"
              disabled={changingPwd || !currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* ══════════════════════════════════════════════════════
            SECTION 4 — Zone de déconnexion
        ══════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
          <p className="mb-1 text-sm font-bold text-rose-400">Zone de déconnexion</p>
          <p className="mb-4 text-xs text-ink3">
            Cette action met fin à votre session active sur cet appareil. Vos données sont conservées.
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink3">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-ink3">{hint}</span>}
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
