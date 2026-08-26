"use client";

/**
 * src/app/providers.tsx  —  Replace existing file with this version.
 *
 * Task 4 addition: wraps the app with ThemeProvider (next-themes) and
 * mounts ThemeSync so the employee's saved theme preference is applied
 * automatically. Everything else (QueryClient, auth hydration) is
 * unchanged from before.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";

function AuthBootstrap({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    // Restore token + employee from localStorage on every page mount
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,       // 30 s — avoid hammering the API on every focus
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthBootstrap>
          {/* Task 4: applies employee.theme to next-themes once authenticated */}
          <ThemeSync />
          {children}
        </AuthBootstrap>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
