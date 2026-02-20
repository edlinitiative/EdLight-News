import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { LanguageToggle } from "@/components/language-toggle";

export const metadata: Metadata = {
  title: "EdLight News",
  description:
    "Actualités éducatives pour les étudiants haïtiens — Nouvèl edikasyon pou elèv ayisyen yo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <LanguageProvider>
          <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <a href="/" className="text-xl font-bold text-brand-700">
                EdLight News
              </a>
              <nav className="flex items-center gap-4">
                <a href="/news" className="text-sm hover:underline">
                  Nouvèl
                </a>
                <a href="/admin" className="text-sm hover:underline">
                  Admin
                </a>
                <LanguageToggle />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
