/**
 * StickyNewsletterCTA — persistent newsletter prompt.
 *
 * Behaviour (PRD §4):
 *   • Mobile (< md): sticky bottom banner above the existing MobileBottomNav.
 *   • Desktop (>= md): floating widget anchored bottom-right.
 *   • Dismissible → 30-day cooldown stored in localStorage.
 *   • Hidden on /bourses/* routes (already a converted audience).
 *   • Hidden permanently after a successful signup from this browser
 *     (proxy for "logged-in subscriber").
 *   • Single email input + submit → POSTs with stream "bourses",
 *     source "sticky".
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, X, Loader2, CheckCircle } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { track } from "@/lib/analytics";

const DISMISS_KEY = "edl_sticky_news_dismissed_at";
const SUBSCRIBED_KEY = "edl_newsletter_subscribed";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function StickyNewsletterCTA() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const fr = language === "fr";

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Decide visibility on mount / route change.
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // Suppress on /bourses/* routes (audience already converted).
    if (pathname.startsWith("/bourses")) {
      setVisible(false);
      return;
    }

    try {
      if (window.localStorage.getItem(SUBSCRIBED_KEY) === "1") {
        setVisible(false);
        return;
      }
      const dismissedAt = Number(
        window.localStorage.getItem(DISMISS_KEY) ?? "0",
      );
      if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore — storage unavailable */
    }

    // Small delay so it doesn't pop immediately on page load.
    const id = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(id);
  }, [pathname]);

  function handleDismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          lang: language,
          streams: ["bourses"],
          source: "sticky",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      track("newsletter_signup", { stream: "bourses", source: "sticky" });
      try {
        window.localStorage.setItem(SUBSCRIBED_KEY, "1");
      } catch {
        /* ignore */
      }
      setTimeout(() => setVisible(false), 2500);
    } catch {
      setStatus("error");
    }
  }

  if (!mounted || !visible) return null;

  const headline = fr
    ? "Recevez les bourses chaque semaine — gratuit"
    : "Resevwa bous yo chak semèn — gratis";
  const placeholder = fr ? "Votre e-mail" : "Imèl ou";
  const submitLabel = fr ? "S'abonner" : "Abòne";
  const dismissLabel = fr ? "Fermer" : "Fèmen";

  return (
    <>
      {/* ── Mobile: bottom banner sitting above MobileBottomNav ────── */}
      <div
        className="fixed inset-x-0 z-40 px-3 md:hidden"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        role="region"
        aria-label={headline}
      >
        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {status === "success" ? (
            <p className="flex-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {fr ? "Inscription réussie !" : "Enskripsyon reyisi !"}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                aria-label={headline}
                className="flex-1 min-w-0 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-primary dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
              >
                {status === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  submitLabel
                )}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={dismissLabel}
            className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Desktop: floating bottom-right widget ─────────────────── */}
      <div
        className="fixed bottom-6 right-6 z-40 hidden w-80 md:block"
        role="region"
        aria-label={headline}
      >
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-900 dark:text-white">
                {fr ? "Newsletter Bourses" : "Nyouzletè Bous"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={dismissLabel}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {status === "success" ? (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {fr ? "Inscription réussie !" : "Enskripsyon reyisi !"}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm leading-snug text-stone-700 dark:text-stone-300">
                {headline}
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  className="flex-1 min-w-0 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    submitLabel
                  )}
                </button>
              </form>
              {status === "error" && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {fr
                    ? "Une erreur est survenue. Veuillez réessayer."
                    : "Yon erè rive. Tanpri eseye ankò."}
                </p>
              )}
              <p className="mt-2 text-[10px] text-stone-400 dark:text-stone-500">
                {fr
                  ? "Hebdomadaire · Désabonnement à tout moment"
                  : "Chak semèn · Dezabòne nenpòt ki lè"}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
