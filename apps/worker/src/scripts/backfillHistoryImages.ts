/**
 * Backfill AI editorial illustrations for Haiti History almanac entries.
 *
 * Usage:
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts --week   # this week only (~7 days)
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts          # all 366 days
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts --from 06-01 --to 06-30  # range
 *   npx tsx -r dotenv/config src/scripts/backfillHistoryImages.ts --force  # regenerate ALL, even existing
 *
 * Respects Gemini free-tier rate limits: 12 RPM with 5s delay between calls.
 * Skips entries that already have a gemini_ai illustration (unless --force).
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

/** Infer the historical era label from a year for period-accurate visuals. */
function inferEra(year: number | null | undefined): string {
  if (!year) return "historical Haiti";
  if (year < 1804) return "colonial-era / revolutionary Haiti (Saint-Domingue)";
  if (year < 1850) return "early independent Haiti, post-revolution (early 19th century)";
  if (year < 1900) return "19th-century Haiti, era of political upheaval and nation-building";
  if (year < 1960) return "early-to-mid 20th century Haiti, era of modernization";
  if (year < 2000) return "late 20th century Haiti, era of political transition and democracy";
  return "modern-day Haiti (21st century)";
}

function buildHistoryImagePrompt(entries: HaitiHistoryAlmanacEntry[]): string {
  const hero = entries[0];
  if (!hero) return "A bold editorial cartoon about Haitian history in the style of The New Yorker.";

  const year = hero.year ?? null;
  const era = inferEra(year);

  // Build rich context for the hero event
  const heroLines: string[] = [
    `MAIN EVENT: "${hero.title_fr}"${year ? ` (year ${year})` : ""}`,
  ];
  if (hero.summary_fr) {
    heroLines.push(`WHAT HAPPENED: ${hero.summary_fr}`);
  }
  if (hero.student_takeaway_fr) {
    heroLines.push(`WHY IT MATTERS: ${hero.student_takeaway_fr}`);
  }

  // Secondary events as brief context
  const others = entries.slice(1, 3);
  const otherLines = others.length > 0
    ? ["", "Also on this day:", ...others.map((e) => `• ${e.title_fr}${e.year ? ` (${e.year})` : ""}`)]
    : [];

  return [
    `Create a bold editorial cartoon illustration of this Haitian historical event.`,
    ``,
    ...heroLines,
    ...otherLines,
    ``,
    `ERA: ${era}`,
    ``,
    `ART DIRECTION:`,
    `- STYLE: Bold, graphic editorial cartoon — like a cover of The New Yorker, The Economist, or Time magazine. Strong outlines, flat bold colours, confident ink-work, slight stylisation. NOT photorealistic, NOT a painting, NOT a textbook illustration.`,
    `- PEOPLE: Draw the historical figures as stylised cartoon characters with expressive faces, period-accurate clothing for ${year ? `${year}` : "the era"}, and dynamic poses that tell the story. Show them front-facing and recognisable as characters (it is perfectly fine to depict people as cartoons).`,
    `- SCENE: Depict the SPECIFIC event described above — the action, the drama, the moment. NOT generic Caribbean scenery. Include setting details appropriate to ${year ? `Haiti in ${year}` : "the era"} (architecture, landscape, objects).`,
    `- COMPOSITION: Strong focal point, dramatic angle, clear visual storytelling. The viewer should immediately understand what is happening.`,
    `- COLOUR: Rich, saturated editorial palette — warm Caribbean tones (golden yellows, deep ocean blues, lush greens, sunset oranges) with bold contrast. Colours should pop.`,
    `- MOOD: Dramatic, dignified, engaging — appropriate for an educational publication aimed at students.`,
    ``,
    `STRICT RULES:`,
    `- The illustration MUST clearly depict the specific event described, not be generic`,
    `- NO text, NO words, NO letters, NO numbers anywhere in the image`,
    `- Portrait orientation (4:5 aspect ratio)`,
    `- Clean, professional, publication-ready quality`,
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
  const isForce = args.includes("--force");
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

  console.log(`\n🎨 History Image Backfill — ${mode}${isForce ? " (FORCE regenerate)" : ""}`);
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
    if (!isForce) {
      const existingAi = dayEntries.find((e) => e.illustration?.provider === "gemini_ai");
      if (existingAi?.illustration?.imageUrl) {
        console.log(`✅ ${monthDay} — already has AI illustration, skipping`);
        skipped++;
        continue;
      }
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
