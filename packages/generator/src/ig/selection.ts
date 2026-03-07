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

// ── Broader Haiti-relevance markers for news eligibility ───────────────────
const NEWS_HAITI_MARKERS = [
  // Governance & politics
  "gouvernement", "gouvènman", "premier ministre", "président", "parlement",
  "sénat", "élection", "transition", "conseil présidentiel",
  // Security
  "insécurité", "gang", "police", "pnh", "sécurité", "violence",
  "kidnapping", "enlèvement", "force armée",
  // Economy & infrastructure
  "économie", "inflation", "gourde", "dollar", "emploi", "chômage",
  "commerce", "investissement", "banque", "électricité", "edh",
  "eau potable", "infrastructure", "route", "transport",
  // Health & environment
  "santé", "hôpital", "choléra", "covid", "vaccination",
  "environnement", "déboisement", "agriculture", "sécurité alimentaire",
  // Key places
  "port-au-prince", "cap-haïtien", "gonaïves", "les cayes", "jacmel",
  "jérémie", "artibonite", "pòtoprens",
  // International
  "caricom", "onu", "nations unies", "binuh", "diplomatie",
  "rapatriement", "migration", "tps", "visa",
  // Culture & society
  "kanaval", "carnaval", "vodou", "créole", "patrimoine",
  "télécommunication", "natcom", "digicel",
];

// ── Non-Haiti eligibility markers (Africa-only, etc.) ──────────────────────
// If eligibility text contains these, the scholarship is NOT for Haitian students
const NON_HAITI_ELIGIBILITY_BLOCKERS = [
  "african", "africain", "afrique", "africa",
  "nigerian", "kenyan", "south african", "ghanaian",
  "sub-saharan", "subsaharan", "sub saharan",
  "citizens of african", "pays africains",
  "ressortissants africains", "africains uniquement",
  "african union", "union africaine",
  "afdb", "african development",
];

// Countries whose residents are the target audience for EdLight
const HAITI_RELEVANT_COUNTRIES = [
  "haiti", "haïti", "ayiti",
  "all countries", "tous les pays",
  "worldwide", "international", "global",
  "caribbean", "caraïbes", "karayib",
  "developing countries", "pays en développement",
  "latin america", "amérique latine",
  "ht",  // ISO code
];

/**
 * Returns false when a scholarship/opportunity is clearly NOT relevant
 * to Haitian students (e.g. African-only, Nigerian-only, etc.).
 */
function isHaitiRelevantOpportunity(item: Item): { relevant: boolean; reason?: string } {
  const opp = item.opportunity;
  const eligText = (opp?.eligibility ?? []).join(" ").toLowerCase();
  const titleSummary = `${item.title} ${item.summary}`.toLowerCase();
  const combined = `${eligText} ${titleSummary}`;
  const norm = normalizeText(combined);

  // 1. Check for explicit Africa-only blockers
  for (const blocker of NON_HAITI_ELIGIBILITY_BLOCKERS) {
    if (norm.includes(normalizeText(blocker))) {
      // Make sure it's not also mentioning Haiti/Caribbean/global
      const hasHaitiMention = HAITI_RELEVANT_COUNTRIES.some(c => norm.includes(normalizeText(c)));
      if (!hasHaitiMention) {
        return { relevant: false, reason: `Eligibility contains "${blocker}" with no Haiti/global mention` };
      }
    }
  }

  // 2. Check geoTag — if explicitly not HT/Diaspora/Global and no Haiti mention
  if (item.geoTag && item.geoTag !== "HT" && item.geoTag !== "Diaspora" && item.geoTag !== "Global") {
    return { relevant: false, reason: `geoTag=${item.geoTag} — not Haiti-relevant` };
  }

  // 3. Low audience fit + no Haiti keywords → skip
  const audienceFit = item.audienceFitScore ?? 0.5;
  if (audienceFit < 0.35) {
    return { relevant: false, reason: `Very low audienceFitScore (${audienceFit.toFixed(2)})` };
  }

  return { relevant: true };
}

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
      // Validate: a real scholarship should have meaningful opportunity fields.
      // If Gemini mis-classified a news article as a scholarship but it lacks
      // eligibility, howToApply, or officialLink, downgrade to "news".
      if (!hasRealOpportunityFields(item)) return "news";
      return "scholarship";
    case "opportunity":
    case "concours":
    case "stages":
    case "programmes":
      if (!hasRealOpportunityFields(item)) return "news";
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

/** Known news/media domains — officialLink to these is not an application link */
const NEWS_LINK_DOMAINS = [
  "juno7.ht", "loophaiti.com", "ayibopost.com", "lenouvelliste.com",
  "haitilibre.com", "alterpresse.org", "metropolehaiti.com",
  "radiotelevisioncaraibes.com", "vfrancaise.com", "maghaiti.net",
  "bbc.com", "reuters.com", "france24.com", "rfi.fr", "lemonde.fr",
  "nytimes.com", "theguardian.com", "aljazeera.com", "cnn.com",
  "apnews.com", "voanews.com",
];

function isNewsUrl(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return NEWS_LINK_DOMAINS.some((nd) => domain === nd || domain.endsWith("." + nd));
  } catch {
    return false;
  }
}

/**
 * A real opportunity/scholarship MUST have eligibility criteria (strongest signal)
 * plus at least one of: howToApply or officialLink to a non-news domain.
 * Items mis-classified by Gemini (e.g. news about time changes) lack these.
 */
/** Words that signal the article is news (sports, crime, politics), not a real opportunity */
const NEWS_SIGNAL_WORDS = [
  // Sports
  "victoire", "match", "equipe", "équipe", "football", "soccer", "grenadière",
  "grenadier", "championnat", "coupe", "tournoi", "joueur", "joueuse",
  "entraîneur", "stade", "but", "penalty", "qualification", "fifa",
  "concacaf", "ligue", "saison", "score", "défaite",
  // Crime / Security
  "attentat", "meurtre", "arrestation", "gang", "violence", "kidnapping",
  "enlèvement", "fusillade", "police", "insécurité", "criminel",
  // Politics / Government
  "élection", "sénateur", "député", "premier ministre", "président",
  "parlement", "gouvernement", "vote", "mandat", "opposition",
  "manifestation", "protestation", "crise politique",
];

function looksLikeNewsContent(item: Item): boolean {
  const text = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();
  let hits = 0;
  for (const word of NEWS_SIGNAL_WORDS) {
    if (text.includes(word)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

function hasRealOpportunityFields(item: Item): boolean {
  const opp = item.opportunity;
  if (!opp) return false;

  // Content-based guard: if title+summary strongly signal news, downgrade
  if (looksLikeNewsContent(item)) return false;

  // Eligibility is mandatory — the strongest signal for a real opportunity
  const hasEligibility = !!(opp.eligibility && opp.eligibility.length > 0);
  if (!hasEligibility) return false;
  // Plus at least one of: substantive howToApply or officialLink to a real application site
  const hasHowToApply = !!(opp.howToApply && opp.howToApply.trim().length > 10);
  const hasOfficialLink = !!(
    opp.officialLink &&
    opp.officialLink.trim().length > 5 &&
    !isNewsUrl(opp.officialLink)
  );
  return hasHowToApply || hasOfficialLink;
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

  // Quality flags: needs review or low confidence → not ready for IG
  if (item.qualityFlags?.needsReview || item.qualityFlags?.lowConfidence) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: [
        item.qualityFlags?.needsReview
          ? "Flagged as needs review"
          : "Flagged as low confidence",
      ],
    };
  }

  // Image required — IG is a visual platform, skip items without images
  if (!item.imageUrl) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Missing imageUrl — required for IG"],
    };
  }

  // Taux du jour articles from third-party sources (Juno7, etc.)
  // We produce our own branded taux post via BRH scraper.
  if (isTauxDuJourArticle(item)) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Taux du jour article — suppressed (use branded taux post)"],
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

  // Scholarship/opportunity: Haiti-relevance gate
  // Block Africa-only, Nigeria-only, etc. that aren't relevant to Haitian students
  if (igType === "scholarship" || igType === "opportunity") {
    const relevance = isHaitiRelevantOpportunity(item);
    if (!relevance.relevant) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: [`Not Haiti-relevant: ${relevance.reason}`],
      };
    }
  }

  // News: conditional eligibility (tighter gate for IG than web)
  if (igType === "news") {
    const audienceFit = item.audienceFitScore ?? 0;
    const studentMarkers = countMatches(fullText, NEWS_STUDENT_MARKERS);
    const haitiMarkers = countMatches(fullText, NEWS_HAITI_MARKERS);
    const isHaitiTagged = item.geoTag === "HT";

    // IG is curated — require higher audience fit than web (0.55 vs 0.5)
    const eligible =
      audienceFit >= 0.55 ||
      studentMarkers >= 2 ||
      (isHaitiTagged && (audienceFit >= 0.35 || haitiMarkers >= 2)) ||
      haitiMarkers >= 3;

    if (!eligible) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: [
          `News: low audience fit (${audienceFit.toFixed(2)}), few student markers (${studentMarkers}), few Haiti markers (${haitiMarkers}), geoTag=${item.geoTag ?? "none"}`,
        ],
      };
    }
    if (audienceFit >= 0.5) reasons.push(`News: audience fit ${audienceFit.toFixed(2)} ≥ 0.5`);
    if (studentMarkers >= 2) reasons.push(`News: ${studentMarkers} student-relevance markers`);
    if (haitiMarkers >= 1) reasons.push(`News: ${haitiMarkers} Haiti-relevance markers`);
    if (isHaitiTagged) reasons.push(`News: Haiti geoTag`);
  }

  // ── Priority scoring ───────────────────────────────────────────────────

  // Base score by type
  const BASE_SCORES: Record<IGPostType, number> = {
    scholarship: 70,
    opportunity: 65,
    taux: 60,
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
 * Returns true when an item looks like a "taux du jour" exchange-rate
 * post from a third-party publisher (Juno7, etc.).
 * We produce our own branded taux post via the BRH scraper.
 */
function isTauxDuJourArticle(item: Item): boolean {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (text.includes("taux du jour")) return true;
  if (
    text.includes("taux") &&
    (/\busd\b/.test(text) ||
      text.includes("dollar") ||
      text.includes("gourde") ||
      /\bbrh\b/.test(text) ||
      text.includes("taux de référence") ||
      text.includes("taux de reference"))
  ) {
    return true;
  }
  return false;
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
