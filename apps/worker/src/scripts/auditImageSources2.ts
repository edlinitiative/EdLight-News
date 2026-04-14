#!/usr/bin/env npx tsx
/**
 * Check when Unsplash started appearing in queued items vs posted items.
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

function classifyUrl(url: string): string {
  if (!url) return "NONE";
  if (url.includes("unsplash.com")) return "unsplash";
  if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) return "wikimedia";
  if (url.includes("firebasestorage.googleapis.com")) return "firebase";
  if (url.includes("flickr.com") || url.includes("staticflickr.com")) return "flickr";
  if (url.includes("loc.gov")) return "loc";
  try { return new URL(url).hostname; } catch { return "other"; }
}

async function main() {
  // 1. Posted items — which image source and when
  console.log("--- All posted items (last 40) ---\n");
  const posted = await db.collection("ig_queue")
    .where("status", "==", "posted")
    .orderBy("updatedAt", "desc")
    .limit(40)
    .get();

  for (const doc of posted.docs) {
    const d = doc.data();
    const slide0 = d.payload?.slides?.[0];
    const url = slide0?.backgroundImage || "";
    const src = classifyUrl(url);
    const created = d.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10) || "n/a";
    const updated = d.updatedAt?.toDate?.()?.toISOString?.()?.slice(0, 10) || "n/a";
    console.log(
      `${d.igType?.padEnd(14)} | ${src.padEnd(22)} | created=${created} updated=${updated} | ${(d.payload?.slides?.[0]?.heading || "").slice(0, 45)}`,
    );
  }

  // 2. Queued items — are Unsplash images from recent pipeline changes?
  console.log("\n\n--- Queued/scheduled items ---\n");
  const queued = await db.collection("ig_queue")
    .where("status", "in", ["queued", "scheduled"])
    .limit(20)
    .get();

  for (const doc of queued.docs) {
    const d = doc.data();
    const slide0 = d.payload?.slides?.[0];
    const url = slide0?.backgroundImage || "";
    const src = classifyUrl(url);
    const created = d.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 16) || "n/a";
    console.log(
      `${d.igType?.padEnd(14)} | ${src.padEnd(22)} | created=${created} | ${(d.payload?.slides?.[0]?.heading || "").slice(0, 45)}`,
    );
  }

  // 3. Check: which items had publisher images that got igImageSafe=false?
  // These are the items that go through the tiered pipeline.
  console.log("\n\n--- Items reasons (looking for tiered/image mentions) ---\n");
  const recent = await db.collection("ig_queue")
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();

  for (const doc of recent.docs) {
    const d = doc.data();
    const reasons = (d.reasons || []) as string[];
    const imageReasons = reasons.filter((r: string) =>
      /image|tiered|unsplash|wikimedia|flickr|commons|stripped|propagat/i.test(r),
    );
    if (imageReasons.length > 0) {
      console.log(`  ${doc.id} (${d.igType}, ${d.status}):`);
      for (const r of imageReasons) console.log(`    → ${r.slice(0, 120)}`);
    }
  }

  // 4. Count how many news items had igImageSafe=false (publisher image stripped)
  console.log("\n\n--- Publisher image stripping analysis ---\n");
  let totalItems = 0;
  let publisherImages = 0;
  let noImage = 0;
  let tieredFound = 0;
  
  for (const doc of recent.docs) {
    const d = doc.data();
    totalItems++;
    const reasons = (d.reasons || []) as string[];
    const hasStripped = reasons.some((r: string) => /stripped|unsafe|igImageSafe/i.test(r));
    const hasTiered = reasons.some((r: string) => /tiered image found/i.test(r));
    const slide0Url = d.payload?.slides?.[0]?.backgroundImage || "";
    const src = classifyUrl(slide0Url);
    
    if (hasStripped) publisherImages++;
    if (src === "NONE") noImage++;
    if (hasTiered) tieredFound++;
  }

  console.log(`  Total items checked: ${totalItems}`);
  console.log(`  Publisher images stripped: ${publisherImages}`);
  console.log(`  Items with no image at all: ${noImage}`);
  console.log(`  Tiered pipeline found image: ${tieredFound}`);
}

main().catch(console.error);
