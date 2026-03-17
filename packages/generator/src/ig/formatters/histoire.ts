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
import {
  finalizeCaption,
  buildCTA,
  buildSourceFooter,
  buildSourceLine,
  shortenText,
  shortenHeadline,
  shortenCaptionText,
  type BilingualText,
} from "./helpers.js";
import { isJunkSentence, cleanExtractedText, splitSentences } from "./news.js";

/** Max content slides (excluding cover + source). Keeps carousels digestible. */
const MAX_CONTENT_SLIDES = 5;

/** Max bullets per history slide — tighter, cleaner pacing than dense 3-bullet cards. */
const MAX_BULLETS_PER_SLIDE = 2;

/** Max chars per bullet — enough context without turning slides into paragraphs. */
const MAX_BULLET_CHARS = 180;

// ── Markdown cleanup (IG renders plain text, not markdown) ──────────────────

/**
 * Strip markdown formatting that's invisible on IG slides:
 * **bold** → bold, [text](url) → text, emoji prefixes, etc.
 */
function stripMarkdown(text: string): string {
  return (
    text
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
      .trim()
  );
}

/** Lines matching these patterns are source-attribution noise, not content. */
function isSourceLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return (
    lower.startsWith("sources") ||
    lower.startsWith("📚") ||
    lower.startsWith("source :") ||
    lower.startsWith("source:") ||
    /^\[.+\]\(.+\)(\s*·\s*\[.+\]\(.+\))*$/.test(lower) // pure link list
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
    return h3Parts
      .map((part) => {
        const lines = part.split("\n");
        const heading = stripMarkdown(lines[0]?.trim() ?? "");
        const body = lines.slice(1).join("\n").trim();
        return { heading, content: body };
      })
      .filter((s) => s.content.length >= 20);
  }

  // Try **Bold Heading** at start of paragraph
  const boldParts = content.split(/\n{2,}(?=\*\*[^*]+\*\*)/);
  if (boldParts.length >= 2) {
    return boldParts
      .map((part) => {
        const match = part.match(/^\*\*([^*]+)\*\*\s*[—–:\-]?\s*([\s\S]*)/);
        if (match)
          return { heading: match[1]!.trim(), content: match[2]!.trim() };
        return { heading: "", content: part.trim() };
      })
      .filter((s) => s.content.length >= 20 && s.heading.length > 0);
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
    paragraphs = splitSentences(cleaned).filter(
      (s) => s.length >= 10 && !isJunkSentence(s),
    );
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
  const fallbacks = [
    "Le saviez-vous ?",
    "Contexte",
    "Pour mieux comprendre",
    "En bref",
  ];
  return fallbacks[index] ?? `Partie ${index + 1}`;
}

function chooseHistoryLayout(
  heading: string,
  bullets: string[],
  preferHeadline = false,
): "headline" | "explanation" {
  const totalChars = bullets.reduce((sum, bullet) => sum + bullet.length, 0);
  const shortDeck = bullets.length === 1 && totalChars <= 200;
  const compactBeat =
    bullets.length === 2 &&
    bullets.every((bullet) => bullet.length <= 108) &&
    heading.length <= 56;
  const takeawayBeat =
    /pourquoi|retenir|héritage|impact|conséquence/i.test(heading) &&
    bullets.length <= 2 &&
    totalChars <= 220;

  if (preferHeadline || shortDeck || compactBeat || takeawayBeat) {
    return "headline";
  }

  return "explanation";
}

function pushHistorySlide(
  slides: IGSlide[],
  heading: string,
  bullets: string[],
  imageUrl: string | undefined,
  options?: { preferHeadline?: boolean; footer?: string },
): void {
  const cleanHeading = heading.trim();
  const cleanBullets = bullets
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0);

  if (!cleanHeading && cleanBullets.length === 0) return;

  slides.push({
    heading: cleanHeading,
    bullets: cleanBullets,
    layout: chooseHistoryLayout(
      cleanHeading,
      cleanBullets,
      options?.preferHeadline,
    ),
    ...(options?.footer ? { footer: options.footer } : {}),
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });
}

export function buildHistoireCarousel(
  item: Item,
  bi?: BilingualText,
): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;
  const imageUrl = item.imageUrl ?? undefined;
  const sections = bi?.frSections;
  const bodyText = bi?.frBody;
  const coverDate = formatHistoryCoverDate(item);
  const coverBullets = buildHistoryCoverBullets(item, summary, sections);

  // ══════════════════════════════════════════════════════════════════════
  // Slide 1 — Cover: actual event title as headline, date as footer
  // No backgroundImage on the cover — the clean dark branded gradient looks
  // more editorial. processIgScheduled will propagate the contextual AI image
  // (used for content slides) back to the cover, so all slides stay consistent.
  // ══════════════════════════════════════════════════════════════════════
  slides.push({
    heading: shortenHeadline(title, 12, 100),
    bullets: coverBullets,
    layout: "headline",
    footer: coverDate, // date shown as the small attribution line, not as the headline
    // No backgroundImage — kept intentionally empty so the branded dark gradient shows.
    // Image will be applied consistently by processIgScheduled.
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
        const cleaned = stripMarkdown(p)
          .replace(/^pour les étudiants\s*:\s*/i, "")
          .trim();
        if (cleaned.length >= 20) takeaways.push(cleaned);
      }
    }

    // Reserve 1 content slot for the takeaway slide when we have takeaways
    const contentCap =
      takeaways.length > 0 ? MAX_CONTENT_SLIDES - 1 : MAX_CONTENT_SLIDES;

    for (const section of contentSections) {
      if (slides.length - 1 >= contentCap) break;

      // ── Extract student_takeaway lines before bullet-ising ──────────
      const paragraphs = section.content.split(/\n{2,}/);
      const takeawayParas = paragraphs.filter((p) => isTakeawayLine(p));
      const contentParas = paragraphs.filter(
        (p) => !isTakeawayLine(p) && !isSourceLine(p),
      );
      const cleanedContent = contentParas.join("\n\n");

      // ── Try parsing LLM sub-sections from long content ──────────────
      const subs =
        cleanedContent.length > 400 ? extractSubSections(cleanedContent) : null;

      if (subs && subs.length >= 2) {
        // LLM body with multiple sub-sections → each becomes its own slide
        for (const sub of subs) {
          if (slides.length - 1 >= contentCap) break;
          // Skip "Questions pour la discussion" on IG (works better in caption)
          if (/questions?\s*(pour|de)\s*(la\s*)?discussion/i.test(sub.heading))
            continue;
          const bullets = sectionToBullets(sub.content);
          if (bullets.length === 0) continue;

          pushHistorySlide(
            slides,
            sectionHeading(sub.heading, slides.length - 1),
            bullets,
            imageUrl,
            {
              preferHeadline:
                /pourquoi cela compte|pourquoi c'est important/i.test(
                  sub.heading,
                ),
            },
          );
        }
      } else {
        // Single section → standard bullet treatment
        const bullets = sectionToBullets(cleanedContent);
        if (bullets.length === 0) continue;

        pushHistorySlide(
          slides,
          sectionHeading(section.heading, slides.length - 1),
          bullets,
          imageUrl,
        );
      }
    }

    // ── Featured "Pourquoi c'est important" slide from takeaways ──────
    if (takeaways.length > 0 && slides.length - 1 < MAX_CONTENT_SLIDES) {
      pushHistorySlide(
        slides,
        "Pourquoi c'est important",
        takeaways
          .slice(0, MAX_BULLETS_PER_SLIDE)
          .map((t) => shortenText(t, MAX_BULLET_CHARS)),
        imageUrl,
        { preferHeadline: takeaways.length === 1 },
      );
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
      const chunkSize = Math.min(
        MAX_BULLETS_PER_SLIDE,
        Math.ceil(facts.length / 2),
      );
      const headings = ["Le saviez-vous ?", "Pour mieux comprendre", "En bref"];
      let slideIdx = 0;

      for (let i = 0; i < facts.length && slideIdx < 3; i += chunkSize) {
        const chunk = facts.slice(i, i + chunkSize);
        pushHistorySlide(
          slides,
          headings[slideIdx] ?? `Partie ${slideIdx + 1}`,
          chunk.map((f) => shortenText(f, MAX_BULLET_CHARS)),
          imageUrl,
        );
        slideIdx++;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Last slide — Source / CTA
  // ══════════════════════════════════════════════════════════════════════
  const sourceLine = buildSourceLine(item);
  const sourceFooter = buildSourceFooter(item);

  // Ensure last content slide has the source footer
  if (slides.length > 1) {
    slides[slides.length - 1]!.footer = sourceFooter;
  } else {
    // Only cover exists — add a dedicated source slide
    slides.push({
      heading: "Source",
      bullets: [sourceFooter],
      layout: "explanation",
      footer: sourceFooter,
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Caption — rich, bilingual, section-aware
  // ══════════════════════════════════════════════════════════════════════
  const captionParts: string[] = [title, ""];
  const captionLead = summary
    ? shortenCaptionText(summary, 320)
    : coverBullets.length > 0
      ? shortenCaptionText(coverBullets.join(" "), 240)
      : "";

  if (captionLead) {
    captionParts.push(captionLead, "");
  }

  for (const slide of slides.slice(1, 5)) {
    if (!slide.heading || slide.heading === "Source") continue;
    const lead = slide.bullets[0];
    if (!lead) continue;
    captionParts.push(`• ${slide.heading}`);
    captionParts.push(shortenCaptionText(lead, 170));
    captionParts.push("");
  }

  if (bi?.htSummary)
    captionParts.push(`🇭🇹 ${shortenCaptionText(bi.htSummary, 300)}`, "");

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

  return { slides, caption: finalizeCaption(captionParts.join("\n")) };
}

function buildHistoryCoverBullets(
  item: Item,
  summary: string,
  sections?: { heading: string; content: string }[],
): string[] {
  // Return 1-2 clean essence sentences that convey what the story is about.
  // No boilerplate prefix like "Dans l'histoire d'Haïti" — the HISTOIRE pill
  // label on the slide already provides that context.
  const summaryLines = buildHistorySummaryLines(sections, summary);
  const outlineLine = buildHistoryOutlineLine(sections);
  const lines: string[] = [];

  if (summaryLines[0]) {
    lines.push(summaryLines[0]);
  }

  if (outlineLine && lines.length < 2) {
    lines.push(outlineLine);
  }

  for (const line of summaryLines.slice(1)) {
    if (lines.length >= 2) break;
    if (lines.includes(line)) continue;
    lines.push(line);
  }

  if (lines.length === 0 && item.title) {
    lines.push(shortenText(item.title, 120));
  }

  return lines;
}

function buildHistoryOutlineLine(
  sections: { heading: string; content: string }[] | undefined,
): string | null {
  const headings = (sections ?? [])
    .map((section) =>
      stripMarkdown(section.heading)
        .replace(/^🎉\s*/u, "")
        .replace(/\s*\((?:\d{3,4}|[\d–-]{5,9})\)\s*$/u, "")
        .trim(),
    )
    .filter((heading) => heading.length >= 4 && !/^sources?$/i.test(heading))
    .slice(0, 3);

  if (headings.length < 2) return null;

  return shortenText(`Repères : ${headings.join(" • ")}`, 105);
}

function buildHistorySummaryLines(
  sections: { heading: string; content: string }[] | undefined,
  fallbackSummary: string,
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  if (fallbackSummary) {
    const summarySentences = splitSentences(stripMarkdown(fallbackSummary));
    for (const sentence of summarySentences) {
      const candidate = shortenText(sentence, 105);
      const key = candidate.toLowerCase();
      if (!candidate || seen.has(key)) continue;
      seen.add(key);
      lines.push(candidate);
      if (lines.length >= 3) break;
    }
  }

  for (const section of sections ?? []) {
    const firstSentence = splitSentences(stripMarkdown(section.content)).filter(
      (sentence) =>
        sentence.length >= 18 &&
        !isJunkSentence(sentence) &&
        !isSourceLine(sentence),
    )[0];
    const candidate = shortenText(firstSentence ?? section.heading, 105);
    const key = candidate.toLowerCase();
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    lines.push(candidate);
    if (lines.length >= 3) break;
  }

  return lines;
}

function formatHistoryCoverDate(item: Item): string {
  const date = toItemDate(item);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Port-au-Prince",
  })
    .format(date)
    .toUpperCase();
}

function toItemDate(item: Item): Date {
  const raw = item.publishedAt as
    | { seconds?: number; _seconds?: number }
    | Date
    | null
    | undefined;
  if (raw instanceof Date) return raw;
  const seconds = raw?.seconds ?? raw?._seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  return new Date();
}
