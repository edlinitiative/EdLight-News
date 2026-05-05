/**
 * Worker job: buildFbQueue
 *
 * Runs every tick. Fetches recent published content items (last 48h),
 * selects the most valuable ones for Facebook distribution, and composes
 * text posts with article link previews.
 *
 * Modeled on buildWaQueue — text-first, no image rendering pipeline.
 * Facebook link posts auto-generate preview cards from the article URL.
 */

import {
  getDb,
  fbQueueRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import type { Item, ContentVersion, FbMessagePayload } from "@edlight-news/types";
import {
  isStockMarketFalsePositive,
  lacksScholarshipEvidence,
} from "../services/classify.js";
import {
  generateSocialPosts,
  socialToFbPayload,
  type SocialArticleInput,
} from "@edlight-news/generator";

/** Feature flag — when "true", try the social v2 generator before legacy composer. */
const SOCIAL_V2_ENABLED = process.env.SOCIAL_GENERATOR_V2 === "true";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum new items to queue per tick. */
const MAX_NEW_ITEMS_PER_RUN = 10;

/** Minimum score threshold for FB distribution. */
const MIN_SCORE_THRESHOLD = 35;

/** Base URL for article links on the website. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://news.edlight.org";

function getHaitiDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

type SocialTopic =
  | "scholarship"
  | "opportunity"
  | "education"
  | "news"
  | "story_only"
  | "other";

function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smallHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function topicForSocial(item: Item): SocialTopic {
  const category = item.category?.toLowerCase() ?? "";
  const vertical = item.vertical?.toLowerCase() ?? "";

  // Story-only categories: never go to the FB feed (or Threads). They
  // exist to fuel the IG story rail. Mark explicitly so scoring filters
  // them out before the queue insert.
  if (
    category === "taux" ||
    category === "histoire" ||
    category === "utility" ||
    vertical === "histoire" ||
    vertical === "taux" ||
    vertical === "utility" ||
    item.canonicalUrl?.startsWith("edlight://histoire/") ||
    item.canonicalUrl?.startsWith("edlight://utility/") ||
    item.canonicalUrl?.startsWith("edlight://taux/")
  ) {
    return "story_only";
  }

  if (
    category === "scholarship" ||
    category === "bourses" ||
    vertical === "bourses"
  ) {
    return "scholarship";
  }
  if (
    category === "opportunity" ||
    category === "concours" ||
    category === "stages" ||
    category === "programmes" ||
    vertical === "opportunites"
  ) {
    return "opportunity";
  }
  if (vertical === "education") {
    return "education";
  }
  if (
    category === "news" ||
    category === "local_news" ||
    vertical === "news" ||
    vertical === "haiti" ||
    vertical === "world" ||
    vertical === "business" ||
    vertical === "technology" ||
    vertical === "explainers"
  ) {
    return "news";
  }
  return "other";
}

function scoreForFb(item: Item): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const topic = topicForSocial(item);
  // Lead the feed with opportunities. Bourses/Opportunités sit ~25 pts
  // above generic news so weak news rarely crowds out an opportunity.
  // story_only is hard-zeroed; the loop also filters it out below.
  const topicBase: Record<SocialTopic, number> = {
    scholarship: 70,
    opportunity: 65,
    education: 45,
    news: 38,
    other: 25,
    story_only: 0,
  };
  score += topicBase[topic];
  reasons.push(`topic=${topic} (+${topicBase[topic]})`);

  const sourceQualityByImageSource: Record<string, number> = {
    gemini_ai: 8,
    publisher: 7,
    wikidata: 4,
    branded: 1,
    screenshot: 0,
  };
  const imageBonus = item.imageUrl
    ? (sourceQualityByImageSource[item.imageSource ?? ""] ?? 3)
    : 0;
  score += imageBonus;
  reasons.push(`image=${item.imageSource ?? "none"} (+${imageBonus})`);

  const citationsCount = Array.isArray(item.citations) ? item.citations.length : 0;
  const citationBonus = clamp(citationsCount * 2, 0, 8);
  score += citationBonus;
  reasons.push(`citations=${citationsCount} (+${citationBonus})`);

  const views = typeof item.viewCount === "number" ? item.viewCount : 0;
  const viewBonus = clamp(Math.floor(Math.log10(views + 1) * 4), 0, 8);
  score += viewBonus;
  reasons.push(`views=${views} (+${viewBonus})`);

  const createdAt = toDateMaybe((item as { createdAt?: unknown }).createdAt);
  if (createdAt) {
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    const freshnessBonus = ageHours <= 6 ? 8 : ageHours <= 24 ? 6 : ageHours <= 48 ? 3 : 0;
    score += freshnessBonus;
    reasons.push(`freshness=${ageHours.toFixed(1)}h (+${freshnessBonus})`);
  }

  const titleLen = item.title?.trim().length ?? 0;
  const titleBonus = titleLen >= 50 && titleLen <= 120 ? 5 : titleLen >= 30 ? 3 : 0;
  score += titleBonus;
  reasons.push(`title_len=${titleLen} (+${titleBonus})`);

  const deadlineRaw = (item as { opportunity?: { deadline?: string | null } }).opportunity?.deadline;
  if ((topic === "scholarship" || topic === "opportunity") && deadlineRaw) {
    const deadline = new Date(deadlineRaw);
    if (!Number.isNaN(deadline.getTime())) {
      const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const urgencyBonus = daysLeft <= 2 ? 8 : daysLeft <= 7 ? 5 : daysLeft <= 14 ? 2 : 0;
      score += urgencyBonus;
      reasons.push(`deadline=${daysLeft}d (+${urgencyBonus})`);
    }
  }

  // Deterministic tie-breaker for better queue spread (0..4).
  const tieBreaker = smallHash(item.id) % 5;
  score += tieBreaker;
  reasons.push(`tie_breaker=+${tieBreaker}`);

  const finalScore = clamp(Math.round(score), 0, 100);
  reasons.push(`final=${finalScore}`);

  return { score: finalScore, reasons };
}

/**
 * Map a worker Item+CV pair to the social generator's input shape.
 * Returns null if the item is missing fields the social generator needs.
 */
function toSocialInput(
  item: Item,
  cv: ContentVersion,
  articleUrl: string,
): SocialArticleInput | null {
  const topic = topicForSocial(item);
  const rawCategory = item.category?.toLowerCase() ?? "";
  const rawVertical = item.vertical?.toLowerCase() ?? "";
  // Pass the right category through so the LLM picks `story_only` for
  // Taux / Histoire and the adapter then refuses to emit a feed payload.
  let category: SocialArticleInput["category"] = "Autre";
  if (topic === "scholarship") category = "Bourses";
  else if (topic === "opportunity") category = "Opportunités";
  else if (topic === "education") category = "Éducation";
  else if (topic === "news") category = "Actualités";
  else if (
    rawCategory === "taux" ||
    rawVertical === "taux" ||
    item.canonicalUrl?.startsWith("edlight://taux/") ||
    item.canonicalUrl?.startsWith("edlight://utility/")
  ) {
    category = "Taux";
  } else if (
    rawCategory === "histoire" ||
    rawVertical === "histoire" ||
    item.canonicalUrl?.startsWith("edlight://histoire/")
  ) {
    category = "Histoire";
  }
  const language: "fr" | "ht" = cv.language === "ht" ? "ht" : "fr";
  const title = cv.title || item.title;
  if (!title || title.length < 10) return null;
  const summary = cv.summary || (item as any).summary || "";
  const body = cv.body || item.extractedText || "";
  const publishedAt =
    (cv as any).publishedAt instanceof Date
      ? (cv as any).publishedAt.toISOString()
      : typeof (cv as any).publishedAt === "string"
        ? (cv as any).publishedAt
        : new Date().toISOString();
  const opportunity = (item as any).opportunity ?? {};
  return {
    articleId: item.id,
    url: articleUrl,
    category,
    language,
    title,
    summary,
    body,
    publishedAt,
    deadline: opportunity.deadline ?? null,
    country: opportunity.country ?? null,
    institution: opportunity.institution ?? null,
    level: null,
    coverage: opportunity.coverage ?? [],
    eligibility: opportunity.eligibility ?? [],
    documents: opportunity.documents ?? [],
    applicationUrl: opportunity.applicationUrl ?? null,
    imageUrl: item.imageUrl ?? null,
  };
}

/**
 * Compose a Facebook post payload using the social v2 generator.
 * Returns null on any error (caller should fall back to the legacy composer).
 */
async function composeFbMessageV2(
  item: Item,
  cv: ContentVersion,
  articleUrl: string,
): Promise<FbMessagePayload | null> {
  try {
    const input = toSocialInput(item, cv, articleUrl);
    if (!input) return null;
    const result = await generateSocialPosts(input);
    if (!result.ok) {
      console.warn(
        `[buildFbQueue] social v2 generator failed for ${item.id}: ${result.error}`,
      );
      return null;
    }
    return socialToFbPayload(result.output, {
      articleUrl,
      imageUrl: item.imageUrl ?? undefined,
    });
  } catch (err) {
    console.warn(
      `[buildFbQueue] social v2 generator threw for ${item.id}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Compose a Facebook post payload for a content item.
 * Uses the French content version. FB link posts auto-generate
 * a preview card with the article's OpenGraph image and title.
 */
async function composeFbMessage(
  item: Item,
  cv: ContentVersion,
): Promise<FbMessagePayload | null> {
  const title = cv.title || item.title;
  const summary = cv.summary || (item as any).summary || "";
  const articleVersionId = cv.id;
  const articleLanguage: "fr" | "ht" = cv.language === "ht" ? "ht" : "fr";

  if (!title || title.length < 10) return null;
  if (!articleVersionId) return null;

  const articleUrl = `${SITE_URL}/news/${articleVersionId}?lang=${articleLanguage}`;

  // ── Social v2 (feature-flagged) ───────────────────────────────────────
  if (SOCIAL_V2_ENABLED) {
    const v2 = await composeFbMessageV2(item, cv, articleUrl);
    if (v2) return v2;
    // fall through to legacy composer
  }

  // ── Final-line-of-defense topic guard ──────────────────────────────────
  // The composer trusts item.category / item.vertical to pick the hook
  // (e.g. "Bourse à surveiller"). If anything upstream mis-tagged the
  // item, we still don't want to ship a misleading hook to Facebook.
  // Re-validate scholarship-flavored topics here against the article body
  // and downgrade to "news" when there's no scholarship evidence.
  let topic = topicForSocial(item);
  if (topic === "scholarship") {
    const corpus = `${title} ${summary} ${item.extractedText ?? ""}`;
    if (
      isStockMarketFalsePositive(corpus) ||
      lacksScholarshipEvidence(corpus)
    ) {
      console.warn(
        `[buildFbQueue] Downgrading scholarship → news for item ${item.id} ` +
          `(no scholarship evidence). Title: "${title.slice(0, 80)}"`,
      );
      topic = "news";
    }
  }

  const hook =
    topic === "scholarship"
      ? "Bourse à surveiller"
      : topic === "opportunity"
        ? "Opportunité à saisir"
        : topic === "education"
          ? "À retenir pour les étudiants"
          : topic === "news"
            ? "À la une"
            : "À lire";

  const lines: string[] = [];
  lines.push(`${hook} : ${title}`);

  if (summary) {
    const normalizedSummary = String(summary).replace(/\s+/g, " ").trim();
    const shortSummary =
      normalizedSummary.length > 320 ? normalizedSummary.slice(0, 317) + "…" : normalizedSummary;
    lines.push("");
    lines.push(shortSummary);
  }

  if (item.source?.name) {
    lines.push("");
    lines.push(`Source : ${item.source.name}`);
  }

  lines.push("");
  lines.push("Lire l'article complet sur EdLight News.");

  return {
    text: lines.join("\n"),
    linkUrl: articleUrl,
    imageUrl: item.imageUrl || undefined,
  };
}

export interface BuildFbQueueResult {
  evaluated: number;
  queued: number;
  skipped: number;
  alreadyExists: number;
  errors: number;
}

export async function buildFbQueue(): Promise<BuildFbQueueResult> {
  const result: BuildFbQueueResult = {
    evaluated: 0,
    queued: 0,
    skipped: 0,
    alreadyExists: 0,
    errors: 0,
  };

  try {
    const haitiToday = getHaitiDateKey();

    // Use published web content_versions as the source of truth.
    // listRecentItems() returns raw scraped items (status=undefined) that have
    // no content_versions yet — composeFbMessage would return null for all of them.
    const recentCvs = await contentVersionsRepo.listPublishedForWeb("fr", 200);

    // Batch-fetch parent items (in chunks of 20 to respect Firestore limits)
    const itemIds = [...new Set(recentCvs.map((cv) => cv.itemId).filter(Boolean))];
    const db = getDb();
    const itemMap = new Map<string, Item>();
    for (let i = 0; i < itemIds.length; i += 20) {
      const batch = itemIds.slice(i, i + 20);
      const refs = batch.map((id) => db.collection("items").doc(id));
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        if (snap.exists) itemMap.set(snap.id, { id: snap.id, ...snap.data() } as Item);
      }
    }

    // Build item+cv pairs — one per item (first/French CV wins)
    const cvByItemId = new Map<string, ContentVersion>();
    for (const cv of recentCvs) {
      if (cv.itemId && !cvByItemId.has(cv.itemId)) cvByItemId.set(cv.itemId, cv);
    }
    const itemPairs: { item: Item; cv: ContentVersion }[] = [];
    for (const [itemId, cv] of cvByItemId) {
      const item = itemMap.get(itemId);
      if (!item) continue;
      itemPairs.push({ item, cv });
    }

    const queueWindowCutoff = new Date();
    queueWindowCutoff.setDate(queueWindowCutoff.getDate() - 3);
    const existingSourceIds =
      await fbQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    let newItemsQueued = 0;

    const scoredItems = itemPairs
      .map(({ item, cv }) => {
        const scored = scoreForFb(item);
        return { item, cv, score: scored.score, reasons: scored.reasons };
      })
      .filter((si) => si.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    for (const { item, cv, score, reasons } of scoredItems) {
      if (newItemsQueued >= MAX_NEW_ITEMS_PER_RUN) break;

      result.evaluated++;

      try {
        if (existingSourceIds.has(item.id)) {
          result.alreadyExists++;
          continue;
        }

        // Skip story-only categories (histoire, taux, utility) — those
        // are IG story rail content and never belong on the FB feed.
        // Catches both synthetic edlight:// URLs and real items tagged
        // Histoire/Taux/Utility upstream.
        if (
          topicForSocial(item) === "story_only" ||
          item.canonicalUrl?.startsWith("edlight://histoire/") ||
          item.canonicalUrl?.startsWith("edlight://utility/") ||
          item.canonicalUrl?.startsWith("edlight://taux/")
        ) {
          result.skipped++;
          continue;
        }

        const payload = await composeFbMessage(item, cv);
        if (!payload) {
          result.skipped++;
          continue;
        }

        await fbQueueRepo.createFbQueueItem({
          sourceContentId: item.id,
          igType: (item.category === "scholarship" || item.category === "opportunity" || item.category === "news") ? item.category : undefined,
          score,
          status: "queued",
          queuedDate: haitiToday,
          reasons,
          payload,
        });

        newItemsQueued++;
        result.queued++;
        console.log(
          `[buildFbQueue] Queued: ${item.id} (score=${score}, category=${item.category})`,
        );
      } catch (err) {
        console.error(
          `[buildFbQueue] Error processing ${item.id}:`,
          err instanceof Error ? err.message : err,
        );
        result.errors++;
      }
    }

    console.log(`[buildFbQueue] Done:`, result);
    return result;
  } catch (err) {
    console.error("[buildFbQueue] Fatal error:", err);
    return result;
  }
}
