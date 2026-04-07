/**
 * One-off script: reset IG queue items that were held due to GCP billing errors
 * back to "scheduled" so the next pipeline tick retries Storage upload + publish.
 *
 * Usage: npx tsx src/scripts/resetBillingHeldIgItems.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();
  const col = db.collection("ig_queue");

  // Find all items stuck in scheduled_ready_for_manual with a billing reason
  const snap = await col
    .where("status", "==", "scheduled_ready_for_manual")
    .get();

  if (snap.empty) {
    console.log("No scheduled_ready_for_manual items found.");
    return;
  }

  let reset = 0;
  let skipped = 0;

  const batch = db.batch();

  for (const doc of snap.docs) {
    const data = doc.data();
    const reasons: string[] = data.reasons ?? [];
    const hasBillingReason = reasons.some(
      (r) =>
        r.includes("billing") ||
        r.includes("delinquent") ||
        r.includes("Storage billing"),
    );

    if (hasBillingReason) {
      const newReasons = [
        ...reasons,
        "Reset to scheduled after billing was re-enabled",
      ];
      batch.update(doc.ref, {
        status: "scheduled",
        reasons: newReasons,
      });
      console.log(`  ↺ ${doc.id} (${data.igType}) — resetting`);
      reset++;
    } else {
      console.log(
        `  — ${doc.id} (${data.igType}) — held for non-billing reason, skipping`,
      );
      skipped++;
    }
  }

  if (reset > 0) {
    await batch.commit();
    console.log(`\nDone: reset ${reset} item(s), skipped ${skipped}.`);
    console.log("They will be picked up on the next pipeline tick.");
  } else {
    console.log(`\nNo billing-held items found (${skipped} skipped).`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
