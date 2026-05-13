/**
 * Convert an internal `Scholarship` Firestore record into the stable
 * ApplyOpportunityDTO consumed by EdLight Apply.
 *
 * Rules:
 *   - Never expose raw Firestore data, internal scoring, prompts, scraping
 *     metadata, or admin-only fields.
 *   - Never invent values: missing fields become `null` or `[]`.
 *   - Timestamps are normalized to ISO strings.
 */

import type { Scholarship } from "@edlight-news/types";
import type {
  ApplyDeadlineConfidence,
  ApplyFundingType,
  ApplyHaitiEligibilityStatus,
  ApplyOpportunityDTO,
  ApplyOpportunityType,
  ApplyVerificationStatus,
} from "@/types/applyOpportunity";

/** Firestore Timestamp-like (admin SDK or plain) → ISO string. */
function toIso(
  value: unknown,
): string | null {
  if (!value) return null;
  // firebase-admin Timestamp
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d.toISOString();
    } catch {
      return null;
    }
  }
  // Raw {seconds, nanoseconds}
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    const seconds = (value as { seconds: number }).seconds;
    return new Date(seconds * 1000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function mapType(kind: Scholarship["kind"]): ApplyOpportunityType {
  if (kind === "program" || kind === "directory") return kind;
  return "unknown";
}

function mapHaitiEligibility(
  raw: Scholarship["haitianEligibility"],
): ApplyHaitiEligibilityStatus {
  if (raw === "yes" || raw === "no" || raw === "unknown") return raw;
  return "unknown";
}

function mapFunding(raw: Scholarship["fundingType"]): ApplyFundingType {
  if (
    raw === "full" ||
    raw === "partial" ||
    raw === "stipend" ||
    raw === "tuition-only"
  ) {
    return raw;
  }
  return "unknown";
}

function mapDeadlineConfidence(
  raw: Scholarship["deadlineAccuracy"],
): ApplyDeadlineConfidence {
  if (
    raw === "exact" ||
    raw === "month-only" ||
    raw === "varies" ||
    raw === "unknown"
  ) {
    return raw;
  }
  return "unknown";
}

/**
 * Convert a verified Scholarship doc into the public DTO.
 */
export function serializeOpportunityForApply(
  doc: Scholarship,
): ApplyOpportunityDTO {
  // Host country → countries[] (single-value upstream).
  const countries: string[] = doc.country ? [doc.country] : [];

  // Nationalities allowed.
  const eligibleNationalities: string[] = Array.isArray(doc.eligibleCountries)
    ? doc.eligibleCountries.filter((c): c is string => typeof c === "string")
    : [];

  // Verification: a Scholarship is "verified" iff verifiedAt is set.
  const lastCheckedAt = toIso(doc.verifiedAt);
  const verificationStatus: ApplyVerificationStatus = lastCheckedAt
    ? "verified"
    : "unverified";

  return {
    id: doc.id,
    // No slug field exists on Scholarship today.
    slug: null,
    title: typeof doc.name === "string" ? doc.name : "",
    type: mapType(doc.kind),
    summary:
      typeof doc.eligibilitySummary === "string" && doc.eligibilitySummary.length > 0
        ? doc.eligibilitySummary
        : typeof doc.programDescription === "string" && doc.programDescription.length > 0
          ? doc.programDescription
          : null,

    countries,
    eligibleNationalities,
    haitiEligibilityStatus: mapHaitiEligibility(doc.haitianEligibility),

    degreeLevels: Array.isArray(doc.level) ? [...doc.level] : [],
    // Not yet captured in the upstream model.
    fields: [],
    languages: [],

    fundingType: mapFunding(doc.fundingType),
    // No dedicated field; programDescription often holds it but is also used
    // for `summary`. Leave null rather than duplicating.
    fundingDetails: null,

    deadline: doc.deadline?.dateISO ?? null,
    deadlineConfidence: mapDeadlineConfidence(doc.deadlineAccuracy),

    applicationUrl: doc.howToApplyUrl ?? doc.officialUrl ?? null,
    sourceUrl: doc.officialUrl ?? null,

    // Not currently tracked in the schema.
    requiresAdmissionFirst: null,

    documentsRequired: Array.isArray(doc.requirements) ? [...doc.requirements] : [],
    // Not currently tracked in the schema.
    languageTestsAccepted: [],

    verificationStatus,
    lastCheckedAt,

    publicNewsUrl:
      typeof doc.relatedPagePath === "string" && doc.relatedPagePath.length > 0
        ? doc.relatedPagePath
        : null,

    tags: Array.isArray(doc.tags) ? [...doc.tags] : [],

    // Scholarship has no createdAt; only verifiedAt + updatedAt.
    createdAt: null,
    updatedAt: toIso(doc.updatedAt),
  };
}
