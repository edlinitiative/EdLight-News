/**
 * Dataset refresh service.
 *
 * Processes queued DatasetJob entries — each job points to a dataset
 * (universities, scholarships, pathways, haiti_calendar) and optionally
 * a specific doc ID.  Processing uses Gemini to verify / update the record
 * from its source URL(s).
 *
 * Non-critical: failures are logged and the pipeline continues.
 */

import { datasetJobsRepo } from "@edlight-news/firebase";
import type { DatasetJob, DatasetName } from "@edlight-news/types";

// ── Configuration ──────────────────────────────────────────────────────────

/** Maximum jobs to process per tick to avoid timeouts. */
const MAX_JOBS_PER_TICK = 5;

/** How many seconds between automatic enqueues for each dataset. */
const REFRESH_CADENCES: Record<DatasetName, number> = {
  universities: 7 * 24 * 3600,       // weekly
  scholarships: 24 * 3600,            // daily (deadlines move fast)
  pathways: 14 * 24 * 3600,           // every 2 weeks
  haiti_calendar: 24 * 3600,          // daily
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Check whether enough time has passed since the last enqueue. */
async function shouldEnqueue(dataset: DatasetName): Promise<boolean> {
  // If there's already a queued/processing job, skip
  const pending = await datasetJobsRepo.listByStatus("queued");
  if (pending.some((j) => j.dataset === dataset)) return false;

  const processing = await datasetJobsRepo.listByStatus("processing");
  if (processing.some((j) => j.dataset === dataset)) return false;

  // Enforce cadence: skip if last done job is too recent
  const cadenceSec = REFRESH_CADENCES[dataset];
  if (cadenceSec) {
    const lastDone = await datasetJobsRepo.lastDoneForDataset(dataset);
    if (lastDone?.updatedAt) {
      const doneMs = typeof lastDone.updatedAt === "object" && "toMillis" in lastDone.updatedAt
        ? (lastDone.updatedAt as { toMillis(): number }).toMillis()
        : typeof lastDone.updatedAt === "object" && "seconds" in lastDone.updatedAt
          ? (lastDone.updatedAt as { seconds: number }).seconds * 1000
          : 0;
      const elapsedSec = (Date.now() - doneMs) / 1000;
      if (elapsedSec < cadenceSec) {
        console.log(
          `[datasets] ${dataset} last refreshed ${Math.round(elapsedSec)}s ago (cadence=${cadenceSec}s) — skipping`,
        );
        return false;
      }
    }
  }

  return true;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface DatasetRefreshResult {
  enqueued: number;
  processed: number;
  errors: number;
}

/**
 * Schedule new refresh jobs if cadences have elapsed, then process
 * the oldest queued jobs.
 */
export async function runDatasetRefresh(): Promise<DatasetRefreshResult> {
  const result: DatasetRefreshResult = { enqueued: 0, processed: 0, errors: 0 };

  // ── 1. Auto-enqueue based on cadence ─────────────────────────────────
  for (const dataset of Object.keys(REFRESH_CADENCES) as DatasetName[]) {
    try {
      if (await shouldEnqueue(dataset)) {
        const { created } = await datasetJobsRepo.enqueue(dataset);
        if (created) {
          result.enqueued++;
          console.log(`[datasets] enqueued refresh for ${dataset}`);
        }
      }
    } catch (err) {
      console.warn(`[datasets] failed to enqueue ${dataset}:`, err instanceof Error ? err.message : err);
      result.errors++;
    }
  }

  // ── 2. Process queued jobs ───────────────────────────────────────────
  const queued = await datasetJobsRepo.listQueued();
  const batch = queued.slice(0, MAX_JOBS_PER_TICK);

  for (const job of batch) {
    try {
      await datasetJobsRepo.markProcessing(job.id);
      await processJob(job);
      await datasetJobsRepo.markDone(job.id);
      result.processed++;
      console.log(`[datasets] processed job ${job.id} (${job.dataset})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[datasets] job ${job.id} failed:`, msg);
      try {
        await datasetJobsRepo.markFailed(job.id, msg);
      } catch {
        // ignore double-failure
      }
      result.errors++;
    }
  }

  return result;
}

// ── Job processors ─────────────────────────────────────────────────────────

async function processJob(job: DatasetJob): Promise<void> {
  switch (job.dataset) {
    case "universities":
      await refreshUniversities(job);
      break;
    case "scholarships":
      await refreshScholarships(job);
      break;
    case "pathways":
      await refreshPathways(job);
      break;
    case "haiti_calendar":
      await refreshHaitiCalendar(job);
      break;
    default:
      console.warn(`[datasets] unknown dataset: ${job.dataset}`);
  }
}

/**
 * Placeholder: In the future, each refresh function will:
 *  1. Fetch the source URL(s) for each record
 *  2. Use Gemini to extract updated information
 *  3. Diff against current record
 *  4. Update if changes are detected
 *
 * For now, these are stubs that simply log the intent.
 */

async function refreshUniversities(_job: DatasetJob): Promise<void> {
  console.log("[datasets] refreshUniversities — stub (LLM verification not yet wired)");
}

async function refreshScholarships(_job: DatasetJob): Promise<void> {
  console.log("[datasets] refreshScholarships — stub (LLM verification not yet wired)");
}

async function refreshPathways(_job: DatasetJob): Promise<void> {
  console.log("[datasets] refreshPathways — stub (LLM verification not yet wired)");
}

async function refreshHaitiCalendar(_job: DatasetJob): Promise<void> {
  console.log("[datasets] refreshHaitiCalendar — stub (LLM verification not yet wired)");
}
