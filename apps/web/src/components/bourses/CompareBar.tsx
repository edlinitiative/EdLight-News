"use client";

/**
 * CompareBar — a sticky tray listing the scholarships picked for comparison,
 * plus a modal that lays them out side-by-side across the key attributes
 * (country, level, funding, deadline, Haiti-eligibility, apply link).
 */

import type { ContentLanguage } from "@edlight-news/types";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { X, GitCompareArrows, ExternalLink, CheckCircle2, MinusCircle } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import {
  countryEmoji,
  countryCode,
  fundingLabel,
  levelText,
} from "@/lib/bourses/labels";
import { getDeadlineStatus } from "@/lib/ui/deadlines";

interface CompareBarProps {
  items: SerializedScholarship[];
  lang: ContentLanguage;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function CompareBar({ items, lang, onRemove, onClear }: CompareBarProps) {
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Auto-close the modal if selection drops below 2.
  useEffect(() => {
    if (items.length < 2 && open) setOpen(false);
  }, [items.length, open]);

  if (items.length === 0) return null;

  const rows: { label: string; render: (s: SerializedScholarship) => ReactNode }[] = [
    {
      label: fr ? "Pays" : "Peyi",
      render: (s) => (
        <span>
          {countryEmoji(s.country)} {countryCode(s.country)}
        </span>
      ),
    },
    { label: fr ? "Niveau" : "Nivo", render: (s) => levelText(s.level, lang) || "—" },
    {
      label: fr ? "Financement" : "Finansman",
      render: (s) => fundingLabel(s.fundingType, lang)?.text ?? (fr ? "À vérifier" : "Pou verifye"),
    },
    {
      label: fr ? "Date limite" : "Dat limit",
      render: (s) => getDeadlineStatus(s.deadline?.dateISO, lang).humanLine,
    },
    {
      label: fr ? "Éligible Haïti" : "Elijib Ayiti",
      render: (s) =>
        (s.haitianEligibility ?? "unknown") === "yes" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <MinusCircle className="h-4 w-4 text-[#c7c4d8] dark:text-stone-600" />
        ),
    },
  ];

  return (
    <>
      {/* Sticky tray */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7e1de] bg-white/95 px-4 py-3 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="font-bold text-[#1d1b1a] dark:text-white">
              {items.length} {fr ? "sélectionnée(s)" : "chwazi"}
            </span>
            <div className="hidden min-w-0 gap-1.5 sm:flex">
              {items.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-[#f5f0ee] px-2 py-0.5 text-[11px] font-medium text-[#464555] dark:bg-stone-800 dark:text-stone-300"
                >
                  <span className="truncate">{s.name}</span>
                  <button onClick={() => onRemove(s.id)} aria-label={fr ? "Retirer" : "Retire"}>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onClear}
              className="text-[12px] font-semibold text-[#6b6563] hover:text-[#93000a] dark:text-stone-400"
            >
              {fr ? "Effacer" : "Efase"}
            </button>
            <button
              onClick={() => setOpen(true)}
              disabled={items.length < 2}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3525cd] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#2a1ea7] disabled:opacity-40 dark:bg-[#c3c0ff] dark:text-[#1d1b1a] dark:hover:bg-[#a8a3ff]"
            >
              <GitCompareArrows className="h-4 w-4" />
              {fr ? "Comparer" : "Konpare"}
            </button>
          </div>
        </div>
      </div>

      {/* Compare modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-2 backdrop-blur-sm sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={fr ? "Comparer les bourses" : "Konpare bous yo"}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#f3ecea] bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f3ecea] px-5 py-3.5 dark:border-stone-800">
              <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-[#1d1b1a] dark:text-white">
                <GitCompareArrows className="h-5 w-5 text-[#3525cd] dark:text-[#c3c0ff]" />
                {fr ? "Comparer" : "Konpare"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-[#6b6563] hover:bg-[#f5f0ee] dark:text-stone-400 dark:hover:bg-stone-800"
                aria-label={fr ? "Fermer" : "Fèmen"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white p-3 dark:bg-stone-900" />
                    {items.map((s) => (
                      <th key={s.id} className="min-w-[150px] border-b border-[#f3ecea] p-3 align-top dark:border-stone-800">
                        <span className="line-clamp-3 font-display text-[13.5px] font-bold text-[#1d1b1a] dark:text-white">
                          {s.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b border-[#f3ecea] dark:border-stone-800">
                      <th className="sticky left-0 z-10 bg-[#faf7f5] p-3 text-[11px] font-bold uppercase tracking-wide text-[#a8a29e] dark:bg-stone-800/60 dark:text-stone-500">
                        {row.label}
                      </th>
                      {items.map((s) => (
                        <td key={s.id} className="p-3 align-top text-[#464555] dark:text-stone-300">
                          {row.render(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#faf7f5] p-3 dark:bg-stone-800/60" />
                    {items.map((s) => {
                      const applyUrl = s.howToApplyUrl || s.officialUrl;
                      return (
                        <td key={s.id} className="p-3 align-top">
                          <div className="flex flex-col gap-1.5">
                            <Link
                              href={`/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`}
                              className="text-[12px] font-bold text-[#3525cd] hover:underline dark:text-[#c3c0ff]"
                            >
                              {fr ? "Détails" : "Detay"}
                            </Link>
                            {applyUrl && (
                              <a
                                href={applyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6b6563] hover:text-[#3525cd] dark:text-stone-400 dark:hover:text-[#c3c0ff]"
                              >
                                {fr ? "Postuler" : "Aplike"} <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
