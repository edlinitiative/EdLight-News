/**
 * POST /cleanup
 *
 * Weekly maintenance endpoint. See services/cleanup.ts for the actual
 * passes and retention policy. Triggered by Cloud Scheduler weekly.
 */
import { Router, type Request, type Response } from "express";
import { runCleanup } from "../services/cleanup.js";

export const cleanupRouter = Router();

cleanupRouter.post("/cleanup", async (_req: Request, res: Response) => {
  // Auth handled by the global middleware in index.ts (OIDC or x-api-key).
  const startMs = Date.now();
  try {
    const summary = await runCleanup();
    console.log("[cleanup] done:", JSON.stringify(summary));
    res.json({ ok: true, summary });
  } catch (err) {
    console.error("[cleanup] error:", err);
    res.status(500).json({
      ok: false,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
