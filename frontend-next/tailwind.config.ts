/**
 * frontend-next/tailwind.config.ts  —  Replace existing file with this version.
 *
 * Task 4 — Mode clair.
 * Les couleurs custom (canvas, surface, surface2, surface3, line, ink, ink2,
 * ink3, brand-50..900) sont converties en références vers des variables CSS
 * (rgb(var(--c-xxx) / <alpha-value>)) au lieu de valeurs hexadécimales fixes.
 *
 * Pourquoi : c'est la SEULE façon de permettre à `next-themes` de basculer
 * réellement l'apparence de l'application à l'exécution (via une classe
 * `.light` sur <html>) SANS modifier un seul composant existant — tous les
 * composants utilisent déjà des classes Tailwind sémantiques comme
 * `bg-surface`, `text-ink`, `border-line`, `text-brand-300`, etc. Il suffit
 * que ces noms de classe résolvent vers des couleurs différentes selon le
 * thème actif, ce que gère globals.css (voir Task 4 dans ce fichier).
 *
 * Les valeurs par défaut (:root, thème sombre) sont IDENTIQUES aux
 * hexadécimaux d'origine — aucune régression visuelle en mode sombre.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        canvas:   "rgb(var(--c-canvas)   / <alpha-value>)",
        surface:  "rgb(var(--c-surface)  / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        surface3: "rgb(var(--c-surface3) / <alpha-value>)",
        line:     "rgb(var(--c-line)     / <alpha-value>)",
        ink:      "rgb(var(--c-ink)      / <alpha-value>)",
        ink2:     "rgb(var(--c-ink2)     / <alpha-value>)",
        ink3:     "rgb(var(--c-ink3)     / <alpha-value>)",
        brand: {
          50:  "rgb(var(--c-brand-50)  / <alpha-value>)",
          100: "rgb(var(--c-brand-100) / <alpha-value>)",
          200: "rgb(var(--c-brand-200) / <alpha-value>)",
          300: "rgb(var(--c-brand-300) / <alpha-value>)",
          400: "rgb(var(--c-brand-400) / <alpha-value>)",
          500: "rgb(var(--c-brand-500) / <alpha-value>)",
          600: "rgb(var(--c-brand-600) / <alpha-value>)",
          700: "rgb(var(--c-brand-700) / <alpha-value>)",
          800: "rgb(var(--c-brand-800) / <alpha-value>)",
          900: "rgb(var(--c-brand-900) / <alpha-value>)",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.25), 0 16px 40px -18px rgba(0,0,0,0.6)",
        card: "0 1px 2px rgba(0,0,0,0.3)",
        popover: "0 24px 48px -12px rgba(0,0,0,0.65)",
        glow: "0 0 0 1px rgba(79,110,247,0.25), 0 8px 24px -8px rgba(79,110,247,0.55)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-down": { from: { opacity: "0", transform: "translateY(-6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-down": "slide-down 0.18s ease-out",
        "scale-in": "scale-in 0.12s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
