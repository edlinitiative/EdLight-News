// One-off runner: invoke buildReelsQueue (v2) and print the result.
// Usage: REELS_ENABLED=true tsx src/scripts/_runReelOnce.ts
import { buildReelsQueue } from "../jobs/buildReelsQueue.js";

async function main(): Promise<void> {
  console.log("[runReelOnce] starting buildReelsQueue (v2)…");
  const t0 = Date.now();
  const r = await buildReelsQueue();
  console.log(`[runReelOnce] done in ${Date.now() - t0}ms`);
  console.log("RESULT:", JSON.stringify(r, null, 2));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("[runReelOnce] FAILED:", err);
    process.exit(1);
  },
);
