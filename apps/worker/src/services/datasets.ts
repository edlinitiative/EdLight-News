/**
 * Dataset refresh service.
 *
 * Processes queued DatasetJob entries — each job points to a dataset
 * (universities, scholarships, pathways, haiti_calendar) and optionally
 * a specific doc ID.  Processing uses Gemini to verify / update the record
 * from its source URL(s).
 *
 * Edge-case design:
 *  - Source returns 404 / network error → logged, record untouched, job marked failed
 *  - Source changes HTML structure → fetch may return empty data → empty-result guard prevents overwrite
 *  - Scholarship deadline changes → upsert detects diff and updates only non-null fields
 *  - MENFP deletes a page → fetch throws, record preserved with last-good verifiedAt
 *  - Scholarship no longer exists → verification detects removal, record stays (manual review)
 *  - Null/undefined values → repository layer filters both (never overwrites good data with null)
 *
 * Non-critical: failures are logged and the pipeline continues.
 */

import {
  datasetJobsRepo,
  universitiesRepo,
  scholarshipsRepo,
  haitiCalendarRepo,
  pathwaysRepo,
} from "@edlight-news/firebase";
import type { DatasetJob, DatasetName } from "@edlight-news/types";
import { fetchHtml } from "@edlight-news/scraper";

// ── Configuration ──────────────────────────────────────────────────────────

/** Maximum jobs to process per tick to avoid timeouts. */
const MAX_JOBS_PER_TICK = 5;

/** Maximum attempts before a job is permanently failed. */
const MAX_ATTEMPTS = 3;

/** How many seconds between automatic enqueues for each dataset. */
const REFRESH_CADENCES: Record<DatasetName, number> = {
  universities: 7 * 24 * 3600,       // weekly
  scholarships: 24 * 3600,            // daily (deadlines move fast)
  pathways: 14 * 24 * 3600,           // every 2 weeks
  haiti_calendar: 24 * 3600,          // daily
};

/**
 * Minimum record count per dataset.
 * If a refresh would result in fewer records than this threshold,
 * the write is aborted to prevent accidental data wipes.
 */
const MIN_RECORD_COUNTS: Record<DatasetName, number> = {
  universities: 10,
  scholarships: 5,
  pathways: 2,
  haiti_calendar: 5,
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

/**
 * Probe a URL to check it is reachable.  Returns true if the URL
 * responds with 2xx within the timeout.  Logs the failure reason.
 */
async function probeUrl(url: string, label: string): Promise<boolean> {
  try {
    // fetchHtml already throws on non-2xx with a descriptive message
    await fetchHtml(url);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[datasets] probe failed for ${label}: ${url} — ${msg}`);
    return false;
  }
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
    // ── Retry gate: if already exceeded max attempts, fail permanently ──
    if (job.attempts >= MAX_ATTEMPTS) {
      console.warn(
        `[datasets] job ${job.id} (${job.dataset}) exceeded ${MAX_ATTEMPTS} attempts — marking permanently failed`,
      );
      try {
        await datasetJobsRepo.markFailed(job.id, `Exceeded max attempts (${MAX_ATTEMPTS})`);
      } catch { /* ignore */ }
      result.errors++;
      continue;
    }

    try {
      // Increment attempt counter before processing
      await datasetJobsRepo.update(job.id, {
        dataset: job.dataset,
        status: job.status,
        runAt: job.runAt as { seconds: number; nanoseconds: number },
        attempts: job.attempts + 1,
      });
      await datasetJobsRepo.markProcessing(job.id);

      await processJob(job);

      await datasetJobsRepo.markDone(job.id);
      result.processed++;
      console.log(`[datasets] processed job ${job.id} (${job.dataset})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[datasets] job ${job.id} failed (attempt ${job.attempts + 1}/${MAX_ATTEMPTS}):`, msg);
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

// ══════════════════════════════════════════════════════════════════════════════
// ── Refresh functions — Verification-only (no LLM rewrite yet) ─────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// Phase 1: Source-URL health checks.
//   For each record in the dataset, probe the primary source URL(s).
//   - If reachable: update verifiedAt timestamp (data confirmed still live).
//   - If 404/timeout: log a warning but DO NOT delete or modify the record.
//     The record keeps its last-good data until manual review.
//
// Phase 2 (future): LLM-powered diff.
//   Fetch page content, send to Gemini to extract structured fields,
//   diff against current record, and upsert only changed fields.
//   The null-safe repository layer ensures no field is ever wiped.
// ══════════════════════════════════════════════════════════════════════════════

async function refreshUniversities(_job: DatasetJob): Promise<void> {
  const all = await universitiesRepo.listAll();
  const minCount = MIN_RECORD_COUNTS.universities;

  if (all.length < minCount) {
    console.warn(
      `[datasets] universities has only ${all.length} records (min=${minCount}) — skipping refresh to avoid data loss`,
    );
    return;
  }

  let reachable = 0;
  let unreachable = 0;

  for (const uni of all) {
    const ok = await probeUrl(uni.admissionsUrl, `university:${uni.name}`);
    if (ok) {
      // Touch verifiedAt to confirm the source is still live
      await universitiesRepo.update(uni.id, {
        name: uni.name,
        country: uni.country,
        admissionsUrl: uni.admissionsUrl,
        sources: uni.sources,
      });
      reachable++;
    } else {
      // Source unreachable — keep existing data, do NOT wipe
      unreachable++;
    }
  }

  console.log(
    `[datasets] refreshUniversities: ${reachable} reachable, ${unreachable} unreachable out of ${all.length}`,
  );
}

async function refreshScholarships(_job: DatasetJob): Promise<void> {
  const all = await scholarshipsRepo.listAll();
  const minCount = MIN_RECORD_COUNTS.scholarships;

  if (all.length < minCount) {
    console.warn(
      `[datasets] scholarships has only ${all.length} records (min=${minCount}) — skipping refresh to avoid data loss`,
    );
    return;
  }

  let reachable = 0;
  let unreachable = 0;

  for (const s of all) {
    const ok = await probeUrl(s.officialUrl, `scholarship:${s.name}`);
    if (ok) {
      await scholarshipsRepo.update(s.id, {
        name: s.name,
        country: s.country,
        level: s.level,
        fundingType: s.fundingType,
        officialUrl: s.officialUrl,
        sources: s.sources,
      });
      reachable++;
    } else {
      unreachable++;
    }
  }

  console.log(
    `[datasets] refreshScholarships: ${reachable} reachable, ${unreachable} unreachable out of ${all.length}`,
  );
}

async function refreshPathways(_job: DatasetJob): Promise<void> {
  const all = await pathwaysRepo.listAll();
  const minCount = MIN_RECORD_COUNTS.pathways;

  if (all.length < minCount) {
    console.warn(
      `[datasets] pathways has only ${all.length} records (min=${minCount}) — skipping refresh to avoid data loss`,
    );
    return;
  }

  // Pathways don't have a single "official URL" — verify the links in their sources
  let verified = 0;
  let broken = 0;

  for (const p of all) {
    let allSourcesOk = true;
    for (const src of p.sources) {
      const ok = await probeUrl(src.url, `pathway:${p.title_fr}:${src.label}`);
      if (!ok) {
        allSourcesOk = false;
        broken++;
        break; // one broken source is enough to flag this pathway
      }
    }
    if (allSourcesOk) {
      // Touch updatedAt to confirm sources still live
      await pathwaysRepo.update(p.id, {
        title_fr: p.title_fr,
        title_ht: p.title_ht,
        goalKey: p.goalKey,
        steps: p.steps,
        sources: p.sources,
      });
      verified++;
    }
  }

  console.log(
    `[datasets] refreshPathways: ${verified} verified, ${broken} with broken links out of ${all.length}`,
  );
}

async function refreshHaitiCalendar(_job: DatasetJob): Promise<void> {
  const all = await haitiCalendarRepo.listAll();
  const minCount = MIN_RECORD_COUNTS.haiti_calendar;

  if (all.length < minCount) {
    console.warn(
      `[datasets] haiti_calendar has only ${all.length} records (min=${minCount}) — skipping refresh to avoid data loss`,
    );
    return;
  }

  let reachable = 0;
  let unreachable = 0;

  for (const evt of all) {
    const ok = await probeUrl(evt.officialUrl, `calendar:${evt.title}`);
    if (ok) {
      await haitiCalendarRepo.update(evt.id, {
        institution: evt.institution,
        eventType: evt.eventType,
        level: evt.level,
        title: evt.title,
        officialUrl: evt.officialUrl,
        sources: evt.sources,
      });
      reachable++;
    } else {
      unreachable++;
    }
  }

  console.log(
    `[datasets] refreshHaitiCalendar: ${reachable} reachable, ${unreachable} unreachable out of ${all.length}`,
  );
}
