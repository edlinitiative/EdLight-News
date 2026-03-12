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

/** Max bullets per explanation slide — 3×200ch + heading stays under 925px budget. */
const MAX_BULLETS_PER_SLIDE = 3;

/** Max chars per bullet — keeps text readable at 34px body font. */
const MAX_BULLET_CHARS = 200;

// ── Markdown cleanup (IG renders plain text, not markdown) ──────────────────

/**
 * Strip markdown formatting that's invisible on IG slides:
 * **bold** → bold, [text](url) → text, emoji prefixes, etc.
 */
function stripMarkdown(text: string): string {
  return text
    // [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // **bold** or __bold__ → plain
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // *italic* → plain
    .replace(/\*([^*]+)\*/g, "$1")
    // ### headers → plain text
    .replace(/^#{1,4}\s*/gm, "")
    // Leading emoji + colon labels (💡 Pour les étudiants : → Pour les étudiants :)
    .replace(/^(?:📚|💡|📌|🎉|📜)\s*/gmu, "")
    // Clean multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Lines matching these patterns are source-attribution noise, not content. */
function isSourceLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return (
    lower.startsWith("sources") ||
    lower.startsWith("📚") ||
    lower.startsWith("source :") ||
    lower.startsWith("source:") ||
    /^\[.+\]\(.+\)(\s*·\s*\[.+\]\(.+\))*$/.test(lower)  // pure link list
  );
}

/** Lines matching these are student-takeaway hooks — extract separately. */
function isTakeawayLine(line: string): boolean {
  return /💡|pour les étudiants|pourquoi c'est important/i.test(line);
}

// ── Sub-section parser (for LLM-generated rich bodies) ──────────────────────

interface SubSection {
  heading: string;
  content: string;
}

/**
 * Parse markdown sub-sections from a long body text.
 * Handles:  **Heading**\n\nParagraph  and  ### Heading\n\nParagraph
 * Returns individual sub-sections that can become their own IG slides.
 */
function extractSubSections(content: string): SubSection[] | null {
  // Try ### headings first (LLM often uses these)
  const h3Parts = content.split(/^###\s+/m).filter((p) => p.trim().length > 0);
  if (h3Parts.length >= 2) {
    return h3Parts.map((part) => {
      const lines = part.split("\n");
      const heading = stripMarkdown(lines[0]?.trim() ?? "");
      const body = lines.slice(1).join("\n").trim();
      return { heading, content: body };
    }).filter((s) => s.content.length >= 20);
  }

  // Try **Bold Heading** at start of paragraph
  const boldParts = content.split(/\n{2,}(?=\*\*[^*]+\*\*)/);
  if (boldParts.length >= 2) {
    return boldParts.map((part) => {
      const match = part.match(/^\*\*([^*]+)\*\*\s*[—–:\-]?\s*([\s\S]*)/);
      if (match) return { heading: match[1]!.trim(), content: match[2]!.trim() };
      return { heading: "", content: part.trim() };
    }).filter((s) => s.content.length >= 20 && s.heading.length > 0);
  }

  return null;
}

// ── Bullet builder (with markdown cleanup + filtering) ──────────────────────

/**
 * Split a section's content into digestible, clean bullets for IG slides.
 * Strips markdown, filters source lines, and respects pixel budget.
 */
function sectionToBullets(content: string): string[] {
  // Filter source lines on RAW text (before markdown stripping) so
  // emoji prefixes (📚) and link-list patterns still match reliably.
  const preFiltered = content
    .split(/\n{2,}/)
    .filter((p) => !isSourceLine(p.trim()))
    .join("\n\n");

  const cleaned = stripMarkdown(preFiltered);

  // Try paragraph split first
  let paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10)
    .filter((p) => !isJunkSentence(p));

  // If only 1 big paragraph, split into sentences
  if (paragraphs.length <= 1) {
    paragraphs = splitSentences(cleaned)
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
    // ── Rich path: structured sections from historyPublisher ──────────
    //
    // Content arrives in 2 flavours:
    //
    // A) Template path — each almanac entry is 1 section whose content
    //    concatenates summary + 💡 student_takeaway + 📚 source links.
    //    We split these apart so the takeaway gets its own featured slide.
    //
    // B) LLM-rewrite path — the primary event is a single section whose
    //    content is a 400-600 word markdown body with **sub-headings**.
    //    We parse sub-sections so "Pourquoi cela compte" and discussion
    //    questions become their own slides instead of getting truncated.

    // Filter out empty / "Sources" sections
    const contentSections = sections.filter((s) => {
      if (!s.content || s.content.trim().length < 20) return false;
      if (/^sources?$/i.test(s.heading.trim())) return false;
      return true;
    });

    // Collect any student takeaways found across all sections (dedupe later)
    const takeaways: string[] = [];

    // Pre-scan for takeaways so we can reserve a slide slot
    for (const section of contentSections) {
      for (const p of section.content.split(/\n{2,}/)) {
        if (!isTakeawayLine(p)) continue;
        const cleaned = stripMarkdown(p).replace(/^pour les étudiants\s*:\s*/i, "").trim();
        if (cleaned.length >= 20) takeaways.push(cleaned);
      }
    }

    // Reserve 1 content slot for the takeaway slide when we have takeaways
    const contentCap = takeaways.length > 0
      ? MAX_CONTENT_SLIDES - 1
      : MAX_CONTENT_SLIDES;

    for (const section of contentSections) {
      if (slides.length - 1 >= contentCap) break;

      // ── Extract student_takeaway lines before bullet-ising ──────────
      const paragraphs = section.content.split(/\n{2,}/);
      const takeawayParas = paragraphs.filter((p) => isTakeawayLine(p));
      const contentParas = paragraphs.filter((p) => !isTakeawayLine(p) && !isSourceLine(p));
      const cleanedContent = contentParas.join("\n\n");

      // ── Try parsing LLM sub-sections from long content ──────────────
      const subs = cleanedContent.length > 400 ? extractSubSections(cleanedContent) : null;

      if (subs && subs.length >= 2) {
        // LLM body with multiple sub-sections → each becomes its own slide
        for (const sub of subs) {
          if (slides.length - 1 >= contentCap) break;
          // Skip "Questions pour la discussion" on IG (works better in caption)
          if (/questions?\s*(pour|de)\s*(la\s*)?discussion/i.test(sub.heading)) continue;
          const bullets = sectionToBullets(sub.content);
          if (bullets.length === 0) continue;

          slides.push({
            heading: sectionHeading(sub.heading, slides.length - 1),
            bullets,
            layout: "explanation",
            ...(imageUrl ? { backgroundImage: imageUrl } : {}),
          });
        }
      } else {
        // Single section → standard bullet treatment
        const bullets = sectionToBullets(cleanedContent);
        if (bullets.length === 0) continue;

        slides.push({
          heading: sectionHeading(section.heading, slides.length - 1),
          bullets,
          layout: "explanation",
          ...(imageUrl ? { backgroundImage: imageUrl } : {}),
        });
      }
    }

    // ── Featured "Pourquoi c'est important" slide from takeaways ──────
    if (takeaways.length > 0 && slides.length - 1 < MAX_CONTENT_SLIDES) {
      slides.push({
        heading: "Pourquoi c'est important",
        bullets: takeaways.slice(0, MAX_BULLETS_PER_SLIDE)
          .map((t) => shortenText(t, MAX_BULLET_CHARS)),
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  } else {
    // ── Fallback path: extractedText / body / summary sentence splitting ─
    // Used for legacy items that don't have structured sections.
    const rawText = stripMarkdown(item.extractedText ?? bodyText ?? "");
    let facts: string[] = [];

    if (rawText.length > 30) {
      const cleaned = cleanExtractedText(rawText);
      facts = splitSentences(cleaned)
        .filter((s) => s.length >= 20 && s.length <= 250)
        .filter((s) => !isJunkSentence(s))
        .filter((s) => !isSourceLine(s))
        .slice(0, 6);
    }

    // Supplement with summary sentences if needed
    if (facts.length < 3 && summary) {
      const summaryFacts = splitSentences(stripMarkdown(summary))
        .filter((s) => s.length >= 15 && s.length <= 250)
        .filter((s) => !isJunkSentence(s))
        .filter((s) => !isSourceLine(s));
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
      const firstSentence = splitSentences(stripMarkdown(section.content))
        .filter((s) => s.length >= 15 && !isJunkSentence(s) && !isSourceLine(s))[0];
      if (firstSentence) {
        captionParts.push(`📌 ${stripMarkdown(section.heading)}`);
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
