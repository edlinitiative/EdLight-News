/**
 * deadlineParsing — parse free-text French / ISO deadlines into a Date,
 * and decide whether a deadline has already passed.
 *
 * Used by the Reels picker (v1.7) to avoid posting opportunities whose
 * deadline is in the past, and by `opportunityScoring` to penalise
 * expired entries.
 *
 * Fail-open policy: if we cannot confidently parse a date, we return
 * `null` from `parseDeadline` and `false` from `isDeadlinePast` so that
 * items with unusual deadline strings are NOT excluded. The picker
 * remains permissive — we only skip when we are SURE the date is past.
 *
 * Supported formats
 *   • ISO `YYYY-MM-DD` or full ISO datetime
 *   • French free-text: `15 mars 2026`, `15 mars`, `30 avril 2025`,
 *     `Dépôt avant 15 mars 2026`, `Avant le 15/03/2026`
 *   • Numeric: `15/03/2026`, `15-03-2026`, `2026/03/15`
 *   • English (defensive): `March 15, 2026`, `15 March 2026`
 */

const MONTHS_FR: Record<string, number> = {
  janvier: 1, jan: 1,
  février: 2, fevrier: 2, fev: 2, fév: 2, "févr": 2, "fevr": 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7, jul: 7,
  août: 8, aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  décembre: 12, decembre: 12, déc: 12, dec: 12,
};

const MONTHS_EN: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const MONTH_LOOKUP: Record<string, number> = { ...MONTHS_EN, ...MONTHS_FR };

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Parse a free-text deadline string into a Date. Returns `null` if no
 * date can be confidently extracted.
 *
 * @param deadline   The raw deadline string (e.g. "15 mars 2026").
 * @param now        Reference "today" used for year inference when only
 *                   day+month is provided. Defaults to `new Date()`.
 */
export function parseDeadline(
  deadline: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!deadline) return null;
  const raw = normalise(deadline);
  if (!raw) return null;

  // 1) ISO date / datetime (YYYY-MM-DD or full).
  const isoMatch = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})(?:t\d{2}:\d{2}.*)?\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // 2) Numeric DMY / YMD with / or - separators.
  //    Try DMY first (European convention) then YMD if ambiguous.
  const numMatch = raw.match(/\b(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})\b/);
  if (numMatch) {
    const [, a, b, c] = numMatch;
    const na = Number(a), nb = Number(b), nc = Number(c);
    let y: number | null = null, m: number | null = null, d: number | null = null;
    if (a.length === 4) {
      // YYYY/MM/DD
      y = na; m = nb; d = nc;
    } else if (c.length === 4) {
      // DD/MM/YYYY (European)
      d = na; m = nb; y = nc;
    } else {
      // ambiguous DD/MM/YY → assume European, 20YY
      d = na; m = nb; y = nc < 100 ? 2000 + nc : nc;
    }
    if (y && m && d && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  // 3) Day + month name (FR or EN), optional year.
  //    e.g. "15 mars 2026", "le 15 mars", "march 15, 2026", "15 march"
  const dayMonthMatch =
    raw.match(/\b(\d{1,2})\s+([a-zéûôàèç]+)\.?\s*(\d{2,4})?\b/i) ||
    raw.match(/\b([a-zéûôàèç]+)\.?\s+(\d{1,2})(?:,\s*|\s+)(\d{2,4})\b/i);
  if (dayMonthMatch) {
    let dayStr: string, monthStr: string, yearStr: string | undefined;
    // Distinguish between "15 mars 2026" and "march 15, 2026".
    if (/^\d/.test(dayMonthMatch[1])) {
      dayStr = dayMonthMatch[1]; monthStr = dayMonthMatch[2]; yearStr = dayMonthMatch[3];
    } else {
      monthStr = dayMonthMatch[1]; dayStr = dayMonthMatch[2]; yearStr = dayMonthMatch[3];
    }
    const month = MONTH_LOOKUP[monthStr.toLowerCase().replace(/\.$/, "")];
    const day = Number(dayStr);
    if (month && day >= 1 && day <= 31) {
      let year: number;
      if (yearStr) {
        const ny = Number(yearStr);
        year = ny < 100 ? 2000 + ny : ny;
      } else {
        // No year → pick the next occurrence (if month+day already passed
        // this year, roll forward to next year).
        year = now.getUTCFullYear();
        const candidate = new Date(Date.UTC(year, month - 1, day));
        if (candidate.getTime() < now.getTime()) year += 1;
      }
      const dt = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  return null;
}

/**
 * Returns `true` only when the deadline can be parsed AND has already
 * passed. Returns `false` if the deadline is in the future, missing,
 * or unparseable (fail-open — we don't want to drop items just because
 * the deadline copy is unusual).
 *
 * "Past" means strictly before today's UTC date (we ignore time-of-day
 * to avoid timezone edge cases — a "15 mars" deadline is treated as
 * still valid through end of 15 mars in any timezone).
 */
export function isDeadlinePast(
  deadline: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const parsed = parseDeadline(deadline, now);
  if (!parsed) return false;
  // Compare on UTC date only — treat "end of day" as the cutoff.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return parsed.getTime() < today.getTime();
}
