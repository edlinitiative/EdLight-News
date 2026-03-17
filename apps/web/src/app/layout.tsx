import type { Metadata } from "next";
import { Suspense } from "react";
import { Source_Serif_4, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { ThemeProvider } from "@/lib/theme-context";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { HtmlLangSync } from "@/components/HtmlLangSync";
import { RouteLanguageSync } from "@/components/RouteLanguageSync";

const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Source_Sans_3({
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
    <html lang="fr" suppressHydrationWarning className={`${serif.variable} ${sans.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
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
      <body className="flex min-h-screen flex-col">
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
              Aller au contenu principal
            </a>

            <NavBar />

            <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
              {children}
            </main>

            <Footer />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
