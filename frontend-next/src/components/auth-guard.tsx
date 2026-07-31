"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * AuthGuard — wraps any page that requires authentication.
 * Redirects to /login if not authenticated.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-6 text-ink3">
          <Image
            src="/logo.jpeg"
            alt="AssurAuto Logo"
            width={80}
            height={80}
            className="animate-pulse rounded-2xl"
            priority
          />
          <p className="text-sm font-semibold">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
