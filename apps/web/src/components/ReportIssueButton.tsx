"use client";

/**
 * ReportIssueButton — "Signaler une erreur" feedback button.
 *
 * Opens a small modal with a reason dropdown and optional note.
 * Submits to /api/feedback via POST. Client-side rate limited
 * (1 report per item per device per 10 minutes via localStorage).
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type FeedbackReason = "date" | "source" | "categorie" | "texte" | "autre";

interface ReportIssueButtonProps {
  itemId: string;
  /** Full page URL (auto-detected if omitted) */
  pageUrl?: string;
  lang?: "fr" | "ht";
}

// ── Rate limiting ───────────────────────────────────────────────────────────

const RATE_KEY_PREFIX = "edlight_report_";
const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

function isRateLimited(itemId: string): boolean {
  try {
    const key = `${RATE_KEY_PREFIX}${itemId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return false;
    const ts = parseInt(stored, 10);
    return Date.now() - ts < RATE_LIMIT_MS;
  } catch {
    return false;
  }
}

function markReported(itemId: string): void {
  try {
    const key = `${RATE_KEY_PREFIX}${itemId}`;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Ignore storage errors
  }
}

// ── Reason labels ───────────────────────────────────────────────────────────

const REASON_OPTIONS: { value: FeedbackReason; fr: string; ht: string }[] = [
  { value: "date", fr: "Date incorrecte", ht: "Dat pa kòrèk" },
  { value: "source", fr: "Source incorrecte", ht: "Sous pa kòrèk" },
  { value: "categorie", fr: "Mauvaise catégorie", ht: "Move kategori" },
  { value: "texte", fr: "Erreur dans le texte", ht: "Erè nan tèks la" },
  { value: "autre", fr: "Autre problème", ht: "Lòt pwoblèm" },
];

// ── Component ───────────────────────────────────────────────────────────────

export function ReportIssueButton({
  itemId,
  pageUrl,
  lang = "fr",
}: ReportIssueButtonProps) {
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FeedbackReason>("texte");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<"success" | "rate-limit" | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleOpen = useCallback(() => {
    if (isRateLimited(itemId)) {
      setToast("rate-limit");
      return;
    }
    setOpen(true);
  }, [itemId]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    if (isRateLimited(itemId)) {
      setToast("rate-limit");
      setOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const url = pageUrl ?? (typeof window !== "undefined" ? window.location.href : "");
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          pageUrl: url,
          reason,
          note: note.trim() || undefined,
        }),
      });

      if (res.ok) {
        markReported(itemId);
        setToast("success");
        setOpen(false);
        setNote("");
        setReason("texte");
      } else {
        // Show generic error as rate-limit to keep it simple
        setToast("rate-limit");
      }
    } catch {
      setToast("rate-limit");
    } finally {
      setSubmitting(false);
    }
  }, [itemId, pageUrl, reason, note, submitting]);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:text-red-600"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        {fr ? "Signaler une erreur" : "Siyale yon erè"}
      </button>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition ${
            toast === "success"
              ? "bg-green-600 text-white"
              : "bg-amber-500 text-white"
          }`}
        >
          {toast === "success"
            ? fr
              ? "Merci, on va vérifier."
              : "Mèsi, n ap verifye."
            : fr
              ? "Veuillez réessayer plus tard."
              : "Tanpri eseye ankò pita."}
        </div>
      )}

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={fr ? "Signaler une erreur" : "Siyale yon erè"}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              {fr ? "Signaler une erreur" : "Siyale yon erè"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {fr
                ? "Aidez-nous à améliorer cette page."
                : "Ede nou amelyore paj sa a."}
            </p>

            {/* Reason selector */}
            <label className="mt-4 block text-sm font-medium text-gray-700">
              {fr ? "Type d'erreur" : "Tip erè"}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as FeedbackReason)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {fr ? opt.fr : opt.ht}
                </option>
              ))}
            </select>

            {/* Note */}
            <label className="mt-3 block text-sm font-medium text-gray-700">
              {fr ? "Détails (optionnel)" : "Detay (opsyonèl)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder={
                fr
                  ? "Décrivez brièvement l'erreur…"
                  : "Dekri erè a brèvman…"
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {note.length}/500
            </p>

            {/* Actions */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                {fr ? "Annuler" : "Anile"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {submitting
                  ? fr
                    ? "Envoi…"
                    : "Voye…"
                  : fr
                    ? "Envoyer"
                    : "Voye"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
