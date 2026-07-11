import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nextClaimNumber() {
  return `SIN-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

export function splitClientName(fullName?: string | null) {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return { nom: parts[0] ?? "", prenom: parts.slice(1).join(" ") };
}
