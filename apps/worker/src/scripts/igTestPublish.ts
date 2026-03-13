/**
 * ig:test-publish — Test the full IG pipeline end-to-end with a single post.
 *
 * Usage: pnpm --filter @edlight-news/worker ig:test-publish
 *
 * Steps:
 *  1. Format a mock scholarship item into carousel slides
 *  2. Render slides to PNG via Playwright
 *  3. Upload PNGs to Firebase Storage (public URLs)
 *  4. Publish carousel to Instagram via Graph API
 */

import dotenv from "dotenv";
import path from "node:path";

const envPath = path.resolve(__dirname, "../../../..", ".env");
console.log(`  Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

import { formatForIG } from "@edlight-news/generator/ig/index.js";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { uploadCarouselSlides } from "@edlight-news/firebase";
import { publishIgPost } from "@edlight-news/publisher";
import type { IGQueueItem, IGFormattedPayload, Item } from "@edlight-news/types";
import { Timestamp } from "firebase-admin/firestore";

// ── Mock item (scholarship — highest base score) ──────────────────────────

const mockItem: Item = {
  id: `test-publish-${Date.now()}`,
  sourceId: "test-source",
  title: "🎓 Test — Pipeline Instagram EdLight News",
  summary: "Ceci est un test du pipeline de publication automatique d'EdLight News sur Instagram. Si vous voyez ce post, la pipeline fonctionne correctement!",
  url: "https://edlight-news.vercel.app",
  language: "fr",
  category: "scholarship",
  tags: ["test", "edlight"],
  fetchedAt: new Date().toISOString(),
  version: {
    v: 1,
    title: "Test — Pipeline Instagram EdLight News",
    summary: "Ceci est un test du pipeline de publication automatique d'EdLight News sur Instagram.",
    body: "EdLight News est une plateforme éducative pour les étudiants haïtiens.",
    language: "fr",
    tags: ["test"],
    audienceFitScore: 0.9,
    studentRelevanceMarkers: ["higher-education", "scholarship-info"],
    generatedAt: new Date().toISOString(),
  } as any,
  deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  opportunity: {
    coverage: "Frais de scolarité + logement + allocation mensuelle",
    eligibility: [
      "Étudiants haïtiens de niveau licence",
      "Âge: 18-25 ans",
      "Moyenne générale ≥ 3.0/4.0",
    ],
    howToApply: "Soumettez votre candidature en ligne sur le site officiel",
    officialLink: "https://edlight-news.vercel.app",
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    isEvergreen: false,
  },
} as any;

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("📸 IG Test Publish — End-to-End");
  console.log("══════════════════════════════════════════════════════════════\n");

  // Check credentials
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;
  if (!token || !userId) {
    console.error("❌ IG_ACCESS_TOKEN and IG_USER_ID must be set in .env");
    process.exit(1);
  }
  console.log(`  IG_USER_ID: ${userId}`);
  console.log(`  IG_ACCESS_TOKEN: ${token.slice(0, 12)}...${token.slice(-6)}`);
  console.log();

  // Step 1: Format content
  console.log("▶ Step 1: Formatting carousel slides...");
  const payload: IGFormattedPayload = await formatForIG("scholarship", mockItem as any);
  console.log(`  ✅ ${payload.slides.length} slides, caption ${payload.caption.length} chars\n`);

  // Step 2: Build queue item
  const queueItem: IGQueueItem = {
    id: `test-${Date.now()}`,
    sourceContentId: mockItem.id,
    igType: "scholarship",
    score: 100,
    status: "rendering",
    reasons: ["Test publish"],
    payload,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Step 3: Render carousel PNGs
  console.log("▶ Step 2: Rendering carousel slides with Playwright...");
  let assets;
  try {
    assets = await generateCarouselAssets(queueItem, payload);
  } catch (renderErr) {
    console.error("  Render error details:", renderErr);
    process.exit(1);
  }
  console.log(`  ✅ Mode: ${assets.mode}`);
  console.log(`  ✅ ${assets.slidePaths.length} slides → ${assets.exportDir}\n`);

  if (assets.mode !== "rendered") {
    console.error("❌ Chromium not available — cannot render PNGs for real publish.");
    console.log("  Slides generated as HTML (dry-run). Check:", assets.exportDir);
    process.exit(1);
  }

  // Step 4: Upload to Firebase Storage
  console.log("▶ Step 3: Uploading slides to Firebase Storage...");
  let slideUrls: string[];
  try {
    slideUrls = await uploadCarouselSlides(assets.slidePaths, queueItem.id);
    console.log(`  ✅ ${slideUrls.length} slides uploaded`);
    for (const url of slideUrls) {
      console.log(`    ${url.slice(0, 80)}...`);
    }
    console.log();
  } catch (err) {
    console.error("❌ Storage upload failed:", err);
    process.exit(1);
  }

  // Step 5: Publish to Instagram
  console.log("▶ Step 4: Publishing carousel to Instagram...");
  console.log(`  API host: ${process.env.IG_API_HOST ?? "graph.instagram.com"}`);
  console.log(`  Slides: ${slideUrls.length}`);
  console.log(`  First slide URL: ${slideUrls[0]?.slice(0, 100)}...`);
  const result = await publishIgPost(queueItem, payload, slideUrls);

  if (result.posted) {
    console.log(`\n  🎉 SUCCESS! Post published to Instagram!`);
    console.log(`  📱 Post ID: ${result.igPostId}`);
    console.log(`  🔗 https://www.instagram.com/edlight.news/\n`);
  } else if (result.dryRun) {
    console.log(`\n  ⚠️  Dry-run mode (credentials missing). Manifest: ${result.dryRunPath}\n`);
  } else {
    console.error(`\n  ❌ Publish failed: ${result.error}\n`);
  }

  console.log("══════════════════════════════════════════════════════════════");
  process.exit(result.posted ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
