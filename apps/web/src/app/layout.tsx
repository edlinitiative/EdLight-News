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
      <body className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
        <ThemeProvider>
          <LanguageProvider>
            <NavBar />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
              {children}
            </main>
            <footer className="mt-20 border-t border-gray-200 bg-white py-8 text-sm text-gray-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between">
                <span className="font-semibold text-brand-600 dark:text-brand-400">
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
