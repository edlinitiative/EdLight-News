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

// ── English-content detection for language gate ────────────────────────────

/** Common English function words / phrases that rarely appear in French text. */
const EN_GATE_MARKERS = [
  /\bthe\b/gi, /\band\b/gi, /\bfor\b/gi, /\bwith\b/gi,
  /\bfrom\b/gi, /\bthis\b/gi, /\bthat\b/gi, /\bwere\b/gi,
  /\bwas\b/gi, /\bhave\b/gi, /\bhas\b/gi, /\bbeen\b/gi,
  /\btheir\b/gi, /\bwhich\b/gi, /\babout\b/gi, /\bwould\b/gi,
  /\bcould\b/gi, /\bsaid\b/gi, /\bafter\b/gi, /\bbefore\b/gi,
];

/** French function words that signal the text is in French. */
const FR_GATE_MARKERS = [
  / le /gi, / la /gi, / les /gi, / des /gi, / du /gi,
  / un /gi, / une /gi, / est /gi, / sont /gi, / dans /gi,
  / pour /gi, / par /gi, / avec /gi, / sur /gi, / qui /gi,
  / que /gi, / cette /gi, / selon /gi, / été /gi, / mais /gi,
];

/**
 * Returns true when a text sample is predominantly English — meaning it
 * should NOT be posted on a French IG account without translation.
 * Uses word-frequency heuristic: count EN vs FR function words.
 */
function looksLikeEnglishContent(text: string): boolean {
  if (!text || text.length < 80) return false;
  const sample = ` ${text.slice(0, 800).toLowerCase()} `;

  let enHits = 0;
  for (const re of EN_GATE_MARKERS) {
    const matches = sample.match(re);
    if (matches) enHits += matches.length;
  }

  let frHits = 0;
  for (const re of FR_GATE_MARKERS) {
    const matches = sample.match(re);
    if (matches) frHits += matches.length;
  }

  // Clearly English: many EN hits and significantly more than FR hits
  return enHits >= 5 && enHits > frHits * 2;
}

function daysUntil(isoDate: string): number {
  const target = new Date(isoDate);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Map ItemCategory → IGPostType ──────────────────────────────────────────

/**
 * Safety guard for utility items scraped with series=HaitiHistory.
 *
 * The dedicated historyPublisher sets canonicalUrl = `edlight://histoire/...`
 * and is always trusted. External RSS sources (e.g. Britannica, Stanford) may
 * occasionally send contemporary articles instead of historical ones. This
 * function checks that the item's content genuinely references a historical
 * event (a year before 2020 or known Haitian history keywords) before routing
 * it to the histoire formatter.
 *
 * Returns `true` (allow) when there is no content to check.
 */
function isHistoricalContent(item: Item): boolean {
  // Trust historyPublisher items unconditionally.
  if (item.canonicalUrl?.startsWith("edlight://histoire/")) return true;

  const textParts: string[] = [];
  if (item.title) textParts.push(item.title);

  // Citation labels and URLs carry the source article titles and domain.
  for (const c of item.utilityMeta?.citations ?? []) {
    if (c.label) textParts.push(c.label);
    if (c.url)   textParts.push(c.url);
  }

  // If no text to analyse, give the item benefit of the doubt.
  if (textParts.length === 0) return true;

  const combined = textParts.join(" ");

  // Any 4-digit year before 2020 strongly signals historical content.
  if (/\b(1[4-9]\d{2}|200[0-9]|201[0-9])\b/.test(combined)) return true;

  // Well-known Haitian historical keywords are also sufficient.
  const HISTORY_KEYWORDS = [
    "révolution", "révolutionnaire", "indépendance", "fondation",
    "esclavage", "esclave", "colonie", "colonial", "saint-domingue",
    "toussaint", "dessalines", "pétion", "christophe", "louverture",
    "bataille", "traité", "empire haïtien", "occupation américaine",
    "duvalier", "abolition", "haïtian revolution", "haitian independence",
  ];
  const norm = normalizeText(combined);
  return HISTORY_KEYWORDS.some((kw) => norm.includes(normalizeText(kw)));
}

function mapCategoryToIGType(item: Item): IGPostType | null {
  const cat = item.category;
  const itemType = item.itemType;
  const series = item.utilityMeta?.series;

  // Utility items
  if (itemType === "utility") {
    if (series === "HaitiHistory" || series === "HaitiFactOfTheDay" || series === "HaitianOfTheWeek") {
      // All three history-related series must pass the isHistoricalContent
      // gate. Without this, non-historical content (e.g. a quiz platform
      // article) can be mis-routed to the histoire formatter.
      if (!isHistoricalContent(item)) {
        return "news"; // Contemporary content mis-tagged as history → demote
      }
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
  // Google News RSS — redirect stubs, never a real application page
  "news.google.com",
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
  // At least one of: howToApply, officialLink, or a non-news canonicalUrl.
  // Many real bourse articles don't embed a separate officialLink, but their
  // canonicalUrl IS the scholarship info page — treat that as a valid link.
  const hasHowToApply = !!(opp.howToApply && opp.howToApply.trim().length > 10);
  const hasOfficialLink = !!(
    opp.officialLink &&
    opp.officialLink.trim().length > 5 &&
    !isNewsUrl(opp.officialLink)
  );
  const canonicalUrl = item.canonicalUrl ?? item.source?.originalUrl ?? "";
  const hasCanonicalLink = canonicalUrl.length > 5 && !isNewsUrl(canonicalUrl);
  // Many real scholarship announcements appear on news sites (Juno7, Le
  // Nouvelliste, etc.) — if we have howToApply or officialLink that's ideal,
  // but a news-domain canonicalUrl is still acceptable when strong structured
  // opportunity signals exist (eligibility array has multiple entries, or
  // coverage/deadline is present).
  const hasNewsCanonical = canonicalUrl.length > 5 && isNewsUrl(canonicalUrl);
  const hasStrongOppSignals =
    (opp.eligibility?.length ?? 0) >= 2 ||
    (opp.coverage?.trim().length ?? 0) > 10 ||
    (opp.deadline?.trim().length ?? 0) > 0;
  const hasActionableLink = hasHowToApply || hasOfficialLink || hasCanonicalLink || (hasNewsCanonical && hasStrongOppSignals);
  if (!hasActionableLink) return false;

  // Thin-content guard: Google News RSS items may carry minimal extracted text.
  // Keep the 80-word preference, but allow strongly structured opportunities
  // with concrete metadata to pass even when body text is short.
  const bodyText = item.extractedText ?? item.summary ?? "";
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 80) return true;

  const hasStructuredOppSignals =
    (opp.coverage?.trim().length ?? 0) > 10 ||
    (opp.howToApply?.trim().length ?? 0) > 20 ||
    (opp.deadline?.trim().length ?? 0) > 0 ||
    (opp.eligibility?.length ?? 0) >= 2;

  return hasStructuredOppSignals;
}

// ── Main selection function ────────────────────────────────────────────────

export function decideIG(item: Item): IGDecision {
  const reasons: string[] = [];
  // `let` because thin news items may be re-routed to "breaking" below
  let igType = mapCategoryToIGType(item);

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

  // Quality flags: needs review → not ready for IG
  if (item.qualityFlags?.needsReview) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Flagged as needs review"],
    };
  }

  // Quality flags: low confidence → not ready for IG.
  // Exceptions:
  // 1. Scholarship/opportunity items derive their value from structured fields
  //    (deadline, eligibility, link), not body-text richness. Blocking them on
  //    lowConfidence — which fires whenever extractedText is empty (most RSS
  //    items) — prevents ANY opportunity from ever reaching IG.
  // 2. News/breaking items with audienceFitScore ≥ 0.40 are already passing
  //    the relevance bar. lowConfidence fires routinely for short-body news
  //    (Gemini extraction confidence < 0.6) but the separate word-count gate
  //    below is the real quality bar for news content. Blocking ALL 0.4-score
  //    news on lowConfidence drains the queue completely.
  const isOppType = igType === "scholarship" || igType === "opportunity";
  const isNewsType = igType === "news" || igType === "breaking";
  const hasAdequateScore = (item.audienceFitScore ?? 0) >= 0.40;
  if (item.qualityFlags?.lowConfidence && !isOppType && !(isNewsType && hasAdequateScore)) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Flagged as low confidence"],
    };
  }

  // Image required — IG is a visual platform, skip items without images.
  // Exception: histoire, utility, scholarship, opportunity, and news can
  // render with the branded dark gradient when no publisher photo is available.
  // Their formatters handle missing imageUrl gracefully (no backgroundImage
  // key on slides). The downstream pipeline may also fill images via Gemini.
  const BRANDED_IMAGE_TYPES: Set<IGPostType> = new Set(["histoire", "utility", "scholarship", "opportunity", "news"]);
  if (!item.imageUrl && !BRANDED_IMAGE_TYPES.has(igType)) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: ["Missing imageUrl — required for IG"],
    };
  }

  // Thin-content gate: news articles with very short body text either get
  // demoted to a breaking-news single-slide (80-199 words) or rejected (<80).
  if (igType === "news") {
    const bodyText = item.extractedText ?? item.summary ?? "";
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 80) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: [`Thin content: ${wordCount} words (min 80)`],
      };
    }
    if (wordCount < 200) {
      // Demote to Template 1 breaking-news single slide — better than rejection
      igType = "breaking";
      reasons.push(`Thin content (${wordCount} words): routed to breaking news format`);
    }
  }

  // Roundup / aggregation gate: block news articles that are just daily
  // roundups ("Actualités Haïti", "Résumé de l'actualité", etc.).
  // These produce low-quality carousels because they lack editorial depth.
  if (igType === "news" && isRoundupTitle(item.title)) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: [`Roundup/aggregation article — title matches blocklist pattern`],
    };
  }

  // Low image confidence: when an image is present, it must meet the bar.
  // Images flagged as generic/stock/logo/screenshot (≤ 0.4) look unprofessional
  // as carousel backgrounds. If there's NO image, branded types render with the
  // dark gradient instead — that's fine, no confidence check needed.
  const hasImage = !!item.imageUrl;
  if (hasImage && (item.imageConfidence ?? 1) <= 0.4) {
    return {
      igEligible: false,
      igType,
      igPriorityScore: 0,
      reasons: [`Low imageConfidence (${(item.imageConfidence ?? 0).toFixed(2)} < 0.40)`],
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

  // ── Language gate: reject items whose content is clearly English ───────
  // Without Gemini content_versions, raw English articles cannot be
  // translated into French slides. The LLM reviewer normally catches
  // English leaks, but when the LLM is unavailable we need a static gate.
  if (igType === "news") {
    const probe = `${item.title} ${(item.extractedText ?? item.summary ?? "").slice(0, 600)}`;
    if (looksLikeEnglishContent(probe)) {
      return {
        igEligible: false,
        igType,
        igPriorityScore: 0,
        reasons: ["English content without French translation — rejected for French IG account"],
      };
    }
  }

  // ── Priority scoring ───────────────────────────────────────────────────

  // Base score by type
  const BASE_SCORES: Record<IGPostType, number> = {
    scholarship: 70,
    opportunity: 72,
    taux: 60,
    histoire: 60,
    utility: 55,
    breaking: 50, // timely but thin — just above news
    news: 40,
    stat: 55,     // manually curated — treat like utility
  };
  let score = BASE_SCORES[igType];
  reasons.push(`Base score for ${igType}: ${score}`);

  // Deadline urgency
  const deadlineStr = item.deadline ?? item.opportunity?.deadline ?? null;
  let igExpiresAt: string | undefined;
  if (deadlineStr) {
    const days = daysUntil(deadlineStr);
    // Only block history/utility items when the deadline has actually passed for
    // scholarships and opportunities. Histoire/utility items sometimes carry a
    // deadline field for unrelated reasons (e.g. HaitiFactOfTheDay carrying a
    // year-end relevance date that predates the post date).
    if (days < 0 && (igType === "scholarship" || igType === "opportunity")) {
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

// ── Roundup / aggregation detection ────────────────────────────────────────

const ROUNDUP_TITLE_PATTERNS = [
  // "Actualités Haïti" / "Actualités du jour" / "Actualité en bref"
  /actualit[ée]s?\s+(ha[iï]ti|du\s+jour|en\s+bref|de\s+la\s+semaine)/i,
  // "Résumé de l'actualité" / "Résumé des nouvelles"
  /r[ée]sum[ée]\s+(de\s+l[''\u2019]?actualit|des\s+nouvelles|du\s+jour|hebdomadaire)/i,
  // "Les nouvelles du jour" / "Les nouvelles en bref"
  /les\s+nouvelles\s+(du\s+jour|en\s+bref|de\s+la\s+semaine)/i,
  // "Tour d'horizon" / "Revue de presse"
  /tour\s+d[''\u2019]horizon|revue\s+de\s+presse/i,
  // "Haïti en bref" / "Haïti actualités"
  /ha[iï]ti\s+(en\s+bref|actualit[ée]s?|nouvelles)/i,
  // "Flash info" / "Points saillants"
  /flash\s+info|points?\s+saillants?/i,
  // "Nouvelles du [day]" (Juno7 pattern)
  /nouvelles\s+du\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i,
  // "Ce qu'il faut retenir" (daily recap)
  /ce\s+qu[''\u2019]il\s+faut\s+retenir/i,
];

/**
 * Returns true when the title matches known roundup/aggregation patterns.
 * These articles summarize multiple unrelated stories and produce weak
 * IG carousels without editorial depth.
 */
export function isRoundupTitle(title: string): boolean {
  if (!title) return false;
  return ROUNDUP_TITLE_PATTERNS.some((re) => re.test(title));
}

/**
 * Returns true when an item looks like a "taux du jour" exchange-rate
 * post from a third-party publisher (Juno7, etc.).
 * We produce our own branded taux post via the BRH scraper.
 */
function isTauxDuJourArticle(item: Item): boolean {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  
  // Strong match: the exact phrase "taux du jour"
  if (text.includes("taux du jour")) return true;
  
  // Composite match: "taux" + exchange-specific keyword
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
