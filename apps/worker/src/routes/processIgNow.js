/**
 * POST /process-ig-now
 *
 * Fast-path endpoint that ONLY runs processIgScheduled().
 * Called by the admin "Publish Now" action to avoid waiting for the full
 * /tick pipeline (ingest → process → generate → … → IG) which takes 5-10 min.
 *
 * Completes in seconds instead of minutes.
 */
import { Router } from "express";
import { processIgScheduled } from "../jobs/processIgScheduled.js";
export const processIgNowRouter = Router();
processIgNowRouter.post("/process-ig-now", async (_req, res) => {
    // Auth is handled by the global middleware in index.ts
    const startMs = Date.now();
    try {
        const result = await processIgScheduled();
        const durationMs = Date.now() - startMs;
        console.log(`[process-ig-now] done in ${durationMs}ms — processed=${result.processed} posted=${result.posted} dryRun=${result.dryRun} errors=${result.errors}`);
        res.json({ ok: true, durationMs, result });
    }
    catch (err) {
        console.error("[process-ig-now] error:", err);
        res.status(500).json({
            ok: false,
            durationMs: Date.now() - startMs,
            error: err instanceof Error ? err.message : "Unknown error",
        });
    }
});
//# sourceMappingURL=processIgNow.js.map