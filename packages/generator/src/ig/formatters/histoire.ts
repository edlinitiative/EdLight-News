/**
 * IG Formatter – Histoire carousel
 *
 * Designed for HaitiHistory, HaitiFactOfTheDay, HaitianOfTheWeek utility items.
 *
 * Story-arc structure (up to 8 slides):
 *   Slide 1 — Cover: "27 Mars 1796" date+year + main event title as subtitle
 *   Slides 2-6 — Content: narrative arc (frNarrative) OR first section only
 *   Slide N-1 — Other facts: bullet list of additional events on the same date
 *   Last slide — Premium CTA + source
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
  buildSourceFooter,
  buildSourceLine,
  shortenText,
  shortenHeadline,
  shortenCaptionText,
  type BilingualText,
} from "./helpers.js";
import { isJunkSentence, cleanExtractedText, splitSentences, narrativeToSlides } from "./news.js";

/** Max content slides (excluding cover + source). Keeps carousels digestible. */
const MAX_CONTENT_SLIDES = 5;

/**
 * Background image for the premium closing CTA slide.
 * Sans-Souci Palace — another iconic Haitian historical landmark,
 * distinct from the Citadelle used by news CTAs.
 */
const HISTOIRE_CTA_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Sans-Souci_Palace_Haiti_%288070547181%29.jpg/1280px-Sans-Souci_Palace_Haiti_%288070547181%29.jpg";

/** Max bullets per history slide — tighter, cleaner pacing than dense 3-bullet cards. */
const MAX_BULLETS_PER_SLIDE = 2;

/** Max chars per bullet — must fit within 3-line CSS clamp at 32px/900px. */
const MAX_BULLET_CHARS = 140;

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

function isCommentaryHeading(heading: string): boolean {
  return /pourquoi|importance|important|héritage|heritage|impact|conséquence|consequence|discussion|question|leçon|lesson/i.test(
    stripMarkdown(heading),
  );
}

function isGenericHistoryHeading(heading: string): boolean {
  return /^(l['’]histoire|histoire du jour|contexte|chronologie|repères?|le saviez-vous|pour mieux comprendre|en bref|parcours|déroulement|les faits|sources?)$/i.test(
    stripMarkdown(heading).trim(),
  );
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
    .filter((p) => !isSourceLine(p.trim()) && !isTakeawayLine(p.trim()))
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
 * Extract the first historical year (1600–2029) from section content.
 * Used to anchor event headings in time on both slides and captions.
 */
function extractYearFromContent(content: string): string | null {
  const match = content.match(/\b(1[6-9]\d{2}|20[0-2]\d)\b/);
  return match ? match[1]! : null;
}

/**
 * Normalize a caption title, replacing numeric date patterns (e.g. "25/03")
 * with French month names (e.g. "25 mars").
 */
function normalizeHistoireCaptionDate(title: string): string {
  const MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return title.replace(/\b(\d{1,2})\/(\d{2})\b/g, (_m, day: string, month: string) => {
    const mo = MONTHS_FR[parseInt(month, 10) - 1];
    return mo ? `${parseInt(day, 10)} ${mo}` : _m;
  });
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

/**
 * Derive a short, unique heading from a sentence for a content slide.
 * Extracts the year (if present) + first clause/fragment for a punchy label.
 */
function deriveSlideHeading(sentence: string, slideIndex: number): string {
  const yearMatch = sentence.match(/\b(1[6-9]\d{2}|20[0-2]\d)\b/);
  const year = yearMatch ? yearMatch[1] : null;

  // Try clause boundary (before a comma, dash, or "qui/que/dont")
  const clauseRe = /^(.{15,60}?)(?:[,;]\s|\s[—–]\s|\squi\s|\sque\s|\sdont\s)/;
  const clauseMatch = sentence.match(clauseRe);
  let fragment = clauseMatch
    ? clauseMatch[1]!.trim().replace(/[,;:\s]+$/, "")
    : null;

  // Fallback: no clause boundary found → use a short editorial label.
  // Word-boundary truncation produces broken fragments like
  // "Les domaines spécifiques de cette formation ne sont" which read
  // as a mid-sentence cut, not a slide heading.
  const FALLBACK_LABELS = ["En contexte", "La suite", "À retenir", "En bref"];
  const fallbackLabel = FALLBACK_LABELS[slideIndex % FALLBACK_LABELS.length] ?? `Partie ${slideIndex + 1}`;
  if (!fragment) {
    return year ? `${year} — ${fallbackLabel}` : fallbackLabel;
  }

  // If we have a year that isn't already in the fragment, prefix it
  if (year && !fragment.includes(year)) {
    return shortenHeadline(`${year} — ${fragment}`, 8);
  }
  return shortenHeadline(fragment, 8);
}

/**
 * Synthesise a continuous narrative arc from the first content section's body
 * text and split it into explanation slides using narrativeToSlides().
 *
 * histoire items are produced by historyPublisher (not the news pipeline) so
 * they never receive an explicit frNarrative. This function recreates the same
 * result on-the-fly:
 *   1. Strip markdown and noise (takeaway / source lines) from the section body.
 *   2. Flatten any LLM sub-sections so we get one pool of text.
 *   3. Sentence-split, filter junk, take the best 5 sentences.
 *   4. Join and pass to narrativeToSlides() for consistent slide layout.
 */
/** Returns true when ≥3 content words (len > 4) from sentence appear in coverText. */
function overlapsCoverBullet(sentence: string, coverText: string): boolean {
  const words = (t: string) =>
    new Set(
      t.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );
  const sW = words(sentence);
  const cW = words(coverText);
  let overlap = 0;
  for (const w of sW) if (cW.has(w)) overlap++;
  return overlap >= 3;
}

function buildHistoireNarrativeSlides(
  contentSections: { heading: string; content: string }[],
  imageUrl: string | undefined,
  coverBulletText?: string,
): IGSlide[] {
  if (contentSections.length === 0) return [];

  const mainSection = contentSections[0]!;

  // Strip takeaway / source noise from paragraphs
  const paragraphs = mainSection.content.split(/\n{2,}/);
  const contentParas = paragraphs.filter(
    (p) => !isTakeawayLine(p) && !isSourceLine(p),
  );
  const cleanedBody = contentParas.join(" ");

  // Flatten LLM sub-sections if present so we get a single sentence pool
  const subs = cleanedBody.length > 400 ? extractSubSections(cleanedBody) : null;
  const rawText =
    subs && subs.length >= 2
      ? subs
          .filter(
            (s) =>
              !isCommentaryHeading(s.heading) &&
              !/questions?\s*(pour|de)\s*(la\s*)?discussion/i.test(s.heading),
          )
          .map((s) => s.content)
          .join(" ")
      : cleanedBody;

  // Sentences that admit missing data must not appear on published slides.
  const DATA_MISSING_RE =
    /\b(pas|non)\s+(disponible|détaillé|précisé|mentionné|indiqué|fourni|spécifié|inclus?|abordé)\b/i;

  const sentences = splitSentences(stripMarkdown(rawText))
    .filter((s) => s.length >= 25 && s.length <= 180)
    .filter((s) => !isJunkSentence(s))
    .filter((s) => !isSourceLine(s))
    .filter((s) => !DATA_MISSING_RE.test(s))
    // Skip sentences that duplicate the cover bullet — prevents the same
    // sentence appearing as slide 1 bullet AND slide 2 bullet 1.
    .filter((s) => !coverBulletText || !overlapsCoverBullet(s, coverBulletText))
    .slice(0, 5);

  if (sentences.length === 0) return [];

  // Group into slides: MAX_BULLETS_PER_SLIDE sentences per slide, each sentence
  // as its own bullet capped at MAX_BULLET_CHARS. This prevents joining 3 sentences
  // into a single 300-400 char mega-bullet that overflows the slide.
  //
  // Vary the heading per slide to avoid "Bataille de Santiago" repeating 3×.
  // Slide 0 uses the section heading; subsequent slides derive a short heading
  // from the first sentence of that chunk (year + key noun phrase).
  const paraSlides: IGSlide[] = [];
  for (let i = 0; i < sentences.length; i += MAX_BULLETS_PER_SLIDE) {
    const chunk = sentences.slice(i, i + MAX_BULLETS_PER_SLIDE);
    const slideIndex = Math.floor(i / MAX_BULLETS_PER_SLIDE);
    let heading: string;
    if (slideIndex === 0) {
      heading = sectionHeading(mainSection.heading, 0);
    } else {
      // Derive a unique heading from the chunk's first sentence.
      // Extract a year if present, then take the first clause.
      const firstSent = chunk[0] ?? "";
      heading = deriveSlideHeading(firstSent, slideIndex);
    }
    paraSlides.push({
      heading,
      bullets: chunk.map((s) => shortenText(s, MAX_BULLET_CHARS)),
      layout: "explanation",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }
  return paraSlides;
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

  // Pre-filter content sections — needed for cover, content slides, and the other-facts slide.
  const contentSections = (sections ?? []).filter((s) => {
    if (!s.content || s.content.trim().length < 20) return false;
    if (/^sources?$/i.test(s.heading.trim())) return false;
    if (isCommentaryHeading(s.heading)) return false;
    return true;
  });

  // Cover heading: formatted date ("27 Mars") + year from the main event ("1796").
  const dateLabel = buildHistoryCoverHeading(item);
  const mainEventYear =
    contentSections.length > 0
      ? extractYearFromContent(contentSections[0]!.content)
      : null;
  const coverHeading = mainEventYear ? `${dateLabel} ${mainEventYear}` : dateLabel;

  // Cover bullets: first bullet becomes the deck (supportLine) on the cover;
  // additional bullets become body text for a richer, more polished cover slide.
  // Uses buildHistorySummaryLines to pull 2–3 concise facts from sections + summary.
  const mainEventRawTitle =
    contentSections.length > 0
      ? normalizeHistoryEventHeading(contentSections[0]!.heading)
      : (title ?? summary);
  const mainEventFirstSentence =
    contentSections.length > 0
      ? splitSentences(
          stripMarkdown(contentSections[0]!.content.split(/\n{2,}/)[0] ?? ""),
        ).find((s) => s.length >= 20 && !isJunkSentence(s) && !isSourceLine(s))
      : null;

  // Deck line (first bullet → supportLine): the main event's first sentence
  const deckLine = mainEventFirstSentence
    ? shortenText(mainEventFirstSentence, 140)
    : mainEventRawTitle
      ? shortenText(mainEventRawTitle, 120)
      : "";

  // Summary facts (bullets 1+): additional key facts for a richer cover
  const summaryFacts = buildHistorySummaryLines(
    contentSections.slice(0, 3),
    summary ?? "",
  ).filter((line) => line !== deckLine && !overlapsCoverBullet(line, deckLine));

  const coverBullets = [
    ...(deckLine ? [deckLine] : []),
    ...summaryFacts.slice(0, 2),
  ];

  // ══════════════════════════════════════════════════════════════════════
  // Slide 1 — Cover: date + year heading, main event title as subtitle, full-bleed image
  // ══════════════════════════════════════════════════════════════════════
  slides.push({
    heading: coverHeading,
    bullets: coverBullets,
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ══════════════════════════════════════════════════════════════════════
  // Content slides — narrative-first (frNarrative), then first section only
  // ONE main fact per post: other events are summarised on the "other facts" slide.
  // ══════════════════════════════════════════════════════════════════════

  if (bi?.frNarrative && bi.frNarrative.trim().length > 0) {
    // ── Priority 1: explicit narrative stored on the ContentVersion ──────
    slides.push(...narrativeToSlides(bi.frNarrative, imageUrl));
  } else if (contentSections.length > 0) {
    // ── Priority 2: synthesise a narrative from the main section body ────
    // histoire items are generated by historyPublisher (not the news
    // pipeline) so frNarrative is never populated. We build it on-the-fly
    // by sentence-splitting the first section's body, then feed those
    // sentences into narrativeToSlides() — same visual result, no LLM call.
    const synthesised = buildHistoireNarrativeSlides(contentSections, imageUrl, coverBullets[0]);
    if (synthesised.length > 0) {
      slides.push(...synthesised);
    } else {
      // ── Priority 3: structured bullets from the first section ──────────
      const mainSection = contentSections[0]!;
      const paragraphs = mainSection.content.split(/\n{2,}/);
      const contentParas = paragraphs.filter(
        (p) => !isTakeawayLine(p) && !isSourceLine(p),
      );
      const cleanedContent = contentParas.join("\n\n");

      const subs =
        cleanedContent.length > 400 ? extractSubSections(cleanedContent) : null;

      if (subs && subs.length >= 2) {
        for (const sub of subs) {
          if (slides.length - 1 >= MAX_CONTENT_SLIDES) break;
          if (
            /questions?\s*(pour|de)\s*(la\s*)?discussion/i.test(sub.heading) ||
            isCommentaryHeading(sub.heading)
          ) continue;
          const bullets = sectionToBullets(sub.content);
          if (bullets.length === 0) continue;
          pushHistorySlide(
            slides,
            sectionHeading(sub.heading, slides.length - 1),
            bullets,
            imageUrl,
          );
        }
      } else {
        const bullets = sectionToBullets(cleanedContent);
        if (bullets.length > 0) {
          const resolvedHeading = sectionHeading(mainSection.heading, slides.length - 1);
          const headingYear =
            !isGenericHistoryHeading(resolvedHeading) &&
            !/\b1[0-9]{3}\b/.test(resolvedHeading)
              ? extractYearFromContent(cleanedContent)
              : null;
          const headingWithYear = headingYear
            ? `${headingYear} — ${resolvedHeading}`
            : resolvedHeading;
          pushHistorySlide(slides, headingWithYear, bullets, imageUrl);
        }
      }
    }
  } else {
    // ── Fallback: extractedText / body / summary sentence splitting ─────
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
  // Second-to-last slide — Other events on this date (bullet summary)
  // ══════════════════════════════════════════════════════════════════════
  const otherSections = contentSections
    .slice(1)
    .filter((s) => !isGenericHistoryHeading(s.heading));

  if (otherSections.length > 0) {
    const otherBullets = otherSections
      .slice(0, 3)
      .map((s) => {
        const firstSentence = splitSentences(
          stripMarkdown(s.content.split(/\n{2,}/)[0] ?? ""),
        ).find((sent) => sent.length >= 20 && !isJunkSentence(sent) && !isSourceLine(sent));
        if (firstSentence) return shortenText(firstSentence, 130);
        // Fallback to year-prefixed heading if content has no usable sentence.
        const heading = normalizeHistoryEventHeading(s.heading);
        if (!heading) return null;
        const year = /\b1[0-9]{3}\b/.test(heading)
          ? null
          : extractYearFromContent(s.content);
        return year
          ? shortenText(`${year} — ${heading}`, 115)
          : shortenText(heading, 115);
      })
      .filter((b): b is string => !!b);

    if (otherBullets.length > 0) {
      // Heading: "Aussi le 27 mars" — makes clear these are same calendar day, different years.
      const dateLabel = buildHistoryCoverHeading(item); // e.g. "27 Mars"
      slides.push({
        heading: `Aussi le ${dateLabel}`,
        bullets: otherBullets,
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Last slide — Premium cinematic CTA (Citadelle background, Litquidity-style)
  // ══════════════════════════════════════════════════════════════════════
  const sourceLine = buildSourceLine(item);
  const sourceFooter = buildSourceFooter(item);
  const premiumHistoryCTA = "Suivez EdLight News pour d'autres repères historiques.";

  // Source attribution on the last content slide (before CTA), so attribution
  // is visible even for users who don't read the caption.
  if (slides.length > 1 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = sourceFooter;
  }

  slides.push({
    heading: "Suivez-nous pour plus de repères historiques",
    bullets: ["L'histoire d'Haïti, chaque jour."],
    layout: "cta",
    backgroundImage: HISTOIRE_CTA_IMAGE,
  });

  // ══════════════════════════════════════════════════════════════════════
  // Caption — rich, bilingual, section-aware
  // ══════════════════════════════════════════════════════════════════════
  // Normalize numeric date patterns in the title ("25/03" → "25 mars").
  const captionTitle = normalizeHistoireCaptionDate(title);
  const captionParts: string[] = [captionTitle, ""];

  // Prefer the stored summary, but fall back to the first clean sentence from
  // section content for legacy items where summary was hard-sliced mid-sentence.
  const rawSummary = summary ?? "";
  const summaryIsBroken =
    rawSummary.length > 0 && !/[.!?»]\s*$/.test(rawSummary.trimEnd());
  const captionLeadSource: string = (() => {
    if (rawSummary && !summaryIsBroken) return rawSummary;
    // Derive from first section: take sentences until we have ≥80 chars or run out.
    const sectionText = contentSections[0]?.content ?? "";
    const sentences = splitSentences(stripMarkdown(sectionText))
      .filter((s) => s.length >= 15 && !isJunkSentence(s) && !isSourceLine(s));
    const lead = sentences.slice(0, 2).join(" ");
    return lead || rawSummary; // last resort: use broken summary anyway
  })();
  const captionLead = captionLeadSource
    ? shortenCaptionText(captionLeadSource, 320)
    : coverBullets.length > 0
      ? shortenCaptionText(coverBullets.join(" "), 240)
      : "";

  if (captionLead) {
    captionParts.push(captionLead, "");
  }

  // Caption bullets — first complete sentence of each section (the almanac summary),
  // prefixed with the year when not already present in the sentence.
  if (contentSections.length > 0) {
    const bullets: string[] = [];
    for (const section of contentSections.slice(0, 4)) {
      const heading = normalizeHistoryEventHeading(section.heading);
      if (!heading || isGenericHistoryHeading(heading)) continue;

      const firstSentence = splitSentences(
        stripMarkdown(section.content.split(/\n{2,}/)[0] ?? ""),
      ).find((s) => s.length >= 20 && !isJunkSentence(s) && !isSourceLine(s));

      if (!firstSentence) continue;

      // Prepend year only if the sentence contains no year at all.
      // Uses the same pattern as the "other facts" slide builder.
      const hasYear = /\b1[0-9]{3}\b/.test(firstSentence);
      const year = hasYear ? null : extractYearFromContent(section.content);
      const bullet = year
        ? `${year} — ${firstSentence}`
        : firstSentence;

      // No truncation: firstSentence is already a single complete sentence from
      // splitSentences(). finalizeCaption() enforces the 2200-char IG cap overall.
      bullets.push(`• ${bullet}`);
    }
    if (bullets.length > 0) {
      captionParts.push(bullets.join("\n"), "");
    }
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

  captionParts.push("", premiumHistoryCTA, "", sourceLine);

  return { slides, caption: finalizeCaption(captionParts.join("\n")) };
}

function buildHistoryCoverBullets(
  item: Item,
  summary: string,
  sections?: { heading: string; content: string }[],
): string[] {
  const eventLines = buildHistoryEventLines(sections);
  if (eventLines.length > 0) return eventLines;

  const summaryLines = buildHistorySummaryLines(sections, summary);
  const lines: string[] = [];

  if (summaryLines[0]) {
    lines.push(summaryLines[0]);
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

function buildHistoryEventLines(
  sections: { heading: string; content: string }[] | undefined,
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const section of sections ?? []) {
    const heading = normalizeHistoryEventHeading(section.heading);
    if (!heading) continue;
    if (isGenericHistoryHeading(heading)) continue;
    if (isCommentaryHeading(heading)) continue;

    // Prepend year from section content when not already present in the heading
    // so cover bullets clearly anchor events in time (e.g. "1802 — Paix d'Amiens").
    let labelledHeading = heading;
    if (!/\b1[0-9]{3}\b/.test(heading)) {
      const year = extractYearFromContent(section.content);
      if (year) {
        labelledHeading = `${year} — ${heading}`;
      }
    }

    const candidate = shortenText(labelledHeading, 115);
    const key = heading.toLowerCase(); // dedupe by base heading, not the year prefix
    if (seen.has(key)) continue;

    seen.add(key);
    lines.push(candidate);

    if (lines.length >= MAX_BULLETS_PER_SLIDE) break;
  }

  return lines;
}

function normalizeHistoryEventHeading(heading: string): string {
  return stripMarkdown(heading)
    .replace(/^🎉\s*/u, "")
    .trim();
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
      const candidate = shortenText(sentence, 150);
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
    const candidate = shortenText(firstSentence ?? section.heading, 150);
    const key = candidate.toLowerCase();
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    lines.push(candidate);
    if (lines.length >= 3) break;
  }

  return lines;
}

function buildHistoryCoverHeading(item: Item): string {
  return formatHistoryHeadingDate(item);
}

function formatHistoryHeadingDate(item: Item): string {
  const date = toItemDate(item);
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Port-au-Prince",
  }).format(date);

  return formatted.replace(
    /^(\d+\s+)(\p{L})/u,
    (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
  );
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
