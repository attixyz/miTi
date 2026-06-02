import { headers } from "next/headers";
import ClientProviders from "@/providers/ClientProviders";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { NovaShell } from "@/components/nova/layout/NovaShell";
import { getBaseUrlFromEnv } from "@/lib/baseUrl";
import "@/utils/app-init";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const baseUrl = getBaseUrlFromEnv();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "miTi",
  description: "Decentralized event discovery and calendar platform on Nostr",
  keywords: ["nostr", "events", "calendar", "meetups", "decentralized"],
  authors: [{ name: "Gil Lohner", url: "https://riginode.xyz" }, { name: "Atti" }],
  publisher: "Atti",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    title: "miTi - Decentralized Event Discovery",
    description: "Discover and organize events on the decentralized Nostr protocol",
    siteName: "miTi",
  },
  twitter: {
    card: "summary_large_image",
    title: "miTi - Decentralized Event Discovery",
    description: "Discover and organize events on the decentralized Nostr protocol",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "miTi",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#151217" },
    { media: "(prefers-color-scheme: light)", color: "#fbf8ff" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const langHeader = headersList.get("x-lang") || "en";

  return (
    <html
      lang={langHeader}
      className={cn(geist.variable)}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body suppressHydrationWarning>
        <ClientProviders serverLang={langHeader}>
          <NovaShell>{children}</NovaShell>
        </ClientProviders>
      </body>
    </html>
  );
}
