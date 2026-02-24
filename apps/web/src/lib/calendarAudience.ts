/**
 * Audience classification for calendar items.
 *
 * Determines whether a calendar/deadline item is specifically targeted
 * at Haitian students, separate from geo classification.
 *
 * An item can be "International" geo (abroad deadline) while still being
 * "HaitianStudents" audience (e.g. Campus France scholarship for Haitians).
 */

export type CalendarAudience = "HaitianStudents" | "General";

/** Flexible input shape accepted by {@link getCalendarAudience}. */
export interface CalendarAudienceInput {
  title?: string | null;
  name?: string | null;
  summary?: string | null;
  notes?: string | null;
  institution?: string | null;
  eligibilitySummary?: string | null;
  /** HaitiCalendarEvent items are inherently for Haitian students */
  eventType?: string | null;
}

/** Normalise for matching: lowercase, trim. Keeps accented chars for pattern matching. */
function lower(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Patterns that signal "for Haitian students" in eligibility/title/summary.
 * These are checked case-insensitively against the combined text blob.
 */
const HAITIAN_AUDIENCE_PATTERNS: readonly RegExp[] = [
  /candidats?\s+ha[iï]tiens?/i,
  /pour\s+ha[iï]ti/i,
  /ha[iï]tien[·\s]?n?e?s?/i,
  /\b[eé]tudiants?\s+ha[iï]tiens?/i,
  /\b[eé]ligible.*ha[iï]ti/i,
  /ressortissants?\s+ha[iï]tiens?/i,
];

/**
 * Calendar event types that are inherently Haiti-audience (national exams, etc.).
 */
const HAITI_EVENT_TYPES = new Set(["exam", "results", "rentree", "registration"]);

/**
 * Classify whether a calendar item targets Haitian students specifically.
 *
 * This is **independent** of geo classification:
 * - A Campus France deadline is "International" geo but "HaitianStudents" audience.
 * - A Chevening scholarship is "International" geo and "General" audience
 *   (unless text mentions Haitian eligibility).
 */
export function getCalendarAudience(item: CalendarAudienceInput): CalendarAudience {
  // Haiti national education events are inherently for Haitian students
  if (item.eventType && HAITI_EVENT_TYPES.has(item.eventType)) {
    return "HaitianStudents";
  }

  // Check text signals
  const textParts: string[] = [];
  if (item.title) textParts.push(item.title);
  if (item.name) textParts.push(item.name);
  if (item.summary) textParts.push(item.summary);
  if (item.notes) textParts.push(item.notes);
  if (item.institution) textParts.push(item.institution);
  if (item.eligibilitySummary) textParts.push(item.eligibilitySummary);

  const blob = textParts.join(" ");
  if (blob.length === 0) return "General";

  const text = lower(blob);

  // Check patterns
  for (const pattern of HAITIAN_AUDIENCE_PATTERNS) {
    if (pattern.test(text)) return "HaitianStudents";
  }

  return "General";
}
