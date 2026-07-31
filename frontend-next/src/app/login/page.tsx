"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (isAuthenticated) router.replace("/dashboard"); }, [isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants invalides.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4">
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(circle at 20% 30%, rgba(79,110,247,0.12), transparent 40rem), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.07), transparent 35rem)" }} />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="AssurAuto Logo"
            width={64}
            height={64}
            className="rounded-2xl shadow-glow"
            priority
          />
          <div className="text-center">
            
            <p className="mt-1 text-sm text-ink3">Espace collaborateur — accès restreint</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          <h2 className="mb-6 text-lg font-bold text-ink">Connexion</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-ink3">Email professionnel</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@slaouiglobal.com" required className="w-full rounded-lg border border-line bg-surface2 py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink3 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-ink3">Mot de passe</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full rounded-lg border border-line bg-surface2 py-2.5 pl-9 pr-10 text-sm text-ink outline-none transition placeholder:text-ink3 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400">{error}</div>}
            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? <><Loader2 size={16} className="animate-spin" />Connexion…</> : "Se connecter"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-ink3">Accès réservé aux employés autorisés.<br />Contactez votre administrateur pour tout problème.</p>
        </div>
        
      </div>
    </div>
  );
}
