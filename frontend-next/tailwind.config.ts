import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#0F1117",
        surface: "#171B26",
        surface2: "#1E2333",
        surface3: "#252B3B",
        line: "#2D3450",
        ink: "#E8EAF0",
        ink2: "#8B90A8",
        ink3: "#5A5F78",
        brand: {
          50: "#EEF1FF",
          100: "#E1E6FE",
          200: "#C3CDFD",
          300: "#9DAAFB",
          400: "#7186F8",
          500: "#4F6EF7",
          600: "#3D5BE0",
          700: "#3347C2",
          800: "#2B3B9C",
          900: "#26337D",
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
