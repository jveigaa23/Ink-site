import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import type { CSSProperties } from "react";
import { getPublicStudio } from "@/server/public-data";
import { contrastTextFor } from "@/lib/color";
import { env } from "@/server/env";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans-face", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getPublicStudio();
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: `${studio.name} — ${studio.tagline}`, template: `%s · ${studio.name}` },
    description: studio.seoDescription,
    applicationName: studio.name,
    openGraph: { type: "website", locale: "pt_BR", siteName: studio.name },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const studio = await getPublicStudio();
  const style = {
    "--accent": studio.accentColor,
    "--accent-contrast": contrastTextFor(studio.accentColor),
  } as CSSProperties;
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`} style={style}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
