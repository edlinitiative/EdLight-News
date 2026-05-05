"use client";

/**
 * NewsletterForm — dual-stream signup (PRD §3).
 *
 * When `dualStream` is true, exposes two opt-ins:
 *   ☑ Bourses (hebdomadaire)   default checked
 *   ☐ Actualités (quotidien)   default unchecked
 *
 * When `dualStream` is false (default), behaves as the legacy single-list
 * signup so existing call-sites (sidebars, article footers) keep working.
 *
 * Each submission carries a `source` tag ("hero" | "footer" | "sticky" |
 * "exit_intent" | "inline") for analytics, and fires a `newsletter_signup`
 * event per selected stream.
 */

import { useState } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { track } from "@/lib/analytics";

type Stream = "bourses" | "news";
type SignupSource = "hero" | "footer" | "sticky" | "exit_intent" | "inline";

interface Props {
  lang: ContentLanguage;
  variant?: "homepage" | "inline";
  /** Where this form lives — used as the analytics `source` property. */
  source?: SignupSource;
  /** When true, render two opt-in checkboxes. Defaults to false (legacy). */
  dualStream?: boolean;
}

const SUBSCRIBED_KEY = "edl_newsletter_subscribed";

export function NewsletterForm({
  lang,
  variant = "homepage",
  source = "footer",
  dualStream = false,
}: Props) {
  const fr = lang === "fr";

  const [email, setEmail] = useState("");
  const [bourses, setBourses] = useState(true);
  const [news, setNews] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const streams: Stream[] = dualStream
      ? ([bourses && "bourses", news && "news"].filter(Boolean) as Stream[])
      : ["bourses", "news"]; // legacy callers get both

    if (streams.length === 0) {
      setStatus("error");
      setErrorMsg(
        fr
          ? "Sélectionnez au moins une édition."
          : "Chwazi omwen yon edisyon.",
      );
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          lang,
          streams,
          source,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      setStatus("success");
      try {
        window.localStorage.setItem(SUBSCRIBED_KEY, "1");
      } catch {
        /* ignore */
      }
      // Fire one event per stream so funnel reporting can attribute opt-ins.
      for (const stream of streams) {
        track("newsletter_signup", { stream, source });
      }
    } catch {
      setStatus("error");
      setErrorMsg(
        fr
          ? "Une erreur est survenue. Veuillez réessayer."
          : "Yon erè rive. Tanpri eseye ankò.",
      );
    }
  };

  if (status === "success") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-800/50 dark:bg-emerald-950/30">
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {fr ? "Inscription réussie !" : "Enskripsyon reyisi !"}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {fr
              ? "Vous recevrez nos éditions directement dans votre boîte mail."
              : "Ou pral resevwa edisyon nou yo dirèkteman nan bwat imèl ou."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {dualStream && (
        <fieldset className="mb-3 space-y-2">
          <legend className="sr-only">
            {fr ? "Choix des éditions" : "Chwa edisyon yo"}
          </legend>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-stone-200">
            <input
              type="checkbox"
              checked={bourses}
              onChange={(e) => setBourses(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-600 bg-stone-900 text-primary focus:ring-primary focus:ring-offset-stone-950"
            />
            <span>
              <span className="font-semibold text-white">
                {fr ? "Bourses" : "Bous"}
              </span>{" "}
              <span className="text-stone-400">
                ({fr ? "hebdomadaire" : "chak semèn"})
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-stone-200">
            <input
              type="checkbox"
              checked={news}
              onChange={(e) => setNews(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-600 bg-stone-900 text-primary focus:ring-primary focus:ring-offset-stone-950"
            />
            <span>
              <span className="font-semibold text-white">
                {fr ? "Actualités" : "Nouvèl"}
              </span>{" "}
              <span className="text-stone-400">
                ({fr ? "quotidien" : "chak jou"})
              </span>
            </span>
          </label>
        </fieldset>
      )}

      <div
        className={
          variant === "homepage"
            ? "flex flex-col gap-3 sm:flex-row"
            : "flex gap-2"
        }
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={fr ? "Votre adresse e-mail" : "Adrès imèl ou"}
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 outline-none ring-0 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder-stone-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/30"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 disabled:opacity-60"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {fr ? "S'abonner" : "Abòne"}
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
      )}
      <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
        {fr ? (
          <>
            Gratuit · Désabonnement à tout moment ·{" "}
            <a
              href="/privacy"
              className="underline hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Confidentialité
            </a>
          </>
        ) : (
          <>
            Gratis · Dezabòne nenpòt ki lè ·{" "}
            <a
              href="/privacy"
              className="underline hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Konfidyansyalite
            </a>
          </>
        )}
      </p>
    </form>
  );
}
