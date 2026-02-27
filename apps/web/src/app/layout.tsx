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
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <HtmlLangSync />
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
            >
              Aller au contenu principal
            </a>

            <NavBar />

            <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
              {children}
            </main>

            <footer className="border-t border-stone-200 bg-stone-950 dark:border-stone-800 dark:bg-stone-950">
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Brand */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-serif text-xl font-bold text-white">Ed</span>
                      <span className="text-xl font-light text-stone-500">Light</span>
                    </div>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-400">
                      Conçu pour les étudiants haïtiens — Nouvelles, bourses et ressources vérifiées.
                    </p>
                  </div>

                  {/* Navigation */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                      Navigation
                    </h3>
                    <nav className="mt-4 flex flex-col gap-2.5 text-sm">
                      {[
                        { href: "/news", label: "Fil d'actualités" },
                        { href: "/bourses", label: "Bourses" },
                        { href: "/opportunites", label: "Opportunités" },
                        { href: "/haiti", label: "Haïti" },
                        { href: "/ressources", label: "Ressources" },
                      ].map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className="text-stone-400 transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>
                  </div>

                  {/* More */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                      Explorer
                    </h3>
                    <nav className="mt-4 flex flex-col gap-2.5 text-sm">
                      {[
                        { href: "/universites", label: "Universités" },
                        { href: "/calendrier", label: "Calendrier" },
                        { href: "/parcours", label: "Parcours" },
                        { href: "/histoire", label: "Histoire" },
                        { href: "/succes", label: "Succès" },
                      ].map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className="text-stone-400 transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>
                  </div>

                  {/* About */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                      À propos
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-stone-400">
                      EdLight News synthétise des sources publiques pour informer les étudiants.
                    </p>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800 pt-8">
                  <p className="text-xs text-stone-500">
                    © {new Date().getFullYear()} EdLight Initiative
                  </p>
                  <p className="text-xs text-stone-600">
                    Les informations ne constituent pas un conseil officiel.
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
