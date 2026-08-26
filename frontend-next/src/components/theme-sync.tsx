"use client";

/**
 * src/components/theme-sync.tsx  —  New file (Task 4).
 *
 * Applies the employee's saved `theme` preference (from the auth profile,
 * persisted server-side via PATCH /auth/me) to next-themes whenever the
 * authenticated employee data changes — e.g. right after login, or after
 * hydrate() restores the session from localStorage on page load.
 *
 * This means the "Clair" / "Sombre" choice made in /profile follows the
 * employee across devices/browsers (server-persisted), while next-themes
 * still handles the actual live DOM class toggling + its own local
 * fallback storage for the brief moment before the profile is hydrated.
 *
 * Renders nothing — pure side-effect component, mounted once in
 * providers.tsx inside both ThemeProvider and the auth bootstrap.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth-store";

export function ThemeSync() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const employee = useAuthStore((s) => s.employee);

  useEffect(() => {
    if (pathname === "/profile") {
      return;
    }

    if (employee?.theme === "dark" || employee?.theme === "light") {
      setTheme(employee.theme);
    }
  }, [employee?.theme, pathname, setTheme]);

  return null;
}
