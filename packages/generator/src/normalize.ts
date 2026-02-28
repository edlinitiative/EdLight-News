/**
 * @edlight-news/generator — Editorial Normalization Engine
 *
 * Rewrites incoming articles into EdLight's official editorial format.
 *
 * Guarantees:
 *  - No facts invented.
 *  - No speculation added.
 *  - No attribution removed.
 *  - No meaning changed.
 *
 * Structural normalization and tone refinement only.
 *
 * Output sections:
 *   1. Titre (factual, no sensationalism)
 *   2. Résumé exécutif (2-3 concise lines)
 *   3. Faits confirmés (structured, no repetition)
 *   4. Déclarations officielles (only if present in source)
 *   5. Points non clarifiés (what is not yet confirmed)
 *   6. Pourquoi c'est important (neutral contextual insight)
 *   7. Source (clear citation)
 *
 * Optional: "Informations à vérifier" if data is incomplete.
 */

import { z } from "zod";
import { callGemini } from "./client.js";

// ── Zod output schema ───────────────────────────────────────────────────────

const normalizedSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

export const geminiNormalizedArticleSchema = z.object({
  /** Factual, non-sensational title */
  title: z.string().min(1).max(200),

  /** 2–3 concise lines summarizing confirmed facts only */
  executive_summary: z.string().min(1).max(600),

  /** Structured confirmed-facts paragraphs */
  confirmed_facts: z.string().min(1),

  /**
   * Official declarations from named sources.
   * Null if no official statements exist in the source material.
   */
  official_statements: z.string().nullable(),

  /** What remains unconfirmed — no speculation */
  unclear_points: z.string().nullable(),

  /** Neutral contextual insight: student, institutional, or economic impact */
  why_it_matters: z.string().min(1),

  /** Clear citation line(s) */
  source_citation: z.string().min(1),

  /**
   * Missing elements that need verification — present only when
   * the source material is incomplete. Null otherwise.
   */
  information_to_verify: z.string().nullable(),

  /** Model confidence that normalization preserved meaning (0.0–1.0) */
  confidence: z.number().min(0).max(1),
});

export type GeminiNormalizedArticle = z.infer<
  typeof geminiNormalizedArticleSchema
>;

// ── Input types ─────────────────────────────────────────────────────────────

export interface NormalizeArticleInput {
  /** Original article title */
  title: string;
  /** Original article body text */
  body: string;
  /** Source publication name */
  sourceName: string;
  /** Source URL */
  sourceUrl: string;
  /** Optional: language hint (defaults to "fr") */
  lang?: "fr" | "ht";
}

// ── Prompt builder ──────────────────────────────────────────────────────────

const PROMPT_VERSION = "normalize-v1";

export function buildNormalizePrompt(input: NormalizeArticleInput): string {
  const lang = input.lang ?? "fr";
  const langLabel = lang === "fr" ? "français" : "kreyòl ayisyen";

  return `Tu es un moteur de normalisation éditoriale pour EdLight News.

MISSION: Réécrire l'article ci-dessous dans le format éditorial officiel d'EdLight News.

RÈGLES ABSOLUES:
1. NE PAS inventer de faits.
2. NE PAS ajouter de spéculation.
3. NE PAS supprimer les attributions.
4. NE PAS changer le sens.
5. Normalisation structurelle et raffinement du ton UNIQUEMENT.

STRUCTURE OBLIGATOIRE:

1) TITRE
   - Factuel, sans sensationnalisme.
   - Retirer le ton dramatique.

2) RÉSUMÉ EXÉCUTIF (2–3 lignes concises)
   - Résumer UNIQUEMENT les faits confirmés.
   - Aucun langage émotionnel.

3) FAITS CONFIRMÉS
   - Paragraphe(s) structuré(s).
   - Supprimer les répétitions.
   - Éviter les phrases vagues.
   - Remplacer le remplissage par des énoncés précis.

4) DÉCLARATIONS OFFICIELLES
   - Inclure UNIQUEMENT si présentes dans la source.
   - Citer la source une seule fois, à la première mention.
   - Si aucune déclaration officielle dans l'article, mettre null.

5) POINTS NON CLARIFIÉS
   - Mentionner ce qui n'est pas encore confirmé.
   - NE PAS spéculer.
   - Si tout est clair, mettre null.

6) POURQUOI C'EST IMPORTANT
   - Observation contextuelle neutre.
   - Focus sur l'impact étudiant, institutionnel ou économique.
   - Analytique, pas partisan.

7) SOURCE
   - Ligne de citation claire.
   - Pas de duplication.

8) INFORMATIONS À VÉRIFIER (optionnel)
   - Si des informations sont incomplètes, lister les éléments manquants UNE SEULE FOIS.
   - NE PAS répéter "À confirmer" dans plusieurs sections.
   - Si tout est complet, mettre null.

RÈGLES DE TON:
- Neutre
- Analytique
- Clair
- Concis
- Pas de drame
- INTERDITS: "Cela soulève des questions", "La population s'interroge", "Une situation préoccupante"
- Remplacer les énoncés génériques par des observations concrètes.

RÈGLES DE FORMAT:
- Paragraphes courts.
- Espacement clair entre sections.
- Aucun artéfact d'interface (ex: "Partager", "Copier", "Lire aussi").
- Pas de blocs "À confirmer" répétés — regrouper sous "Informations à vérifier".

LANGUE DE SORTIE: ${langLabel}

ARTICLE SOURCE:
Titre: ${input.title}
URL: ${input.sourceUrl}
Source: ${input.sourceName}

Texte:
${input.body.slice(0, 8000)}

RÉPONDS UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "title": "Titre normalisé (max 200 caractères)",
  "executive_summary": "Résumé exécutif (2–3 lignes, max 600 caractères)",
  "confirmed_facts": "Faits confirmés — paragraphes structurés",
  "official_statements": "Déclarations officielles ou null si aucune",
  "unclear_points": "Points non clarifiés ou null si tout est clair",
  "why_it_matters": "Pourquoi c'est important — analyse neutre",
  "source_citation": "${input.sourceName} — ${input.sourceUrl}",
  "information_to_verify": "Éléments manquants à vérifier ou null",
  "confidence": 0.90
}`;
}

// ── Result types ────────────────────────────────────────────────────────────

export interface NormalizeArticleResult {
  success: true;
  article: GeminiNormalizedArticle;
  promptVersion: string;
}

export interface NormalizeArticleError {
  success: false;
  error: string;
  rawResponse?: string;
}

// ── Generate normalized article ─────────────────────────────────────────────

/**
 * Call Gemini to normalize an incoming article into EdLight editorial format.
 * Returns structured, Zod-validated output or an error.
 */
export async function normalizeArticle(
  input: NormalizeArticleInput,
): Promise<NormalizeArticleResult | NormalizeArticleError> {
  try {
    const prompt = buildNormalizePrompt(input);
    const raw = await callGemini(prompt);

    // Parse JSON from response
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: "Gemini normalization response is not valid JSON",
        rawResponse: raw.slice(0, 500),
      };
    }

    // Validate with Zod
    const result = geminiNormalizedArticleSchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        error: `Normalization Zod validation failed: ${result.error.message}`,
        rawResponse: JSON.stringify(parsed).slice(0, 500),
      };
    }

    return {
      success: true,
      article: result.data,
      promptVersion: PROMPT_VERSION,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Gemini normalization error",
    };
  }
}

// ── Grounding validation ────────────────────────────────────────────────────

export interface NormalizationValidationResult {
  passed: boolean;
  issues: string[];
}

/**
 * Validate that the normalized article is grounded in the original text.
 *
 * Checks:
 *  1. Confidence threshold (>= 0.7 — higher bar since normalization must preserve meaning)
 *  2. All sections are non-empty
 *  3. Significant numbers in output appear in source text
 *  4. No fabricated quotes (quoted text must appear in source)
 */
export function validateNormalizationGrounding(
  output: GeminiNormalizedArticle,
  originalBody: string,
): NormalizationValidationResult {
  const issues: string[] = [];

  // 1. Confidence check (higher threshold than synthesis — meaning preservation is critical)
  if (output.confidence < 0.7) {
    issues.push(`Low confidence: ${output.confidence}`);
  }

  // 2. Core section presence
  if (!output.title.trim()) {
    issues.push("Empty title");
  }
  if (!output.executive_summary.trim()) {
    issues.push("Empty executive summary");
  }
  if (!output.confirmed_facts.trim()) {
    issues.push("Empty confirmed facts section");
  }
  if (!output.why_it_matters.trim()) {
    issues.push("Empty why-it-matters section");
  }

  // 3. Number grounding — significant numbers (3+ digits) should appear in source
  const allOutputText = [
    output.title,
    output.executive_summary,
    output.confirmed_facts,
    output.official_statements ?? "",
    output.why_it_matters,
  ].join(" ");

  const significantNumbers = allOutputText.match(/\d{3,}/g) ?? [];
  let ungroundedCount = 0;
  for (const num of significantNumbers) {
    if (!originalBody.includes(num)) {
      ungroundedCount++;
    }
  }
  if (
    significantNumbers.length > 0 &&
    ungroundedCount / significantNumbers.length > 0.3
  ) {
    issues.push(
      `${ungroundedCount}/${significantNumbers.length} significant numbers not grounded in source`,
    );
  }

  // 4. Quote grounding — text in «» or "" should appear in source
  const quotedTexts = allOutputText.match(/[«"]([^»"]{10,})[»"]/g) ?? [];
  let ungroundedQuotes = 0;
  for (const qt of quotedTexts) {
    // Strip quote chars and check a meaningful substring (first 20 chars)
    const inner = qt.replace(/[«»""]/g, "").trim();
    const probe = inner.slice(0, 30).toLowerCase();
    if (probe && !originalBody.toLowerCase().includes(probe)) {
      ungroundedQuotes++;
    }
  }
  if (quotedTexts.length > 0 && ungroundedQuotes > 0) {
    issues.push(
      `${ungroundedQuotes}/${quotedTexts.length} quoted passage(s) not found in source text`,
    );
  }

  // Pass if no critical issues
  const hasCriticalIssue = issues.some(
    (i) =>
      i.startsWith("Empty") ||
      i.startsWith("Low confidence") ||
      i.includes("quoted passage"),
  );
  const passed = !hasCriticalIssue;

  return { passed, issues };
}

// ── Formatter: structured article → Markdown ────────────────────────────────

/**
 * Format a validated GeminiNormalizedArticle into clean Markdown
 * following EdLight editorial structure.
 */
export function formatNormalizedArticle(
  article: GeminiNormalizedArticle,
): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${article.title}`);

  // Executive summary
  sections.push(`## 📌 Résumé exécutif\n\n${article.executive_summary}`);

  // Confirmed facts
  sections.push(`## 🧾 Faits confirmés\n\n${article.confirmed_facts}`);

  // Official statements (only if present)
  if (article.official_statements) {
    sections.push(
      `## 🗣 Déclarations officielles\n\n${article.official_statements}`,
    );
  }

  // Unclear points (only if present)
  if (article.unclear_points) {
    sections.push(`## 🔎 Points non clarifiés\n\n${article.unclear_points}`);
  }

  // Why it matters
  sections.push(
    `## 🎓 Pourquoi c'est important\n\n${article.why_it_matters}`,
  );

  // Source
  sections.push(`## 📚 Source\n\n${article.source_citation}`);

  // Information to verify (only if present)
  if (article.information_to_verify) {
    sections.push(
      `## ⚠️ Informations à vérifier\n\n${article.information_to_verify}`,
    );
  }

  return sections.join("\n\n");
}

export { PROMPT_VERSION as NORMALIZE_PROMPT_VERSION };
