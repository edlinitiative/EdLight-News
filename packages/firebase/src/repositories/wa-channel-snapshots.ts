/**
 * Repository: wa_channel_snapshots
 *
 * Manual snapshots of the WhatsApp Channel follower count
 * (rollout PR Task 4). The Meta API does not currently expose this number.
 */
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { WaChannelSnapshot } from "@edlight-news/types";

const COLLECTION = "wa_channel_snapshots";

function collection() {
  return getDb().collection(COLLECTION);
}

export interface CreateSnapshotInput {
  dateISO: string;
  followerCount: number;
  source: "manual" | "script" | "api";
  notes?: string;
}

export async function create(input: CreateSnapshotInput): Promise<WaChannelSnapshot> {
  const ref = collection().doc();
  // Strip undefined values — Firestore rejects them unless ignoreUndefinedProperties
  // is set on the Admin SDK init, which we don't do globally.
  const data: Record<string, unknown> = {
    dateISO: input.dateISO,
    followerCount: input.followerCount,
    source: input.source,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (typeof input.notes === "string" && input.notes.length > 0) {
    data.notes = input.notes;
  }
  await ref.set(data);
  const snap = await ref.get();
  return { id: ref.id, ...(snap.data() as Omit<WaChannelSnapshot, "id">) };
}

export async function listRecent(limit = 30): Promise<WaChannelSnapshot[]> {
  const snap = await collection()
    .orderBy("dateISO", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<WaChannelSnapshot, "id">) }),
  );
}

function tsToIso(ts: Timestamp | undefined | null): string | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate().toISOString();
  }
  return null;
}

/**
 * Compute the most-recent count and a 7-day delta for the dashboard badge.
 * Returns null when no snapshots exist.
 */
export interface SnapshotSummary {
  latest: {
    followerCount: number;
    dateISO: string;
    source: string;
    notes?: string;
    createdAt: string | null;
  };
  delta7d: number | null;
  delta7dPct: number | null;
  count: number;
  recent: Array<{
    dateISO: string;
    followerCount: number;
    source: string;
    notes?: string;
    createdAt: string | null;
  }>;
}

export async function summarize(): Promise<SnapshotSummary | null> {
  const recent = await listRecent(30);
  if (recent.length === 0) return null;
  const latest = recent[0]!;
  // Find the snapshot closest to (latest - 7 days) without going past it.
  const latestMs = new Date(latest.dateISO).getTime();
  const targetMs = latestMs - 7 * 24 * 3600 * 1000;
  let baseline: WaChannelSnapshot | undefined;
  for (const s of recent) {
    const ms = new Date(s.dateISO).getTime();
    if (ms <= targetMs) {
      baseline = s;
      break;
    }
  }
  const delta7d = baseline ? latest.followerCount - baseline.followerCount : null;
  const delta7dPct =
    baseline && baseline.followerCount > 0
      ? Math.round(((latest.followerCount - baseline.followerCount) / baseline.followerCount) * 1000) / 10
      : null;
  return {
    latest: {
      followerCount: latest.followerCount,
      dateISO: latest.dateISO,
      source: latest.source,
      notes: latest.notes,
      createdAt: tsToIso(latest.createdAt),
    },
    delta7d,
    delta7dPct,
    count: recent.length,
    recent: recent.map((s) => ({
      dateISO: s.dateISO,
      followerCount: s.followerCount,
      source: s.source,
      notes: s.notes,
      createdAt: tsToIso(s.createdAt),
    })),
  };
}

/**
 * Detect a 2-consecutive-negative-delta WA churn alert (Task 6).
 * Returns true when the most recent two snapshots both show a negative
 * 7-day delta vs their respective baselines.
 */
export async function detectChurnAlert(): Promise<{
  alert: boolean;
  recent: Array<{ dateISO: string; followerCount: number; delta7d: number | null }>;
}> {
  const recent = await listRecent(15);
  if (recent.length < 2) return { alert: false, recent: [] };
  function deltaFor(idx: number): number | null {
    const cur = recent[idx]!;
    const targetMs = new Date(cur.dateISO).getTime() - 7 * 24 * 3600 * 1000;
    for (let j = idx + 1; j < recent.length; j++) {
      if (new Date(recent[j]!.dateISO).getTime() <= targetMs) {
        return cur.followerCount - recent[j]!.followerCount;
      }
    }
    return null;
  }
  const d0 = deltaFor(0);
  const d1 = deltaFor(1);
  const alert = d0 !== null && d1 !== null && d0 < 0 && d1 < 0;
  return {
    alert,
    recent: [
      { dateISO: recent[0]!.dateISO, followerCount: recent[0]!.followerCount, delta7d: d0 },
      { dateISO: recent[1]!.dateISO, followerCount: recent[1]!.followerCount, delta7d: d1 },
    ],
  };
}
