/**
 * Worker job: scheduleFbPost
 *
 * Runs on every tick. Takes queued FB items and distributes them across
 * posting slots throughout the day, with highest-scored items getting
 * peak-engagement slots.
 *
 * Dedup rules (applied against FB items sent or already scheduled in
 * the last 24h, PLUS items being scheduled in this batch):
 *   1. Same `dedupeGroupId` on the source item → skip (same story).
 *   2. Title token-overlap (Jaccard) ≥ 0.55 → skip (same story, different
 *      headline wording). Lowered from 0.6 to catch more dupes.
 *   3. Same primary `category` posted within the last 120 minutes → skip
 *      (cooloff increased to spread similar content better).
 *
 * Skipped items are marked `skipped` with a clear reason.
 * High-score items are assigned to early slots for best engagement.
 */

import { fbQueueRepo, getDb } from "@edlight-news/firebase";
import type { FbQueueItem, Item } from "@edlight-news/types";

/** Maximum FB posts per day (increased from 8). */
const DAILY_CAP = 12;

/** Facebook posting slots (Haiti local time America/Port-au-Prince).
 *  12 slots spread 7am–11pm for even distribution. */
const SLOTS = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 30 },
  { hour: 10, minute: 0 },
  { hour: 11, minute: 30 },
  { hour: 13, minute: 0 },
  { hour: 14, minute: 30 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 19, minute: 0 },
  { hour: 20, minute: 30 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 30 },
];

/** Minimum minutes between two posts with the same primary category. */
const CATEGORY_COOLOFF_MINUTES = 120;

/** Jaccard token-overlap threshold — lowered from 0.6 to 0.55 to catch
 *  more duplicates (e.g., "Ouragan Melissa" vs "Hurricane Melissa"). */
const TITLE_SIMILARITY_THRESHOLD = 0.55;

/** Look-back window for "recently posted" comparisons. */
const RECENT_LOOKBACK_HOURS = 24;

// ── Haiti timezone helpers ──────────────────────────────────────────────

const HAITI_TZ = "America/Port-au-Prince";

function toHaitiDate(date: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: HAITI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const obj: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") obj[p.type] = parseInt(p.value, 10);
  }
  return new Date(obj.year, obj.month - 1, obj.day, obj.hour, obj.minute, obj.second);
}

function getNextAvailableSlot(takenSlotISOs: Set<string>): Date | null {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiToday = new Date(haitiNow.getFullYear(), haitiNow.getMonth(), haitiNow.getDate());

  for (const slot of SLOTS) {
    const candidate = new Date(haitiToday.getFullYear(), haitiToday.getMonth(), haitiToday.getDate(), slot.hour, slot.minute, 0);
    const candidateISO = candidate.toISOString();

    // Skip past slots
    if (candidate <= now) continue;

    // Skip already-taken slots
    if (takenSlotISOs.has(candidateISO)) continue;

    return candidate;
  }

  // No slot found today; try tomorrow
  const tomorrow = new Date(haitiToday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const slot of SLOTS) {
    const candidate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), slot.hour, slot.minute, 0);
    const candidateISO = candidate.toISOString();

    if (takenSlotISOs.has(candidateISO)) continue;
    return candidate;
  }

  return null;
}

// ── Dedup & scoring ──────────────────────────────────────────────────────

const STOPWORDS = new Set([
  // FR
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au", "aux",
  "en", "dans", "sur", "pour", "par", "avec", "sans", "ce", "cette", "ces", "qui",
  "que", "quoi", "dont", "où", "se", "sa", "son", "ses", "leur", "leurs", "est",
  "sont", "été", "être", "avoir", "ont", "a", "n", "y",
  // HT
  "yo", "li", "ki", "nan", "sou", "pou", "ak", "epi", "men", "se", "te", "p",
  // EN (just in case)
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "by", "with",
  "is", "are", "was", "were", "be", "been", "this", "that",
]);

function normalizeTitle(text: string | undefined | null): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/** Extract the headline from a FB post payload. We compose payloads as
 *  "<hook> : <title>\n\n<summary>\n\nSource: ..." — the first line minus
 *  the hook is the title we care about. */
function extractTitleFromPayload(text: string | undefined | null): string {
  if (!text) return "";
  const firstLine = text.split("\n", 1)[0] ?? "";
  const colonIdx = firstLine.indexOf(":");
  return (colonIdx >= 0 ? firstLine.slice(colonIdx + 1) : firstLine).trim();
}

function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: unknown }).toDate;
    if (typeof fn === "function") {
      const d = (fn as () => Date).call(value);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const s = (value as { seconds?: unknown }).seconds;
    if (typeof s === "number") return new Date(s * 1000);
  }
  return null;
}

interface RecentSignature {
  dedupeGroupId: string | null;
  category: string | null;
  titleTokens: Set<string>;
  postedAt: Date | null;
}

async function loadSourceItems(ids: string[]): Promise<Map<string, Item>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const db = getDb();
  const refs = unique.map((id) => db.collection("items").doc(id));
  const snaps = await db.getAll(...refs);
  const out = new Map<string, Item>();
  for (const snap of snaps) {
    if (snap.exists) out.set(snap.id, { id: snap.id, ...snap.data() } as Item);
  }
  return out;
}

function buildSignature(
  queueItem: FbQueueItem,
  sourceItem: Item | undefined,
  whenOverride?: Date,
): RecentSignature {
  const title =
    sourceItem?.title || extractTitleFromPayload(queueItem.payload?.text);
  return {
    dedupeGroupId: sourceItem?.dedupeGroupId ?? null,
    category: sourceItem?.category ?? null,
    titleTokens: normalizeTitle(title),
    postedAt:
      whenOverride ??
      toDateMaybe(queueItem.scheduledFor) ??
      toDateMaybe(queueItem.updatedAt) ??
      null,
  };
}

function isDuplicate(
  candidate: RecentSignature,
  recents: RecentSignature[],
): { dup: true; reason: string } | { dup: false } {
  for (const r of recents) {
    if (
      candidate.dedupeGroupId &&
      r.dedupeGroupId &&
      candidate.dedupeGroupId === r.dedupeGroupId
    ) {
      return { dup: true, reason: `same dedupeGroupId=${candidate.dedupeGroupId}` };
    }
    const sim = jaccard(candidate.titleTokens, r.titleTokens);
    if (sim >= TITLE_SIMILARITY_THRESHOLD) {
      return { dup: true, reason: `title overlap ${sim.toFixed(2)} ≥ ${TITLE_SIMILARITY_THRESHOLD}` };
    }
    if (
      candidate.category &&
      r.category &&
      candidate.category === r.category &&
      r.postedAt
    ) {
      const minutesAgo = (Date.now() - r.postedAt.getTime()) / (1000 * 60);
      if (minutesAgo < CATEGORY_COOLOFF_MINUTES) {
        return {
          dup: true,
          reason: `category=${candidate.category} cool-off (${minutesAgo.toFixed(0)}m < ${CATEGORY_COOLOFF_MINUTES}m)`,
        };
      }
    }
  }
  return { dup: false };
}

export interface ScheduleFbPostResult {
  scheduled: number;
  skippedCap: number;
  skippedDuplicate: number;
}

export async function scheduleFbPost(): Promise<ScheduleFbPostResult> {
  const result: ScheduleFbPostResult = {
    scheduled: 0,
    skippedCap: 0,
    skippedDuplicate: 0,
  };

  try {
    const sentToday = await fbQueueRepo.countSentToday();
    const scheduledToday = await fbQueueRepo.countScheduledToday();
    const totalToday = sentToday + scheduledToday;

    if (totalToday >= DAILY_CAP) {
      console.log(`[scheduleFbPost] Daily cap reached (${totalToday}/${DAILY_CAP})`);
      return result;
    }

    const remaining = DAILY_CAP - totalToday;

    const queued = await fbQueueRepo.listQueuedByScore(remaining * 3); // overfetch so dedup has options
    if (queued.length === 0) {
      console.log("[scheduleFbPost] No queued FB items");
      return result;
    }

    // Recent context: already-sent (last 24h) + currently scheduled.
    const [recentSent, alreadyScheduled] = await Promise.all([
      fbQueueRepo.listRecentSent(RECENT_LOOKBACK_HOURS, 50),
      fbQueueRepo.listScheduled(50),
    ]);

    // Batch-fetch source items for everything we need to compare.
    const sourceIds = [
      ...queued.map((q) => q.sourceContentId),
      ...recentSent.map((q) => q.sourceContentId),
      ...alreadyScheduled.map((q) => q.sourceContentId),
    ];
    const sourceItems = await loadSourceItems(sourceIds);

    const recentSignatures: RecentSignature[] = [
      ...recentSent.map((q) => buildSignature(q, sourceItems.get(q.sourceContentId))),
      ...alreadyScheduled.map((q) => buildSignature(q, sourceItems.get(q.sourceContentId))),
    ];

    // Collect already-taken slots from today's scheduled items
    const takenSlots = new Set<string>();
    for (const item of alreadyScheduled) {
      if (item.scheduledFor) takenSlots.add(item.scheduledFor);
    }

    for (const item of queued) {
      if (result.scheduled >= remaining) {
        result.skippedCap++;
        continue;
      }

      // Check dedup BEFORE assigning a slot
      const candidateSig = buildSignature(item, sourceItems.get(item.sourceContentId));
      const dupCheck = isDuplicate(candidateSig, recentSignatures);

      if (dupCheck.dup) {
        result.skippedDuplicate++;
        try {
          await fbQueueRepo.updateStatus(item.id, "skipped", {
            reasons: [`Duplicate / too-related: ${dupCheck.reason}`],
          });
        } catch (err) {
          console.warn(
            `[scheduleFbPost] Failed to mark ${item.id} skipped:`,
            err instanceof Error ? err.message : err,
          );
        }
        console.log(
          `[scheduleFbPost] Skipped ${item.id} as duplicate — ${dupCheck.reason}`,
        );
        continue;
      }

      // Passed dedup — assign next available slot
      const slot = getNextAvailableSlot(takenSlots);
      if (!slot) {
        console.log(`[scheduleFbPost] No available slots for ${item.id}`);
        result.skippedCap++;
        continue;
      }

      const iso = slot.toISOString();
      await fbQueueRepo.setScheduled(item.id, iso);
      takenSlots.add(iso);
      recentSignatures.push(candidateSig);
      result.scheduled++;
      console.log(`[scheduleFbPost] Scheduled ${item.id} → ${iso}`);
    }

    console.log("[scheduleFbPost] Done:", result);
    return result;
  } catch (err) {
    console.error("[scheduleFbPost] Error:", err);
    return result;
  }
}
