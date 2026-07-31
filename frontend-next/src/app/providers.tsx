"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

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
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
