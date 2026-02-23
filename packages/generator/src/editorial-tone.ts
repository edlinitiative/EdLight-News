/**
 * @edlight-news/generator — Editorial Tone System
 *
 * Centralised editorial guidelines injected into every LLM prompt.
 * Each content series has a distinct voice calibrated for Haitian students.
 *
 * Series → Tone mapping:
 *   HaitiHistory          → history (calm, precise, authoritative)
 *   ScholarshipRadar      → scholarship (clear, actionable, deadline-focused)
 *   StudyAbroad           → study-abroad (practical, structured, non-intimidating)
 *   Career                → career (constructive, forward-looking)
 *   HaitianOfTheWeek      → profile (respectful, balanced, grounded)
 *   HaitiFactOfTheDay     → news (objective, concise)
 *   HaitiEducationCalendar→ news (objective, concise)
 *   (web-draft / synthesis)→ news (objective, concise)
 */

import type { UtilitySeries } from "@edlight-news/types";

// ── Tone key type ───────────────────────────────────────────────────────────

export type EditorialToneKey =
  | "history"
  | "scholarship"
  | "study-abroad"
  | "career"
  | "profile"
  | "news";

// ── Per-tone editorial directives ───────────────────────────────────────────

export interface EditorialDirective {
  key: EditorialToneKey;
  tone: string;
  style: string;
  rules: string;
  studentLens: string;
}

const DIRECTIVES: Record<EditorialToneKey, EditorialDirective> = {
  // ── Haiti History ─────────────────────────────────────────────────────────
  history: {
    key: "history",
    tone: [
      "Calm, precise, authoritative.",
      "Never dramatic, sensational, or romanticized.",
      "No patriotic rhetoric.",
      "No political commentary.",
    ].join("\n"),
    style: [
      "Paragraph-based with clear narrative flow.",
      "Structured sections: Contexte, L'événement, Conséquences, Pourquoi cela compte, Sources.",
      "600–800 words.",
    ].join("\n"),
    rules: [
      "Every factual claim must come from provided sources.",
      "Do not invent dates, quotes, or numbers.",
      "Avoid dramatic adjectives unless sourced.",
      "When uncertainty exists, acknowledge it calmly.",
    ].join("\n"),
    studentLens: [
      "Explain institutional implications.",
      "Encourage critical thinking.",
      "Avoid moralizing.",
    ].join("\n"),
  },

  // ── Scholarship Radar ─────────────────────────────────────────────────────
  scholarship: {
    key: "scholarship",
    tone: [
      "Clear, concise, actionable.",
      "Encouraging but not exaggerated.",
      "Deadline-focused and precise.",
    ].join("\n"),
    style: [
      "Structured sections: Résumé, Qui peut postuler, Financement, Date limite, Comment postuler, Sources.",
      "Use short paragraphs or clean bullet points where helpful.",
      "300–600 words.",
    ].join("\n"),
    rules: [
      "Every deadline must be cited.",
      'Do not speculate on acceptance chances.',
      'Do not use hype language ("incroyable opportunité").',
      'If details are unclear, state "à confirmer".',
    ].join("\n"),
    studentLens: [
      "Make it easy to understand eligibility and next steps.",
      "Remove fluff.",
    ].join("\n"),
  },

  // ── Study Abroad ──────────────────────────────────────────────────────────
  "study-abroad": {
    key: "study-abroad",
    tone: [
      "Practical and structured.",
      "Supportive but realistic.",
      "Clear, non-intimidating.",
    ].join("\n"),
    style: [
      "Step-by-step format.",
      "Headings: Vue d'ensemble, Conditions d'admission, Procédure, Coûts estimés, Délais, Sources.",
      "600–900 words.",
    ].join("\n"),
    rules: [
      "Use only provided official sources.",
      "Do not guarantee admission outcomes.",
      "Avoid marketing tone.",
      'Avoid generalizations like "facilement accepté".',
    ].join("\n"),
    studentLens: [
      "Explain process clearly.",
      "Clarify institutional structure (visa, application platforms).",
      "Reduce confusion.",
    ].join("\n"),
  },

  // ── Career ────────────────────────────────────────────────────────────────
  career: {
    key: "career",
    tone: [
      "Constructive, forward-looking.",
      "Calmly motivating.",
      "Not preachy.",
    ].join("\n"),
    style: [
      "Clear sections with practical advice.",
      "Realistic expectations.",
      "500–800 words.",
    ].join("\n"),
    rules: [
      "Avoid cliché motivational phrases.",
      "Avoid exaggerated success stories.",
      "Ground advice in logic and examples.",
      "If data is cited, include sources.",
    ].join("\n"),
    studentLens: [
      "Help students think structurally.",
      "Emphasize skills, planning, and experimentation.",
      "Encourage agency without promising outcomes.",
    ].join("\n"),
  },

  // ── Haitian of the Week ───────────────────────────────────────────────────
  profile: {
    key: "profile",
    tone: [
      "Respectful and balanced.",
      "Slightly narrative but grounded.",
      "Inspirational without exaggeration.",
    ].join("\n"),
    style: [
      "Sections: Parcours, Réalisations, Impact, Leçons pour les étudiants, Sources.",
      "600–900 words.",
    ].join("\n"),
    rules: [
      "Verify achievements with sources.",
      "Do not glorify or mythologize.",
      "Avoid promotional tone.",
      'Avoid unsupported claims of "first ever" unless cited.',
    ].join("\n"),
    studentLens: [
      "Highlight discipline, impact, and context.",
      "Connect achievements to student pathways.",
    ].join("\n"),
  },

  // ── News (default for web-draft, synthesis, fact-of-the-day, calendar) ───
  news: {
    key: "news",
    tone: [
      "Objective and concise.",
      "No opinion.",
      "No emotional framing.",
    ].join("\n"),
    style: [
      "300–500 words.",
      "Clear headline.",
      "Summary first, details second.",
      "Attribute all information to sources.",
    ].join("\n"),
    rules: [
      "Do not speculate.",
      "Do not dramatize.",
      "Avoid loaded adjectives.",
      "Avoid commentary or analysis.",
    ].join("\n"),
    studentLens: [
      "Inform clearly.",
      "Maintain credibility.",
    ].join("\n"),
  },
};

// ── Series → Tone mapping ───────────────────────────────────────────────────

const SERIES_TONE_MAP: Record<UtilitySeries, EditorialToneKey> = {
  HaitiHistory: "history",
  ScholarshipRadar: "scholarship",
  StudyAbroad: "study-abroad",
  Career: "career",
  HaitianOfTheWeek: "profile",
  HaitiFactOfTheDay: "news",
  HaitiEducationCalendar: "news",
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the editorial directive for a utility series.
 */
export function getEditorialDirective(series: UtilitySeries): EditorialDirective {
  const key = SERIES_TONE_MAP[series];
  return DIRECTIVES[key];
}

/**
 * Get the editorial directive for a tone key directly (useful for
 * web-draft and synthesis prompts which are not tied to a UtilitySeries).
 */
export function getEditorialDirectiveByKey(key: EditorialToneKey): EditorialDirective {
  return DIRECTIVES[key];
}

/**
 * Format an editorial directive as a prompt block ready for injection
 * into an LLM system/user prompt.
 */
export function formatEditorialBlock(directive: EditorialDirective): string {
  return `EDITORIAL GUIDELINES (MANDATORY):
Tone:
${directive.tone}

Style:
${directive.style}

Rules:
${directive.rules}

Student Lens:
${directive.studentLens}`;
}

/**
 * Convenience: get the formatted editorial block for a series.
 */
export function editorialBlockForSeries(series: UtilitySeries): string {
  return formatEditorialBlock(getEditorialDirective(series));
}

/**
 * Convenience: get the formatted editorial block for a tone key.
 */
export function editorialBlockForKey(key: EditorialToneKey): string {
  return formatEditorialBlock(getEditorialDirectiveByKey(key));
}
