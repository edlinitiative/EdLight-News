/**
 * @edlight-news/renderer – Rewrite / Compression Engine
 *
 * Shortens text intelligently when copy limits or measurement checks fail.
 *
 * Rewriting order (IG_COPILOT.md §5.6):
 *   1. Remove filler words / phrases
 *   2. Shorten headline phrasing (cut dependent clauses first)
 *   3. Compress body (move last sentence to caption)
 *   4. Hard word-trim if still failing
 *
 * Hard rule:
 *   Never solve overflow by shrinking the font below minFontSize.
 *   If text cannot fit, shorten the text.
 */

import type { SlideContent } from "../types/post.js";
import { getTemplateConfig } from "../config/templateLimits.js";
import { validateSlide } from "./validateCopyLimits.js";
import { measureSlide } from "./measureText.js";

// ── Filler word/phrase tables ─────────────────────────────────────────────────
// These phrases carry no critical semantic content in news copy
// and can be removed without changing the meaning of the sentence.

const FILLER_FR = [
  "également", "notamment", "ainsi que", "ainsi", "donc", "toutefois",
  "néanmoins", "cependant", "effectivement", "vraiment", "très",
  "assez", "particulièrement", "réellement", "simplement",
  "actuellement", "récemment", "désormais", "dorénavant", "par ailleurs",
  "en effet", "il convient de noter que", "il faut noter que",
  "il est important de", "selon les experts", "bien évidemment",
  "bien sûr", "afin de", "à cet égard", "dans ce cadre",
  "c'est ainsi que", "on peut noter que", "force est de constater que",
];

const FILLER_EN = [
  "also", "however", "therefore", "thus", "moreover", "furthermore",
  "additionally", "indeed", "actually", "quite", "very", "really",
  "particularly", "notably", "essentially", "basically", "simply",
  "currently", "recently", "it should be noted that",
  "it is important to note that", "it is worth noting that",
  "according to experts", "of course", "in this regard",
  "in order to", "as a matter of fact",
];

const FILLER_HT = [
  // Discourse markers & connectors
  "menm", "nan tèt", "an plis", "sepandan", "kidonk", "poutèt sa",
  "malgre tout", "pou tout sa", "antouka", "dayè", "finalman",
  "anfèt", "vrèman", "tout bon vre", "natirèlman", "evidaman",
  // Hedging & filler phrases
  "fòk nou note ke", "li enpòtan pou note ke", "sa vle di ke",
  "jan nou konnen", "selon espè yo", "nan kad sa a",
  // Redundant intensifiers
  "anpil anpil", "vrèman vre", "totalman", "konplètman",
  // Transitional phrases
  "nan menm lòd lide sa a", "pou sa ki konsène", "ann gade",
];

// ── Public API ────────────────────────────────────────────────────────────────

export interface RewriteResult {
  /** The (potentially shortened) slide content. */
  slide: SlideContent;
  /** Text snippets that were moved out to caption (caller appends these). */
  overflowedToCaption: string[];
  /** Number of rewrite passes that changed something. */
  rewriteCount: number;
  /** True if at least one pass altered the slide copy. */
  wasRewritten: boolean;
}

/**
 * Attempt to compress a slide's copy until it passes copy-limit validation
 * and pixel-level text measurement.
 *
 * Runs up to `maxPasses` rewrite iterations.  Returns the shortest version
 * that fits, along with any text moved to the caption.
 *
 * @param slide      The slide to rewrite.
 * @param templateId Template ID (for limit and zone lookup).
 * @param maxPasses  Max rewrite iterations before giving up (default: 4).
 * @param language   Preferred language code (fr/ht/en) for accurate measurement.
 */
export function rewriteSlideCopy(
  slide: SlideContent,
  templateId: string,
  maxPasses = 4,
  language?: string,
): RewriteResult {
  let current: SlideContent = { ...slide };
  const overflowedToCaption: string[] = [];
  let rewriteCount = 0;

  for (let pass = 0; pass < maxPasses; pass++) {
    // Check if we already pass all constraints
    const validation = validateSlide(current, templateId);
    const config = getTemplateConfig(templateId);
    const fitResults = measureSlide(current, config, language);
    const measureFailed = fitResults.some(r => !r.fits);

    if (validation.passed && !measureFailed) break;

    const before = snapshotFields(current);

    switch (pass) {
      // Pass 0: strip filler words (cheap, non-destructive)
      case 0:
        current = applyFillerStrip(current);
        break;

      // Pass 1: shorten headline by removing dependent clauses
      case 1: {
        const cfg = getTemplateConfig(templateId);
        current = applyHeadlineShorten(current, cfg.zones.headline.limits.maxWords ?? 16);
        break;
      }

      // Pass 2: compress body, moving last sentence to caption
      case 2: {
        const cfg = getTemplateConfig(templateId);
        const bodyZone = cfg.zones.body;
        const maxWords = bodyZone?.limits.maxWords ?? 40;
        const { slide: compressed, moved } = applyBodyCompress(current, maxWords);
        current = compressed;
        if (moved) overflowedToCaption.push(moved);
        break;
      }

      // Pass 3: hard word-count truncation (last resort)
      default: {
        const cfg = getTemplateConfig(templateId);
        current = applyHardTruncate(current, cfg);
        break;
      }
    }

    if (hasChanged(before, snapshotFields(current))) rewriteCount++;
  }

  return {
    slide: current,
    overflowedToCaption,
    rewriteCount,
    wasRewritten: rewriteCount > 0,
  };
}

// ── Rewrite pass implementations ──────────────────────────────────────────────

/** Pass 0 — Strip known filler words/phrases from all text fields. */
function applyFillerStrip(slide: SlideContent): SlideContent {
  return {
    ...slide,
    headline: stripFiller(slide.headline),
    body: slide.body != null ? stripFiller(slide.body) : undefined,
    supportLine: slide.supportLine != null ? stripFiller(slide.supportLine) : undefined,
    sourceLine: slide.sourceLine != null ? stripFiller(slide.sourceLine) : undefined,
  };
}

function stripFiller(text: string): string {
  let out = text;

  // Apply all filler lists (longest first to avoid partial matches)
  const allFillers = [
    ...FILLER_FR.sort((a, b) => b.length - a.length),
    ...FILLER_EN.sort((a, b) => b.length - a.length),
    ...FILLER_HT.sort((a, b) => b.length - a.length),
  ];

  for (const filler of allFillers) {
    // Word-boundary regex — case-insensitive
    const re = new RegExp(`(?<![\\w])${escapeRegex(filler)}(?![\\w])`, "gi");
    out = out.replace(re, " ");
  }

  // Collapse consecutive spaces and clean up punctuation artefacts
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;:!?.])/g, "$1")
    .replace(/^[,;: ]+/, "")
    .trim();

  return out || text; // Never return empty string
}

/** Pass 1 — Shorten headline by removing a trailing dependent clause. */
function applyHeadlineShorten(slide: SlideContent, maxWords: number): SlideContent {
  const words = slide.headline.trim().split(/\s+/);
  if (words.length <= maxWords) return slide;

  // Strategy A: cut at last clause separator (comma / colon / em-dash)
  const clauseRe = /^(.{20,}?)(?:\s*[,:]|—|–|-)\s*.{10,}$/;
  const match = slide.headline.match(clauseRe);
  if (match?.[1]) {
    const clauseWords = match[1].trim().split(/\s+/);
    if (clauseWords.length <= maxWords && clauseWords.length >= 4) {
      return { ...slide, headline: match[1].trim() };
    }
  }

  // Strategy B: hard word count trim
  return { ...slide, headline: words.slice(0, maxWords).join(" ") };
}

/** Pass 2 — Compress body by moving the last sentence to the caption. */
function applyBodyCompress(
  slide: SlideContent,
  maxWords: number,
): { slide: SlideContent; moved?: string } {
  if (!slide.body) return { slide };

  const words = slide.body.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return { slide };

  // Split on sentence boundaries
  const sentences = slide.body.split(/(?<=[.!?»])\s+/).filter(Boolean);

  if (sentences.length > 1) {
    // Move last sentence to caption
    const main = sentences.slice(0, -1).join(" ");
    const moved = sentences[sentences.length - 1]!;
    return { slide: { ...slide, body: main }, moved };
  }

  // Single sentence — word-trim, move remainder to caption
  const main = words.slice(0, maxWords).join(" ");
  const moved = words.slice(maxWords).join(" ");
  return { slide: { ...slide, body: main }, moved: moved || undefined };
}

/** Pass 3 — Hard word-count truncation on all fields that exceed limits. */
function applyHardTruncate(
  slide: SlideContent,
  config: ReturnType<typeof getTemplateConfig>,
): SlideContent {
  const result = { ...slide };

  const hlMax = config.zones.headline.limits.maxWords;
  if (hlMax != null) {
    const words = slide.headline.split(/\s+/).filter(Boolean);
    if (words.length > hlMax) result.headline = words.slice(0, hlMax).join(" ");
  }

  const bodyZone = config.zones.body;
  const bodyMax = bodyZone?.limits.maxWords;
  const pbMax = bodyZone?.limits.perBulletMaxLines;

  if (pbMax && slide.body && /[•\n]/.test(slide.body)) {
    // Per-bullet truncation: cap each bullet to fit its CSS line-clamp.
    // Cover facts use tighter clamp (2 lines) than detail bullets (3 lines).
    const bulletClamp = slide.layoutVariant === "cover" ? Math.min(pbMax, 2) : pbMax;
    // Conservative estimate: Inter avgWidthCoeff=0.53 × FR scale 1.04 ≈ 0.55,
    // plus ~12% word-wrap overhead → use 0.62 for safe truncation target.
    const charsPerLine = Math.floor((bodyZone!.box.width) / (bodyZone!.fontSize * 0.62));
    const maxCharsPerBullet = charsPerLine * bulletClamp;
    const parts = slide.body.split(/\n/);
    const truncated = parts.map(part => {
      const clean = part.replace(/^•\s*/, "").trim();
      if (!clean || clean.length <= maxCharsPerBullet) return part;
      const words = clean.split(/\s+/);
      let built = "";
      for (const w of words) {
        const next = built ? built + " " + w : w;
        if (next.length > maxCharsPerBullet - 1) break;
        built = next;
      }
      const prefix = part.startsWith("•") ? "• " : "";
      return prefix + built;
    });
    result.body = truncated.join("\n");
  } else if (bodyMax != null && slide.body) {
    const words = slide.body.split(/\s+/).filter(Boolean);
    if (words.length > bodyMax) result.body = words.slice(0, bodyMax).join(" ");
  }

  const slZone = config.zones.supportLine;
  const slMax = slZone?.limits.maxWords;
  if (slMax != null && slide.supportLine) {
    const words = slide.supportLine.split(/\s+/).filter(Boolean);
    if (words.length > slMax) result.supportLine = words.slice(0, slMax).join(" ");
  }

  // sourceLine: truncate to maxChars (preferred) or maxWords
  const srcZone = config.zones.sourceLine;
  if (srcZone && slide.sourceLine) {
    const maxChars = srcZone.limits.maxChars;
    const srcMax = srcZone.limits.maxWords;
    if (maxChars != null && slide.sourceLine.length > maxChars) {
      // Smart truncate: keep "Source: " prefix, trim name
      result.sourceLine = slide.sourceLine.slice(0, maxChars - 1).replace(/[\s\-–—,;:]+$/, "") + "…";
    } else if (srcMax != null) {
      const words = slide.sourceLine.split(/\s+/).filter(Boolean);
      if (words.length > srcMax) result.sourceLine = words.slice(0, srcMax).join(" ");
    }
  }

  return result;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

type FieldSnapshot = {
  headline: string;
  body?: string;
  supportLine?: string;
  sourceLine?: string;
};

function snapshotFields(slide: SlideContent): FieldSnapshot {
  return { headline: slide.headline, body: slide.body, supportLine: slide.supportLine, sourceLine: slide.sourceLine };
}

function hasChanged(a: FieldSnapshot, b: FieldSnapshot): boolean {
  return a.headline !== b.headline || a.body !== b.body || a.supportLine !== b.supportLine || a.sourceLine !== b.sourceLine;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count words in a string. Exported for use by buildSlides.ts. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
