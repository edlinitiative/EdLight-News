/**
 * IG Formatter helpers — shared across all formatter templates.
 */

import type { Item } from "@edlight-news/types";

const MAX_CAPTION_LENGTH = 1200;
const MIN_CAPTION_LENGTH = 600;

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
  return caption.slice(0, MAX_CAPTION_LENGTH - 3) + "…";
}

/**
 * Pad a short caption with hashtags to meet minimum length.
 */
export function padCaption(caption: string): string {
  if (caption.length >= MIN_CAPTION_LENGTH) return caption;
  const tags = "\n\n#EdLightNews #Haiti #Education #Bourse #Opportunité #Étudiant";
  return caption + tags;
}

/**
 * Build the standard CTA line.
 */
export function buildCTA(): string {
  return "👉 Détails sur EdLight News — lien dans la bio";
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
