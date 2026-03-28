/**
 * One-off: patch the AUF ig_queue doc so the cover slide contains
 * only the title (bullets: []) — matching the updated utility formatter.
 *
 * Usage: npx tsx src/scripts/patchAufCoverSlide.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";

const db = getDb();

// The AUF scheduled post identified during the backfill
const DOC_ID = "BuuRtXXndHOZ4OIHov4L";

async function main() {
  const ref = db.collection("ig_queue").doc(DOC_ID);
  const snap = await ref.get();

  if (!snap.exists) {
    console.error(`❌ Document ${DOC_ID} not found`);
    process.exit(1);
  }

  const data = snap.data()!;
  const slides: any[] = data.payload?.slides ?? [];

  if (!slides.length) {
    console.error("❌ No slides found on this document");
    process.exit(1);
  }

  const cover = slides[0];
  console.log("Current cover slide:");
  console.log(JSON.stringify(cover, null, 2));

  if (!cover.bullets?.length) {
    console.log("✅ Cover already has empty bullets — nothing to do.");
    process.exit(0);
  }

  // Move the old cover bullets/heading into slide 2 if slide 2 doesn't already
  // have them, otherwise just clear cover bullets.
  const newSlides = slides.map((s: any, i: number) => {
    if (i === 0) {
      // Cover: keep heading, clear bullets so only title shows
      return { ...s, bullets: [] };
    }
    return s;
  });

  // If slide 2 is missing a summary, prepend the old cover text there
  const slide2 = newSlides[1];
  if (slide2 && (!slide2.bullets || slide2.bullets.length === 0)) {
    // Use old cover bullets as the first bullets on slide 2
    newSlides[1] = { ...slide2, bullets: cover.bullets };
    console.log("↳ Moved old cover bullets to slide 2");
  }

  await ref.update({ "payload.slides": newSlides });

  console.log("\n✅ Patched! New cover slide:");
  console.log(JSON.stringify(newSlides[0], null, 2));
  console.log("\nNew slide 2:");
  console.log(JSON.stringify(newSlides[1], null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
