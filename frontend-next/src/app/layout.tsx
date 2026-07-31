import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AssurAuto Pro | Plateforme de gestion",
  description: "Gestion clients, véhicules, sinistres et documents OCR",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
