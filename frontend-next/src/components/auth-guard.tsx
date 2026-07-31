"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

/**
 * AuthGuard — wraps any page that requires authentication.
 * Redirects to /login if not authenticated.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4 text-ink3">
          <ShieldCheck size={40} className="animate-pulse text-brand-500" />
          <p className="text-sm font-semibold">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
