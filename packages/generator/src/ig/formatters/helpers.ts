/**
 * IG Formatter helpers — shared across all formatter templates.
 */

import type { Item } from "@edlight-news/types";

const MAX_CAPTION_LENGTH = 2200; // IG's actual limit
const MIN_CAPTION_LENGTH = 600;

/**
 * Bilingual text overrides from content_versions (fr + ht).
 * When provided, formatters use these instead of raw item.title/summary.
 */
export interface BilingualText {
  frTitle: string;
  frSummary: string;
  htTitle?: string;
  htSummary?: string;
}

/**
 * Format an ISO deadline string to a human-readable French date.
 */
export function formatDeadline(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Truncate caption to MAX_CAPTION_LENGTH while keeping it meaningful.
 */
export function truncateCaption(caption: string): string {
  if (caption.length <= MAX_CAPTION_LENGTH) return caption;

  // Try to cut at a sentence boundary (. ! ? followed by space/newline)
  const cutZone = caption.slice(0, MAX_CAPTION_LENGTH - 3);
  const lastSentenceEnd = Math.max(
    cutZone.lastIndexOf(". "),
    cutZone.lastIndexOf(".\n"),
    cutZone.lastIndexOf("! "),
    cutZone.lastIndexOf("!\n"),
    cutZone.lastIndexOf("? "),
    cutZone.lastIndexOf("?\n"),
  );

  // Use sentence boundary if it's in the latter half, otherwise word boundary
  if (lastSentenceEnd > MAX_CAPTION_LENGTH * 0.5) {
    return caption.slice(0, lastSentenceEnd + 1);
  }
  const lastSpace = cutZone.lastIndexOf(" ");
  return (lastSpace > MAX_CAPTION_LENGTH * 0.5 ? caption.slice(0, lastSpace) : cutZone) + "…";
}

/**
 * Pad a short caption with hashtags to meet minimum length.
 */
export function padCaption(caption: string): string {
  if (caption.length >= MIN_CAPTION_LENGTH) return caption;
  const tags = "\n\n#EdLightNews #Haiti #Éducation #Bourse #Opportunité";
  return caption + tags;
}

/**
 * Build the standard bilingual CTA line (French + Kreyòl).
 */
export function buildCTA(): string {
  return "→ Détails sur EdLight News — lien dans la bio\n→ Detay sou EdLight News — lyen nan biyo";
}

/**
 * Build source attribution line from an Item.
 */
export function buildSourceLine(item: Item): string {
  const sourceName = item.source?.name ?? item.citations?.[0]?.sourceName ?? "Source";
  const sourceUrl = item.source?.originalUrl ?? item.citations?.[0]?.sourceUrl ?? item.canonicalUrl;
  return `Source: ${sourceName} (${sourceUrl})`;
}

/**
 * Shorten text to a maximum character length, breaking at word boundary.
 */
export function shortenText(text: string, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/**
 * Shorten a headline to at most `maxWords` words.
 * Keeps the first N words and appends "…" if truncated.
 */
export function shortenHeadline(text: string, maxWords = 14): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

// Known news/media domains — "Postulez" doesn't make sense for these
const NEWS_DOMAINS = [
  "juno7.ht", "loophaiti.com", "ayibopost.com", "lenouvelliste.com",
  "haitilibre.com", "alterpresse.org", "metropolehaiti.com",
  "radiotelevisioncaraibes.com", "vfrancaise.com", "maghaiti.net",
  "bbc.com", "reuters.com", "france24.com", "rfi.fr", "lemonde.fr",
  "nytimes.com", "theguardian.com", "aljazeera.com", "cnn.com",
  "apnews.com", "voanews.com",
];

/**
 * Convert a raw URL into human-friendly text for IG slides.
 * e.g. "https://www.campusfrance.org/apply" → "Postulez sur campusfrance.org"
 * For news sites → "Plus d'infos sur juno7.ht"
 */
export function humanizeUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const isNews = NEWS_DOMAINS.some((nd) => domain === nd || domain.endsWith("." + nd));
    return isNews
      ? `Plus d'infos sur ${domain}`
      : `Postulez sur ${domain}`;
  } catch {
    return "Voir le lien dans la bio";
  }
}
