/**
 * Deadline status utility for Opportunités.
 *
 * Determines whether an opportunity's deadline has passed and by how many days.
 * Pure function — no Firestore access, safe for client components.
 */

export interface DeadlineStatus {
  /** True when the deadline date is in the past. */
  isExpired: boolean;
  /** Number of days past the deadline (only set when isExpired is true). */
  daysPast?: number;
}

/**
 * Check whether an ISO deadline date has expired relative to today.
 *
 * - If `dateISO` is missing or invalid → not expired (benefit of the doubt).
 * - If today > deadline → expired with `daysPast` set.
 */
export function getDeadlineStatus(dateISO?: string | null): DeadlineStatus {
  if (!dateISO || typeof dateISO !== "string") {
    return { isExpired: false };
  }

  // Accept YYYY-MM-DD; append T00:00:00 to avoid timezone shift
  const cleaned = dateISO.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return { isExpired: false };
  }

  const deadline = new Date(cleaned + "T00:00:00");
  if (Number.isNaN(deadline.getTime())) {
    return { isExpired: false };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate(),
  );

  if (today.getTime() <= deadlineDay.getTime()) {
    return { isExpired: false };
  }

  const msPerDay = 86_400_000;
  const daysPast = Math.round(
    (today.getTime() - deadlineDay.getTime()) / msPerDay,
  );

  return { isExpired: true, daysPast };
}
