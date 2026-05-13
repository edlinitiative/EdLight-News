/**
 * Repository: social_boost_log
 *
 * Time-series log of every non-zero boost applied by `applySocialBoost`
 * (rollout PR Task 2). Backs the "Boost health" dashboard panel.
 */
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { SocialBoostLogEntry } from "@edlight-news/types";

const COLLECTION = "social_boost_log";

function collection() {
  return getDb().collection(COLLECTION);
}

export interface RecordBoostInput {
  itemId: string;
  topic: string;
  baseScore: number;
  boostedScore: number;
  boost: number;
  platformsContributed: string[];
  capped: boolean;
}

/** Persist one boost-applied event. Fire-and-forget from callers. */
export async function record(entry: RecordBoostInput): Promise<void> {
  await collection().add({
    ...entry,
    appliedAt: FieldValue.serverTimestamp(),
  });
}

/** List entries from the last N hours, newest first. */
export async function listRecent(hours = 168): Promise<SocialBoostLogEntry[]> {
  const cutoffMs = Date.now() - hours * 3600 * 1000;
  const cutoff = new Date(cutoffMs);
  const snap = await collection()
    .where("appliedAt", ">=", cutoff)
    .orderBy("appliedAt", "desc")
    .limit(500)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<SocialBoostLogEntry, "id">) }),
  );
}

/**
 * Aggregate "Boost health" metrics for the last N hours.
 * Returns shape consumed by the admin dashboard panel.
 */
export interface BoostMetricsRollup {
  windowHours: number;
  itemsBoosted: number;
  uniqueItems: number;
  avgBoost: number;
  boostedAtCap: number;
  repeatBoostedItems: number;
  topBoostedItems: Array<{
    itemId: string;
    boost: number;
    boostedScore: number;
    topic: string;
    platformsContributed: string[];
    capped: boolean;
    appliedAt: string | null;
  }>;
}

function tsToIso(ts: Timestamp | undefined | null): string | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate().toISOString();
  }
  const seconds = (ts as unknown as { _seconds?: number })._seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  return null;
}

export async function rollup(hours = 168): Promise<BoostMetricsRollup> {
  const entries = await listRecent(hours);
  const itemsBoosted = entries.length;
  const uniqueIds = new Set(entries.map((e) => e.itemId));
  const boostedAtCap = entries.filter((e) => e.capped).length;
  const sumBoost = entries.reduce((s, e) => s + e.boost, 0);
  const avgBoost = itemsBoosted > 0 ? sumBoost / itemsBoosted : 0;
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.itemId, (counts.get(e.itemId) ?? 0) + 1);
  const repeatBoostedItems = [...counts.values()].filter((n) => n >= 2).length;
  const topBoostedItems = [...entries]
    .sort((a, b) => b.boost - a.boost || b.boostedScore - a.boostedScore)
    .slice(0, 10)
    .map((e) => ({
      itemId: e.itemId,
      boost: e.boost,
      boostedScore: e.boostedScore,
      topic: e.topic,
      platformsContributed: e.platformsContributed,
      capped: e.capped,
      appliedAt: tsToIso(e.appliedAt),
    }));
  return {
    windowHours: hours,
    itemsBoosted,
    uniqueItems: uniqueIds.size,
    avgBoost: Math.round(avgBoost * 10) / 10,
    boostedAtCap,
    repeatBoostedItems,
    topBoostedItems,
  };
}

