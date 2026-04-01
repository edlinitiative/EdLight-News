import { igQueueRepo } from "@edlight-news/firebase";
import { getHaitiOffsetHours, toHaitiDate, isStale, DAILY_STAPLES, STAPLE_SLOT_INDEX, SLOTS, getNextAvailableSlot, matchesTargetPostDate, STALENESS_TTL_HOURS } from "../jobs/scheduleIgPost.js";
import type { IGPostType } from "@edlight-news/types";

function getHaitiTodayISO(): string {
  const haiti = toHaitiDate(new Date());
  const year = haiti.getFullYear();
  const month = String(haiti.getMonth() + 1).padStart(2, "0");
  const day = String(haiti.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main() {
  const haitiToday = getHaitiTodayISO();
  console.log("Haiti today:", haitiToday);
  console.log("UTC now:", new Date().toISOString());

  const todayStatuses = await igQueueRepo.listPostedAndScheduledToday();
  console.log("\ntodayStatuses:", JSON.stringify(todayStatuses, null, 2));

  const scheduledItems = await igQueueRepo.listScheduled(20);
  const takenSlots = new Set<string>();
  for (const s of scheduledItems) {
    if (s.scheduledFor) takenSlots.add(new Date(s.scheduledFor).toISOString());
  }
  console.log("\ntakenSlots:", [...takenSlots]);

  const queued = await igQueueRepo.listQueuedByScore(30);
  const fresh: typeof queued = [];
  for (const item of queued) {
    if (isStale(item)) {
      console.log(`STALE: ${item.id} (${item.igType})`);
    } else {
      fresh.push(item);
    }
  }
  console.log(`\nfresh items: ${fresh.length}`);
  console.log("types in fresh:", [...fresh.reduce((m, i) => { m.set(i.igType, (m.get(i.igType)??0)+1); return m; }, new Map())]);

  // Trace Phase 1 for each staple
  for (const stapleType of DAILY_STAPLES) {
    console.log(`\n--- Checking staple: ${stapleType} ---`);
    
    const alreadyCovered = todayStatuses.some(
      (s) => s.igType === stapleType && matchesTargetPostDate(s, haitiToday)
    );
    console.log(`  alreadyCovered: ${alreadyCovered}`);
    if (alreadyCovered) continue;

    const candidate = fresh.find(
      (q) => q.igType === stapleType && matchesTargetPostDate(q, haitiToday)
    );
    console.log(`  candidate: ${candidate ? `${candidate.id} (score=${candidate.score}, targetPostDate=${candidate.targetPostDate})` : 'NONE'}`);
    if (!candidate) continue;

    const pinnedIdx = STAPLE_SLOT_INDEX[stapleType];
    const pinnedSlotDef = pinnedIdx != null ? SLOTS[pinnedIdx] : null;
    if (pinnedSlotDef) {
      const offsetHours = getHaitiOffsetHours(new Date());
      const haitiNow = toHaitiDate(new Date());
      const pinnedDate = new Date(Date.UTC(
        haitiNow.getFullYear(), haitiNow.getMonth(), haitiNow.getDate(),
        pinnedSlotDef.hour + offsetHours, pinnedSlotDef.minute, 0, 0
      ));
      console.log(`  pinned slot: ${pinnedDate.toISOString()} (${pinnedSlotDef.hour}:${pinnedSlotDef.minute} Haiti)`);
      console.log(`  pinned taken: ${takenSlots.has(pinnedDate.toISOString())}, pinned future: ${pinnedDate > new Date()}`);
    }

    const slot = getNextAvailableSlot(takenSlots, true);
    console.log(`  nextAvailableSlot (todayOnly): ${slot?.toISOString() ?? 'NULL'}`);
  }
}
main().catch(console.error);
