import type { Metadata } from "next";
import { Source_Serif_4, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { ThemeProvider } from "@/lib/theme-context";
import { NavBar } from "@/components/NavBar";
import { HtmlLangSync } from "@/components/HtmlLangSync";

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
      </head>
      <body className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
        <ThemeProvider>
          <LanguageProvider>
            <HtmlLangSync />
            {/* Skip-to-content link for keyboard / screen-reader users */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
            >
              Aller au contenu principal
            </a>
            <NavBar />
            <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6">
              {children}
            </main>
            <footer className="mt-10 border-t border-gray-200/70 bg-white/80 py-10 text-sm text-gray-500 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-400">
              <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-3">
                {/* Brand column */}
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 text-lg tracking-tight text-brand-700 dark:text-brand-300">
                    <span className="font-serif font-bold">Ed</span>
                    <span className="font-light text-gray-400 dark:text-slate-500">Light</span>
                    <span className="text-sm font-medium text-gray-400 dark:text-slate-500">News</span>
                  </span>
                  <p className="max-w-xs text-xs leading-relaxed text-gray-400 dark:text-slate-500">
                    Conçu pour les étudiants haïtiens — Nouvelles, bourses et ressources vérifiées.
                  </p>
                </div>

                {/* Navigation column */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">Navigation</h3>
                  <nav className="flex flex-col gap-1.5 text-xs">
                    <a href="/news" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">Fil d&apos;actualités</a>
                    <a href="/haiti" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">Haïti</a>
                    <a href="/opportunites" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">Opportunités</a>
                    <a href="/bourses" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">Bourses</a>
                    <a href="/ressources" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">Ressources</a>
                  </nav>
                </div>

                {/* About column */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">À propos</h3>
                  <p className="text-xs leading-relaxed text-gray-400 dark:text-slate-500">
                    EdLight News synthétise des sources publiques pour informer les étudiants. Les informations ne constituent pas un conseil officiel.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    © {new Date().getFullYear()} EdLight Initiative
                  </p>
                </div>
              </div>
            </footer>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
