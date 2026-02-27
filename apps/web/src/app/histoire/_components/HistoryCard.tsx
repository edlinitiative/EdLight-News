/**
 * HistoryCard — single almanac entry card.
 *
 * Shows: year badge, title, summary (line-clamped), category tags,
 * student takeaway (if present), sources, and illustration.
 */

import Image from "next/image";
import { BookOpen, CheckCircle } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";

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
  /** "hero" = larger card, "compact" = smaller card in list */
  variant?: "hero" | "compact";
}

export function HistoryCard({ entry, lang, variant = "compact" }: HistoryCardProps) {
  const fr = lang === "fr";
  const illustration = shouldShowIllustration(entry) ? entry.illustration : null;
  const isHero = variant === "hero";

  return (
    <article
      className={
        "group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md dark:border-stone-700 dark:bg-stone-800" +
        (isHero ? " ring-1 ring-blue-100 dark:ring-blue-900/40" : "")
      }
    >
      {/* Top row: optional illustration + header */}
      <div className={illustration ? "flex gap-0" : ""}>
        {illustration && (
          <div className="relative hidden w-32 shrink-0 overflow-hidden sm:block sm:w-40">
            <Image
              src={illustration.imageUrl}
              alt={entry.title_fr}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.year != null && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {entry.year}
              </span>
            )}
            {entry.confidence === "high" && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle className="h-3 w-3" />
                {fr ? "Vérifié" : "Verifye"}
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
          <h3
            className={
              isHero
                ? "text-base font-bold leading-snug text-stone-900 dark:text-white sm:text-lg"
                : "text-sm font-bold leading-snug text-stone-900 dark:text-white sm:text-base"
            }
          >
            {entry.title_fr}
          </h3>

          {/* Summary */}
          <p
            className={
              "text-sm leading-relaxed text-stone-500 dark:text-stone-400 " +
              (isHero ? "line-clamp-4" : "line-clamp-2")
            }
          >
            {entry.summary_fr}
          </p>
        </div>
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-2.5 border-t border-stone-100 px-4 pb-4 pt-3 dark:border-stone-700/60 sm:px-5">
        {/* Student takeaway */}
        {entry.student_takeaway_fr && isHero && (
          <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 dark:border-blue-800/40 dark:bg-blue-900/20">
            <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-300" />
            <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
              <strong>{fr ? "Pourquoi c'est important" : "Poukisa sa enpòtan"} :</strong>{" "}
              {entry.student_takeaway_fr}
            </p>
          </div>
        )}

        {/* Sources */}
        {entry.sources.length > 0 && (
          <div className="flex flex-wrap items-center text-[11px] text-stone-500 dark:text-stone-400">
            <span className="mr-1 font-medium">{fr ? "Sources :" : "Sous :"}</span>
            {entry.sources.map((s, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">·</span>}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {s.label}
                </a>
              </span>
            ))}
          </div>
        )}

        {/* Illustration credit */}
        {illustration && (
          <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
            <span>{fr ? "Illustration historique" : "Ilistrasyon istorik"}</span>
            <a
              href={illustration.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-500 hover:underline dark:text-blue-400"
            >
              Wikimedia Commons
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
