"use client";

/**
 * SourcesAccordion — collapsible "Sources & vérification" section.
 *
 * Keeps attribution visible but out of the way by default.
 * Shows: source links, illustration credit, verified/updated labels.
 */

import { useState } from "react";
import { ChevronDown, ExternalLink, ShieldCheck, ImageIcon } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializableAlmanacEntry } from "./shared";

interface SourcesAccordionProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
}

export function SourcesAccordion({ entry, lang }: SourcesAccordionProps) {
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);

  const hasSources = entry.sources.length > 0;
  const hasIllustration = !!entry.illustration?.imageUrl;
  const hasVerified = !!entry.verifiedAt;
  const hasUpdated = !!entry.updatedAt;

  if (!hasSources && !hasIllustration && !hasVerified) return null;

  return (
    <div className="border-t border-stone-100 dark:border-stone-700/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-[11px] font-medium text-stone-400 transition hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 sm:px-5"
      >
        <ShieldCheck className="h-3 w-3" />
        {fr ? "Sources & vérification" : "Sous & verifikasyon"}
        <ChevronDown
          className={`ml-auto h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 px-4 pb-4 sm:px-5">
          {/* Source links */}
          {hasSources && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {fr ? "Sources" : "Sous"}
              </p>
              <ul className="space-y-0.5">
                {entry.sources.map((s, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 text-stone-400" />
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Illustration credit */}
          {hasIllustration && (
            <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              <ImageIcon className="h-3 w-3" />
              <span>{fr ? "Illustration :" : "Ilistrasyon :"}</span>
              <a
                href={entry.illustration!.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-500 hover:underline dark:text-blue-400"
              >
                {entry.illustration!.provider === "wikimedia_commons"
                  ? "Wikimedia Commons"
                  : (fr ? "Source" : "Sous")}
              </a>
              {entry.illustration!.author && (
                <span className="text-stone-400">— {entry.illustration!.author}</span>
              )}
            </div>
          )}

          {/* Verified / Updated labels */}
          <div className="flex flex-wrap gap-3 text-[10px] text-stone-400 dark:text-stone-500">
            {hasVerified && (
              <span>
                ✓ {fr ? "Vérifié" : "Verifye"}{" "}
                {new Date(entry.verifiedAt!).toLocaleDateString(fr ? "fr-FR" : "ht", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {hasUpdated && (
              <span>
                ↻ {fr ? "Mis à jour" : "Mete ajou"}{" "}
                {new Date(entry.updatedAt!).toLocaleDateString(fr ? "fr-FR" : "ht", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
