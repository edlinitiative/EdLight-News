/**
 * Utility Magazine Scheduler — generates student-focused original content
 * on a daily schedule with six recurring series.
 *
 * Daily slots (America/Port-au-Prince ≈ UTC-5):
 *   07:30  ScholarshipRadar / deadline-oriented
 *   13:00  Career OR StudyAbroad (weekly anchors)
 *   19:00  HaitiFactOfTheDay OR HaitiHistory
 *
 * Weekly anchors:
 *   Monday    → Career
 *   Wednesday → StudyAbroad (rotation: US→CA→FR→DO→RU*)
 *   Saturday  → HaitianOfTheWeek
 *   Other     → alternates per slot schedule
 *
 * RU rotation is disabled unless ENABLE_RU_STUDYABROAD=true.
 *
 * Called as a step in /tick alongside the existing scraper pipeline.
 */

import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  utilitySourcesRepo,
  utilityQueueRepo,
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import {
  generateUtilityFromPackets,
  validateUtilityJson,
  formatContentVersion,
} from "@edlight-news/generator";
import type { UtilitySourcePacket } from "@edlight-news/generator";
import { extractArticleContent } from "@edlight-news/scraper";
import type {
  UtilityType,
  UtilitySeries,
  UtilityMeta,
  ItemCategory,
  ContentLanguage,
  QualityFlags,
  UtilitySource,
} from "@edlight-news/types";

// ── Configuration ───────────────────────────────────────────────────────────

const MAX_JOBS_PER_TICK = parseInt(process.env.UTILITY_MAX_JOBS_PER_TICK ?? "2", 10);
const MAX_TEXT_PER_SOURCE = 2000;
const MAX_SOURCES_PER_JOB = 5;
const ENABLE_RU = process.env.ENABLE_RU_STUDYABROAD === "true";

/** Max sources to pull for calendar jobs */
const MAX_CALENDAR_SOURCES = 8;
/** Only create a new calendar item if none exists in last N days */
const CALENDAR_DEDUP_DAYS = 30;

// ── Haiti timezone offset (UTC-5 / EST, Haiti does not observe DST) ─────
const HAITI_UTC_OFFSET_HOURS = -5;

function getHaitiHour(): number {
  const now = new Date();
  const utcH = now.getUTCHours();
  return (utcH + HAITI_UTC_OFFSET_HOURS + 24) % 24;
}

function getHaitiDayOfWeek(): number {
  const now = new Date();
  // Adjust UTC date by Haiti offset to get local day
  const haitiTime = new Date(now.getTime() + HAITI_UTC_OFFSET_HOURS * 3600000);
  return haitiTime.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
}

// ── StudyAbroad country rotation ────────────────────────────────────────────

const STUDY_ABROAD_ROTATION = ENABLE_RU
  ? ["US", "CA", "FR", "DO", "RU"]
  : ["US", "CA", "FR", "DO"];

function getStudyAbroadRotationKey(): string {
  // Rotate weekly: use ISO week number mod rotation length
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7,
  );
  return STUDY_ABROAD_ROTATION[weekNum % STUDY_ABROAD_ROTATION.length]!;
}

// ── Date detection regex ────────────────────────────────────────────────────

const DATE_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/g,
  /\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/gi,
  /\d{1,2}\/\d{1,2}\/\d{4}/g,
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
];

function detectDates(text: string): string[] {
  const dates = new Set<string>();
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) for (const m of matches) dates.add(m);
  }
  return [...dates];
}

// ── Series → UtilityType mapping ────────────────────────────────────────────

function seriesToUtilityType(series: UtilitySeries): UtilityType {
  switch (series) {
    case "StudyAbroad":
      return "study_abroad";
    case "Career":
      return "career";
    case "ScholarshipRadar":
      return "scholarship";
    case "HaitiHistory":
      return "history";
    case "HaitiFactOfTheDay":
      return "daily_fact";
    case "HaitianOfTheWeek":
      return "profile";
    case "HaitiEducationCalendar":
      return "school_calendar";
  }
}

// ── Series → Category mapping ───────────────────────────────────────────────

function seriesToCategory(series: UtilitySeries): ItemCategory {
  switch (series) {
    case "ScholarshipRadar":
      return "bourses";
    case "HaitiEducationCalendar":
      return "resource";
    default:
      return "resource";
  }
}

// ── Source fetching ─────────────────────────────────────────────────────────

async function fetchSourcePacket(source: UtilitySource): Promise<UtilitySourcePacket | null> {
  try {
    if (source.type === "pdf") {
      console.log(`[utility] PDF source ${source.url} — skipping (not implemented)`);
      return null;
    }

    const extracted = await extractArticleContent(source.url, {
      articleBody: source.parsingHints?.selectorMain,
    });

    const text = extracted.text.slice(0, MAX_TEXT_PER_SOURCE);
    if (text.length < 50) {
      console.log(`[utility] Source ${source.url} — text too short (${text.length} chars)`);
      return null;
    }

    return {
      url: source.url,
      label: source.label,
      domain: source.allowlistDomain,
      extractedText: text,
      detectedDates: detectDates(text),
      pageTitle: extracted.title || source.label,
    };
  } catch (err) {
    console.error(
      `[utility] Failed to fetch source ${source.url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Slot scheduler ──────────────────────────────────────────────────────────

interface ScheduledSlot {
  series: UtilitySeries;
  rotationKey?: string;
}

/**
 * Determines which series should be produced right now based on Haiti time.
 * Returns up to 1 slot per call (the tick runs periodically).
 */
function getScheduledSlots(): ScheduledSlot[] {
  const hour = getHaitiHour();
  const dow = getHaitiDayOfWeek(); // 0=Sun … 6=Sat
  const slots: ScheduledSlot[] = [];
  // ── 06:45 slot: HaitiEducationCalendar (ALWAYS-ON, daily) ─────────────
  if (hour >= 6 && hour < 9) {
    slots.push({ series: "HaitiEducationCalendar", rotationKey: "HT" });
  }
  // ── 07:30 slot: ScholarshipRadar ─────────────────────────────────────────
  if (hour >= 7 && hour < 10) {
    slots.push({ series: "ScholarshipRadar" });
  }

  // ── 13:00 slot: Career or StudyAbroad (weekly anchors) ───────────────────
  if (hour >= 12 && hour < 16) {
    if (dow === 1) {
      // Monday → Career
      slots.push({ series: "Career" });
    } else if (dow === 3) {
      // Wednesday → StudyAbroad with rotation
      const rk = getStudyAbroadRotationKey();
      slots.push({ series: "StudyAbroad", rotationKey: rk });
    } else if (dow % 2 === 0) {
      // Even days → Career
      slots.push({ series: "Career" });
    } else {
      // Odd days → StudyAbroad
      const rk = getStudyAbroadRotationKey();
      slots.push({ series: "StudyAbroad", rotationKey: rk });
    }
  }

  // ── 19:00 slot: HaitiFactOfTheDay / HaitiHistory / HaitianOfTheWeek ─────
  if (hour >= 18 && hour < 22) {
    if (dow === 6) {
      // Saturday → HaitianOfTheWeek
      slots.push({ series: "HaitianOfTheWeek" });
    } else if (dow % 2 === 0) {
      // Even days → HaitiFactOfTheDay
      slots.push({ series: "HaitiFactOfTheDay" });
    } else {
      // Odd days → HaitiHistory
      slots.push({ series: "HaitiHistory" });
    }
  }

  return slots;
}

// ── Calendar change detection helpers ────────────────────────────────────────

/** Compute a SHA-256 hash over sorted deadlines for cheap change detection. */
function computeCalendarHash(deadlines: { label: string; dateISO: string; sourceUrl: string }[]): string {
  const sorted = [...deadlines].sort((a, b) =>
    `${a.dateISO}|${a.label}`.localeCompare(`${b.dateISO}|${b.label}`),
  );
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

/**
 * Find the most recent existing calendar item (living post) within CALENDAR_DEDUP_DAYS.
 * Returns null if no item found or if it's too old.
 */
async function findExistingCalendarItem(): Promise<import("@edlight-news/types").Item | null> {
  // Use items collection: look for utility items with series="HaitiEducationCalendar"
  const snap = await (await import("@edlight-news/firebase")).itemsRepo
    .listRecentItems(200);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CALENDAR_DEDUP_DAYS);
  const cutoffMs = cutoff.getTime();

  for (const item of snap) {
    if (
      item.itemType === "utility" &&
      item.utilityMeta?.series === "HaitiEducationCalendar"
    ) {
      // Check if item is within the dedup window
      const createdMs = item.createdAt instanceof Timestamp
        ? item.createdAt.toMillis()
        : new Date(item.createdAt as unknown as string).getTime();
      if (createdMs >= cutoffMs) return item;
    }
  }
  return null;
}

// ── Calendar education keywords for date detection ──────────────────────────

const CALENDAR_KEYWORDS = [
  "inscription", "admission", "concours", "bac", "ns ",
  "rentrée", "calendrier", "résultats", "session", "examen",
  "épreuve", "philo", "enregistrement", "rétho",
];

/** Detect Haiti education keywords in text. */
function hasCalendarKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return CALENDAR_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Main engine ─────────────────────────────────────────────────────────────

export interface UtilityEngineResult {
  seeded: number;
  processed: number;
  published: number;
  needsReview: number;
  errors: number;
}

export async function runUtilityEngine(): Promise<UtilityEngineResult> {
  const result: UtilityEngineResult = {
    seeded: 0,
    processed: 0,
    published: 0,
    needsReview: 0,
    errors: 0,
  };

  // ── Step 1: Seed queue based on daily schedule ────────────────────────────
  try {
    const slots = getScheduledSlots();
    console.log(`[utility] Scheduled slots for this tick: ${slots.map((s) => s.series).join(", ") || "none"}`);

    for (const slot of slots) {
      // Dedup: skip if a job for this series already exists in last 20h
      const recentJobs = await utilityQueueRepo.listQueuedJobs(50);
      const alreadyQueued = recentJobs.some(
        (j) => j.series === slot.series && (!slot.rotationKey || j.rotationKey === slot.rotationKey),
      );
      if (alreadyQueued) {
        console.log(`[utility] ${slot.series} already queued — skipping`);
        continue;
      }

      // Also check if we already published this series today
      const recentCount = await utilityQueueRepo.countRecentUtilityItems(20);
      // Fetch sources for this series
      const sources = slot.rotationKey
        ? await utilitySourcesRepo.listBySeriesAndRotation(slot.series, slot.rotationKey)
        : await utilitySourcesRepo.listBySeries(slot.series);

      if (sources.length === 0) {
        console.log(`[utility] No sources for ${slot.series}${slot.rotationKey ? `/${slot.rotationKey}` : ""} — skipping`);
        continue;
      }

      // Take top sources by priority (max varies by series)
      const maxSources = slot.series === "HaitiEducationCalendar"
        ? MAX_CALENDAR_SOURCES
        : MAX_SOURCES_PER_JOB;
      const topSources = sources.slice(0, maxSources);

      await utilityQueueRepo.enqueueJob({
        series: slot.series,
        ...(slot.rotationKey ? { rotationKey: slot.rotationKey } : {}),
        langTargets: ["fr", "ht"],
        sourceIds: topSources.map((s) => s.id),
      });

      result.seeded++;
      console.log(
        `[utility] Seeded ${slot.series}${slot.rotationKey ? `/${slot.rotationKey}` : ""} ` +
          `with ${topSources.length} sources`,
      );
    }
  } catch (err) {
    console.error("[utility] Error seeding queue:", err instanceof Error ? err.message : err);
  }

  // ── Step 2: Process queued jobs ───────────────────────────────────────────
  try {
    const jobs = await utilityQueueRepo.listQueuedJobs(MAX_JOBS_PER_TICK);
    console.log(`[utility] Found ${jobs.length} queued jobs to process`);

    for (const job of jobs) {
      try {
        await utilityQueueRepo.markProcessing(job.id);
        result.processed++;

        // Resolve sources by ID
        const resolvedSources: UtilitySource[] = [];
        for (const sid of job.sourceIds) {
          const src = await utilitySourcesRepo.getUtilitySource(sid);
          if (src) resolvedSources.push(src);
        }

        if (resolvedSources.length === 0) {
          await utilityQueueRepo.markFailed(job.id, ["No sources could be resolved from IDs"]);
          result.errors++;
          continue;
        }

        // Fetch source packets
        const packets: UtilitySourcePacket[] = [];
        for (const source of resolvedSources) {
          const packet = await fetchSourcePacket(source);
          if (packet) packets.push(packet);
        }

        if (packets.length === 0) {
          await utilityQueueRepo.markFailed(job.id, ["No source packets could be fetched"]);
          result.errors++;
          continue;
        }

        // Collect allowlist domains for validation
        const allowlistDomains = resolvedSources
          .map((s) => s.allowlistDomain)
          .filter(Boolean);

        // Generate utility content via LLM
        const genResult = await generateUtilityFromPackets({
          series: job.series,
          rotationKey: job.rotationKey,
          sourcePackets: packets,
        });

        if (!genResult.success) {
          await utilityQueueRepo.markFailed(job.id, [genResult.error]);
          result.errors++;
          continue;
        }

        const output = genResult.output;

        // Validate grounding with allowlist enforcement
        const validation = validateUtilityJson(
          packets,
          output,
          job.series,
          allowlistDomains,
        );

        // Map series → utilityType and category
        const utilityType = seriesToUtilityType(job.series);
        const category = seriesToCategory(job.series);

        // Build utility meta
        const utilityMeta: UtilityMeta = {
          series: job.series,
          utilityType,
          region: resolvedSources
            .flatMap((s) => s.region)
            .filter((v, i, a) => a.indexOf(v) === i) as UtilityMeta["region"],
          audience: ["universite", "international"],
          citations: output.citations,
          extractedFacts: {
            deadlines: output.facts.deadlines.map((d) => ({
              label: d.label,
              dateISO: d.dateISO,
              sourceUrl: d.sourceUrl,
            })),
            requirements: output.facts.requirements,
            steps: output.facts.steps,
            eligibility: output.facts.eligibility,
            ...(output.facts.notes && output.facts.notes.length > 0
              ? { notes: output.facts.notes }
              : {}),
          },
          ...(job.rotationKey ? { rotationKey: job.rotationKey } : {}),
        };

        // Compute calendar hash for change detection
        if (job.series === "HaitiEducationCalendar") {
          utilityMeta.calendarHash = computeCalendarHash(
            output.facts.deadlines.map((d) => ({
              label: d.label,
              dateISO: d.dateISO,
              sourceUrl: d.sourceUrl,
            })),
          );
        }

        // Build quality flags
        const qualityFlags: QualityFlags = {
          hasSourceUrl: true,
          needsReview: !validation.passed,
          lowConfidence: false,
          reasons: validation.issues,
        };

        // HaitiEducationCalendar strict: if validation fails, set needsReview but don't promote
        if (job.series === "HaitiEducationCalendar" && !validation.passed) {
          qualityFlags.needsReview = true;
        }

        // Audience fit score
        const audienceFitScore = validation.passed ? 0.92 : 0.70;

        // Find nearest deadline for ordering
        const deadlines = output.facts.deadlines
          .filter((d) => d.dateISO && d.dateISO.length > 0)
          .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        const nearestDeadline = deadlines.length > 0 ? deadlines[0]!.dateISO : null;

        // ── Calendar living-post logic ──────────────────────────────────────
        // For HaitiEducationCalendar: update existing item if one exists within
        // CALENDAR_DEDUP_DAYS, and only if deadlines actually changed.
        if (job.series === "HaitiEducationCalendar") {
          const existingCalendar = await findExistingCalendarItem();

          if (existingCalendar) {
            const oldHash = existingCalendar.utilityMeta?.calendarHash ?? "";
            const newHash = utilityMeta.calendarHash ?? "";

            if (oldHash === newHash && oldHash.length > 0) {
              // No meaningful change — skip regeneration
              console.log(
                `[utility] Calendar item ${existingCalendar.id} unchanged (hash match) — skipping update`,
              );
              await utilityQueueRepo.markDone(job.id);
              continue;
            }

            // Major update: deadlines changed
            console.log(
              `[utility] Calendar item ${existingCalendar.id} has changes — updating living post`,
            );

            await itemsRepo.updateItem(existingCalendar.id, {
              title: output.title_fr,
              summary: output.summary_fr,
              confidence: validation.passed ? 0.9 : 0.6,
              qualityFlags,
              citations: output.citations.map((c) => ({
                sourceName: c.label,
                sourceUrl: c.url,
              })),
              utilityMeta,
              audienceFitScore,
              deadline: nearestDeadline,
              evergreen: !nearestDeadline,
            });
            await itemsRepo.setLastMajorUpdate(existingCalendar.id);

            // Update content versions
            const existingCvs = await contentVersionsRepo.listByItemId(existingCalendar.id);
            const sourceCitations = output.citations.map((c) => ({
              name: c.label,
              url: c.url,
            }));

            for (const cv of existingCvs) {
              if (cv.channel !== "web") continue;
              const isFr = cv.language === "fr";
              const calendarStatus = validation.passed ? ("published" as const) : ("review" as const);
              const calendarDraftReason = validation.passed
                ? undefined
                : `Validation issues: ${validation.issues.join("; ")}`;
              const fmtCal = formatContentVersion({
                lang: isFr ? "fr" : "ht",
                title: isFr ? output.title_fr : output.title_ht,
                summary: isFr ? output.summary_fr : output.summary_ht,
                sections: isFr ? output.sections_fr : output.sections_ht,
                sourceCitations,
                series: job.series,
              });
              await contentVersionsRepo.updateContentVersion(cv.id, {
                title: fmtCal.title,
                summary: fmtCal.summary,
                body: (fmtCal.sections ?? (isFr ? output.sections_fr : output.sections_ht))
                  .map((s) => `## ${s.heading}\n\n${s.content}`)
                  .join("\n\n"),
                status: calendarStatus,
                ...(calendarDraftReason ? { draftReason: calendarDraftReason } : {}),
                qualityFlags,
                citations: output.citations.map((c) => ({
                  sourceName: c.label,
                  sourceUrl: c.url,
                })),
                sections: fmtCal.sections ?? (isFr ? output.sections_fr : output.sections_ht),
                sourceCitations: fmtCal.sourceCitations ?? sourceCitations,
              });
            }

            if (validation.passed) {
              await utilityQueueRepo.markDone(job.id);
              result.published++;
              console.log(`[utility] Updated calendar living post ${existingCalendar.id}`);
            } else {
              await utilityQueueRepo.markFailed(job.id, validation.issues);
              result.needsReview++;
              console.log(
                `[utility] Calendar ${existingCalendar.id} needs review: ${validation.issues.join("; ")}`,
              );
            }
            continue; // Skip normal item creation
          }
        }

        // ── Normal item creation (non-calendar or first calendar) ───────────
        // Create item
        const itemData = {
          rawItemId: `utility-${job.id}`,
          sourceId: "utility-engine",
          title: output.title_fr,
          summary: output.summary_fr,
          canonicalUrl: packets[0]!.url,
          category,
          deadline: nearestDeadline,
          evergreen: !nearestDeadline,
          confidence: validation.passed ? 0.9 : 0.6,
          qualityFlags,
          citations: output.citations.map((c) => ({
            sourceName: c.label,
            sourceUrl: c.url,
          })),
          itemType: "utility" as const,
          utilityMeta,
          audienceFitScore,
          geoTag: utilityMeta.region?.includes("HT") ? ("HT" as const) : ("Global" as const),
          imageSource: "branded" as const,
          // HaitianOfTheWeek items are success stories by definition
          ...(job.series === "HaitianOfTheWeek" ? { successTag: true } : {}),
        };

        const { item } = await itemsRepo.upsertItemByCanonicalUrl(itemData);
        console.log(
          `[utility] Created item ${item.id} (${job.series}): "${output.title_fr.slice(0, 60)}"`,
        );

        // Create content versions for FR and HT
        const sourceCitations = output.citations.map((c) => ({
          name: c.label,
          url: c.url,
        }));

        const status = validation.passed ? ("published" as const) : ("review" as const);
        const draftReason = validation.passed
          ? undefined
          : `Validation issues: ${validation.issues.join("; ")}`;

        for (const lang of job.langTargets as ContentLanguage[]) {
          const isFr = lang === "fr";
          const fmtUtil = formatContentVersion({
            lang: isFr ? "fr" : "ht",
            title: isFr ? output.title_fr : output.title_ht,
            summary: isFr ? output.summary_fr : output.summary_ht,
            sections: isFr ? output.sections_fr : output.sections_ht,
            sourceCitations,
            series: job.series,
          });
          await contentVersionsRepo.createContentVersion({
            itemId: item.id,
            channel: "web",
            language: lang,
            title: fmtUtil.title,
            summary: fmtUtil.summary ?? (isFr ? output.summary_fr : output.summary_ht),
            body: (fmtUtil.sections ?? (isFr ? output.sections_fr : output.sections_ht))
              .map((s) => `## ${s.heading}\n\n${s.content}`)
              .join("\n\n"),
            status,
            ...(draftReason ? { draftReason } : {}),
            category,
            qualityFlags,
            citations: output.citations.map((c) => ({
              sourceName: c.label,
              sourceUrl: c.url,
            })),
            sections: fmtUtil.sections ?? (isFr ? output.sections_fr : output.sections_ht),
            sourceCitations: fmtUtil.sourceCitations ?? sourceCitations,
          });
        }

        if (validation.passed) {
          await utilityQueueRepo.markDone(job.id);
          result.published++;
          console.log(`[utility] Published utility item ${item.id}`);
        } else {
          await utilityQueueRepo.markFailed(job.id, validation.issues);
          result.needsReview++;
          console.log(
            `[utility] Item ${item.id} needs review: ${validation.issues.join("; ")}`,
          );
        }
      } catch (err) {
        console.error(
          `[utility] Error processing job ${job.id}:`,
          err instanceof Error ? err.message : err,
        );
        await utilityQueueRepo
          .markFailed(job.id, [err instanceof Error ? err.message : "Unknown error"])
          .catch(() => {});
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[utility] Error processing queue:", err instanceof Error ? err.message : err);
    result.errors++;
  }

  console.log(`[utility] Engine done:`, result);
  return result;
}
