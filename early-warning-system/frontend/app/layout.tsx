import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Nunito_Sans, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { ChromeShell } from "@/components/layout/chrome-shell";
import "./globals.css";

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Climate Compass",
    template: "%s — Climate Compass",
  },
  description:
    "Climate Compass helps people check air quality for selected places and get notified when conditions change.",
  applicationName: "Climate Compass",
  icons: {
    icon: "/favicon.ico",
    apple: "/climate-compass-logo-192.png",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
};

export const viewport: Viewport = {
  themeColor: "#f8fcfd",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${outfit.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <Providers>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <Suspense
            fallback={
              <main id="main-content" className="flex-1">
                {children}
              </main>
            }
          >
            <ChromeShell>{children}</ChromeShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
