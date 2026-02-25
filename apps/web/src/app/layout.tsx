import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { ThemeProvider } from "@/lib/theme-context";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "EdLight News",
  description:
    "Actualités éducatives pour les étudiants haïtiens — Nouvèl edikasyon pou elèv ayisyen yo",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
        <ThemeProvider>
          <LanguageProvider>
            <NavBar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
              {children}
            </main>
            <footer className="mt-16 border-t border-gray-200/70 bg-white/80 py-8 text-sm text-gray-500 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-400">
              <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between">
                <span className="inline-flex items-center gap-2 font-semibold text-brand-600 dark:text-brand-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white dark:bg-brand-500">E</span>
                  EdLight News
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  © {new Date().getFullYear()} EdLight Initiative
                </span>
              </div>
            </footer>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
