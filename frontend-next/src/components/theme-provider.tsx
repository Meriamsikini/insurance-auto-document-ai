"use client";

/**
 * src/components/theme-provider.tsx  —  New file (Task 4).
 *
 * Thin wrapper around next-themes. `next-themes` is already listed as a
 * dependency in package.json (^0.4.6) — it was previously unused.
 *
 * attribute="class"   → toggles a "dark" / "light" class on <html>, which
 *                        globals.css reads via the .light selector.
 * defaultTheme="dark" → matches the app's original (only) appearance, so
 *                        nothing changes for users who never touch the
 *                        theme toggle.
 * enableSystem={false}→ we don't want to silently follow the OS theme;
 *                        the user explicitly picks "Sombre" / "Clair" in
 *                        their profile.
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      themes={["dark", "light"]}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
