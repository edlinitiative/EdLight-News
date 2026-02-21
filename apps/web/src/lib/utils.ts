/**
 * Shared utilities for the EdLight News web app.
 * Date formatting, category mapping, domain extraction.
 */

import type { ContentLanguage, ItemCategory } from "@edlight-news/types";

// ── Date formatting ─────────────────────────────────────────────────────────

/**
 * Format a Firestore timestamp-like object or ISO string to a human-readable date.
 * Gracefully handles missing/invalid data.
 */
export function formatDate(
  value: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null | undefined,
  lang: ContentLanguage = "fr",
): string {
  if (!value) return "";
  let date: Date;
  try {
    if (typeof value === "string") {
      date = new Date(value);
    } else if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      date = value.toDate();
    } else if (typeof value === "object" && ("seconds" in value || "_seconds" in value)) {
      const secs = (value as Record<string, number>).seconds ?? (value as Record<string, number>)._seconds ?? 0;
      date = new Date(secs * 1000);
    } else {
      return "";
    }
    if (isNaN(date.getTime())) return "";
  } catch {
    return "";
  }

  const locale = lang === "ht" ? "fr-HT" : "fr-FR";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a date relative to now (e.g., "il y a 3 heures").
 */
export function formatRelativeDate(
  value: { seconds?: number; _seconds?: number } | string | null | undefined,
  lang: ContentLanguage = "fr",
): string {
  if (!value) return "";
  let ms: number;
  try {
    if (typeof value === "string") {
      ms = new Date(value).getTime();
    } else if (typeof value === "object") {
      const secs = (value as Record<string, number>).seconds ?? (value as Record<string, number>)._seconds ?? 0;
      ms = secs * 1000;
    } else {
      return "";
    }
    if (isNaN(ms)) return "";
  } catch {
    return "";
  }

  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (lang === "ht") {
    if (minutes < 60) return `${minutes} minit de sa`;
    if (hours < 24) return `${hours} èdtan de sa`;
    if (days < 7) return `${days} jou de sa`;
    return formatDate(value, lang);
  }

  if (minutes < 60) return `il y a ${minutes} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days < 7) return `il y a ${days}j`;
  return formatDate(value, lang);
}

// ── Category labels & mapping ───────────────────────────────────────────────

export type FeedCategory =
  | "all"
  | "news"
  | "local_news"
  | "scholarship"
  | "opportunity"
  | "event"
  | "resource";

export const CATEGORY_LABELS: Record<FeedCategory, { fr: string; ht: string }> = {
  all:         { fr: "Tout",          ht: "Tout"      },
  news:        { fr: "Actualités",    ht: "Nouvèl"    },
  local_news:  { fr: "Haïti",         ht: "Ayiti"     },
  scholarship: { fr: "Bourses",       ht: "Bous"      },
  opportunity: { fr: "Opportunités",  ht: "Okazyon"   },
  event:       { fr: "Événements",    ht: "Evènman"   },
  resource:    { fr: "Ressources",    ht: "Resous"    },
};

export const CATEGORY_COLORS: Record<string, string> = {
  local_news:  "bg-blue-50 text-blue-700",
  scholarship: "bg-purple-50 text-purple-700",
  opportunity: "bg-orange-50 text-orange-700",
  event:       "bg-teal-50 text-teal-700",
  resource:    "bg-green-50 text-green-700",
  news:        "bg-gray-50 text-gray-700",
};

export function categoryLabel(cat: string | undefined, lang: ContentLanguage): string {
  if (!cat) return "";
  return CATEGORY_LABELS[cat as FeedCategory]?.[lang] ?? cat;
}

// ── Domain extraction ───────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── Sort options ────────────────────────────────────────────────────────────

export type SortOption = "latest" | "relevance" | "deadline";

export const SORT_LABELS: Record<SortOption, { fr: string; ht: string }> = {
  latest:    { fr: "Dernières",                ht: "Dènye"              },
  relevance: { fr: "Pertinence",               ht: "Pètinans"          },
  deadline:  { fr: "Bourses: deadline proche",  ht: "Bous: dat limit"  },
};
