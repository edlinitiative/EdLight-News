/**
 * @edlight-news/ig – Selection logic
 *
 * Determines whether a content item is eligible for Instagram posting
 * and assigns a priority score for scheduling.
 *
 * Pure functions — no side effects, no DB calls.
 */

import type { Item, IGDecision, IGPostType } from "@edlight-news/types";

// ── Student-relevance markers for news eligibility ─────────────────────────
const NEWS_STUDENT_MARKERS = [
  "éducation", "education", "edikasyon", "université", "university",
  "examen", "exam", "baccalauréat", "bac", "concours", "inscription",
  "bourse", "scholarship", "sécurité", "sécurité des écoles",
  "école", "school", "lekòl", "étudiant", "student", "elèv",
  "campus", "formation", "rentrée", "diplôme", "admission",
  "perturbation", "disruption", "grève", "tremblement", "ouragan",
  "cyclone", "urgence", "emergency", "catastrophe",
];

// ── Official / strong source domains ───────────────────────────────────────
const OFFICIAL_DOMAINS = [
  "menfp.gouv.ht", "gouv.ht", "un.org", "unicef.org", "worldbank.org",
  "state.gov", "canada.ca", "campusfrance.org", "daad.de", "fulbright.org",
  "chevening.org", "edu", "ac.uk", "gc.ca", "gouv.fr",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function textContainsAny(text: string, markers: string[]): boolean {
  const norm = normalizeText(text);
  return markers.some((m) => norm.includes(normalizeText(m)));
}

function countMatches(text: string, markers: string[]): number {
  const norm = normalizeText(text);
  return markers.filter((m) => norm.includes(normalizeText(m))).length;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isOfficialSource(url: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  return OFFICIAL_DOMAINS.some(
    (od) => domain === od || domain.endsWith("." + od),
  );
}

function daysUntil(isoDate: string): number {
  const target = new Date(isoDate);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Map ItemCategory → IGPostType ──────────────────────────────────────────

function mapCategoryToIGType(item: Item): IGPostType | null {
  const cat = item.category;
  const itemType = item.itemType;
  const series = item.utilityMeta?.series;

  // Utility items
  if (itemType === "utility") {
    if (series === "HaitiHistory" || series === "HaitiFactOfTheDay" || series === "HaitianOfTheWeek") {
      return "histoire";
    }
    return "utility";
  }

  switch (cat) {
    case "scholarship":
    case "bourses":
      return "scholarship";
    case "opportunity":
    case "concours":
    case "stages":
    case "programmes":
      return "opportunity";
    case "news":
    case "local_news":
    case "event":
      return "news";
    case "resource":
      return "utility";
    default:
      return null;
  }
}

// ── Main selection function ────────────────────────────────────────────────

export function decideIG(item: Item): IGDecision {
  const reasons: string[] = [];
  const igType = mapCategoryToIGType(item);

  // No IG type mapping → ineligible
  if (!igType) {
    return {
      igEligible: false,
      igType: null,
      igPriorityScore: 0,
      reasons: ["No IG type mapping for category: " + item.category],
    };
  }

  const fullText = `${item.title} ${item.summary} ${item.extractedText ?? ""}`;
  const canonicalUrl = item.canonicalUrl ?? item.source?.originalUrl ?? "";

  // ── Ineligibility checks ───────────────────────────────────────────────

  // Missing source URL
  if (!canonicalUrl && !item.source?.originalUrl) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Missing source URL"],
    };
  }

  // Quality flags: off-mission
  if (item.qualityFlags?.offMission) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Flagged as off-mission"],
    };
  }

  // Scholarship/opportunity without deadline → ineligible
  if ((igType === "scholarship" || igType === "opportunity") && !item.deadline && !item.opportunity?.deadline) {
    if (!item.evergreen) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: ["Scholarship/opportunity missing deadline (non-evergreen)"],
      };
    }
  }

  // Scholarship/opportunity without link → ineligible
  if ((igType === "scholarship" || igType === "opportunity") && !item.opportunity?.officialLink && !canonicalUrl) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Scholarship/opportunity missing official link"],
    };
  }

  // News: conditional eligibility
  if (igType === "news") {
    const audienceFit = item.audienceFitScore ?? 0;
    const studentMarkers = countMatches(fullText, NEWS_STUDENT_MARKERS);

    if (audienceFit < 0.5 && studentMarkers < 2) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: [
          `News: low audience fit (${audienceFit.toFixed(2)}) and few student markers (${studentMarkers})`,
        ],
      };
    }
    if (audienceFit >= 0.5) reasons.push(`News: audience fit ${audienceFit.toFixed(2)} ≥ 0.5`);
    if (studentMarkers >= 2) reasons.push(`News: ${studentMarkers} student-relevance markers`);
  }

  // ── Priority scoring ───────────────────────────────────────────────────

  // Base score by type
  const BASE_SCORES: Record<IGPostType, number> = {
    scholarship: 70,
    opportunity: 65,
    utility: 55,
    histoire: 50,
    news: 45,
  };
  let score = BASE_SCORES[igType];
  reasons.push(`Base score for ${igType}: ${score}`);

  // Deadline urgency
  const deadlineStr = item.deadline ?? item.opportunity?.deadline ?? null;
  let igExpiresAt: string | undefined;
  if (deadlineStr) {
    const days = daysUntil(deadlineStr);
    if (days < 0) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: ["Deadline already passed"],
      };
    }
    if (days <= 3) {
      score += 25;
      reasons.push(`Deadline urgency: <3 days (+25)`);
    } else if (days <= 7) {
      score += 15;
      reasons.push(`Deadline urgency: 3-7 days (+15)`);
    } else if (days <= 21) {
      score += 8;
      reasons.push(`Deadline urgency: 8-21 days (+8)`);
    }
    igExpiresAt = deadlineStr;
  }

  // Audience fit bonus (0..1 → up to +15)
  const audienceFit = item.audienceFitScore ?? 0;
  const audienceBonus = Math.round(audienceFit * 15);
  if (audienceBonus > 0) {
    score += audienceBonus;
    reasons.push(`Audience fit bonus: +${audienceBonus} (score ${audienceFit.toFixed(2)})`);
  }

  // Official source bonus
  const sourceUrl = item.source?.originalUrl ?? canonicalUrl;
  if (isOfficialSource(sourceUrl)) {
    score += 5;
    reasons.push(`Official source: +5`);
  }

  // Weak source penalty
  if (item.qualityFlags?.weakSource) {
    score -= 10;
    reasons.push(`Weak source: -10`);
  }

  // Clamp 0..100
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    igEligible: true,
    igType,
    igPriorityScore: score,
    reasons,
    igExpiresAt,
  };
}

/**
 * Apply a dedupe penalty if a content item's group was recently posted.
 * Call this after decideIG with context about recent IG posts.
 */
export function applyDedupePenalty(
  decision: IGDecision,
  recentlyPostedGroupIds: Set<string>,
  itemDedupeGroupId?: string,
): IGDecision {
  if (!decision.igEligible || !itemDedupeGroupId) return decision;
  if (!recentlyPostedGroupIds.has(itemDedupeGroupId)) return decision;

  const newScore = Math.max(0, decision.igPriorityScore - 20);
  return {
    ...decision,
    igPriorityScore: newScore,
    reasons: [...decision.reasons, `Dedupe group recently posted: -20`],
  };
}
