/**
 * Shared deadline display helpers.
 *
 * Single source of truth for how deadlines are formatted, labelled, and
 * badge-coloured across the entire EdLight News UI.
 *
 * Pure functions — no side effects, no Firestore calls.
 */

export type BadgeVariant =
  | "expired"   // red
  | "today"     // red
  | "urgent"    // amber  (1-7 days)
  | "soon"      // blue   (8-45 days, badge shows J-X)
  | "upcoming"  // stone  (>45 days)
  | "unknown";  // stone  (no date)

export interface DeadlineDisplayStatus {
  /** Short badge text: "Expiré", "Aujourd'hui", "Urgent", "J-12", "À venir", "À confirmer" */
  badgeLabel: string;
  /** Colour variant for styling */
  badgeVariant: BadgeVariant;
  /** Human-readable line: "Clôturé le 3 mars 2026", "Dernier jour", "Clôture dans 5 jours", etc. */
  humanLine: string;
  /** Raw days-until value (negative = past, 0 = today, null = unknown) */
  daysLeft: number | null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseSafe(dateISO?: string | null): Date | null {
  if (!dateISO || typeof dateISO !== "string") return null;
  const cleaned = dateISO.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return null;
  const d = new Date(cleaned + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(target: Date, now: Date): number {
  return Math.round((stripTime(target).getTime() - stripTime(now).getTime()) / 86_400_000);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Format a deadline date for display.
 *
 *   formatDeadlineDate("2026-03-15", "fr")  → "15 mars 2026"
 *   formatDeadlineDate("2026-03-15", "ht")  → "15 mars 2026" (fr-HT locale)
 *   formatDeadlineDate(undefined, "fr")      → null
 */
export function formatDeadlineDate(
  dateISO: string | undefined | null,
  lang: "fr" | "ht",
): string | null {
  const d = parseSafe(dateISO);
  if (!d) return null;
  try {
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "fr-HT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateISO ?? null;
  }
}

/**
 * Format a deadline date in short form (day + abbreviated month).
 *
 *   formatDeadlineDateShort("2026-03-15", "fr")  → "15 mars"
 */
export function formatDeadlineDateShort(
  dateISO: string | undefined | null,
  lang: "fr" | "ht",
): string | null {
  const d = parseSafe(dateISO);
  if (!d) return null;
  try {
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "fr-HT", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateISO ?? null;
  }
}

/**
 * Central deadline status resolver.
 *
 * Returns everything the UI needs to display a deadline: badge text,
 * badge variant, human-readable countdown line, and raw days-left.
 *
 * @param dateISO  YYYY-MM-DD string, or null/undefined if unknown
 * @param lang     "fr" | "ht"
 * @param now      Override for testing
 */
export function getDeadlineStatus(
  dateISO: string | undefined | null,
  lang: "fr" | "ht",
  now: Date = new Date(),
): DeadlineDisplayStatus {
  const fr = lang === "fr";

  // ── No date ──
  if (!dateISO) {
    return {
      badgeLabel: fr ? "À confirmer" : "Pou verifye",
      badgeVariant: "unknown",
      humanLine: fr ? "Date limite non précisée" : "Dat limit pa presize",
      daysLeft: null,
    };
  }

  const target = parseSafe(dateISO);
  if (!target) {
    return {
      badgeLabel: fr ? "À confirmer" : "Pou verifye",
      badgeVariant: "unknown",
      humanLine: fr ? "Date limite non précisée" : "Dat limit pa presize",
      daysLeft: null,
    };
  }

  const days = daysBetween(target, now);
  const formatted = formatDeadlineDate(dateISO, lang)!;

  // ── Past ──
  if (days < 0) {
    return {
      badgeLabel: fr ? "Expiré" : "Fini",
      badgeVariant: "expired",
      humanLine: fr ? `Clôturé le ${formatted}` : `Fèmen depi ${formatted}`,
      daysLeft: days,
    };
  }

  // ── Today ──
  if (days === 0) {
    return {
      badgeLabel: fr ? "Aujourd'hui" : "Jodi a",
      badgeVariant: "today",
      humanLine: fr ? "Dernier jour" : "Dènye jou",
      daysLeft: 0,
    };
  }

  // ── Tomorrow ──
  if (days === 1) {
    return {
      badgeLabel: fr ? "Urgent" : "Ijan",
      badgeVariant: "urgent",
      humanLine: fr ? "Clôture demain" : "Fèmen demen",
      daysLeft: 1,
    };
  }

  // ── 2-7 days ──
  if (days <= 7) {
    return {
      badgeLabel: fr ? "Urgent" : "Ijan",
      badgeVariant: "urgent",
      humanLine: fr
        ? `Clôture dans ${days} jours`
        : `Fèmen nan ${days} jou`,
      daysLeft: days,
    };
  }

  // ── 8-45 days ──
  if (days <= 45) {
    return {
      badgeLabel: `J-${days}`,
      badgeVariant: "soon",
      humanLine: fr
        ? `Clôture dans ${days} jours`
        : `Fèmen nan ${days} jou`,
      daysLeft: days,
    };
  }

  // ── >45 days ──
  return {
    badgeLabel: fr ? "À venir" : "Ap vini",
    badgeVariant: "upcoming",
    humanLine: fr ? `Clôture le ${formatted}` : `Fèmen ${formatted}`,
    daysLeft: days,
  };
}

// ── Badge variant → Tailwind class mapping ───────────────────────────────────

const BADGE_STYLES: Record<BadgeVariant, string> = {
  expired:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  today:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  urgent:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  soon:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  upcoming: "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
  unknown:  "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400",
};

/** Get the Tailwind class string for a badge variant. */
export function badgeStyle(variant: BadgeVariant): string {
  return BADGE_STYLES[variant];
}
