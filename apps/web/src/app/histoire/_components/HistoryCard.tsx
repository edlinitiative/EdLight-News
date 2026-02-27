/**
 * HistoryCard — single almanac entry card.
 *
 * Layout:
 *   • Title + summary (line-clamped)
 *   • "Pourquoi c'est important" callout (if takeaway exists)
 *   • Tags as small chips
 *   • Collapsible "Sources & vérification" accordion (default collapsed)
 */

import Image from "next/image";
import { Lightbulb } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { SourcesAccordion } from "./SourcesAccordion";

const ILLUSTRATION_MIN_CONFIDENCE = 0.55;

function shouldShowIllustration(entry: SerializableAlmanacEntry): boolean {
  if (!entry.illustration?.imageUrl) return false;
  const confidence = entry.illustration.confidence;
  if (typeof confidence !== "number") return true;
  return confidence >= ILLUSTRATION_MIN_CONFIDENCE;
}

interface HistoryCardProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
}

export function HistoryCard({ entry, lang }: HistoryCardProps) {
  const fr = lang === "fr";
  const illustration = shouldShowIllustration(entry) ? entry.illustration : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md dark:border-stone-700 dark:bg-stone-800">
      {/* Optional illustration */}
      {illustration && (
        <div className="relative h-36 w-full overflow-hidden sm:h-44">
          <Image
            src={illustration.imageUrl}
            alt={entry.title_fr}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        {/* Year + tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.year != null && (
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold tabular-nums text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {entry.year}
            </span>
          )}
          {entry.tags?.slice(0, 3).map((tag) => {
            const t = TAG_LABELS[tag];
            return (
              <span
                key={tag}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t?.color ?? "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300"}`}
              >
                {fr ? t?.fr : t?.ht}
              </span>
            );
          })}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold leading-snug text-stone-900 dark:text-white sm:text-base">
          {entry.title_fr}
        </h3>

        {/* Summary — line-clamped */}
        <p className="line-clamp-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {entry.summary_fr}
        </p>

        {/* "Pourquoi c'est important" callout */}
        {entry.student_takeaway_fr && (
          <div className="flex gap-2 rounded-xl bg-amber-50/80 px-3 py-2.5 dark:bg-amber-900/10">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <strong className="font-semibold">
                {fr ? "Pourquoi c\u2019est important" : "Poukisa sa enp\u00f2tan"}
              </strong>{" "}
              — {entry.student_takeaway_fr}
            </p>
          </div>
        )}
      </div>

      {/* Sources accordion — collapsed by default */}
      <SourcesAccordion entry={entry} lang={lang} />
    </article>
  );
}
