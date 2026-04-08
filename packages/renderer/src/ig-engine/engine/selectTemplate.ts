/**
 * @edlight-news/renderer – Template Selection Engine
 *
 * Selects the correct template from the fixed library based on:
 *   - content type hint
 *   - urgency level
 *   - number of key facts
 *   - whether there is a deadline
 *   - whether educational explanation is needed
 *
 * Rule (IG_COPILOT.md §5.3):
 *   The engine must select from the fixed template library only.
 *   No freestyle layout generation.
 */

import type { ContentIntakeInput, TemplateId } from "../types/post.js";

// ── Selection rules ───────────────────────────────────────────────────────────

interface SelectionResult {
  templateId: TemplateId;
  reason: string;
}

/**
 * Select the appropriate template for the given content intake.
 *
 * Priority order:
 *   1. Explicit hint from caller (contentTypeHint)
 *   2. Breaking / urgent content → breaking-news-single
 *   3. Deadline content → opportunity-carousel
 *   4. Explainer / analytical → explainer-carousel
 *   5. Stat / data → quote-stat-card
 *   6. Recap → weekly-recap-carousel
 *   7. Default → news-carousel
 */
export function selectTemplate(input: ContentIntakeInput): SelectionResult {
  // 1. Explicit hint wins
  if (input.contentTypeHint) {
    return {
      templateId: input.contentTypeHint,
      reason: `Explicit contentTypeHint: "${input.contentTypeHint}"`,
    };
  }

  const cat = (input.category ?? "").toLowerCase();
  const urgency = input.urgencyLevel ?? "normal";
  const hasDeadline = Boolean(input.deadline);
  const factCount = (input.keyFacts ?? []).length;
  const summary = (input.sourceSummary ?? "").toLowerCase();
  const topic = (input.topic ?? "").toLowerCase();

  // 2. Breaking / urgent
  if (urgency === "breaking" || cat === "breaking") {
    return { templateId: "breaking-news-single", reason: "Urgency level is breaking" };
  }

  // 3. Opportunity / scholarship (deadline-driven)
  if (hasDeadline || isOpportunityCategory(cat)) {
    if (factCount >= 3) {
      return { templateId: "opportunity-carousel", reason: "Opportunity with deadline and multiple facts" };
    }
    return { templateId: "opportunity-carousel", reason: "Opportunity / scholarship category" };
  }

  // 4. Explainer / analytical
  if (isExplainerContent(cat, summary, topic)) {
    return { templateId: "explainer-carousel", reason: "Analytical / explainer content detected" };
  }

  // 5. Single stat or quote
  if (isStatContent(cat, summary, topic)) {
    return { templateId: "quote-stat-card", reason: "Data / stat / quote content detected" };
  }

  // 6. Weekly recap
  if (cat === "recap" || topic.includes("semaine") || topic.includes("bilan") || topic.includes("semèn") || topic.includes("rezime")) {
    return { templateId: "weekly-recap-carousel", reason: "Weekly recap content detected" };
  }

  // 7. Default: news carousel
  if (factCount <= 2 && urgency === "high") {
    return { templateId: "breaking-news-single", reason: "High urgency with few facts → single slide" };
  }

  return {
    templateId: "news-carousel",
    reason: `Default template for category "${cat}"`,
  };
}

// ── Category helpers ──────────────────────────────────────────────────────────

const OPPORTUNITY_CATS = new Set([
  "scholarship",
  "opportunity",
  "bourses",
  "concours",
  "stages",
  "programmes",
  "fellowship",
  "grant",
  "internship",
]);

function isOpportunityCategory(cat: string): boolean {
  return OPPORTUNITY_CATS.has(cat);
}

const EXPLAINER_KEYWORDS = [
  // French
  "pourquoi",
  "comment",
  "analyse",
  "politique",
  "économie",
  "explique",
  "comprendre",
  "civique",
  "technologie",
  "science",
  // English
  "policy",
  "explain",
  "understand",
  "analysis",
  // Haitian Creole
  "poukisa",
  "kijan",
  "konprann",
  "eksplike",
  "politik",
  "ekonomi",
  "teknoloji",
  "syans",
  "sivik",
];

function isExplainerContent(cat: string, summary: string, topic: string): boolean {
  if (cat === "explainer" || cat === "analysis") return true;
  const text = `${summary} ${topic}`;
  return EXPLAINER_KEYWORDS.some(kw => text.includes(kw));
}

const STAT_KEYWORDS = [
  // Universal
  "%",
  // French
  "milliard",
  "million",
  "chiffre",
  "données",
  "rapport",
  "étude",
  "citation",
  // English
  "statistic",
  "quote",
  "billion",
  // Haitian Creole
  "milya",
  "chif",
  "done",
  "rapò",
  "etid",
  "sitasyon",
];

function isStatContent(cat: string, summary: string, topic: string): boolean {
  if (cat === "stat" || cat === "data") return true;
  const text = `${summary} ${topic}`;
  return STAT_KEYWORDS.some(kw => text.includes(kw));
}
