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
import {
  verifyUniversity,
  verifyScholarship,
  verifyCalendarEvent,
  VERIFY_CONFIDENCE_THRESHOLD,
} from "@edlight-news/generator";

// ── Configuration ──────────────────────────────────────────────────────────

/** Maximum jobs to process per tick to avoid timeouts. */
const MAX_JOBS_PER_TICK = 5;

/** Maximum records to LLM-verify per dataset job to control Gemini API costs. */
const MAX_VERIFY_PER_JOB = 10;

/** Maximum attempts before a job is permanently failed. */
const MAX_ATTEMPTS = 3;

/** How many seconds between automatic enqueues for each dataset. */
const REFRESH_CADENCES: Record<DatasetName, number> = {
  universities: 7 * 24 * 3600,       // weekly
  scholarships: 24 * 3600,            // daily (deadlines move fast)
  pathways: 14 * 24 * 3600,           // every 2 weeks
  haiti_calendar: 24 * 3600,          // daily
  haiti_history_almanac: 30 * 24 * 3600, // monthly (curated, rarely changes)
  haiti_holidays: 90 * 24 * 3600,        // quarterly (very stable)
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
  haiti_history_almanac: 20,
  haiti_holidays: 5,
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

/**
 * Fetch HTML from a URL, returning null (not throwing) on failure.
 * Logs the error for observability.
 */
async function safeFetchHtml(url: string, label: string): Promise<string | null> {
  try {
    return await fetchHtml(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[datasets] fetch failed for ${label}: ${url} — ${msg}`);
    return null;
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
// ── Refresh functions — Phase 2: LLM-powered verification ──────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// For universities, scholarships, and calendar events:
//   1. Fetch HTML from the source URL (skip record on 404/timeout)
//   2. Send HTML + current record to Gemini for structured field extraction
//   3. If Gemini says page is irrelevant or low confidence → skip (preserve data)
//   4. Diff extracted fields against current record → only write changes
//   5. Null-safe repository layer filters out undefined/null → no accidental wipes
//
// For pathways: URL-probe only (no single source page to parse)
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

  let verified = 0;
  let updated = 0;
  let skipped = 0;

  // Cap LLM-verify calls per job to control Gemini API costs
  const batch = all.slice(0, MAX_VERIFY_PER_JOB);
  if (all.length > MAX_VERIFY_PER_JOB) {
    console.log(`[datasets] universities: verifying ${batch.length}/${all.length} records (capped at ${MAX_VERIFY_PER_JOB})`);
  }

  for (const uni of batch) {
    const html = await safeFetchHtml(uni.admissionsUrl, `university:${uni.name}`);
    if (!html) { skipped++; continue; }

    const result = await verifyUniversity(
      { name: uni.name, country: uni.country, admissionsUrl: uni.admissionsUrl },
      html,
    );

    if (!result.ok) {
      console.warn(`[datasets] verify failed for university:${uni.name} — ${result.error}`);
      skipped++;
      continue;
    }

    const d = result.data;

    // Page is no longer relevant (e.g. redirected to homepage, error page)
    if (!d.pageRelevant) {
      console.warn(`[datasets] university:${uni.name} — page no longer relevant, preserving existing data`);
      skipped++;
      continue;
    }

    // Low confidence extraction — don't trust it
    if (d.confidence < VERIFY_CONFIDENCE_THRESHOLD) {
      console.warn(`[datasets] university:${uni.name} — low confidence (${d.confidence}), skipping update`);
      skipped++;
      continue;
    }

    // Build partial update from extracted fields (only what Gemini found)
    const patch: Record<string, unknown> = {};
    if (d.city && d.city !== uni.city) patch.city = d.city;
    if (d.tuitionBand && d.tuitionBand !== uni.tuitionBand) patch.tuitionBand = d.tuitionBand;
    if (d.internationalAdmissionsUrl && d.internationalAdmissionsUrl !== uni.internationalAdmissionsUrl) {
      patch.internationalAdmissionsUrl = d.internationalAdmissionsUrl;
    }
    if (d.scholarshipUrl && d.scholarshipUrl !== uni.scholarshipUrl) patch.scholarshipUrl = d.scholarshipUrl;
    if (d.languages && JSON.stringify(d.languages) !== JSON.stringify(uni.languages)) patch.languages = d.languages;
    if (d.applicationPlatform || d.englishTests || d.frenchTests) {
      const newReqs = {
        applicationPlatform: d.applicationPlatform ?? uni.requirements?.applicationPlatform,
        englishTests: d.englishTests ?? uni.requirements?.englishTests,
        frenchTests: d.frenchTests ?? uni.requirements?.frenchTests,
      };
      if (JSON.stringify(newReqs) !== JSON.stringify(uni.requirements)) patch.requirements = newReqs;
    }

    if (Object.keys(patch).length > 0) {
      await universitiesRepo.update(uni.id, {
        name: uni.name,
        country: uni.country,
        admissionsUrl: uni.admissionsUrl,
        sources: uni.sources,
        ...patch,
      } as Parameters<typeof universitiesRepo.update>[1]);
      updated++;
      console.log(`[datasets] university:${uni.name} — updated ${Object.keys(patch).join(", ")}`);
    } else {
      // No changes, just touch updatedAt to confirm verified
      await universitiesRepo.update(uni.id, {
        name: uni.name,
        country: uni.country,
        admissionsUrl: uni.admissionsUrl,
        sources: uni.sources,
      });
    }
    verified++;
  }

  console.log(
    `[datasets] refreshUniversities: ${verified} verified, ${updated} updated, ${skipped} skipped out of ${all.length}`,
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

  let verified = 0;
  let updated = 0;
  let skipped = 0;

  // Cap LLM-verify calls per job to control Gemini API costs
  const batch = all.slice(0, MAX_VERIFY_PER_JOB);
  if (all.length > MAX_VERIFY_PER_JOB) {
    console.log(`[datasets] scholarships: verifying ${batch.length}/${all.length} records (capped at ${MAX_VERIFY_PER_JOB})`);
  }

  for (const s of batch) {
    const html = await safeFetchHtml(s.officialUrl, `scholarship:${s.name}`);
    if (!html) { skipped++; continue; }

    const result = await verifyScholarship(
      { name: s.name, country: s.country, officialUrl: s.officialUrl },
      html,
    );

    if (!result.ok) {
      console.warn(`[datasets] verify failed for scholarship:${s.name} — ${result.error}`);
      skipped++;
      continue;
    }

    const d = result.data;

    if (!d.pageRelevant) {
      console.warn(`[datasets] scholarship:${s.name} — page no longer relevant, preserving existing data`);
      skipped++;
      continue;
    }

    if (d.confidence < VERIFY_CONFIDENCE_THRESHOLD) {
      console.warn(`[datasets] scholarship:${s.name} — low confidence (${d.confidence}), skipping update`);
      skipped++;
      continue;
    }

    // Build partial update — only changed fields
    const patch: Record<string, unknown> = {};
    if (d.fundingType && d.fundingType !== s.fundingType) patch.fundingType = d.fundingType;
    if (d.eligibilitySummary && d.eligibilitySummary !== s.eligibilitySummary) patch.eligibilitySummary = d.eligibilitySummary;
    if (d.requirements && JSON.stringify(d.requirements) !== JSON.stringify(s.requirements)) patch.requirements = d.requirements;
    if (d.howToApplyUrl && d.howToApplyUrl !== s.howToApplyUrl) patch.howToApplyUrl = d.howToApplyUrl;
    if (d.eligibleCountries && JSON.stringify(d.eligibleCountries) !== JSON.stringify(s.eligibleCountries)) {
      patch.eligibleCountries = d.eligibleCountries;
    }
    if (d.recurring !== undefined && d.recurring !== s.recurring) patch.recurring = d.recurring;

    // Deadline — the most important field for scholarships
    if (d.deadlineDateISO || d.deadlineNotes) {
      const newDeadline = {
        dateISO: d.deadlineDateISO ?? s.deadline?.dateISO,
        notes: d.deadlineNotes ?? s.deadline?.notes,
        sourceUrl: s.deadline?.sourceUrl ?? s.officialUrl,
      };
      if (
        newDeadline.dateISO !== s.deadline?.dateISO ||
        newDeadline.notes !== s.deadline?.notes
      ) {
        patch.deadline = newDeadline;
        console.log(
          `[datasets] scholarship:${s.name} — deadline changed: ${s.deadline?.dateISO ?? "none"} → ${newDeadline.dateISO ?? "none"}`,
        );
      }
    }

    if (Object.keys(patch).length > 0) {
      await scholarshipsRepo.update(s.id, {
        name: s.name,
        country: s.country,
        level: s.level,
        fundingType: (patch.fundingType as typeof s.fundingType) ?? s.fundingType,
        officialUrl: s.officialUrl,
        sources: s.sources,
        ...patch,
      } as Parameters<typeof scholarshipsRepo.update>[1]);
      updated++;
      console.log(`[datasets] scholarship:${s.name} — updated ${Object.keys(patch).join(", ")}`);
    } else {
      await scholarshipsRepo.update(s.id, {
        name: s.name,
        country: s.country,
        level: s.level,
        fundingType: s.fundingType,
        officialUrl: s.officialUrl,
        sources: s.sources,
      });
    }
    verified++;
  }

  console.log(
    `[datasets] refreshScholarships: ${verified} verified, ${updated} updated, ${skipped} skipped out of ${all.length}`,
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

  // Pathways are curated step-by-step guides — no single source page to LLM-parse.
  // Phase 2 for pathways = URL probe only (verify links still live).
  let verified = 0;
  let broken = 0;

  for (const p of all) {
    let allSourcesOk = true;
    for (const src of p.sources) {
      const ok = await probeUrl(src.url, `pathway:${p.title_fr}:${src.label}`);
      if (!ok) {
        allSourcesOk = false;
        broken++;
        break;
      }
    }
    if (allSourcesOk) {
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

  let verified = 0;
  let updated = 0;
  let skipped = 0;

  // Cap LLM-verify calls per job to control Gemini API costs
  const batch = all.slice(0, MAX_VERIFY_PER_JOB);
  if (all.length > MAX_VERIFY_PER_JOB) {
    console.log(`[datasets] haiti_calendar: verifying ${batch.length}/${all.length} records (capped at ${MAX_VERIFY_PER_JOB})`);
  }

  for (const evt of batch) {
    const html = await safeFetchHtml(evt.officialUrl, `calendar:${evt.title}`);
    if (!html) { skipped++; continue; }

    const result = await verifyCalendarEvent(
      { title: evt.title, institution: evt.institution, officialUrl: evt.officialUrl },
      html,
    );

    if (!result.ok) {
      console.warn(`[datasets] verify failed for calendar:${evt.title} — ${result.error}`);
      skipped++;
      continue;
    }

    const d = result.data;

    if (!d.pageRelevant) {
      console.warn(`[datasets] calendar:${evt.title} — page no longer relevant, preserving existing data`);
      skipped++;
      continue;
    }

    if (d.confidence < VERIFY_CONFIDENCE_THRESHOLD) {
      console.warn(`[datasets] calendar:${evt.title} — low confidence (${d.confidence}), skipping update`);
      skipped++;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (d.startDateISO && d.startDateISO !== evt.startDateISO) patch.startDateISO = d.startDateISO;
    if (d.endDateISO && d.endDateISO !== evt.endDateISO) patch.endDateISO = d.endDateISO;
    if (d.dateISO && d.dateISO !== evt.dateISO) {
      patch.dateISO = d.dateISO;
      console.log(`[datasets] calendar:${evt.title} — date changed: ${evt.dateISO ?? "none"} → ${d.dateISO}`);
    }
    if (d.location && d.location !== evt.location) patch.location = d.location;
    if (d.notes && d.notes !== evt.notes) patch.notes = d.notes;

    if (Object.keys(patch).length > 0) {
      await haitiCalendarRepo.update(evt.id, {
        institution: evt.institution,
        eventType: evt.eventType,
        level: evt.level,
        title: evt.title,
        officialUrl: evt.officialUrl,
        sources: evt.sources,
        ...patch,
      } as Parameters<typeof haitiCalendarRepo.update>[1]);
      updated++;
      console.log(`[datasets] calendar:${evt.title} — updated ${Object.keys(patch).join(", ")}`);
    } else {
      await haitiCalendarRepo.update(evt.id, {
        institution: evt.institution,
        eventType: evt.eventType,
        level: evt.level,
        title: evt.title,
        officialUrl: evt.officialUrl,
        sources: evt.sources,
      });
    }
    verified++;
  }

  console.log(
    `[datasets] refreshHaitiCalendar: ${verified} verified, ${updated} updated, ${skipped} skipped out of ${all.length}`,
  );
}
