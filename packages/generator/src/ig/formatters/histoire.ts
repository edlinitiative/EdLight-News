/**
 * IG Formatter – Histoire carousel
 *
 * Designed for HaitiHistory, HaitiFactOfTheDay, HaitianOfTheWeek utility items.
 *
 * Story-arc structure (up to 7 slides):
 *   Slide 1 — Cover: bold title, short teaser line (no long body text)
 *   Slides 2-6 — Content: one slide per Gemini section (L'histoire,
 *                Contexte, Pourquoi ça compte, Parcours, etc.)
 *   Last slide — Source / CTA
 *
 * When structured sections from ContentVersion are available (via bi.frSections),
 * each section becomes its own rich slide. This prevents the old problem of
 * slide 2 being a near-repeat of slide 1.
 *
 * Fallback: legacy extractedText / summary sentence-splitting for items
 * that don't have structured sections.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, shortenHeadline, type BilingualText } from "./helpers.js";
import { isJunkSentence, cleanExtractedText, splitSentences } from "./news.js";

/** Max content slides (excluding cover + source). Keeps carousels digestible. */
const MAX_CONTENT_SLIDES = 5;

/** Max bullets per explanation slide — avoids overflow on 1350px canvas. */
const MAX_BULLETS_PER_SLIDE = 4;

/** Max chars per bullet — keeps text readable at 34px body font. */
const MAX_BULLET_CHARS = 200;

/**
 * Split a section's content into digestible bullets.
 * Prefers paragraph breaks, then sentence splitting, then hard truncation.
 */
function sectionToBullets(content: string): string[] {
  // Try paragraph split first
  let paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10);

  // If only 1 big paragraph, split into sentences
  if (paragraphs.length <= 1) {
    paragraphs = splitSentences(content)
      .filter((s) => s.length >= 10 && !isJunkSentence(s));
  }

  return paragraphs
    .slice(0, MAX_BULLETS_PER_SLIDE)
    .map((b) => shortenText(b, MAX_BULLET_CHARS));
}

/**
 * Pick an appropriate heading for the section slide.
 * Uses the Gemini section heading when available, with friendly fallback.
 */
function sectionHeading(heading: string, index: number): string {
  if (heading && heading.length > 2) return shortenHeadline(heading, 8);
  const fallbacks = ["Le saviez-vous ?", "Contexte", "Pour mieux comprendre", "En bref"];
  return fallbacks[index] ?? `Partie ${index + 1}`;
}

export function buildHistoireCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;
  const imageUrl = item.imageUrl ?? undefined;
  const sections = bi?.frSections;
  const bodyText = bi?.frBody;

  // ══════════════════════════════════════════════════════════════════════
  // Slide 1 — Cover: punchy title + short teaser (never clips)
  // ══════════════════════════════════════════════════════════════════════
  // Only include a short teaser if the title alone doesn't tell the story.
  // This prevents the last-line clipping issue on the cover.
  const coverBullets: string[] = [];
  if (summary && title.length < 80) {
    // Short one-liner teaser — NOT the full summary
    const teaser = shortenText(summary, 100);
    if (teaser.length >= 20) coverBullets.push(teaser);
  }

  slides.push({
    heading: shortenHeadline(title, 12),
    bullets: coverBullets,
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ══════════════════════════════════════════════════════════════════════
  // Content slides — from structured sections (preferred) or fallback
  // ══════════════════════════════════════════════════════════════════════

  if (sections && sections.length > 0) {
    // ── Rich path: Gemini-generated sections ──────────────────────────
    // Each section (L'histoire, Contexte, Pourquoi ça compte, Parcours, etc.)
    // becomes its own slide with the section heading + content as bullets.

    // Filter out near-empty sections and "Sources" section (handled separately)
    const contentSections = sections.filter((s) => {
      if (!s.content || s.content.trim().length < 20) return false;
      if (/^sources?$/i.test(s.heading.trim())) return false;
      return true;
    });

    for (const section of contentSections.slice(0, MAX_CONTENT_SLIDES)) {
      const bullets = sectionToBullets(section.content);
      if (bullets.length === 0) continue;

      slides.push({
        heading: sectionHeading(section.heading, slides.length - 1),
        bullets,
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  } else {
    // ── Fallback path: extractedText / body / summary sentence splitting ─
    // Used for legacy items that don't have structured sections.
    const rawText = item.extractedText ?? bodyText ?? "";
    let facts: string[] = [];

    if (rawText.length > 30) {
      const cleaned = cleanExtractedText(rawText);
      facts = splitSentences(cleaned)
        .filter((s) => s.length >= 20 && s.length <= 250)
        .filter((s) => !isJunkSentence(s))
        .slice(0, 6);
    }

    // Supplement with summary sentences if needed
    if (facts.length < 3 && summary) {
      const summaryFacts = splitSentences(summary)
        .filter((s) => s.length >= 15 && s.length <= 250)
        .filter((s) => !isJunkSentence(s));
      for (const sf of summaryFacts) {
        if (!facts.includes(sf)) facts.push(sf);
        if (facts.length >= 6) break;
      }
    }

    if (facts.length === 0 && summary) {
      facts = [shortenText(summary, 280)];
    }

    // Split facts across 2-3 slides (3-4 bullets each) for readability
    if (facts.length > 0) {
      const chunkSize = Math.min(MAX_BULLETS_PER_SLIDE, Math.ceil(facts.length / 2));
      const headings = ["Le saviez-vous ?", "Pour mieux comprendre", "En bref"];
      let slideIdx = 0;

      for (let i = 0; i < facts.length && slideIdx < 3; i += chunkSize) {
        const chunk = facts.slice(i, i + chunkSize);
        slides.push({
          heading: headings[slideIdx] ?? `Partie ${slideIdx + 1}`,
          bullets: chunk.map((f) => shortenText(f, MAX_BULLET_CHARS)),
          layout: "explanation",
          ...(imageUrl ? { backgroundImage: imageUrl } : {}),
        });
        slideIdx++;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Last slide — Source / CTA
  // ══════════════════════════════════════════════════════════════════════
  const sourceLine = buildSourceLine(item);

  // Ensure last content slide has the source footer
  if (slides.length > 1) {
    slides[slides.length - 1]!.footer = sourceLine;
  } else {
    // Only cover exists — add a dedicated source slide
    slides.push({
      heading: "Source",
      bullets: [sourceLine],
      layout: "explanation",
      footer: sourceLine,
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Caption — rich, bilingual, section-aware
  // ══════════════════════════════════════════════════════════════════════
  const captionParts: string[] = [title, ""];

  if (sections && sections.length > 0) {
    // Build a richer caption with highlights from each section
    for (const section of sections.slice(0, 4)) {
      if (!section.content || section.content.trim().length < 20) continue;
      if (/^sources?$/i.test(section.heading.trim())) continue;
      // Take the first sentence of each section as a caption paragraph
      const firstSentence = splitSentences(section.content)
        .filter((s) => s.length >= 15 && !isJunkSentence(s))[0];
      if (firstSentence) {
        captionParts.push(`📌 ${section.heading}`);
        captionParts.push(shortenText(firstSentence, 200));
        captionParts.push("");
      }
    }
  } else {
    captionParts.push(shortenText(summary, 400));
    captionParts.push("");
  }

  if (bi?.htSummary) captionParts.push(`🇭🇹 ${shortenText(bi.htSummary, 300)}`, "");

  // Hashtags — vary by series type
  const seriesType = item.utilityMeta?.series;
  if (seriesType === "HaitianOfTheWeek") {
    captionParts.push("#AyisyenSemèn #HaitiPride #EdLightNews");
  } else if (seriesType === "HaitiFactOfTheDay") {
    captionParts.push("#FètDuJour #HaitiHistory #EdLightNews");
  } else {
    captionParts.push("#IstwaAyiti #HistoireHaïti #EdLightNews");
  }

  captionParts.push("", buildCTA(), "", sourceLine);

  return { slides, caption: truncateCaption(captionParts.join("\n")) };
}
