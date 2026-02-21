import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { NavBar } from "@/components/NavBar";

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
      <body className="flex min-h-screen flex-col bg-gray-50">
        <LanguageProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="mt-16 border-t bg-white py-8 text-sm text-gray-500">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between">
              <span className="font-semibold text-brand-700">
                EdLight News
              </span>
              <nav className="flex flex-wrap items-center gap-4">
                <a href="/sources" className="hover:text-gray-700 hover:underline">
                  Sources
                </a>
                <a href="/about" className="hover:text-gray-700 hover:underline">
                  À propos
                </a>
                <a href="/contact" className="hover:text-gray-700 hover:underline">
                  Contact
                </a>
              </nav>
              <span className="text-xs text-gray-400">
                © {new Date().getFullYear()} EdLight Initiative
              </span>
            </div>
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
