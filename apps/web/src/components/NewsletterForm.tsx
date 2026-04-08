"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";

interface Props {
  lang: ContentLanguage;
  variant?: "homepage" | "inline";
}

export function NewsletterForm({ lang, variant = "homepage" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fr = lang === "fr";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), lang }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        fr
          ? "Une erreur est survenue. Veuillez réessayer."
          : "Yon erè rive. Tanpri eseye ankò."
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
              ? "Vous recevrez nos actualités directement dans votre boîte mail."
              : "Ou pral resevwa nouvèl nou yo dirèkteman nan bwat imèl ou."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className={variant === "homepage" ? "flex flex-col gap-3 sm:flex-row" : "flex gap-2"}>
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
        {fr
          ? "Gratuit. Pas de spam. Désabonnement à tout moment."
          : "Gratis. Pa gen spam. Dezabòne nenpòt ki lè."}
      </p>
    </form>
  );
}
