#!/usr/bin/env npx tsx
/**
 * Diagnostic: Trace why bourses/scholarships aren't entering the IG queue.
 *
 * For ALL items with opportunity-related categories (scholarship, bourses,
 * opportunity, concours, stages, programmes), runs through the exact same
 * gates as decideIG() + buildIgQueue() and reports WHERE each item drops out.
 *
 * Gates checked (in order):
 *   1. mapCategoryToIGType — does category map to a valid IG type?
 *   2. hasRealOpportunityFields — eligibility + link check
 *   3. qualityFlags — offMission / needsReview / lowConfidence
 *   4. imageUrl / BRANDED_IMAGE_TYPES
 *   5. Deadline present (non-evergreen)
 *   6. Haiti relevance
 *   7. French content_version exists
 *   8. decideIG final result (igEligible, igType, score, reasons)
 *   9. Already in ig_queue?
 *
 * Usage: cd apps/worker && npx tsx src/scripts/_diagnoseBourseIgPipeline.ts
 */
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import { decideIG, applyDedupePenalty } from "@edlight-news/generator/ig/index.js";
import type { Item } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../..", ".env") });

// ── Opportunity-related categories ──────────────────────────────────────────
const OPPORTUNITY_CATEGORIES = new Set([
  "scholarship", "bourses", "opportunity", "concours", "stages", "programmes",
]);

// ── Gate tracking ───────────────────────────────────────────────────────────
interface GateResult {
  gate: string;
  passed: boolean;
  detail: string;
}

interface ItemDiagnosis {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  gates: GateResult[];
  igDecision?: { eligible: boolean; type: string | null; score: number; reasons: string[] };
  inIgQueue: boolean;
  inIgQueueStatus?: string;
}

async function main() {
  const db = getDb();

  // ── 1. Fetch ALL opportunity-tagged items ────────────────────────────────
  console.log("🔍  Diagnosing bourse/scholarship IG pipeline…\n");

  // By vertical
  const verticalSnap = await db.collection("items")
    .where("vertical", "==", "opportunites").limit(500).get();

  // By category
  const catSnaps = await Promise.all(
    Array.from(OPPORTUNITY_CATEGORIES).map((c) =>
      db.collection("items").where("category", "==", c).limit(200).get()
    ),
  );

  // Deduplicate
  const itemsMap = new Map<string, any>();
  for (const doc of verticalSnap.docs) {
    itemsMap.set(doc.id, { id: doc.id, ...doc.data() });
  }
  for (let i = 0; i < catSnaps.length; i++) {
    for (const doc of catSnaps[i].docs) {
      if (!itemsMap.has(doc.id)) {
        itemsMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    }
  }

  const items = Array.from(itemsMap.values());
  console.log(`📊  Total unique opportunity-tagged items: ${items.length}`);
  console.log(`    by vertical=opportunites:        ${verticalSnap.size}`);
  for (let i = 0; i < catSnaps.length; i++) {
    const c = Array.from(OPPORTUNITY_CATEGORIES)[i];
    console.log(`    by category="${c}":`.padEnd(32) + `${catSnaps[i].size}`);
  }
  console.log();

  // ── Pre-fetch ig_queue entries for these items ──────────────────────────
  const sourceContentIds = items.map((i: any) => i.id);
  // Batch in groups of 30 (Firestore IN limit)
  const queueEntries = new Map<string, any>();
  for (let i = 0; i < sourceContentIds.length; i += 30) {
    const batch = sourceContentIds.slice(i, i + 30);
    if (batch.length === 0) continue;
    const qSnap = await db.collection("ig_queue")
      .where("sourceContentId", "in", batch)
      .get();
    for (const doc of qSnap.docs) {
      queueEntries.set(doc.id, doc.data());
    }
  }

  // ── Pre-fetch content_versions for these items (batched) ────────────────
  const cvMap = new Map<string, { fr?: any; ht?: any }>();
  for (let i = 0; i < sourceContentIds.length; i += 30) {
    const batch = sourceContentIds.slice(i, i + 30);
    if (batch.length === 0) continue;
    const cvSnap = await db.collection("content_versions")
      .where("itemId", "in", batch)
      .get();
    for (const doc of cvSnap.docs) {
      const data = doc.data() as any;
      const iid = data.itemId;
      if (!cvMap.has(iid)) cvMap.set(iid, {});
      const entry = cvMap.get(iid)!;
      if (data.language === "fr") entry.fr = data;
      if (data.language === "ht") entry.ht = data;
    }
  }

  // ── Track totals for summary ────────────────────────────────────────────
  const summary = {
    total: items.length,
    gated_mapCategory: 0,
    gated_hasRealOppFields: 0,
    gated_offMission: 0,
    gated_needsReview: 0,
    gated_imageMissing: 0,
    gated_noDeadline: 0,
    gated_notHaitiRelevant: 0,
    gated_noFrContentVersion: 0,
    gated_decideIgRejected: 0,
    passedDecideIg: 0,
    alreadyInQueue: 0,
    diagnoses: [] as ItemDiagnosis[],
  };

  // ── 2. Run each item through the gates ──────────────────────────────────
  for (const item of items) {
    const gates: GateResult[] = [];
    const diagnosis: ItemDiagnosis = {
      id: item.id,
      title: (item.title ?? "").slice(0, 80),
      category: item.category ?? "none",
      createdAt: item.createdAt?.toDate?.()?.toISOString?.() ?? "unknown",
      gates,
      inIgQueue: false,
    };

    // ── Gate 1: mapCategoryToIGType ───────────────────────────────────────
    const igType = mapCategoryToIGType(item);
    gates.push({
      gate: "mapCategoryToIGType",
      passed: igType !== null,
      detail: igType
        ? `category="${item.category}" → igType="${igType}"`
        : `category="${item.category}" → no IG type mapping`,
    });
    if (!igType) {
      summary.gated_mapCategory++;
      summary.diagnoses.push(diagnosis);
      continue;
    }

    // ── Gate 2: hasRealOpportunityFields (for scholarship/bourses types) ──
    if (igType === "scholarship" || igType === "opportunity") {
      const hasFields = hasRealOpportunityFields(item);
      gates.push({
        gate: "hasRealOpportunityFields",
        passed: hasFields,
        detail: hasFields
          ? "Passed: eligibility + link present"
          : `FAILED: ${describeMissingFields(item)}`,
      });
      if (!hasFields) {
        summary.gated_hasRealOppFields++;
        // Don't continue — decideIG will also check this and set reasons
      }
    }

    // ── Gate 3: Run actual decideIG() ─────────────────────────────────────
    const decision = decideIG(item as Item);
    diagnosis.igDecision = {
      eligible: decision.igEligible,
      type: decision.igType,
      score: decision.igPriorityScore,
      reasons: decision.reasons,
    };

    gates.push({
      gate: "decideIG",
      passed: decision.igEligible,
      detail: decision.igEligible
        ? `✅ Eligible: type=${decision.igType}, score=${decision.igPriorityScore}`
        : `❌ Rejected: ${decision.reasons.slice(0, 3).join("; ")}`,
    });

    if (!decision.igEligible) {
      summary.gated_decideIgRejected++;
    } else {
      summary.passedDecideIg++;
    }

    // ── Gate 4: French content_version exists ─────────────────────────────
    const cv = cvMap.get(item.id);
    const hasFrCv = !!cv?.fr;
    const frStatus = cv?.fr?.status ?? "none";
    gates.push({
      gate: "FR content_version",
      passed: hasFrCv && frStatus === "published",
      detail: hasFrCv
        ? `✅ FR version exists (status=${frStatus})`
        : `❌ No FR content_version (HT=${!!cv?.ht ? cv.ht.status : "none"})`,
    });
    if (!hasFrCv || frStatus !== "published") {
      summary.gated_noFrContentVersion++;
    }

    // ── Gate 5: Already in ig_queue? ─────────────────────────────────────
    const queueEntry = Array.from(queueEntries.values()).find(
      (q: any) => q.sourceContentId === item.id,
    );
    diagnosis.inIgQueue = !!queueEntry;
    diagnosis.inIgQueueStatus = queueEntry?.status;
    gates.push({
      gate: "ig_queue",
      passed: !!queueEntry,
      detail: queueEntry
        ? `✅ Found in ig_queue (status=${queueEntry.status})`
        : `❌ NOT in ig_queue`,
    });
    if (queueEntry) {
      summary.alreadyInQueue++;
    }

    summary.diagnoses.push(diagnosis);
  }

  // ── 3. Print summary ────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════");
  console.log("  PIPELINE SUMMARY");
  console.log("══════════════════════════════════════════════════");
  console.log(`  Total opportunity-tagged items:    ${summary.total}`);
  console.log(`  └─ No IG type mapping:             ${summary.gated_mapCategory}`);
  console.log(`  └─ Failed hasRealOpportunityFields: ${summary.gated_hasRealOppFields}`);
  console.log(`  └─ Rejected by decideIG:           ${summary.gated_decideIgRejected}`);
  console.log(`  └─ No FR content_version:          ${summary.gated_noFrContentVersion}`);
  console.log(`  └─ PASSED decideIG:                ${summary.passedDecideIg}`);
  console.log(`  └─ Already in ig_queue:            ${summary.alreadyInQueue}`);
  console.log();

  // ── 4. Print diagnoses grouped by outcome ──────────────────────────────
  const rejected = summary.diagnoses.filter((d) => !d.igDecision?.eligible);
  const passed = summary.diagnoses.filter((d) => d.igDecision?.eligible);
  const inQueue = summary.diagnoses.filter((d) => d.inIgQueue);

  console.log("── REJECTED BY decideIG ──────────────────────────");
  for (const d of rejected.slice(0, 30)) {
    const reason = d.igDecision?.reasons.slice(0, 2).join(" | ") ?? "unknown";
    console.log(`  ❌ ${d.id.slice(0, 12)} | ${d.title.slice(0, 50)} | ${reason}`);
  }
  if (rejected.length > 30) {
    console.log(`  … and ${rejected.length - 30} more rejected items`);
  }
  console.log();

  if (passed.length > 0) {
    console.log("── PASSED decideIG ───────────────────────────────");
    for (const d of passed.slice(0, 30)) {
      const inQ = d.inIgQueue ? "✅ in_queue" : "❌ NOT in_queue";
      console.log(
        `  ✅ ${d.id.slice(0, 12)} | ${d.title.slice(0, 50)} | score=${d.igDecision?.score} | ${inQ}`,
      );
    }
    if (passed.length > 30) {
      console.log(`  … and ${passed.length - 30} more passed items`);
    }
  }
  console.log();

  // ── 5. Deep-dive: items that passed decideIG but NOT in ig_queue ────────
  const passedNotQueued = passed.filter((d) => !d.inIgQueue);
  if (passedNotQueued.length > 0) {
    console.log("── PASSED decideIG BUT NOT IN QUEUE ───────────────");
    console.log("  (Reasons: no FR content_version, stale date, per-run cap, etc.)");
    for (const d of passedNotQueued.slice(0, 20)) {
      const frGate = d.gates.find((g) => g.gate === "FR content_version");
      const frDetail = frGate ? frGate.detail : "unknown";
      console.log(`  ${d.id.slice(0, 12)} | ${d.title.slice(0, 50)}`);
      console.log(`    FR: ${frDetail}`);
      console.log(`    score=${d.igDecision?.score} type=${d.igDecision?.type}`);
    }
    if (passedNotQueued.length > 20) {
      console.log(`  … and ${passedNotQueued.length - 20} more`);
    }
  } else if (passed.length > 0) {
    console.log("✅  All items that passed decideIG are already in ig_queue.");
  }

  // ── 6. Items in queue with details ──────────────────────────────────────
  if (inQueue.length > 0) {
    console.log("\n── ITEMS IN ig_queue ─────────────────────────────");
    for (const d of inQueue) {
      console.log(`  ${d.id.slice(0, 12)} | ${d.title.slice(0, 50)} | status=${d.inIgQueueStatus}`);
    }
  }

  console.log("\n✅  Diagnosis complete.");
}

// ── Inline helpers mirroring selection.ts logic ────────────────────────────

function mapCategoryToIGType(item: any): string | null {
  const cat = item.category;
  const itemType = item.itemType;
  const series = item.utilityMeta?.series;

  if (itemType === "utility") {
    if (series === "HaitiHistory" || series === "HaitiFactOfTheDay" || series === "HaitianOfTheWeek") {
      return "histoire";
    }
    return "utility";
  }

  switch (cat) {
    case "scholarship":
    case "bourses":
      if (!hasRealOpportunityFields(item)) return "news";
      return "scholarship";
    case "opportunity":
    case "concours":
    case "stages":
    case "programmes":
      if (!hasRealOpportunityFields(item)) return "news";
      return "opportunity";
    case "news":
    case "local_news":
    case "event":
      return "news";
    case "resource":
      return "utility";
    default:
      return null;
  }
}

function hasRealOpportunityFields(item: any): boolean {
  const opp = item.opportunity;
  if (!opp) return false;

  const text = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();
  const NEWS_SIGNAL_WORDS = [
    "victoire", "match", "equipe", "football", "championnat",
    "attentat", "meurtre", "arrestation", "gang", "violence",
    "élection", "sénateur", "député", "premier ministre",
    "manifestation", "protestation", "crise politique",
  ];
  let newsHits = 0;
  for (const word of NEWS_SIGNAL_WORDS) {
    if (text.includes(word)) newsHits++;
    if (newsHits >= 2) return false;
  }

  const hasEligibility = !!(opp.eligibility && opp.eligibility.length > 0);
  if (!hasEligibility) return false;

  const hasHowToApply = !!(opp.howToApply && opp.howToApply.trim().length > 10);
  const hasOfficialLink = !!(opp.officialLink && opp.officialLink.trim().length > 5);
  const canonicalUrl = item.canonicalUrl ?? item.source?.originalUrl ?? "";
  const hasCanonicalLink = canonicalUrl.length > 5;

  if (!hasHowToApply && !hasOfficialLink && !hasCanonicalLink) return false;

  const bodyText = item.extractedText ?? item.summary ?? "";
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 80) return true;

  const hasStructuredOppSignals =
    (opp.coverage?.trim().length ?? 0) > 10 ||
    (opp.howToApply?.trim().length ?? 0) > 20 ||
    (opp.deadline?.trim().length ?? 0) > 0 ||
    (opp.eligibility?.length ?? 0) >= 2;

  return hasStructuredOppSignals;
}

function describeMissingFields(item: any): string {
  const opp = item.opportunity;
  const missing: string[] = [];
  if (!opp) return "No opportunity object";
  if (!opp.eligibility || opp.eligibility.length === 0) missing.push("eligibility");
  if (!(opp.howToApply?.trim().length > 10)) missing.push("howToApply");
  if (!(opp.officialLink?.trim().length > 5)) {
    const url = item.canonicalUrl ?? item.source?.originalUrl ?? "";
    if (!url) missing.push("officialLink/canonicalUrl");
  }
  if (missing.length === 0) {
    const text = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();
    if (["victoire", "match", "equipe", "football", "élection"].some((w) => text.includes(w))) {
      return "Looks like news content (sports/politics keywords)";
    }
    const bodyText = item.extractedText ?? item.summary ?? "";
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 80) return `Thin content (${wordCount} words) with insufficient structured opp signals`;
    return "Unknown reason";
  }
  return `Missing: ${missing.join(", ")}`;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
