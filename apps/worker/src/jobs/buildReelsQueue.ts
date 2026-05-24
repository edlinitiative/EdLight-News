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
import {
  buildReelV2,
  FORMAT_TO_TEMPLATE,
  type ReelFormat,
  type ReelQualityScore,
  type ReelScene,
} from "@edlight-news/reels-generator";

const REELS_ENABLED = process.env.REELS_ENABLED === "true";
const DAILY_COST_CEILING_USD = Number(
  process.env.REELS_DAILY_COST_CEILING_USD ?? "1.00",
);
/** Day-of-week (Haiti tz) on which to attempt a weekly roundup. 5 = Friday. */
const REELS_ROUNDUP_DOW = Number(process.env.REELS_ROUNDUP_DOW ?? "5");
/** Min opportunity-eligible items in the candidate pool to trigger roundup. */
const REELS_ROUNDUP_MIN_ITEMS = Number(process.env.REELS_ROUNDUP_MIN_ITEMS ?? "3");
const REELS_ROUNDUP_MAX_ITEMS = 5;
const HAITI_TZ = "America/Port-au-Prince";

function haitiDow(date: Date = new Date()): number {
  // Intl returns localized weekday; map by ISO with Sunday=0.
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: HAITI_TZ,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

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

/**
 * Post a rich Slack draft so the reviewer can preview the reel without
 * leaving Slack: title, topic, template, duration, cost, MP4 link, IG
 * caption draft, and a one-click admin URL.
 */
async function postReelDraftToSlack(opts: {
  reelId: string;
  topic: ReelsTopic;
  template: ReelsTemplate;
  /** v2 editorial format (optional for back-compat with v1 callers). */
  format?: ReelFormat;
  /** v2 reel title (shown in Slack header when present). */
  title?: string;
  /** First spoken line, duplicated for quick scanning. */
  hook?: string;
  /** Per-scene storyboard preview. */
  storyboard?: ReelScene[];
  /** Deterministic quality score. */
  qualityScore?: ReelQualityScore;
  durationSec: number;
  costUsd: number;
  mp4Url: string;
  scriptText: string;
  igCaption: string;
  hashtags?: string[];
  sourceTitle: string | null;
  sourceUrl: string;
  adminUrl: string;
}): Promise<{ ok: boolean; ts?: string }> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return { ok: false };
  const truncate = (s: string, n: number) =>
    s.length > n ? `${s.slice(0, n - 1)}…` : s;

  // Build optional v2 storyboard / quality blocks so the reviewer can see
  // scene-by-scene structure and the deterministic QA verdict inline.
  const storyboardBlock =
    opts.storyboard && opts.storyboard.length > 0
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*Storyboard (${opts.storyboard.length} scenes):*\n` +
                opts.storyboard
                  .map(
                    (s, i) =>
                      `${i + 1}. *${s.visualType}* — _${truncate(s.voiceover, 90)}_` +
                      (s.onScreenText ? `\n   overlay: ${truncate(s.onScreenText, 60)}` : ""),
                  )
                  .join("\n"),
            },
          },
        ]
      : [];

  const qualityBlock = opts.qualityScore
    ? [
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Quality:*\n${opts.qualityScore.total}/100 ${opts.qualityScore.passed ? "✅ pass" : "⚠️ review"}`,
            },
            {
              type: "mrkdwn",
              text:
                `*Hook:* ${opts.qualityScore.hookStrength} · ` +
                `*Clarity:* ${opts.qualityScore.scriptClarity} · ` +
                `*Visual:* ${opts.qualityScore.visualRelevance} · ` +
                `*Duration:* ${opts.qualityScore.durationFit}`,
            },
          ],
        },
        ...(opts.qualityScore.notes.length > 0
          ? [
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: `_Notes:_ ${opts.qualityScore.notes.map((n) => `• ${n}`).join("  ")}`,
                  },
                ],
              },
            ]
          : []),
      ]
    : [];

  const headerLabel = opts.format ?? opts.topic;
  const titleLine = opts.title ? `*${truncate(opts.title, 120)}*` : null;
  const hookLine = opts.hook ? `🎯 _${truncate(opts.hook, 140)}_` : null;
  const hashtagLine =
    opts.hashtags && opts.hashtags.length > 0
      ? opts.hashtags.map((h) => `#${h}`).join(" ")
      : null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🎬 New Sandra Reel ready for review — ${headerLabel} / ${opts.template}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🎬 Sandra Reel: ${headerLabel}`,
              emoji: true,
            },
          },
          ...(titleLine || hookLine
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: [titleLine, hookLine].filter(Boolean).join("\n"),
                  },
                },
              ]
            : []),
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Format:*\n${opts.format ?? "—"}` },
              { type: "mrkdwn", text: `*Template:*\n${opts.template}` },
              { type: "mrkdwn", text: `*Duration:*\n${opts.durationSec.toFixed(1)}s` },
              { type: "mrkdwn", text: `*Cost:*\n$${opts.costUsd.toFixed(4)}` },
            ],
          },
          ...qualityBlock,
          ...(opts.sourceTitle
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Source:* <${opts.sourceUrl}|${truncate(opts.sourceTitle, 120)}>`,
                  },
                },
              ]
            : []),
          ...storyboardBlock,
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Sandra script:*\n>>>${truncate(opts.scriptText, 600)}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*IG caption draft:*\n>>>${truncate(opts.igCaption, 500)}` +
                (hashtagLine ? `\n${truncate(hashtagLine, 250)}` : ""),
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "▶ Watch MP4", emoji: true },
                url: opts.mp4Url,
                style: "primary",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "⬇ Download", emoji: true },
                // GCS honors response-content-disposition to force a download
                // dialog instead of inline playback in the browser.
                url: `${opts.mp4Url}${opts.mp4Url.includes("?") ? "&" : "?"}response-content-disposition=${encodeURIComponent(`attachment; filename="${opts.reelId}.mp4"`)}`,
              },
              {
                type: "button",
                text: { type: "plain_text", text: "✅ Review in admin", emoji: true },
                url: opts.adminUrl,
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text:
                  "Cold-start: 1 reel/day, $1.00/day cost ceiling. " +
                  "Approve in admin to add to the manual posting queue.",
              },
            ],
          },
        ],
      }),
    });
    // Slack incoming webhooks don't return a message ts; chat.postMessage
    // does. We try to parse a JSON body opportunistically and fall back to
    // a plain ok signal so the caller can still flip the status.
    let ts: string | undefined;
    try {
      const j = (await res.clone().json()) as { ts?: string };
      if (j && typeof j.ts === "string") ts = j.ts;
    } catch {
      // ignore — most workspace webhooks return "ok" as text/plain.
    }
    return { ok: res.ok, ts };
  } catch (err) {
    console.warn("[buildReelsQueue] Slack draft post failed:", err);
    return { ok: false };
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

  // ── 4. Build the reel end-to-end (v2 format-driven pipeline) ─────────
  //
  // Roundup mode: on the configured day-of-week (Haiti tz, default Friday)
  // when we have ≥ REELS_ROUNDUP_MIN_ITEMS opportunity-eligible candidates,
  // bundle the top 3–5 into a single weekly_opportunity_roundup Reel.
  // Otherwise fall back to single-item alert/explainer mode driven by the
  // top candidate.
  const isRoundupDay = haitiDow() === REELS_ROUNDUP_DOW;
  const opportunityCandidates = candidates.filter(
    (c) => c.topic === "opportunity" || c.topic === "scholarship",
  );
  const useRoundup =
    isRoundupDay && opportunityCandidates.length >= REELS_ROUNDUP_MIN_ITEMS;

  const articleUrl = `${SITE_URL}/news/${pick.cv.id}?lang=fr`;

  const primaryItem = useRoundup ? opportunityCandidates[0]! : pick;
  const roundupExtras = useRoundup
    ? opportunityCandidates
        .slice(1, REELS_ROUNDUP_MAX_ITEMS)
        .map((c) => ({
          id: c.item.id,
          title: c.cv.title || c.item.title,
          summary:
            c.cv.summary ||
            (c.item as unknown as { summary?: string }).summary ||
            "",
          url: `${SITE_URL}/news/${c.cv.id}?lang=fr`,
          sourceName: c.item.source?.name,
        }))
    : undefined;

  let built;
  try {
    built = await buildReelV2({
      primary: {
        id: primaryItem.item.id,
        title: primaryItem.cv.title || primaryItem.item.title,
        summary:
          primaryItem.cv.summary ||
          (primaryItem.item as unknown as { summary?: string }).summary ||
          "",
        url: useRoundup
          ? `${SITE_URL}/news/${primaryItem.cv.id}?lang=fr`
          : articleUrl,
        sourceName: primaryItem.item.source?.name,
        category: primaryItem.item.category,
        vertical: primaryItem.item.vertical,
        imageUrl: primaryItem.item.imageUrl || undefined,
      },
      roundup: roundupExtras,
      language: "fr",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("reelGenerationFailed", {
      itemId: primaryItem.item.id,
      topic: primaryItem.topic,
      stage: "buildReelV2",
      error: msg,
    });
    result.errors++;
    result.skipped = `build-failed:${msg.slice(0, 400)}`;
    return result;
  }

  const v1 = built.v1;
  const reelV2 = built.reel;
  const format: ReelFormat = reelV2.format;
  const quality: ReelQualityScore | undefined = reelV2.qualityScore;

  // ── 5. Upload MP4 to Cloud Storage ────────────────────────────────────
  let mp4Url: string;
  try {
    const buf = await fs.readFile(built.videoPath);
    const objectPath = `reels/${haitiToday}/${v1.id}.mp4`;
    mp4Url = await uploadImageBuffer(objectPath, buf, "video/mp4");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("reelGenerationFailed", {
      itemId: primaryItem.item.id,
      stage: "upload",
      error: msg,
    });
    result.errors++;
    result.skipped = `upload-failed:${msg.slice(0, 80)}`;
    return result;
  }

  // ── 6. Insert pending row (v1 fields + v2 editorial fields) ──────────
  const renderedTemplate = (v1.template ?? FORMAT_TO_TEMPLATE[format]) as ReelsTemplate;
  const reelVariant = `${format}-${renderedTemplate}-v2`;
  const cost = mapCost(v1.cost);

  const create: CreateReelsPendingItem = {
    sourceItemId: primaryItem.item.id,
    topic: primaryItem.topic,
    template: renderedTemplate,
    reelVariant,
    language: "fr",
    scriptText: reelV2.script,
    igCaption: reelV2.caption,
    mp4Url,
    thumbnailUrl: "",
    durationSec: reelV2.durationSec ?? v1.durationSec,
    // We mark the freshly-built Reel as pending_review (v2 status). Older
    // v1 admin tooling treats any non-approved/posted status as actionable.
    status: "pending_review",
    generatedAt: Timestamp.now(),
    costEstimateUsd: cost.totalUsd,
    costBreakdown: cost,
    // ── v2 editorial fields ──────────────────────────────────────────
    format,
    title: reelV2.title,
    hook: reelV2.hook,
    sourceItemIds: reelV2.sourceItemIds,
    storyboard: reelV2.storyboard,
    hashtags: reelV2.hashtags,
    qualityScore: quality,
  };

  let inserted;
  try {
    inserted = await reelsPendingRepo.createReelsPendingItem(create);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("reelGenerationFailed", {
      itemId: primaryItem.item.id,
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
    sourceItemId: primaryItem.item.id,
    sourceItemIds: reelV2.sourceItemIds,
    topic: primaryItem.topic,
    format,
    template: renderedTemplate,
    reelVariant,
    durationSec: reelV2.durationSec,
    qualityScoreTotal: quality?.total,
    qualityPassed: quality?.passed,
    costUsd: cost.totalUsd,
    haitiDate: haitiToday,
  });

  // Awaited (not fire-and-forget): on Cloud Run the container's CPU is
  // throttled once the request handler returns, which would drop the
  // in-flight webhook fetch and silently lose the Slack notification.
  const slackResult = await postReelDraftToSlack({
    reelId: inserted.id,
    topic: primaryItem.topic,
    template: renderedTemplate,
    format,
    title: reelV2.title,
    hook: reelV2.hook,
    storyboard: reelV2.storyboard,
    qualityScore: quality,
    durationSec: reelV2.durationSec ?? v1.durationSec,
    costUsd: cost.totalUsd,
    mp4Url,
    scriptText: reelV2.script,
    igCaption: reelV2.caption,
    hashtags: reelV2.hashtags,
    sourceTitle:
      primaryItem.cv.title || primaryItem.item.title || null,
    sourceUrl: articleUrl,
    adminUrl: `${SITE_URL}/admin/reels-pending`,
  });

  if (slackResult.ok) {
    try {
      await reelsPendingRepo.markSentToSlack(inserted.id, {
        slackMessageTs: slackResult.ts,
      });
    } catch (err) {
      console.warn("[buildReelsQueue] markSentToSlack failed:", err);
    }
  }

  // Suppress unused imports warning.
  void randomUUID;
  void postWebhook;
  return result;
}
