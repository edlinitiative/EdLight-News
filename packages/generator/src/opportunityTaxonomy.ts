/**
 * @edlight-news/generator — Wider opportunity taxonomy
 *
 * Complements `opportunityScoring.ts` (which gates the 4 broad buckets:
 * bourses / stages / concours / programmes) with a finer-grained
 * action-oriented taxonomy designed for Haitian youth: scholarships,
 * fellowships, internships, competitions, grants, leadership programs,
 * exchange programs, accelerators, hackathons, calls for applications,
 * etc.
 *
 * All inference is **deterministic** and **purely textual** — no LLM, no
 * Firestore. Safe to import from worker, web (server + client), and tests.
 *
 * Design rule: every helper is a *no-op fallback* — if it can't infer
 * something it returns "unknown" / null / [] so callers never need to
 * guard. This keeps the model 100% backwards compatible with existing
 * Items that don't carry the new fields.
 */

import { normalizeForOpportunity } from "./opportunityScoring.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fine-grained kinds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The 22 actionable opportunity kinds EdLight tracks.
 *
 * Mapped onto the existing 4 broad buckets (bourses/stages/concours/programmes)
 * via {@link kindToBroadCategory} so legacy filters and Firestore indexes keep
 * working without migration.
 */
export const OPPORTUNITY_KINDS = [
  "scholarship",
  "fellowship",
  "grant",
  "internship",
  "apprenticeship",
  "competition",
  "hackathon",
  "essay_contest",
  "award",
  "startup_program",
  "incubator",
  "accelerator",
  "leadership_program",
  "exchange_program",
  "volunteer_program",
  "research_program",
  "training",
  "bootcamp",
  "conference",
  "travel_grant",
  "mentorship",
  "youth_delegation",
  "call_for_applications", // generic catch-all when no finer match
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

/** Patterns that select a single kind. First match wins, order matters. */
const KIND_PATTERNS: ReadonlyArray<{
  kind: OpportunityKind;
  patterns: RegExp[];
}> = [
  // High-confidence named formats first.
  {
    kind: "hackathon",
    patterns: [/\bhackathon\b/, /\bideathon\b/, /\bdatathon\b/, /\bcodefest\b/],
  },
  {
    kind: "essay_contest",
    patterns: [
      /\bessay\s+(?:contest|competition|prize)\b/,
      /\bconcours\s+(?:de\s+)?(?:r[eé]daction|d[ée]criture|d[ée]ssai)\b/,
      /\bwriting\s+contest\b/,
    ],
  },
  {
    kind: "travel_grant",
    patterns: [
      /\btravel\s+grant\b/,
      /\bbourse\s+de\s+(?:participation|d[ée]placement|voyage)\b/,
      /\bconference\s+(?:travel\s+)?(?:bursary|scholarship)\b/,
    ],
  },
  {
    kind: "youth_delegation",
    patterns: [
      /\byouth\s+delegate(?:s)?\b/,
      /\bjeunes?\s+d[ée]l[ée]gu[ée]s?\b/,
      /\bdel[ée]gation\s+(?:de\s+)?jeunes?\b/,
      /\bone\s+young\s+world\b/,
      /\bunga\s+youth\b/,
    ],
  },
  {
    kind: "leadership_program",
    patterns: [
      /\b(?:youth\s+)?leadership\s+(?:program|programme|academy|fellowship|institute)\b/,
      /\bprogramme\s+de\s+leadership\b/,
      /\byali\b/,
      /\bmandela\s+washington\b/,
      /\batlas\s+corps\b/,
      /\bglobal\s+changemakers\b/,
      /\bobama\s+(?:leaders|foundation\s+leaders)\b/,
    ],
  },
  {
    kind: "exchange_program",
    patterns: [
      /\bexchange\s+(?:program|programme|semester|year)\b/,
      /\bprogramme\s+d['\s]?[ée]change\b/,
      /\b(?:erasmus|study\s+abroad|semester\s+abroad)\b/,
    ],
  },
  {
    kind: "accelerator",
    patterns: [
      /\baccelerator\b/, /\bacc[ée]l[ée]rateur\b/,
      /\b(?:y\s+combinator|techstars|startupbootcamp|seedstars)\b/,
    ],
  },
  {
    kind: "incubator",
    patterns: [
      /\bincubator\b/, /\bincubateur\b/,
      /\binnovation\s+hub\b/,
    ],
  },
  {
    kind: "startup_program",
    patterns: [
      /\bstartup\s+(?:program|programme|challenge|competition|cohort)\b/,
      /\bgoogle\s+for\s+startups\b/,
      /\bfounders?\s+(?:program|cohort|fellowship)\b/,
      /\bpitch\s+competition\b/,
      /\binnovation\s+challenge\b/,
    ],
  },
  {
    kind: "bootcamp",
    patterns: [/\bboot\s?camp\b/, /\bcoding\s+bootcamp\b/, /\bcodeschool\b/],
  },
  {
    kind: "conference",
    patterns: [
      /\bconference\s+(?:scholarship|sponsorship|bursary|grant)\b/,
      /\b(?:fully[\s-]?funded|sponsored)\s+conference\b/,
      /\bsommet\s+(?:mondial|international)\s+(?:de\s+)?(?:la\s+)?jeunesse\b/,
    ],
  },
  {
    kind: "mentorship",
    patterns: [
      /\bmentorship\s+(?:program|programme|cohort)\b/,
      /\bprogramme\s+de\s+mentorat\b/,
      /\b1[\s-]?on[\s-]?1\s+mentorship\b/,
    ],
  },
  {
    kind: "research_program",
    patterns: [
      /\bresearch\s+(?:fellowship|program|programme|grant|assistantship)\b/,
      /\bprogramme\s+de\s+recherche\b/,
      /\b(?:summer|winter)\s+research\b/,
    ],
  },
  {
    kind: "volunteer_program",
    patterns: [
      /\bvolunteer\s+(?:program|programme|abroad|opportunit)/,
      /\bvolontariat\s+(?:international|de\s+solidarit[ée])\b/,
      /\bunv\b/, /\bpeace\s+corps\b/,
    ],
  },
  {
    kind: "training",
    patterns: [
      /\b(?:free|paid|sponsored)\s+training\b/,
      /\bformation\s+(?:gratuite|en\s+ligne|certifiante)\b/,
      /\btraining\s+cohort\b/, /\btraining\s+programme?\b/,
    ],
  },
  {
    kind: "apprenticeship",
    patterns: [/\bapprenticeship\b/, /\balternance\b/, /\bapprenti(?:e)?s?\b/],
  },
  {
    kind: "internship",
    patterns: [
      /\binternship\b/, /\boffre\s+de\s+stage\b/,
      /\bstage\s+(?:r[ée]mun[ée]r[ée]|en\s+entreprise|professionnel)\b/,
      /\bsummer\s+intern(?:ship)?\b/,
    ],
  },
  {
    kind: "fellowship",
    patterns: [/\bfellowship\b/, /\bfellow(?:s|ship)?\s+program/, /\bbourse\s+post[\s-]?doctoral/],
  },
  {
    kind: "grant",
    patterns: [
      /\bgrant\s+(?:opportunit|program|call|application)/,
      /\bsubvention\b/, /\baide\s+financi[èe]re\b/,
      /\bappel\s+[àa]\s+projets?\b/,
    ],
  },
  {
    kind: "competition",
    patterns: [
      /\bcompetition\s+(?:open|call|for|2\d{3})/,
      /\bconcours\s+(?:national|international|de\s+)/,
      /\bolympiade(?:s)?\b/,
      /\bmodel\s+un\b/, /\bmun\b/,
    ],
  },
  {
    kind: "award",
    patterns: [
      /\baward\s+(?:nomination|application|opportunit)/,
      /\bprix\s+(?:de\s+l['\s]?innovation|[ée]tudiant|de\s+la\s+jeunesse)\b/,
      /\bnominat(?:e|ions)\s+open\b/,
    ],
  },
  {
    kind: "scholarship",
    patterns: [
      /\bscholarship\b/,
      /\bbourse(?:s)?\s+(?:d['\s]?[ée]tudes?|compl[èe]te|enti[èe]re|partielle)\b/,
      /\bbourse(?:s)?\s+(?:fulbright|chevening|erasmus|daad|mext|chinese\s+government)\b/,
      /\b(?:fully[\s-]?funded|partially[\s-]?funded)\s+(?:masters?|phd|doctorate|undergraduate)\b/,
    ],
  },
  // Generic catch-all — matches when subcategory says "opportunity" but no
  // finer kind fired. Cheap last-resort signal.
  {
    kind: "call_for_applications",
    patterns: [
      /\bcall\s+for\s+applications?\b/,
      /\bappel\s+[àa]\s+candidatures?\b/,
      /\bapplications?\s+(?:open|now\s+open)\b/,
      /\bcandidatures?\s+ouvertes?\b/,
    ],
  },
];

/**
 * Infer the most specific opportunity kind from text.
 *
 * Returns `null` when nothing matches — the caller can then fall back to the
 * existing broad subcategory (bourses/stages/concours/programmes) without
 * losing the legacy classification.
 */
export function inferOpportunityKind(rawText: string): OpportunityKind | null {
  const text = normalizeForOpportunity(rawText);
  for (const { kind, patterns } of KIND_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return kind;
  }
  return null;
}

// Map fine kinds → existing 4-bucket ItemCategory so URL filters & Firestore
// indexes keep working unchanged. Used as a fallback by classify.ts only when
// the legacy bucket detector returns nothing.
const KIND_TO_BROAD: Record<OpportunityKind, "bourses" | "stages" | "concours" | "programmes"> = {
  scholarship: "bourses",
  fellowship: "bourses",
  grant: "bourses",
  travel_grant: "bourses",

  internship: "stages",
  apprenticeship: "stages",
  volunteer_program: "stages",

  competition: "concours",
  hackathon: "concours",
  essay_contest: "concours",
  award: "concours",

  startup_program: "programmes",
  incubator: "programmes",
  accelerator: "programmes",
  leadership_program: "programmes",
  exchange_program: "programmes",
  research_program: "programmes",
  training: "programmes",
  bootcamp: "programmes",
  conference: "programmes",
  mentorship: "programmes",
  youth_delegation: "programmes",
  call_for_applications: "programmes",
};

export function kindToBroadCategory(
  kind: OpportunityKind,
): "bourses" | "stages" | "concours" | "programmes" {
  return KIND_TO_BROAD[kind];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Audience
// ─────────────────────────────────────────────────────────────────────────────

export const OPPORTUNITY_AUDIENCES = [
  "high_school",
  "university",
  "young_professional",
  "entrepreneur",
  "ngo",
  "teacher",
  "researcher",
] as const;
export type OpportunityAudience = (typeof OPPORTUNITY_AUDIENCES)[number];

const AUDIENCE_PATTERNS: ReadonlyArray<{
  audience: OpportunityAudience;
  patterns: RegExp[];
}> = [
  {
    audience: "high_school",
    patterns: [
      /\b(?:high\s+school|secondary\s+school|lyc[ée]e(?:n|nne)?s?|secondaire)\b/,
      /\b(?:eleves?\s+du\s+secondaire|coll[ée]gien)\b/,
    ],
  },
  {
    audience: "university",
    patterns: [
      /\b(?:university|undergraduate|graduate|masters?|phd|doctorate|doctorat)\b/,
      /\b(?:[ée]tudiants?\s+(?:universitaires?|de\s+licence|de\s+master|en\s+doctorat))\b/,
      /\b(?:licence|master|doctorat|universite|faculte)\b/,
    ],
  },
  {
    audience: "young_professional",
    patterns: [
      /\b(?:young\s+professionals?|early[\s-]?career|mid[\s-]?career)\b/,
      /\b(?:jeunes?\s+professionnels?|jeune\s+cadre)\b/,
      /\b(?:1\s*[\u2013-]\s*5\s+years?\s+(?:of\s+)?experience)\b/,
    ],
  },
  {
    audience: "entrepreneur",
    patterns: [
      /\b(?:entrepreneur(?:s|ial)?|founders?|startup\s+founders?)\b/,
      /\b(?:porteurs?\s+de\s+projet|cr[ée]ateurs?\s+d['\s]?entreprise)\b/,
    ],
  },
  {
    audience: "ngo",
    patterns: [
      /\b(?:ngo|non[\s-]?profit|civil\s+society)\b/,
      /\b(?:ong|associations?|organisations?\s+(?:non\s+)?gouvernementales?)\b/,
    ],
  },
  {
    audience: "teacher",
    patterns: [
      /\b(?:teachers?|educators?|enseignants?|professeurs?\s+du\s+secondaire)\b/,
    ],
  },
  {
    audience: "researcher",
    patterns: [
      /\b(?:researchers?|post[\s-]?docs?|chercheurs?|doctorants?)\b/,
    ],
  },
];

/** Returns all matching audiences (multi-label). Empty array if unknown. */
export function inferOpportunityAudience(rawText: string): OpportunityAudience[] {
  const text = normalizeForOpportunity(rawText);
  const hits = new Set<OpportunityAudience>();
  for (const { audience, patterns } of AUDIENCE_PATTERNS) {
    if (patterns.some((p) => p.test(text))) hits.add(audience);
  }
  return [...hits];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Funding type
// ─────────────────────────────────────────────────────────────────────────────

export type OpportunityFundingType =
  | "fully_funded"
  | "partially_funded"
  | "paid"
  | "free"
  | "unclear";

export function inferFundingType(rawText: string): OpportunityFundingType {
  const text = normalizeForOpportunity(rawText);
  if (
    /\bfully[\s-]?funded\b/.test(text) ||
    /\b(?:enti[èe]rement|compl[èe]tement)\s+financ[ée]e?\b/.test(text) ||
    /\bbourse\s+(?:compl[èe]te|int[ée]grale)\b/.test(text)
  ) {
    return "fully_funded";
  }
  if (
    /\bpartially[\s-]?funded\b/.test(text) ||
    /\bpartiellement\s+financ[ée]e?\b/.test(text) ||
    /\bbourse\s+partielle\b/.test(text) ||
    /\btuition\s+only\b/.test(text)
  ) {
    return "partially_funded";
  }
  if (
    /\bpaid\s+(?:internship|program|programme|fellowship)\b/.test(text) ||
    /\bstage\s+r[ée]mun[ée]r[ée]\b/.test(text) ||
    /\bstipend\b/.test(text)
  ) {
    return "paid";
  }
  if (
    /\bfree\s+(?:training|program|programme|course)\b/.test(text) ||
    /\bformation\s+gratuite\b/.test(text) ||
    /\bsans\s+frais\b/.test(text) ||
    /\bno\s+(?:application\s+)?fee\b/.test(text)
  ) {
    return "free";
  }
  return "unclear";
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Location type
// ─────────────────────────────────────────────────────────────────────────────

export type OpportunityLocationType = "online" | "in_person" | "hybrid" | "unclear";

export function inferLocationType(rawText: string): OpportunityLocationType {
  const text = normalizeForOpportunity(rawText);
  const online =
    /\b(?:online|remote|virtual|en\s+ligne|[àa]\s+distance)\b/.test(text);
  const inPerson =
    /\b(?:in[\s-]?person|on[\s-]?site|en\s+pr[ée]sentiel|pr[ée]sentiel)\b/.test(
      text,
    );
  if (online && inPerson) return "hybrid";
  if (/\bhybrid(?:e)?\b/.test(text)) return "hybrid";
  if (online) return "online";
  if (inPerson) return "in_person";
  return "unclear";
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Haiti eligibility
// ─────────────────────────────────────────────────────────────────────────────

export type HaitiEligibility = "yes" | "no" | "unclear";

const HAITI_POSITIVE_RE =
  /\b(?:haiti|ha[ïi]ti|ayiti|ha[ïi]tien(?:ne)?s?|ha[ïi]tians?|caribbean|cara[ïi]bes?|developing\s+countries|pays\s+en\s+d[ée]veloppement|francophone|globally|worldwide|all\s+nationalities|toutes?\s+nationalit[ée]s?|low[\s-]?\s?and[\s-]?middle[\s-]?income\s+countries|lmic)\b/;

/** Countries that often appear as **exclusive** eligibility lists not containing Haiti. */
const HAITI_NEGATIVE_LIST_RE =
  /\beligible\s+(?:countries|nationals)\s*:\s*(?!.*\bhaiti)(?=[a-z, ]+\.)/i;

export function inferHaitiEligibility(rawText: string): HaitiEligibility {
  const text = normalizeForOpportunity(rawText);
  if (HAITI_POSITIVE_RE.test(text)) return "yes";
  if (HAITI_NEGATIVE_LIST_RE.test(rawText)) return "no";
  return "unclear";
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Lifecycle status (deadline-based)
// ─────────────────────────────────────────────────────────────────────────────

export type OpportunityLifecycle =
  | "open"
  | "deadline_soon" // within 14 days
  | "expired"
  | "unknown"; // no deadline parsed

const SOON_DAYS = 14;

/**
 * Compute lifecycle from a parsed ISO deadline.
 *
 * Used by:
 *   - classify.ts (writes onto Item.opportunity at ingest time)
 *   - admin queue + /opportunites filter chips
 *
 * Pure: deterministic given (deadlineISO, now).
 */
export function inferOpportunityLifecycle(
  deadlineISO: string | null | undefined,
  now: Date = new Date(),
): OpportunityLifecycle {
  if (!deadlineISO) return "unknown";
  const ts = Date.parse(deadlineISO);
  if (Number.isNaN(ts)) return "unknown";
  const diffMs = ts - now.getTime();
  if (diffMs < 0) return "expired";
  const days = diffMs / (24 * 60 * 60 * 1000);
  if (days <= SOON_DAYS) return "deadline_soon";
  return "open";
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Trust tier (publisher-derived)
// ─────────────────────────────────────────────────────────────────────────────

export type OpportunityTrustTier = "official" | "aggregator" | "media" | "social";

const OFFICIAL_DOMAINS = [
  "fulbright", "chevening.org", "daad.de", "mastercardfdn.org", "ec.europa.eu",
  "campusfrance", "auf.org", "francophonie.org", "cscuk.fcdo.gov.uk",
  "rotary.org", "rhodeshouse.ox.ac.uk", "schwarzmanscholars",
  "worldbank.org", "iadb.org", "undp.org", "unesco.org", "un.org",
  "educanada.ca", "studyinaustralia.gov.au", "turkiyeburslari.gov.tr",
  "campuschina.org", "studyinkorea.go.kr",
  "atlascorps.org", "globalchangemakers.net", "oneyoungworld.com",
  "obamafoundation.org", "echoinggreen.org", "ashoka.org",
];

const AGGREGATOR_DOMAINS = [
  "opportunitydesk.org", "opportunitiesforyouth.org", "youthop",
  "afterschoolafrica.com", "scholars4dev.com", "scholarshippositions.com",
  "scholarshipportal.com", "oppcentral.com", "scholarshiproar.com",
  "idealist.org",
];

export function inferTrustTier(
  publisherName?: string | null,
  url?: string | null,
): OpportunityTrustTier {
  const blob = `${publisherName ?? ""} ${url ?? ""}`.toLowerCase();
  if (OFFICIAL_DOMAINS.some((d) => blob.includes(d))) return "official";
  if (AGGREGATOR_DOMAINS.some((d) => blob.includes(d))) return "aggregator";
  if (/(facebook|instagram|x\.com|twitter|linkedin|tiktok)/.test(blob)) {
    return "social";
  }
  return "media";
}
