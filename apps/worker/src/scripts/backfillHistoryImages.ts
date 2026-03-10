/**
 * Backfill AI editorial illustrations for Haiti History almanac entries.
 *
 * Usage:
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts --week   # this week only (~7 days)
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts          # all 366 days
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts --from 06-01 --to 06-30  # range
 *
 * Respects Gemini free-tier rate limits: 12 RPM with 5s delay between calls.
 * Skips entries that already have a gemini_ai illustration.
 */

import { haitiHistoryAlmanacRepo } from "@edlight-news/firebase";
import type { HaitiHistoryAlmanacEntry } from "@edlight-news/types";
import { generateCustomImage } from "../services/geminiImageGen.js";

// ── Config ──────────────────────────────────────────────────────────────────

/** Delay between image generation calls (ms). Gemini free-tier = 15 RPM. */
const DELAY_MS = 5_000;

/** Maximum retries per image. */
const MAX_RETRIES = 2;

// ── Prompt builder (mirrors historyPublisher) ───────────────────────────────

function buildHistoryImagePrompt(entries: HaitiHistoryAlmanacEntry[]): string {
  const events = entries
    .map((e) => {
      const year = e.year ? ` (${e.year})` : "";
      return `• ${e.title_fr}${year}`;
    })
    .join("\n");

  return [
    "Create a colorful editorial illustration for a Haitian history educational post.",
    "",
    "Events featured today:",
    events,
    "",
    "Style requirements:",
    "- Bold, vibrant Caribbean color palette (warm yellows, ocean blues, lush greens, sunset oranges)",
    "- Hand-drawn editorial illustration style, NOT photorealistic",
    "- Symbolic/metaphorical imagery — do NOT depict specific named individuals",
    "- Include subtle Haitian cultural motifs (tropical flora, architecture, Caribbean sea)",
    "- Educational, dignified tone appropriate for students",
    "- Portrait orientation (4:5 aspect ratio, 1080×1350 pixels)",
    "- NO text, NO words, NO letters, NO numbers overlaid on the image",
    "- Clean composition with a clear focal point",
  ].join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWeekMonthDays(): string[] {
  const now = new Date();
  const days: string[] = [];
  for (let offset = -1; offset <= 5; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    days.push(`${mm}-${dd}`);
  }
  return days;
}

function getAllMonthDays(): string[] {
  const days: string[] = [];
  // Use a non-leap year for standard 365, then add Feb 29
  const year = 2024; // leap year to include 02-29
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      days.push(`${mm}-${dd}`);
    }
  }
  return days;
}

function parseMonthDayRange(from: string, to: string): string[] {
  const all = getAllMonthDays();
  const fromIdx = all.indexOf(from);
  const toIdx = all.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) {
    throw new Error(`Invalid range: --from ${from} --to ${to}`);
  }
  if (fromIdx <= toIdx) {
    return all.slice(fromIdx, toIdx + 1);
  }
  // Wrap around year boundary (e.g., 12-01 to 01-15)
  return [...all.slice(fromIdx), ...all.slice(0, toIdx + 1)];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isWeek = args.includes("--week");
  const fromIdx = args.indexOf("--from");
  const toIdx = args.indexOf("--to");

  let targetDays: string[];
  let mode: string;

  if (isWeek) {
    targetDays = getWeekMonthDays();
    mode = "week";
  } else if (fromIdx !== -1 && toIdx !== -1) {
    const from = args[fromIdx + 1];
    const to = args[toIdx + 1];
    if (!from || !to) throw new Error("--from and --to require MM-DD values");
    targetDays = parseMonthDayRange(from, to);
    mode = `range ${from}→${to}`;
  } else {
    targetDays = getAllMonthDays();
    mode = "full (366 days)";
  }

  console.log(`\n🎨 History Image Backfill — ${mode}`);
  console.log(`   Target days: ${targetDays.length}`);
  console.log(`   Rate limit delay: ${DELAY_MS}ms between calls\n`);

  // Fetch ALL almanac entries once (more efficient than per-day queries)
  console.log("📚 Loading all almanac entries...");
  const allEntries = await haitiHistoryAlmanacRepo.listAll();
  console.log(`   Loaded ${allEntries.length} entries\n`);

  // Group by monthDay
  const byDay = new Map<string, HaitiHistoryAlmanacEntry[]>();
  for (const entry of allEntries) {
    const existing = byDay.get(entry.monthDay) ?? [];
    existing.push(entry);
    byDay.set(entry.monthDay, existing);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let noDayData = 0;

  for (const monthDay of targetDays) {
    const dayEntries = byDay.get(monthDay);
    if (!dayEntries || dayEntries.length === 0) {
      console.log(`⏭️  ${monthDay} — no almanac entries, skipping`);
      noDayData++;
      continue;
    }

    // Check if any entry already has a gemini_ai illustration
    const existingAi = dayEntries.find((e) => e.illustration?.provider === "gemini_ai");
    if (existingAi?.illustration?.imageUrl) {
      console.log(`✅ ${monthDay} — already has AI illustration, skipping`);
      skipped++;
      continue;
    }

    // Generate AI illustration
    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const prompt = buildHistoryImagePrompt(dayEntries);
        const storagePath = `histoire/illustrations/${monthDay}.png`;
        const url = await generateCustomImage(prompt, storagePath);

        if (url) {
          // Save illustration metadata to the first entry
          const firstEntry = dayEntries[0]!;
          try {
            await haitiHistoryAlmanacRepo.update(firstEntry.id, {
              illustration: {
                imageUrl: url,
                pageUrl: url,
                provider: "gemini_ai" as const,
                confidence: 0.85,
              },
            } as Partial<typeof firstEntry>);
          } catch (updateErr) {
            console.warn(`   ⚠️ Could not persist metadata for ${monthDay}: ${updateErr}`);
          }

          console.log(`🎨 ${monthDay} — generated (${dayEntries.length} events, attempt ${attempt})`);
          generated++;
          success = true;
          break;
        } else {
          console.warn(`   ⚠️ ${monthDay} — generation returned null (attempt ${attempt}/${MAX_RETRIES})`);
        }
      } catch (err) {
        console.error(`   ❌ ${monthDay} — error (attempt ${attempt}/${MAX_RETRIES}):`, err instanceof Error ? err.message : err);
      }

      if (attempt < MAX_RETRIES) {
        await sleep(DELAY_MS * 2); // longer delay on retry
      }
    }

    if (!success) {
      failed++;
    }

    // Rate-limit delay
    await sleep(DELAY_MS);
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`🎨 Backfill complete!`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Skipped (already done): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   No data: ${noDayData}`);
  console.log(`   Total: ${targetDays.length}`);
  console.log(`${"═".repeat(50)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
