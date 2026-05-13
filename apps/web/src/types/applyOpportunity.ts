/**
 * DTO returned by the internal /api/internal/opportunities/* endpoints.
 *
 * This is the stable contract consumed by EdLight Apply. It deliberately
 * decouples the external shape from the internal Firestore `Scholarship`
 * model so the ingestion pipeline can evolve without breaking consumers.
 *
 * Fields that are not yet populated by the ingestion engine are returned
 * as `null` or `[]` — never invented or guessed.
 */

/** "program" = direct application; "directory" = listing of programmes. */
export type ApplyOpportunityType = "program" | "directory" | "unknown";

/** Whether Haitian students may apply. */
export type ApplyHaitiEligibilityStatus = "yes" | "no" | "unknown";

/** Funding coverage. */
export type ApplyFundingType =
  | "full"
  | "partial"
  | "stipend"
  | "tuition-only"
  | "unknown";

/** How precise the deadline information is. */
export type ApplyDeadlineConfidence =
  | "exact"
  | "month-only"
  | "varies"
  | "unknown";

/** Verification provenance. */
export type ApplyVerificationStatus = "verified" | "unverified";

export interface ApplyOpportunityDTO {
  id: string;
  /** Slug if the upstream model has one; otherwise null. */
  slug: string | null;
  title: string;
  type: ApplyOpportunityType;
  summary: string | null;

  /** Host countries (where the opportunity takes place). */
  countries: string[];
  /** Nationalities allowed to apply. */
  eligibleNationalities: string[];
  haitiEligibilityStatus: ApplyHaitiEligibilityStatus;

  /** e.g. ["bachelor", "master", "phd", "short_programs"]. */
  degreeLevels: string[];
  /** Fields of study, when known. Empty for now. */
  fields: string[];
  /** Languages of instruction or required for application. Empty for now. */
  languages: string[];

  fundingType: ApplyFundingType;
  /** Free-form funding details (e.g. tuition + stipend amounts). */
  fundingDetails: string | null;

  /** ISO date string, or null if evergreen / unknown. */
  deadline: string | null;
  deadlineConfidence: ApplyDeadlineConfidence;

  /** Where the student actually applies. */
  applicationUrl: string | null;
  /** Canonical source / official programme URL. */
  sourceUrl: string | null;

  /** Whether the student must secure university admission first. */
  requiresAdmissionFirst: boolean | null;

  documentsRequired: string[];
  languageTestsAccepted: string[];

  verificationStatus: ApplyVerificationStatus;
  /** ISO timestamp of last verification, or null. */
  lastCheckedAt: string | null;

  /** Public News page URL for this opportunity (relative or absolute). */
  publicNewsUrl: string | null;

  tags: string[];

  /** ISO timestamps. createdAt may be null when not tracked upstream. */
  createdAt: string | null;
  updatedAt: string | null;
}
