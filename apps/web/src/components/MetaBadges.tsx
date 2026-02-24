/**
 * MetaBadges — Reusable Verified / Updated / Published date badges.
 *
 * Displays subtle pill-style badges for key trust dates on content.
 * Works with Firestore Timestamps, ISO strings, or null values.
 */

import type { ContentLanguage } from "@edlight-news/types";

// ── French month names ──────────────────────────────────────────────────────
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const HT_MONTHS = [
  "janvye", "fevriye", "mas", "avril", "me", "jen",
  "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
];

// ── Date parsing & formatting ───────────────────────────────────────────────

type TimestampLike =
  | { seconds?: number; _seconds?: number; toDate?: () => Date }
  | string
  | null
  | undefined;

/** Extract a Date from various timestamp-like shapes. Returns null on failure. */
function toDate(value: TimestampLike): Date | null {
  if (!value) return null;
  try {
    if (typeof value === "string") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "object") {
      if ("toDate" in value && typeof value.toDate === "function") {
        return value.toDate();
      }
      const secs =
        (value as Record<string, number>).seconds ??
        (value as Record<string, number>)._seconds;
      if (secs) return new Date(secs * 1000);
    }
  } catch {
    // Gracefully fall through
  }
  return null;
}

/**
 * Format a date in the house style.
 * FR: "27 mars 2026"
 * HT: "27 mas 2026"
 */
function formatBadgeDate(date: Date, lang: ContentLanguage): string {
  const day = date.getDate();
  const monthIdx = date.getMonth();
  const year = date.getFullYear();
  const months = lang === "ht" ? HT_MONTHS : FR_MONTHS;
  return `${day} ${months[monthIdx]} ${year}`;
}

// ── Component ───────────────────────────────────────────────────────────────

interface MetaBadgesProps {
  verifiedAt?: TimestampLike;
  updatedAt?: TimestampLike;
  publishedAt?: TimestampLike;
  lang?: ContentLanguage;
  variant?: "compact" | "full";
}

/** One day in milliseconds */
const ONE_DAY_MS = 86_400_000;

export function MetaBadges({
  verifiedAt,
  updatedAt,
  publishedAt,
  lang = "fr",
  variant = "compact",
}: MetaBadgesProps) {
  const verDate = toDate(verifiedAt);
  const updDate = toDate(updatedAt);
  const pubDate = toDate(publishedAt);

  // Only show "Mis à jour" if updatedAt differs meaningfully from publishedAt
  // (at least 1 day apart), or if publishedAt is missing
  const showUpdated = (() => {
    if (!updDate) return false;
    if (!pubDate) return true;
    return Math.abs(updDate.getTime() - pubDate.getTime()) >= ONE_DAY_MS;
  })();

  const hasBadges = verDate || showUpdated || (variant === "full" && pubDate);
  if (!hasBadges) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {verDate && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {lang === "ht"
            ? `Verifye ${formatBadgeDate(verDate, lang)}`
            : `Vérifié le ${formatBadgeDate(verDate, lang)}`}
        </span>
      )}

      {showUpdated && updDate && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
            />
          </svg>
          {lang === "ht"
            ? `Mizajou ${formatBadgeDate(updDate, lang)}`
            : `Mis à jour le ${formatBadgeDate(updDate, lang)}`}
        </span>
      )}

      {variant === "full" && pubDate && (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {lang === "ht"
            ? `Pibliye ${formatBadgeDate(pubDate, lang)}`
            : `Publié le ${formatBadgeDate(pubDate, lang)}`}
        </span>
      )}
    </div>
  );
}
