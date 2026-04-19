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
  itemsRepo,
  fbQueueRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import type { Item, FbMessagePayload } from "@edlight-news/types";

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
  const topicBase: Record<SocialTopic, number> = {
    scholarship: 55,
    opportunity: 52,
    education: 48,
    news: 45,
    other: 34,
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
 * Compose a Facebook post payload for a content item.
 * Uses the French content version. FB link posts auto-generate
 * a preview card with the article's OpenGraph image and title.
 */
async function composeFbMessage(item: Item): Promise<FbMessagePayload | null> {
  let title = item.title;
  let summary = (item as any).summary ?? "";
  let articleVersionId: string | null = null;
  let articleLanguage: "fr" | "ht" = "fr";

  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const webVersions = versions.filter((v) => v.channel === "web" && v.status === "published");
    const selected =
      webVersions.find((v) => v.language === "fr") ??
      webVersions[0];

    if (selected) {
      articleVersionId = selected.id;
      articleLanguage = selected.language === "ht" ? "ht" : "fr";
      title = selected.title || title;
      summary = selected.summary || summary;
    }
  } catch {
    // Versions unavailable — skip because Facebook should link to a live web article.
  }

  if (!title || title.length < 10) return null;
  if (!articleVersionId) return null;

  const articleUrl = `${SITE_URL}/news/${articleVersionId}?lang=${articleLanguage}`;

  const topic = topicForSocial(item);
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

    const recentItems = await itemsRepo.listRecentItems(100);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const items: Item[] = recentItems.filter((item) => {
      if (!item.createdAt) return false;
      const createdAt =
        typeof item.createdAt === "object" && "seconds" in item.createdAt
          ? new Date((item.createdAt as any).seconds * 1000)
          : new Date();
      return createdAt >= cutoff;
    });

    const queueWindowCutoff = new Date();
    queueWindowCutoff.setDate(queueWindowCutoff.getDate() - 3);
    const existingSourceIds =
      await fbQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    let newItemsQueued = 0;

    const scoredItems = items
      .map((item) => {
        const scored = scoreForFb(item);
        return { item, score: scored.score, reasons: scored.reasons };
      })
      .filter((si) => si.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    for (const { item, score, reasons } of scoredItems) {
      if (newItemsQueued >= MAX_NEW_ITEMS_PER_RUN) break;

      result.evaluated++;

      try {
        if (existingSourceIds.has(item.id)) {
          result.alreadyExists++;
          continue;
        }

        // Skip internal / utility items (histoire, taux) — those are IG-only
        if (
          item.canonicalUrl?.startsWith("edlight://histoire/") ||
          item.canonicalUrl?.startsWith("edlight://utility/")
        ) {
          result.skipped++;
          continue;
        }

        const payload = await composeFbMessage(item);
        if (!payload) {
          result.skipped++;
          continue;
        }

        await fbQueueRepo.createFbQueueItem({
          sourceContentId: item.id,
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
