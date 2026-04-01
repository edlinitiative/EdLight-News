/**
 * Week-calculation helpers for the /histoire weekly view.
 * Haiti timezone: America/Port-au-Prince (UTC-5 winter, UTC-4 summer — follows US Eastern DST).
 */

const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MONTH_NAMES_HT = [
  "janvye", "fevriye", "mas", "avril", "me", "jen",
  "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
];

export const DAY_NAMES_FR = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi",
];
export const DAY_NAMES_HT = [
  "Dimanch", "Lendi", "Madi", "Mèkredi", "Jedi", "Vandredi", "Samdi",
];
export const DAY_SHORT_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const DAY_SHORT_HT = ["Dim", "Len", "Mad", "Mèk", "Jed", "Van", "Sam"];

export interface WeekBounds {
  /** MM-DD of Sunday */
  start: string;
  /** MM-DD of Saturday */
  end: string;
  /** 7 MM-DD strings (Sun → Sat) */
  days: string[];
  /** Human-readable label, e.g. "22–28 Février 2026" */
  label: string;
  /** Per-day metadata for rendering headers */
  dayLabels: { dayName: string; dayShort: string; dayNumber: number; monthShort: string; monthIndex: number }[];
}

/**
 * Get the current date/time in the Haiti timezone (America/Port-au-Prince).
 * Uses Intl.DateTimeFormat so DST transitions (UTC-5 ↔ UTC-4) are handled
 * automatically by the platform — no hardcoded offset.
 */
function getHaitiNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port-au-Prince",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // Construct as a local-time string so getUTC* methods return Haiti values
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`,
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Compute the 7-day week bounds (Sunday → Saturday) for the current week + offset.
 *
 * @param weekOffset 0 = current week, -1 = last week, +1 = next week
 * @param lang       "fr" | "ht" — controls month/day name language
 */
export function getHaitiWeekBounds(
  weekOffset: number,
  lang: "fr" | "ht" = "fr",
): WeekBounds {
  const now = getHaitiNow();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // Rewind to Sunday (getUTCDay() returns 0 = Sun)
  const dayOfWeek = today.getUTCDay();
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - dayOfWeek + weekOffset * 7);

  const days: string[] = [];
  const dayLabels: WeekBounds["dayLabels"] = [];
  const dayNames = lang === "fr" ? DAY_NAMES_FR : DAY_NAMES_HT;
  const dayShorts = lang === "fr" ? DAY_SHORT_FR : DAY_SHORT_HT;
  const monthNames = lang === "fr" ? MONTH_NAMES_FR : MONTH_NAMES_HT;

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() + i);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${mm}-${dd}`);
    dayLabels.push({
      dayName: dayNames[d.getUTCDay()]!,
      dayShort: dayShorts[d.getUTCDay()]!,
      dayNumber: d.getUTCDate(),
      monthShort: capitalize((monthNames[d.getUTCMonth()] ?? "").slice(0, 3)),
      monthIndex: d.getUTCMonth(),
    });
  }

  // Build human label
  const firstDay = new Date(sunday);
  const lastDay = new Date(sunday);
  lastDay.setUTCDate(sunday.getUTCDate() + 6);

  let label: string;
  if (
    firstDay.getUTCMonth() === lastDay.getUTCMonth() &&
    firstDay.getUTCFullYear() === lastDay.getUTCFullYear()
  ) {
    // Same month: "22–28 Février 2026"
    const monthName = capitalize(monthNames[firstDay.getUTCMonth()] ?? "");
    label = `${firstDay.getUTCDate()}–${lastDay.getUTCDate()} ${monthName} ${firstDay.getUTCFullYear()}`;
  } else {
    // Cross-month or cross-year: "29 Déc 2025 – 4 Jan 2026"
    const m1 = capitalize((monthNames[firstDay.getUTCMonth()] ?? "").slice(0, 3));
    const m2 = capitalize((monthNames[lastDay.getUTCMonth()] ?? "").slice(0, 3));
    const y1 = firstDay.getUTCFullYear();
    const y2 = lastDay.getUTCFullYear();
    label = `${firstDay.getUTCDate()} ${m1}${y1 !== y2 ? ` ${y1}` : ""} – ${lastDay.getUTCDate()} ${m2} ${y2}`;
  }

  return { start: days[0]!, end: days[6]!, days, label, dayLabels };
}
