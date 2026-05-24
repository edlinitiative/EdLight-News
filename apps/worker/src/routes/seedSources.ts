/**
 * POST /seed-sources
 *
 * Re-seeds the `sources` Firestore collection from the bundled
 * docs/sources.seed.json. Idempotent — safe to call repeatedly.
 *
 * Auth handled by the global middleware in index.ts (OIDC or x-api-key).
 *
 * Query params:
 *   ?dryRun=1   Count seeds without writing.
 */
import { Router, type Request, type Response } from "express";
import { runSeedSources } from "../services/seedSources.js";

export const seedSourcesRouter = Router();

seedSourcesRouter.post("/seed-sources", async (req: Request, res: Response) => {
  const startMs = Date.now();
  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
  try {
    const summary = await runSeedSources({ dryRun });
    console.log("[seed-sources] done:", JSON.stringify(summary));
    res.json({ ok: true, dryRun, summary });
  } catch (err) {
    console.error("[seed-sources] error:", err);
    res.status(500).json({
      ok: false,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
