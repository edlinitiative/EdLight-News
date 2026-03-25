/**
 * Script: regenerateEditorialBg
 *
 * Force-regenerates the shared branded background used for
 * opportunity + utility IG posts and stores it permanently in Firebase Storage.
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker ig:regen-editorial-bg
 */

import "dotenv/config";
import { ensureOpportunityBackground } from "../services/geminiImageGen.js";

async function main() {
  console.log("=== Regenerating editorial background ===\n");
  console.log("Force-generating a new background (overwriting existing)...");
  const url = await ensureOpportunityBackground(/* forceRegenerate */ true);
  if (url) {
    console.log("\n✓ Background stored successfully:");
    console.log(url.slice(0, 120) + "...");
  } else {
    console.error("\n✗ Failed to generate background — check GEMINI_API_KEY and Firebase config");
    process.exit(1);
  }
  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
