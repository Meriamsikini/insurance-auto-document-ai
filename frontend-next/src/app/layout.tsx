import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssurAuto",
  description: "Gestion clients, vehicules, sinistres et documents OCR",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
