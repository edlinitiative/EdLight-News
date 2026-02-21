import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve .env from monorepo root (two levels up from apps/worker/src)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../..", ".env");
dotenv.config({ path: envPath });

import express from "express";
import { tickRouter } from "./routes/tick.js";
import { ingest } from "./services/ingest.js";
import { processRawItems } from "./services/process.js";
import { generateForItems } from "./services/generate.js";
import { generateImages } from "./jobs/generateImages.js";
import { contentVersionsRepo } from "@edlight-news/firebase";

const app = express();
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "edlight-news-worker" });
});

// Main automation endpoint
app.use(tickRouter);

const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, () => {
  console.log(`[worker] listening on :${PORT}`);
});

// ─── Self-scheduling pipeline cron ────────────────────────────────────────────
const TICK_INTERVAL_MS = parseInt(
  process.env.TICK_INTERVAL_MS ?? String(30 * 60 * 1000), // default: 30 min
  10,
);

async function runTick() {
  console.log("[cron] tick started");
  try {
    const ingestResult = await ingest();
    const processResult = await processRawItems();
    const generateResult = await generateForItems();
    const published = await contentVersionsRepo.publishEligibleDrafts();

    // Step 5: Generate branded card images (non-critical)
    let imageResult = { generated: 0, failed: 0 };
    try {
      imageResult = await generateImages();
    } catch (err) {
      console.warn("[cron] image generation error:", err instanceof Error ? err.message : err);
    }

    console.log("[cron] tick done", { ingestResult, processResult, generateResult, published, imageResult });
  } catch (err) {
    console.error("[cron] tick error:", err instanceof Error ? err.message : err);
  }
}

// Run once shortly after startup, then every TICK_INTERVAL_MS
setTimeout(() => {
  void runTick();
  setInterval(() => void runTick(), TICK_INTERVAL_MS);
}, 30_000); // 30-second delay so the server is fully ready first

console.log(
  `[cron] pipeline scheduled every ${TICK_INTERVAL_MS / 1000 / 60} minutes` +
  ` (first run in 30 s) — override with TICK_INTERVAL_MS env var`,
);
