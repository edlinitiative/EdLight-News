/**
 * Refresh recurring scholarships.
 *
 * For every scholarship marked `recurring: true` whose `deadline.dateISO` is
 * in the past, roll the deadline forward by 1 year (preserving month/day).
 * This keeps the "Échéances" badge useful for evergreen, annually-recurring
 * programmes (Rhodes, Chevening, UWC, Fulbright, …) without needing the
 * curator to touch every entry every year.
 *
 * The script is **safe to re-run** — entries whose deadline is already in the
 * future are left untouched. `verifiedAt` is **not** bumped, so the next
 * curation pass can still spot stale entries.
 *
 * Usage:  pnpm refresh:recurring-scholarships  (from apps/worker)
 *
 * Future work: add a second pass that fetches each `officialUrl` (or the
 * source RSS already configured under `discoverScholarships`) to confirm or
 * adjust the rolled-forward date via the LLM, then bumps `verifiedAt`.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { scholarshipsRepo } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

const DRY_RUN = process.argv.includes("--dry-run");

function rollForward(dateISO: string, today: Date): string | null {
  // Parse YYYY-MM-DD reliably (no TZ shifts).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // How many full years to add to bring the date strictly into the future?
  const todayY = today.getUTCFullYear();
  const todayKey = today.toISOString().slice(0, 10);
  let nextY = Math.max(y, todayY);
  for (;;) {
    const candidate = `${String(nextY).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (candidate > todayKey) return candidate;
    nextY += 1;
    // Safety: never roll more than 5 cycles in one go.
    if (nextY > todayY + 5) return null;
  }
}

async function main() {
  const today = new Date();
  console.log(
    `🔁 Refreshing recurring scholarships${DRY_RUN ? " (DRY RUN)" : ""} — today=${today
      .toISOString()
      .slice(0, 10)}\n`,
  );

  const all = await scholarshipsRepo.listAll();
  const recurring = all.filter((s) => s.recurring === true);
  console.log(`   total scholarships: ${all.length}`);
  console.log(`   marked recurring  : ${recurring.length}\n`);

  let rolled = 0;
  let skipped = 0;
  let needsManual = 0;

  for (const s of recurring) {
    const dl = s.deadline;
    if (!dl?.dateISO) {
      // Nothing to roll — `varies` / `month-only` / no date.
      skipped++;
      continue;
    }
    const todayKey = today.toISOString().slice(0, 10);
    if (dl.dateISO > todayKey) {
      skipped++;
      continue;
    }
    const next = rollForward(dl.dateISO, today);
    if (!next) {
      console.warn(`  ⚠️  ${s.name} — could not roll deadline ${dl.dateISO}; needs manual review`);
      needsManual++;
      continue;
    }
    console.log(`  📅 ${s.name}: ${dl.dateISO} → ${next}`);
    if (!DRY_RUN) {
      await scholarshipsRepo.update(s.id, {
        deadline: { ...dl, dateISO: next },
      });
    }
    rolled++;
  }

  console.log(
    `\n🏁 Done — rolled: ${rolled}, skipped: ${skipped}, needs manual: ${needsManual}${
      DRY_RUN ? " (dry run, no writes)" : ""
    }`,
  );
}

main().catch((err) => {
  console.error("❌ Refresh failed:", err);
  process.exit(1);
});
