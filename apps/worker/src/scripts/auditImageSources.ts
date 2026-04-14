#!/usr/bin/env npx tsx
/**
 * Audit: which image sources are actually being used in production IG posts.
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
  if (url.includes("firebasestorage.googleapis.com")) return "firebase/gemini";
  if (url.includes("flickr.com") || url.includes("staticflickr.com")) return "flickr";
  if (url.includes("loc.gov")) return "loc";
  try { return "other:" + new URL(url).hostname; } catch { return "other"; }
}

async function main() {
  console.log("=== IMAGE SOURCE AUDIT ===\n");

  // 1. All posted items
  const posted = await db.collection("ig_queue")
    .where("status", "==", "posted")
    .orderBy("updatedAt", "desc")
    .limit(60)
    .get();

  console.log(`Total posted items (last 60): ${posted.size}\n`);

  const sources: Record<string, number> = {};
  const sourcesByType: Record<string, Record<string, number>> = {};
  const samplesBySource: Record<string, string[]> = {};

  for (const doc of posted.docs) {
    const d = doc.data();
    const igType = d.igType ?? "unknown";
    const slides = d.payload?.slides || [];

    for (const s of slides) {
      const url = s.backgroundImage || "";
      const src = classifyUrl(url);
      sources[src] = (sources[src] || 0) + 1;

      if (!sourcesByType[igType]) sourcesByType[igType] = {};
      sourcesByType[igType][src] = (sourcesByType[igType][src] || 0) + 1;

      if (!samplesBySource[src]) samplesBySource[src] = [];
      if (samplesBySource[src].length < 3 && url) {
        samplesBySource[src].push(url.slice(0, 120));
      }
    }
  }

  // Print overall distribution
  console.log("--- Overall image source distribution ---");
  const totalSlides = Object.values(sources).reduce((a, b) => a + b, 0);
  for (const [src, count] of Object.entries(sources).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / totalSlides) * 100).toFixed(1);
    console.log(`  ${src.padEnd(20)} ${String(count).padStart(4)} slides  (${pct}%)`);
  }

  // Print by igType
  console.log("\n--- By IG type ---");
  for (const [igType, srcs] of Object.entries(sourcesByType).sort()) {
    const total = Object.values(srcs).reduce((a, b) => a + b, 0);
    console.log(`\n  ${igType} (${total} slides):`);
    for (const [src, count] of Object.entries(srcs).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${src.padEnd(20)} ${count}`);
    }
  }

  // Print sample URLs
  console.log("\n--- Sample URLs per source ---");
  for (const [src, urls] of Object.entries(samplesBySource).sort()) {
    console.log(`\n  ${src}:`);
    for (const u of urls) console.log(`    ${u}`);
  }

  // 2. Check all queued items too
  console.log("\n\n--- Currently queued items ---");
  const queued = await db.collection("ig_queue")
    .where("status", "in", ["queued", "scheduled"])
    .orderBy("updatedAt", "desc")
    .limit(30)
    .get();

  console.log(`Queued/scheduled items: ${queued.size}`);
  const queuedSources: Record<string, number> = {};
  for (const doc of queued.docs) {
    const d = doc.data();
    const slides = d.payload?.slides || [];
    for (const s of slides) {
      const src = classifyUrl(s.backgroundImage || "");
      queuedSources[src] = (queuedSources[src] || 0) + 1;
    }
  }
  for (const [src, count] of Object.entries(queuedSources).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src.padEnd(20)} ${count} slides`);
  }

  // 3. Check: does the Unsplash key work?
  console.log("\n\n--- API Key Status ---");
  const unsplashKey = process.env.Unsplash_ACCESS_KEY;
  console.log(`  Unsplash_ACCESS_KEY: ${unsplashKey ? "SET (" + unsplashKey.slice(0, 8) + "...)" : "❌ MISSING"}`);
  console.log(`  FLICKR_API_KEY:      ${process.env.FLICKR_API_KEY ? "SET" : "❌ MISSING"}`);
  console.log(`  BRAVE_API_KEY:       ${process.env.BRAVE_API_KEY ? "SET" : "❌ MISSING"}`);
  console.log(`  GEMINI_API_KEY:      ${process.env.GEMINI_API_KEY ? "SET (" + process.env.GEMINI_API_KEY.slice(0, 8) + "...)" : "❌ MISSING"}`);

  // 4. Test Unsplash API with a real query
  if (unsplashKey) {
    console.log("\n--- Unsplash API live test ---");
    try {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", "Haiti Caribbean");
      url.searchParams.set("orientation", "portrait");
      url.searchParams.set("per_page", "3");
      url.searchParams.set("content_filter", "high");

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Client-ID ${unsplashKey}`,
          "Accept-Version": "v1",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json() as any;
        console.log(`  ✅ Unsplash API works! Found ${data.total} results for "Haiti Caribbean"`);
        for (const p of (data.results || []).slice(0, 3)) {
          console.log(`     ${p.width}×${p.height} by ${p.user.name} — ${p.urls.regular.slice(0, 80)}`);
        }
      } else {
        const errText = await res.text();
        console.log(`  ❌ Unsplash API error: ${res.status} ${errText.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`  ❌ Unsplash API error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 5. Test LoC API
  console.log("\n--- Library of Congress API live test ---");
  try {
    const locUrl = `https://www.loc.gov/search/?q=Haiti+history&fa=online-format:image&fo=json&c=3`;
    const res = await fetch(locUrl, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const data = await res.json() as any;
      const results = data.results || [];
      console.log(`  ✅ LoC API works! Found ${results.length} results for "Haiti history"`);
      for (const r of results.slice(0, 3)) {
        console.log(`     ${r.title?.slice(0, 60)} — ${r.image_url?.[0]?.slice(0, 80) || "(no image_url)"}`);
      }
    } else {
      console.log(`  ❌ LoC API error: ${res.status}`);
    }
  } catch (err) {
    console.log(`  ❌ LoC API error: ${err instanceof Error ? err.message : err}`);
  }

  console.log("\n=== AUDIT COMPLETE ===\n");
}

main().catch(console.error);
