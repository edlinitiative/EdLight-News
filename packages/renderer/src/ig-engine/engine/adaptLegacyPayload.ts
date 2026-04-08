/**
 * @edlight-news/renderer – Legacy Payload Adapter
 *
 * Converts the old-format IGFormattedPayload (flat IGSlide[] with heading/
 * bullets/footer fields) into the new IG Engine types (ContentIntakeInput +
 * SlideContent[] + PostCaption) so the new premium renderer can be used as a
 * drop-in replacement for generateCarouselAssets().
 *
 * Mapping rules:
 *   IGSlide.heading         → SlideContent.headline
 *   IGSlide.bullets (2+)    → SlideContent.body  (joined as "• a\n• b\n• c")
 *   IGSlide.bullets (1)     → SlideContent.body  (plain paragraph)
 *   IGSlide.bullets[0] on cover → SlideContent.supportLine
 *   IGSlide.footer          → SlideContent.sourceLine
 *   IGSlide.backgroundImage → SlideContent.imageUrl
 *   IGSlide.statValue       → SlideContent.statValue
 *   IGSlide.statDescription → SlideContent.statDescription
 *   IGSlide.layout          → SlideContent.layoutVariant (see resolveLayoutVariant)
 *
 * IGPostType → TemplateId routing:
 *   news        → news-carousel
 *   scholarship → opportunity-carousel
 *   opportunity → opportunity-carousel
 *   histoire    → news-carousel
 *   utility     → explainer-carousel
 *   breaking    → breaking-news-single
 *   stat        → quote-stat-card
 *   taux        → taux-card  (premium navy/gold financial card)
 */

import type { IGFormattedPayload, IGQueueItem, IGPostType, IGSlide } from "@edlight-news/types";
import type { ContentIntakeInput, SlideContent, PostCaption, TemplateId, PostLanguage } from "../types/post.js";

// ── Routing tables ────────────────────────────────────────────────────────────

const IG_TYPE_TO_TEMPLATE: Partial<Record<IGPostType, TemplateId>> = {
  news:        "news-carousel",
  scholarship: "opportunity-carousel",
  opportunity: "opportunity-carousel",
  histoire:    "news-carousel",
  utility:     "explainer-carousel",
  breaking:    "breaking-news-single",
  stat:        "quote-stat-card",
  taux:        "taux-card",
};

const IG_TYPE_TO_CATEGORY: Record<IGPostType, string> = {
  news:        "news",
  scholarship: "scholarship",
  opportunity: "opportunity",
  histoire:    "history",
  utility:     "utility",
  breaking:    "breaking",
  stat:        "stat",
  taux:        "taux",
};

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns true when the igType should be rendered by the new IG Engine.
 * All igTypes now have a template mapping.
 */
export function shouldUseIgEngine(igType: IGPostType): boolean {
  return igType in IG_TYPE_TO_TEMPLATE;
}

/** Resolve the content-type key used for brand colour lookup ("news", "history", …). */
export function resolveContentType(igType: IGPostType): string {
  return IG_TYPE_TO_CATEGORY[igType] ?? "news";
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Join a bullets array into a body string the new engine can parse.
 * - 0 bullets → undefined
 * - 1 bullet  → plain paragraph (no separator → template uses <p> path)
 * - 2+ bullets → "• a\n• b\n• c" (separators trigger bullet-list path)
 */
function bulletsToBody(bullets: string[]): string | undefined {
  if (bullets.length === 0) return undefined;
  if (bullets.length === 1) return bullets[0];
  return bullets.map(b => `• ${b.replace(/^[•\-]\s*/, "")}`).join("\n");
}

// ── Language detection ─────────────────────────────────────────────────────

/** Haitian-Creole marker words (standalone, word-boundary matched). */
const CREOLE_MARKERS = [
  "nan", "pou", "ki", "ak", "pa", "te", "ap", "yo", "li",
  "mwen", "nou", "anpil", "lè", "sa", "gen", "fè", "konsa", "tankou",
  "ou",  // "you" in Creole – standalone only
];

/** Common English words for basic English detection. */
const ENGLISH_MARKERS = [
  "the", "is", "are", "was", "for", "with", "this", "that",
];

/**
 * Heuristically detect whether content is Haitian Creole, English, or French
 * by scanning slide text (headings + bullets) and the caption.
 *
 * Scoring:
 *   – Count distinct Creole marker words found (word-boundary match).
 *     If ≥ 3 → "ht"
 *   – Count distinct English marker words found.
 *     If ≥ 5 → "en"
 *   – Otherwise default to French → "fr"
 */
function detectLanguage(slides: IGSlide[], caption: string): PostLanguage {
  // Collect all textual content into a single lowercased string.
  const parts: string[] = [];
  for (const slide of slides) {
    if (slide.heading) parts.push(slide.heading);
    if (slide.bullets) parts.push(...slide.bullets);
  }
  parts.push(caption);
  const text = parts.join(" ").toLowerCase();

  // Count distinct Creole markers present.
  let creoleHits = 0;
  for (const marker of CREOLE_MARKERS) {
    const re = new RegExp(`\\b${marker}\\b`, "i");
    if (re.test(text)) creoleHits++;
  }
  if (creoleHits >= 3) return "ht";

  // Count distinct English markers present.
  let englishHits = 0;
  for (const marker of ENGLISH_MARKERS) {
    const re = new RegExp(`\\b${marker}\\b`, "i");
    if (re.test(text)) englishHits++;
  }
  if (englishHits >= 5) return "en";

  return "fr";
}

/**
 * Map an IGSlide's layout field + position to a SlideContent.layoutVariant.
 *
 * IGSlideLayout → SlideContent.layoutVariant:
 *   "headline"   at index 0  → "cover"
 *   "headline"   at index >0 → "detail"
 *   "explanation"            → "detail"
 *   "data"                   → "data"
 *   "cta"                    → "cta"
 *   undefined   at index 0  → "cover"
 *   undefined   at index >0 → "detail"
 */
function resolveLayoutVariant(
  layout: IGSlide["layout"],
  index: number,
): SlideContent["layoutVariant"] {
  if (layout === "cta")  return "cta";
  if (layout === "data") return "data";
  // "headline", "explanation", or undefined
  return index === 0 ? "cover" : "detail";
}

/**
 * Convert a single IGSlide into a SlideContent for the new engine.
 *
 * Cover slides: bullets[0] → supportLine (displayed as a deck beneath the
 * headline); remaining bullets are not shown on the cover (by design).
 *
 * All other slides: full bullets array → body text.
 */
function adaptSlide(slide: IGSlide, index: number): SlideContent {
  const variant = resolveLayoutVariant(slide.layout, index);
  const isCover = variant === "cover";
  const isData  = variant === "data";

  let supportLine: string | undefined;
  let body: string | undefined;

  if (isCover) {
    // First bullet serves as the deck / support line on the cover
    supportLine = slide.bullets[0] ?? undefined;
    // Remaining bullets (if any) are not surfaced on cover slides
  } else if (isData) {
    // Data slides: bullets provide supplementary description text
    body = bulletsToBody(slide.bullets);
  } else {
    // Detail / explanation slides: bullets become the body content
    body = bulletsToBody(slide.bullets);
  }

  return {
    slideNumber:     index + 1,
    layoutVariant:   variant,
    headline:        slide.heading,
    body,
    supportLine,
    sourceLine:      slide.footer,
    imageUrl:        slide.backgroundImage,
    statValue:       isData ? (slide.statValue   ?? undefined) : undefined,
    statDescription: isData ? (slide.statDescription ?? undefined) : undefined,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface AdaptedPayload {
  intake:      ContentIntakeInput;
  rawSlides:   SlideContent[];
  caption:     PostCaption;
  contentType: string;
}

/**
 * Convert an IGQueueItem + IGFormattedPayload into the ContentIntakeInput +
 * SlideContent[] + PostCaption bundle expected by buildPost().
 *
 * Call shouldUseIgEngine(item.igType) before calling this — it throws for
 * igTypes that have no template mapping (e.g. "taux").
 */
export function adaptLegacyPayload(
  queueItem: IGQueueItem,
  payload:   IGFormattedPayload,
): AdaptedPayload {
  const igType     = queueItem.igType;
  const templateId = IG_TYPE_TO_TEMPLATE[igType];

  if (!templateId) {
    throw new Error(
      `[adaptLegacyPayload] igType "${igType}" has no IG Engine template — ` +
      `call shouldUseIgEngine() before adapting.`,
    );
  }

  const contentType = resolveContentType(igType);
  const rawSlides   = payload.slides.map((slide, i) => adaptSlide(slide, i));

  // ── Topic: cover slide heading ────────────────────────────────────────────
  const topic = payload.slides[0]?.heading ?? "";

  // ── Caption: parse flat caption string into structured PostCaption ────────
  // The old system stores captions as a single string that may contain
  // hashtags inline (e.g. "…text…\n\n#Haïti #EdLightNews\n\nSuivez…").
  const rawCaption   = payload.caption ?? "";
  const hashtags     = rawCaption.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g) ?? [];
  const cleanCaption = rawCaption.replace(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g, "").replace(/\n{3,}/g, "\n\n").trim();
  // First paragraph is the main text; last non-empty paragraph is the CTA
  const paragraphs   = cleanCaption.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const captionText  = paragraphs[0] ?? cleanCaption;
  const cta          = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : undefined;

  const intake: ContentIntakeInput = {
    contentTypeHint:  templateId,
    topic,
    sourceSummary:    topic,
    category:         contentType,
    preferredLanguage: detectLanguage(payload.slides, payload.caption),
    urgencyLevel:     igType === "breaking" ? "breaking" : "normal",
  };

  const caption: PostCaption = {
    text:     captionText,
    hashtags,
    cta,
  };

  return { intake, rawSlides, caption, contentType };
}
