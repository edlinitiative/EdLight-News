/**
 * One-shot QA invoker for the Reels pipeline.
 *
 * Mirrors the production buildReelsQueue() flow (pick candidate → buildReel
 * → upload mp4 → insert pending row → post Slack draft via ALERT_WEBHOOK_URL)
 * but is intended to be run by an engineer on the codespace to validate
 * template / motion / caption changes end-to-end before promoting.
 *
 *   pnpm tsx --env-file=.env src/scripts/runBuildReelsQueueOnce.ts [--force] [--itemId=<id>]
 *
 * Flags
 * ─────
 *   --force          Skip the 1-Reel-per-day slot guard. Still respects the
 *                    cost ceiling. Useful for QA when the daily slot is
 *                    already taken by a production run.
 *   --itemId=<id>    Skip the auto candidate selection and render this
 *                    specific item ID from Firestore. Topic is inferred via
 *                    the same rules the production picker uses.
 *
 * NOTE: This script does NOT modify buildReelsQueue.ts. Production code path
 * is unchanged. Even with --force, this script:
 *   • only adds a new row to reels_pending_review (status "pending")
 *   • does not delete or modify existing rows
 *   • uses the same uploadImageBuffer + postReelDraftToSlack patterns as the
 *     production job
 */

import { promises as fs } from "node:fs";
import {
  contentVersionsRepo,
  getDb,
  reelsPendingRepo,
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

// ─── CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const force = args.includes("--force");
const itemIdArg = args.find((a) => a.startsWith("--itemId="))?.split("=")[1];

const DAILY_COST_CEILING_USD = Number(
  process.env.REELS_DAILY_COST_CEILING_USD ?? "1.00",
);
const HAITI_TZ = "America/Port-au-Prince";
const SITE_URL = process.env.SITE_URL ?? "https://edlight.news";

// ─── Helpers (mirrored from production buildReelsQueue) ─────────────────

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

const TOPIC_PREFERENCE: ReelsTopic[] = [
  "scholarship",
  "histoire",
  "opportunity",
  "taux",
  "fact",
  "news",
];

function topicForReels(item: Item): ReelsTopic | null {
  const cls = (item as unknown as { classification?: { topics?: string[] } })
    .classification;
  const topics = cls?.topics ?? [];
  for (const t of TOPIC_PREFERENCE) {
    if (topics.includes(t)) return t;
  }
  // Loose category fallback
  const cat = (item as unknown as { category?: string }).category;
  if (cat === "opportunity") return "opportunity";
  if (cat === "scholarship") return "scholarship";
  if (cat === "histoire" || cat === "history") return "histoire";
  if (cat === "taux") return "taux";
  if (cat === "fact") return "fact";
  if (cat === "news") return "news";
  return null;
}

function scoreForReels(item: Item, topic: ReelsTopic): number {
  let s = 50;
  const score = (item as unknown as { score?: number }).score;
  if (typeof score === "number") s = score;
  if (topic === "scholarship") s += 20;
  if (topic === "opportunity") s += 10;
  if (item.imageUrl) s += 5;
  return s;
}

/** Mirrors the production mapCost in buildReelsQueue.ts. */
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

async function postReelDraftToSlack(opts: {
  reelId: string;
  topic: ReelsTopic;
  template: ReelsTemplate;
  durationSec: number;
  costUsd: number;
  mp4Url: string;
  scriptText: string;
  igCaption: string;
  sourceTitle: string | null;
  sourceUrl: string;
  adminUrl: string;
}): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) {
    console.warn("[runBuildReelsQueueOnce] ALERT_WEBHOOK_URL not set — skipping Slack post.");
    return;
  }
  const truncate = (s: string, n: number) =>
    s.length > n ? `${s.slice(0, n - 1)}…` : s;
  const downloadUrl = `${opts.mp4Url}${opts.mp4Url.includes("?") ? "&" : "?"}response-content-disposition=${encodeURIComponent(
    `attachment; filename="${opts.reelId}.mp4"`,
  )}`;
  const headerText = force
    ? `🎬 v1.4 QA Sandra Reel: ${opts.topic}`
    : `🎬 Sandra Reel ready: ${opts.topic}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `🎬 ${force ? "v1.4 QA " : ""}Sandra Reel — ${opts.topic} / ${opts.template}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: headerText, emoji: true } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Template:*\n${opts.template}` },
            { type: "mrkdwn", text: `*Duration:*\n${opts.durationSec.toFixed(1)}s` },
            { type: "mrkdwn", text: `*Cost:*\n$${opts.costUsd.toFixed(4)}` },
            { type: "mrkdwn", text: `*Reel ID:*\n\`${opts.reelId}\`` },
          ],
        },
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
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Sandra script (FR):*\n>>>${truncate(opts.scriptText, 600)}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*IG caption draft:*\n>>>${truncate(opts.igCaption, 500)}`,
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
              url: downloadUrl,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "✅ Review in admin", emoji: true },
              url: opts.adminUrl,
            },
          ],
        },
        ...(force
          ? [
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: "⚠ QA run via `runBuildReelsQueueOnce.ts --force` (slot-guard bypassed). v1.4 templates — premium overhaul commit `ed0998b`.",
                  },
                ],
              },
            ]
          : []),
      ],
    }),
  });
}

// ─── Candidate pick (auto or by --itemId) ───────────────────────────────

async function pickCandidate(): Promise<{
  item: Item;
  cv: ContentVersion;
  topic: ReelsTopic;
  score: number;
} | null> {
  const db = getDb();
  if (itemIdArg) {
    const snap = await db.collection("items").doc(itemIdArg).get();
    if (!snap.exists) {
      console.error(`[runBuildReelsQueueOnce] item not found: ${itemIdArg}`);
      return null;
    }
    const item = { id: snap.id, ...snap.data() } as Item;
    const topic = topicForReels(item);
    if (!topic) {
      console.error(`[runBuildReelsQueueOnce] item ${itemIdArg} has no eligible topic.`);
      return null;
    }
    // Find the most recent fr content version for this item
    const cvs = await contentVersionsRepo.listPublishedForWeb("fr", 200);
    const cv = cvs.find((c) => c.itemId === item.id);
    if (!cv) {
      console.error(`[runBuildReelsQueueOnce] no fr content version for item ${itemIdArg}.`);
      return null;
    }
    return { item, cv, topic, score: scoreForReels(item, topic) };
  }

  // Auto-pick: same logic as production buildReelsQueue
  const recentCvs = await contentVersionsRepo.listPublishedForWeb("fr", 200);
  const itemIds = [...new Set(recentCvs.map((cv) => cv.itemId).filter(Boolean))];
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
  const candidates: Array<{ item: Item; cv: ContentVersion; topic: ReelsTopic; score: number; rank: number }> = [];
  for (const [iid, cv] of cvByItemId) {
    const item = itemMap.get(iid);
    if (!item) continue;
    const topic = topicForReels(item);
    if (!topic) continue;
    const rank = TOPIC_PREFERENCE.indexOf(topic);
    if (rank === -1) continue;
    candidates.push({ item, cv, topic, rank, score: scoreForReels(item, topic) });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : b.score - a.score));
  const top = candidates[0]!;
  return { item: top.item, cv: top.cv, topic: top.topic, score: top.score };
}

// ─── Main ────────────────────────────────────────────────────────────────

const t0 = Date.now();
console.log("[runBuildReelsQueueOnce] flags:", { force, itemId: itemIdArg ?? null });
console.log("[runBuildReelsQueueOnce] FIREBASE_STORAGE_BUCKET =", process.env.FIREBASE_STORAGE_BUCKET);
console.log("[runBuildReelsQueueOnce] ALERT_WEBHOOK_URL set:", !!process.env.ALERT_WEBHOOK_URL);

const haitiToday = getHaitiDateKey();

// ── 1. Slot guard (skipped under --force) ──────────────────────────────
if (!force) {
  try {
    const open = await reelsPendingRepo.listOpenSlotsForDay(haitiToday);
    if (open.length > 0) {
      console.log(`[runBuildReelsQueueOnce] slot-taken:${open[0]!.id} — rerun with --force to bypass.`);
      process.exit(1);
    }
  } catch (err) {
    console.warn("[runBuildReelsQueueOnce] listOpenSlotsForDay failed:", err);
  }
} else {
  console.log("[runBuildReelsQueueOnce] --force: skipping 1-Reel-per-day slot guard.");
}

// ── 2. Cost ceiling guard (always enforced) ───────────────────────────
try {
  const costToday = await reelsPendingRepo.sumCostForDay(haitiToday);
  if (costToday >= DAILY_COST_CEILING_USD) {
    console.log(`[runBuildReelsQueueOnce] cost-ceiling:$${costToday.toFixed(4)}>=${DAILY_COST_CEILING_USD} — aborting.`);
    process.exit(1);
  }
  console.log(`[runBuildReelsQueueOnce] costToday=$${costToday.toFixed(4)} (ceiling=$${DAILY_COST_CEILING_USD})`);
} catch (err) {
  console.warn("[runBuildReelsQueueOnce] sumCostForDay failed:", err);
}

// ── 3. Pick candidate ─────────────────────────────────────────────────
const pick = await pickCandidate();
if (!pick) {
  console.error("[runBuildReelsQueueOnce] no eligible candidate.");
  process.exit(1);
}
console.log(
  `[runBuildReelsQueueOnce] candidate: itemId=${pick.item.id} topic=${pick.topic} score=${pick.score} title="${(pick.item.title ?? "").slice(0, 80)}"`,
);

// ── 4. buildReel ───────────────────────────────────────────────────────
const articleUrl = `${SITE_URL}/news/${pick.cv.id}?lang=fr`;
console.log("[runBuildReelsQueueOnce] calling buildReel()…");
const built = await buildReel({
  topic: pick.topic,
  item: {
    id: pick.item.id,
    title: pick.cv.title || pick.item.title,
    summary:
      pick.cv.summary ||
      (pick.item as unknown as { summary?: string }).summary ||
      "",
    url: articleUrl,
    sourceName: pick.item.source?.name,
  },
  imageUrl: pick.item.imageUrl || undefined,
});
console.log("[runBuildReelsQueueOnce] buildReel done. videoPath=", built.videoPath);

// ── 5. Upload mp4 ──────────────────────────────────────────────────────
const buf = await fs.readFile(built.videoPath);
const objectPath = force
  ? `reels-qa/${haitiToday}/${built.artifact.id}.mp4`
  : `reels/${haitiToday}/${built.artifact.id}.mp4`;
const mp4Url = await uploadImageBuffer(objectPath, buf, "video/mp4");
console.log("[runBuildReelsQueueOnce] uploaded mp4Url=", mp4Url);

// ── 6. Insert pending row ─────────────────────────────────────────────
const reelVariant = `${pick.topic}-${built.artifact.template}-v1.4${force ? "-qa" : ""}`;
const cost = mapCost(built.artifact.cost);
const create: CreateReelsPendingItem = {
  sourceItemId: pick.item.id,
  topic: pick.topic,
  template: built.artifact.template as ReelsTemplate,
  reelVariant,
  language: "fr",
  scriptText: built.artifact.script.voiceover,
  igCaption:
    built.artifact.captionDraft ?? built.artifact.script.caption ?? "",
  mp4Url,
  thumbnailUrl: "",
  durationSec: built.artifact.durationSec,
  status: "pending",
  generatedAt: Timestamp.now(),
  costEstimateUsd: cost.totalUsd,
  costBreakdown: cost,
};
const inserted = await reelsPendingRepo.createReelsPendingItem(create);
console.log("[runBuildReelsQueueOnce] persisted reelId=", inserted.id);

// ── 7. Post to Slack ──────────────────────────────────────────────────
await postReelDraftToSlack({
  reelId: inserted.id,
  topic: pick.topic,
  template: built.artifact.template as ReelsTemplate,
  durationSec: built.artifact.durationSec,
  costUsd: cost.totalUsd,
  mp4Url,
  scriptText: built.artifact.script.voiceover,
  igCaption: create.igCaption,
  sourceTitle: pick.cv.title || pick.item.title || null,
  sourceUrl: articleUrl,
  adminUrl: `${SITE_URL}/admin/reels-pending`,
});
console.log("[runBuildReelsQueueOnce] posted to Slack.");

// ── 8. Cleanup local artifacts ────────────────────────────────────────
void Promise.allSettled([
  fs.rm(built.videoPath, { force: true }),
  fs.rm(built.audioPath, { force: true }),
]);

console.log(
  `[runBuildReelsQueueOnce] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s — cost $${cost.totalUsd.toFixed(4)}.`,
);
