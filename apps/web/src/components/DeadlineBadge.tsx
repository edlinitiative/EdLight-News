/**
 * DeadlineBadge — subtle urgency pill for time-sensitive items.
 *
 * Renders "Clôture dans X jours" / "Fèmen nan X jou" with colour
 * intensity that increases as the deadline approaches.
 *
 * Returns null when:
 *  - dateISO is missing / invalid
 *  - deadline is in the past
 *  - deadline exceeds windowDays
 */

import { Clock, AlertTriangle } from "lucide-react";
import {
  parseISODateSafe,
  daysUntil,
  formatDaysLabel,
  urgencyTier,
  type UrgencyTier,
} from "@/lib/deadlines";

// ── Styling per tier ─────────────────────────────────────────────────────────

const TIER_STYLES: Record<UrgencyTier, string> = {
  critical: "bg-red-100 text-red-800 ring-1 ring-red-300",
  soon:     "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  upcoming: "bg-amber-50 text-amber-700",
  none:     "",
};

const TIER_ICON: Record<UrgencyTier, React.ReactNode> = {
  critical: <AlertTriangle className="h-3 w-3 shrink-0" />,
  soon:     <Clock className="h-3 w-3 shrink-0" />,
  upcoming: <Clock className="h-3 w-3 shrink-0" />,
  none:     null,
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface DeadlineBadgeProps {
  /** ISO date string (YYYY-MM-DD) */
  dateISO?: string | null;
  /** Maximum future window in days (default 30) */
  windowDays?: number;
  /** Display language */
  lang?: "fr" | "ht";
  /** Label prefix override */
  prefix?: { fr: string; ht: string };
  /** Visual variant */
  variant?: "compact" | "pill";
}

// ── Component ────────────────────────────────────────────────────────────────

export function DeadlineBadge({
  dateISO,
  windowDays = 30,
  lang = "fr",
  prefix,
  variant = "pill",
}: DeadlineBadgeProps) {
  const date = parseISODateSafe(dateISO);
  if (!date) return null;

  const days = daysUntil(date);
  if (days < 0 || days > windowDays) return null;

  const tier = urgencyTier(days);
  const label = formatDaysLabel(days, lang, prefix);
  const styles = TIER_STYLES[tier];
  const icon = TIER_ICON[tier];

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium ${styles}`}
        title={dateISO ?? ""}
      >
        {icon}
        {label}
      </span>
    );
  }

  // pill (default)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}
      title={dateISO ?? ""}
    >
      {icon}
      {label}
    </span>
  );
}
