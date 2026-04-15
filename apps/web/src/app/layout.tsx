import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { ThemeProvider } from "@/lib/theme-context";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { BackToTop } from "@/components/BackToTop";
import { HtmlLangSync } from "@/components/HtmlLangSync";
import { RouteLanguageSync } from "@/components/RouteLanguageSync";

/* ── Manrope — authoritative, geometric headlines ────────── */
const display = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

/* ── Inter — neutral, high-legibility body copy ──────────── */
const sans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EdLight News",
  description:
    "Actualités éducatives pour les étudiants haïtiens — Nouvèl edikasyon pou elèv ayisyen yo",
  icons: { icon: "/icon.svg" },
  metadataBase: new URL("https://news.edlight.org"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "EdLight News",
              url: "https://news.edlight.org",
              description:
                "Actualités éducatives pour les étudiants haïtiens — Nouvèl edikasyon pou elèv ayisyen yo",
              publisher: {
                "@type": "Organization",
                name: "EdLight Initiative",
                url: "https://edlight.org",
              },
              inLanguage: ["fr", "ht"],
              potentialAction: {
                "@type": "SearchAction",
                target: "https://news.edlight.org/news?search={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-surface text-on-surface">
        <ThemeProvider>
          <LanguageProvider>
            <Suspense fallback={null}>
              <RouteLanguageSync />
            </Suspense>
            <HtmlLangSync />
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
            >
              Aller au contenu principal / Ale nan kontni prensipal la
            </a>

            <NavBar />
            <AppSidebar />

            <div className="flex flex-1 flex-col lg:pl-64">
              <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6 lg:pb-20 lg:px-8">
                {children}
              </main>
              <div className="lg:pl-0">
                <Footer />
              </div>
            </div>

            <MobileBottomNav />
            <BackToTop />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
