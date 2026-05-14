import { NextResponse } from "next/server";
import { reelsPendingRepo, getDb } from "@edlight-news/firebase";
import type {
  ReelsPendingItem,
  ReelsMetrics,
} from "@edlight-news/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const HAITI_TZ = "America/Port-au-Prince";
const DAILY_COST_CEILING_USD = Number(
  process.env.REELS_DAILY_COST_CEILING_USD ?? "1.00",
);
const REELS_ENABLED = process.env.REELS_ENABLED === "true";

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null) {
    const v = value as { _seconds?: number; toDate?: () => Date };
    if (typeof v._seconds === "number") return new Date(v._seconds * 1000).toISOString();
    if (typeof v.toDate === "function") return v.toDate().toISOString();
  }
  return null;
}

function getHaitiDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function metricsToJson(m: ReelsMetrics | undefined): Record<string, unknown> | null {
  if (!m) return null;
  return {
    plays: m.plays,
    reach: m.reach,
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
    saves: m.saves,
    totalInteractions: m.totalInteractions,
    avgWatchTimeSec: m.avgWatchTimeSec,
    watchCompletionRate: m.watchCompletionRate,
    lastSyncedAt: timestampToIso(m.lastSyncedAt),
  };
}

async function loadArticles(itemIds: string[]) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (ids.length === 0) return new Map<string, Record<string, unknown> | null>();
  const db = getDb();
  const refs = ids.map((id) => db.collection("items").doc(id));
  const snaps = await db.getAll(...refs);
  const map = new Map<string, Record<string, unknown> | null>();
  for (const snap of snaps) {
    if (!snap.exists) {
      map.set(snap.id, null);
      continue;
    }
    const d = snap.data() ?? {};
    map.set(snap.id, {
      title: d.title ?? null,
      summary: d.summary ?? null,
      sourceName: d.source?.name ?? null,
      canonicalUrl: d.canonicalUrl ?? null,
      imageUrl: d.imageUrl ?? null,
    });
  }
  return map;
}

function entryToJson(
  item: ReelsPendingItem,
  articles: Map<string, Record<string, unknown> | null>,
) {
  return {
    id: item.id,
    sourceItemId: item.sourceItemId,
    topic: item.topic,
    template: item.template,
    reelVariant: item.reelVariant,
    language: item.language,
    scriptText: item.scriptText,
    igCaption: item.igCaption,
    mp4Url: item.mp4Url,
    thumbnailUrl: item.thumbnailUrl ?? "",
    durationSec: item.durationSec,
    status: item.status,
    generatedAt: timestampToIso(item.generatedAt),
    approvedAt: timestampToIso(item.approvedAt),
    approvedBy: item.approvedBy ?? null,
    postedAt: timestampToIso(item.postedAt),
    igMediaId: item.igMediaId ?? null,
    igPostUrl: item.igPostUrl ?? null,
    rejectionReason: item.rejectionReason ?? null,
    costEstimateUsd: item.costEstimateUsd ?? null,
    costBreakdown: item.costBreakdown ?? null,
    socialMetrics: metricsToJson(item.socialMetrics),
    article: articles.get(item.sourceItemId) ?? null,
  };
}

export async function GET() {
  try {
    const haitiDate = getHaitiDateKey();
    const [pending, approved, posted, leaderboard, costToday] = await Promise.all([
      reelsPendingRepo.listByStatus("pending", 50),
      reelsPendingRepo.listByStatus("approved", 50),
      reelsPendingRepo.listPostedSince(30, 100),
      reelsPendingRepo.computeVariantLeaderboard({ days: 30, minPosts: 3 }),
      reelsPendingRepo.sumCostForDay(haitiDate),
    ]);

    const allItemIds = [
      ...pending.map((i) => i.sourceItemId),
      ...approved.map((i) => i.sourceItemId),
      ...posted.map((i) => i.sourceItemId),
    ];
    const articles = await loadArticles(allItemIds);

    return NextResponse.json(
      {
        pending: pending.map((i) => entryToJson(i, articles)),
        approved: approved.map((i) => entryToJson(i, articles)),
        posted: posted.map((i) => entryToJson(i, articles)),
        leaderboard,
        costToday,
        ceilingUsd: DAILY_COST_CEILING_USD,
        haitiDate,
        enabled: REELS_ENABLED,
      },
      NO_STORE,
    );
  } catch (err) {
    console.error("[api/admin/reels-pending] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load reels" },
      { status: 500, headers: NO_STORE.headers },
    );
  }
}
