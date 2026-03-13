/**
 * Deep-inspect the 10 problematic ig_queue items: titles, itemId,
 * cover image status, slide details, and source item info.
 *
 * Usage: npx tsx src/scripts/inspectBadQueue.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";

const db = getDb();

const BAD_IDS = [
  "3r4pWW4QpivumKTB8Umb",
  "4Ml0kPKw1rDwvpgh6ODV",
  "BQjNHvwjN5582tWuPDfY",
  "E4eAdy6ttqwVwH7gYOQF",
  "SOGxasOlB6OktqPbIOJU",
  "Vei12ifY159oAF3mXVTb",
  "WtN3lK1yASi3HRyEf8xB",
  "oL9jnAcpr0mPZOd19iSj",
  "qwVnS6OlQBIbJt7z9JXI",
  "zo9G4nCLFXrWWsVwNRrf",
];

async function main() {
  for (const id of BAD_IDS) {
    const doc = await db.collection("ig_queue").doc(id).get();
    if (!doc.exists) {
      console.log(`❌ ${id} — NOT FOUND\n`);
      continue;
    }
    const d = doc.data()!;
    const payload = d.payload ?? {};
    const slides: any[] = payload.slides ?? [];
    const caption = (payload.caption ?? "").slice(0, 100);
    const itemId = d.itemId ?? "N/A";
    const igType = d.igType ?? "?";
    const status = d.status ?? "?";
    const score = d.igPriorityScore ?? 0;
    const reasons: string[] = d.reasons ?? [];
    const createdAt = d.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 16) ?? "?";

    console.log(`┌─ ${id} ──────────────────────────────────────`);
    console.log(`│ status=${status}  type=${igType}  score=${score}  created=${createdAt}`);
    console.log(`│ itemId=${itemId}`);
    console.log(`│ caption: ${caption}...`);
    console.log(`│ reasons: ${reasons.slice(0, 3).join(" | ")}`);
    console.log(`│`);
    console.log(`│ Slides (${slides.length}):`);
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const bg = s.backgroundImage ? `✅ ${s.backgroundImage.slice(0, 60)}…` : "❌ MISSING";
      const hl = (s.headline ?? "").slice(0, 50);
      const layout = s.layout ?? "?";
      console.log(`│   [${i}] layout=${layout}  headline="${hl}"`);
      console.log(`│       bg: ${bg}`);
    }
    console.log(`└${"─".repeat(55)}\n`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
