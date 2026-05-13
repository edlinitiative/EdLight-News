/**
 * Express route: POST /review
 *
 * Triggers the T+14 post-rollout review job manually or via Cloud Scheduler.
 * Runs once (idempotent — if the Outcomes placeholder is already filled, it
 * returns ok=true with a note instead of opening a duplicate PR).
 *
 * Auth: same as /tick — validated by the app-level middleware in index.ts.
 * Cloud Scheduler sends an OIDC Bearer token; Vercel can send WORKER_API_KEY.
 */
import { Router, type Request, type Response } from "express";
import { postRolloutReview } from "../jobs/postRolloutReview.js";

export const reviewRouter = Router();

reviewRouter.post("/review", async (_req: Request, res: Response) => {
  console.log("[review] starting post-rollout review job");
  const startMs = Date.now();
  try {
    const result = await postRolloutReview();
    const durationMs = Date.now() - startMs;
    if (result.ok) {
      console.log(`[review] done in ${durationMs}ms`, result);
      return res.json({ durationMs, ...result });
    } else {
      console.error(`[review] failed: ${result.error}`);
      return res.status(500).json({ ok: false, durationMs, error: result.error });
    }
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[review] unexpected error:", err);
    return res.status(500).json({ ok: false, durationMs, error: message });
  }
});
