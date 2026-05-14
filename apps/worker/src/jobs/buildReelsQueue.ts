/**
 * Worker job: buildReelsQueue (Reels Pipeline v1, cold-start mode).
 *
 * Runs every tick. When `REELS_ENABLED=true` and no Reel has been generated
 * for today (Haiti tz), selects the highest-scored eligible item from the
 * last 48 hours, calls `buildReel()` from `@edlight-news/reels-generator`,
 * uploads the rendered MP4 to Cloud Storage, and inserts a `pending` row
 * into the `reels_pending_review` collection for human review.
 *
 * Hard limits (cold-start):
 *   • 1 Reel per Haiti day (single open slot).
 *   • Daily cost ceiling: REELS_DAILY_COST_CEILING_USD (default $1.00).
 *
 * Topic preference for cold-start virality (in order):
 *   scholarship > histoire > opportunity > taux > fact > news
 *
 * No direct IG publishing: humans download the MP4 and post manually so
 * trending audio can be picked at post time. We accept the IG post URL back
 * via the admin page, parse the shortcode, and let pullSocialMetrics sync
 * insights from there.
 */

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  getDb,
  reelsPendingRepo,
  contentVersionsRepo,
  uploadImageBuffer,
} from "@edlight-news/firebase";
import type {
  Item,
  ContentVersion,
  ReelsTopic,
  ReelsTemplate,
  ReelsCostBreakdown,
  CreateReelsPendingItem,
} from "@edlight-news/types";
import { Timestamp } from "firebase-admin/firestore";
import { buildReel } from "@edlight-news/reels-generator";

const REELS_ENABLED = process.env.REELS_ENABLED === "true";
const DAILY_COST_CEILING_USD = Number(
  process.env.REELS_DAILY_COST_CEILING_USD ?? "1.00",
);
const HAITI_TZ = "America/Port-au-Prince";

/** Ordered preference — earlier topics win during cold-start virality phase. */
const TOPIC_PREFERENCE: ReelsTopic[] = [
  "scholarship",
  "histoire",
  "opportunity",
  "taux",
  "fact",
  "news",
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://news.edlight.org";

export interface BuildReelsQueueResult {
  generated: number;
  skipped: string | null;
  errors: number;
  costToday?: number;
  reelId?: string;
}

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

function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const t = (value as { toDate?: () => Date }).toDate;
    if (typeof t === "function") return t.call(value);
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
  }
  return null;
}

/** Map an Item (category/vertical/canonicalUrl) to a ReelsTopic, or null
 *  if the item is not Reels-eligible. */
function topicForReels(item: Item): ReelsTopic | null {
  const category = item.category?.toLowerCase() ?? "";
  const vertical = item.vertical?.toLowerCase() ?? "";

  if (
    category === "histoire" ||
    vertical === "histoire" ||
    item.canonicalUrl?.startsWith("edlight://histoire/")
  ) {
    return "histoire";
  }
  if (
    category === "taux" ||
    vertical === "taux" ||
    item.canonicalUrl?.startsWith("edlight://taux/")
  ) {
    return "taux";
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
  if (vertical === "education") return "education";
  if (
    category === "news" ||
    category === "local_news" ||
    vertical === "news" ||
    vertical === "haiti" ||
    vertical === "world"
  ) {
    return "news";
  }
  return null;
}

/** Lightweight Reels-specific score. Kept small and topic-led — the
 *  Reels pipeline picks ONE item per day, so absolute scoring doesn't need
 *  to align with the FB queue. */
function scoreForReels(item: Item, topic: ReelsTopic): number {
  const topicBase: Record<ReelsTopic, number> = {
    scholarship: 80,
    histoire: 75,
    opportunity: 65,
    taux: 55,
    fact: 50,
    news: 35,
    education: 30,
  };
  let score = topicBase[topic];

  if (item.imageUrl) score += 6;
  const citations = Array.isArray(item.citations) ? item.citations.length : 0;
  score += Math.min(citations * 2, 8);

  const createdAt = toDateMaybe((item as { createdAt?: unknown }).createdAt);
  if (createdAt) {
    const ageHours = (Date.now() - createdAt.getTime()) / 3.6e6;
    if (ageHours <= 6) score += 8;
    else if (ageHours <= 24) score += 5;
    else if (ageHours <= 48) score += 2;
  }

  return score;
}

function emit(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...payload }));
}

async function postWebhook(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.warn("[buildReelsQueue] webhook post failed:", err);
  }
}

/** Map the orchestrator's ReelCostBreakdown to our Firestore shape. */
function mapCost(
  cost: import("@edlight-news/reels-generator").BuildReelResult["artifact"]["cost"],
): ReelsCostBreakdown {
  return {
    llmUsd: cost.scriptUsd,
    ttsUsd: cost.voiceUsd,
    whisperUsd: cost.transcriptionUsd,
    renderUsd: cost.renderUsd + cost.footageUsd,
    totalUsd: cost.totalUsd,
  };
}

export async function buildReelsQueue(): Promise<BuildReelsQueueResult> {
  const result: BuildReelsQueueResult = {
    generated: 0,
    skipped: null,
    errors: 0,
  };

  if (!REELS_ENABLED) {
    result.skipped = "REELS_ENABLED!=true";
    return result;
  }

  const haitiToday = getHaitiDateKey();

  // ── 1. Daily slot guard (1/day cold-start cap) ────────────────────────
  try {
    const openSlots = await reelsPendingRepo.listOpenSlotsForDay(haitiToday);
    if (openSlots.length > 0) {
      result.skipped = `slot-taken:${openSlots[0]!.id}`;
      return result;
    }
  } catch (err) {
    console.warn("[buildReelsQueue] listOpenSlotsForDay failed:", err);
  }

  // ── 2. Cost ceiling guard ─────────────────────────────────────────────
  let costToday = 0;
  try {
    costToday = await reelsPendingRepo.sumCostForDay(haitiToday);
  } catch (err) {
    console.warn("[buildReelsQueue] sumCostForDay failed:", err);
  }
  result.costToday = costToday;
  if (costToday >= DAILY_COST_CEILING_USD) {
    emit("reelsCostCeilingHit", {
      haitiDate: haitiToday,
      costToday,
      ceilingUsd: DAILY_COST_CEILING_USD,
    });
    result.skipped = `cost-ceiling:$${costToday.toFixed(4)}>=${DAILY_COST_CEILING_USD}`;
    return result;
  }

  // ── 3. Pick the best candidate item from the last 48h ─────────────────
  const recentCvs = await contentVersionsRepo.listPublishedForWeb("fr", 200);
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

  const cvByItemId = new Map<string, ContentVersion>();
  for (const cv of recentCvs) {
    if (cv.itemId && !cvByItemId.has(cv.itemId)) cvByItemId.set(cv.itemId, cv);
  }

  type Candidate = {
    item: Item;
    cv: ContentVersion;
    topic: ReelsTopic;
    score: number;
    topicRank: number;
  };

  const candidates: Candidate[] = [];
  for (const [itemId, cv] of cvByItemId) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    const topic = topicForReels(item);
    if (!topic) continue;
    const topicRank = TOPIC_PREFERENCE.indexOf(topic);
    if (topicRank === -1) continue;
    const score = scoreForReels(item, topic);
    candidates.push({ item, cv, topic, score, topicRank });
  }

  if (candidates.length === 0) {
    result.skipped = "no-eligible-items";
    return result;
  }

  // Sort by topicRank ASC (preferred topics first), then score DESC.
  candidates.sort((a, b) => {
    if (a.topicRank !== b.topicRank) return a.topicRank - b.topicRank;
    return b.score - a.score;
  });

  const pick = candidates[0]!;
  emit("reelCandidateSelected", {
    itemId: pick.item.id,
    topic: pick.topic,
    score: pick.score,
    title: pick.item.title?.slice(0, 80) ?? null,
  });

  // ── 4. Build the reel end-to-end ──────────────────────────────────────
  const articleUrl = `${SITE_URL}/news/${pick.cv.id}?lang=fr`;
  let built;
  try {
    built = await buildReel({
      topic: pick.topic,
      item: {
        id: pick.item.id,
        title: pick.cv.title || pick.item.title,
        summary: pick.cv.summary || (pick.item as unknown as { summary?: string }).summary || "",
        url: articleUrl,
        sourceName: pick.item.source?.name,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("reelGenerationFailed", {
      itemId: pick.item.id,
      topic: pick.topic,
      error: msg,
    });
    result.errors++;
    result.skipped = `build-failed:${msg.slice(0, 80)}`;
    return result;
  }

  // ── 5. Upload MP4 to Cloud Storage ────────────────────────────────────
  let mp4Url: string;
  try {
    const buf = await fs.readFile(built.videoPath);
    const objectPath = `reels/${haitiToday}/${built.artifact.id}.mp4`;
    mp4Url = await uploadImageBuffer(objectPath, buf, "video/mp4");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("reelGenerationFailed", {
      itemId: pick.item.id,
      stage: "upload",
      error: msg,
    });
    result.errors++;
    result.skipped = `upload-failed:${msg.slice(0, 80)}`;
    return result;
  }

  // ── 6. Insert pending row ─────────────────────────────────────────────
  const reelVariant = `${pick.topic}-${built.artifact.template}-v1`;
  const cost = mapCost(built.artifact.cost);

  const create: CreateReelsPendingItem = {
    sourceItemId: pick.item.id,
    topic: pick.topic,
    template: built.artifact.template as ReelsTemplate,
    reelVariant,
    language: "fr",
    scriptText: built.artifact.script.voiceover,
    igCaption: built.artifact.captionDraft ?? built.artifact.script.caption ?? "",
    mp4Url,
    thumbnailUrl: "",
    durationSec: built.artifact.durationSec,
    status: "pending",
    generatedAt: Timestamp.now(),
    costEstimateUsd: cost.totalUsd,
    costBreakdown: cost,
  };

  let inserted;
  try {
    inserted = await reelsPendingRepo.createReelsPendingItem(create);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("reelGenerationFailed", {
      itemId: pick.item.id,
      stage: "persist",
      error: msg,
    });
    result.errors++;
    result.skipped = `persist-failed:${msg.slice(0, 80)}`;
    return result;
  }

  // Best-effort cleanup of local artifacts; failures are logged only.
  void Promise.allSettled([
    fs.rm(built.videoPath, { force: true }),
    fs.rm(built.audioPath, { force: true }),
  ]).catch(() => undefined);

  result.generated = 1;
  result.reelId = inserted.id;
  result.costToday = costToday + cost.totalUsd;

  emit("reelGenerated", {
    reelId: inserted.id,
    sourceItemId: pick.item.id,
    topic: pick.topic,
    template: built.artifact.template,
    reelVariant,
    durationSec: built.artifact.durationSec,
    costUsd: cost.totalUsd,
    haitiDate: haitiToday,
  });

  void postWebhook(
    `🎬 New EdLight Reel ready for review (${pick.topic} / ${built.artifact.template}) — ` +
      `${SITE_URL.replace("news.", "")}/admin/reels-pending`,
  );

  // Suppress unused imports warning.
  void randomUUID;
  return result;
}
