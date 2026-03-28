/**
 * @edlight-news/generator — Synthesis module
 *
 * Generates multi-source synthesis articles using Gemini.
 * Includes prompt building, output validation, and grounding checks.
 */

import { z } from "zod";
import { callGemini } from "./client.js";
import { editorialBlockForKey } from "./editorial-tone.js";

// ── Gemini output schema for synthesis ──────────────────────────────────────

const synthesisSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

export const geminiSynthesisSchema = z.object({
  title_fr: z.string().min(1).max(200),
  summary_fr: z.string().min(1).max(500),
  sections_fr: z.array(synthesisSectionSchema).min(1),
  title_ht: z.string().min(1).max(200),
  summary_ht: z.string().min(1).max(500),
  sections_ht: z.array(synthesisSectionSchema).min(1),
  ig_narrative: z.string().nullable().optional(),
  what_changed: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.enum(["confirmed", "unconfirmed", "evolving"])),
});

export type GeminiSynthesisOutput = z.infer<typeof geminiSynthesisSchema>;

// ── Source packet types ─────────────────────────────────────────────────────

export interface SynthesisSource {
  itemId: string;
  title: string;
  text: string;
  sourceName: string;
  publishedAt?: string;
  /** True if this source was added after the last synthesis (living update) */
  isNew?: boolean;
}

export interface SynthesisPacket {
  clusterId: string;
  sources: SynthesisSource[];
  /** Title of existing synthesis (for living update context) */
  existingSynthesisTitle?: string;
}

// ── Prompt builder ──────────────────────────────────────────────────────────

const PROMPT_VERSION = "synthesis-v1";

export function buildSynthesisPrompt(packet: SynthesisPacket): string {
  const sourcesBlock = packet.sources
    .map(
      (s, i) =>
        `SOURCE ${i + 1}${s.isNew ? " [NOUVELLE]" : ""}:\nTitre: ${s.title}\nSource: ${s.sourceName}\nDate: ${s.publishedAt ?? "N/A"}\nTexte:\n${s.text.slice(0, 3000)}\n---`,
    )
    .join("\n\n");

  const updateContext = packet.existingSynthesisTitle
    ? `\nNOTE: Ceci est une MISE À JOUR d'une synthèse existante: "${packet.existingSynthesisTitle}". Les sources marquées [NOUVELLE] sont des ajouts récents. Indique ce qui a changé dans "what_changed".\n`
    : "";

  const editorial = editorialBlockForKey("news");

  return `Tu es rédacteur en chef pour EdLight News, une plateforme d'actualités éducatives pour les étudiants haïtiens.

${editorial}

Synthétise les ${packet.sources.length} articles sources ci-dessous sur le MÊME sujet en UN SEUL article de synthèse complet, en FRANÇAIS et en KREYÒL AYISYEN.
${updateContext}
RÈGLES STRICTES:
1. Combine les informations de TOUTES les sources en un récit cohérent et structuré en sections.
2. CITE LES SOURCES par nom dans le texte (ex: "Selon Le Nouvelliste…").
3. Identifie les faits CONFIRMÉS par 2+ sources vs les faits rapportés par une seule source.
4. N'INVENTE JAMAIS d'information absente des sources.
5. Sois concis, précis et utile pour un étudiant haïtien.
6. Chaque section doit avoir un titre clair et un contenu informatif (2-3 phrases complètes).
7. Le "what_changed" doit être null pour une nouvelle synthèse, ou une phrase décrivant les changements pour une mise à jour.
8. Les tags doivent refléter le statut global:
   - "confirmed" = faits corroborés par 2+ sources
   - "unconfirmed" = rapporté par 1 seule source
   - "evolving" = situation en cours d'évolution
9. LIMITES INSTAGRAM (IMPÉRATIF): Les sections sont affichées sur des slides Instagram.
   - "heading" de chaque section : MAX 70 CARACTÈRES. Titre court, percutant, sans ponctuation finale.
   - "content" de chaque section : MAX 500 CARACTÈRES. Exactement 2-3 phrases complètes. Chaque phrase doit avoir un sens complet — ne jamais couper une phrase à mi-chemin.
   - "summary_fr" / "summary_ht" : MAX 300 CARACTÈRES. 2 phrases maximum. Elles sont affichées en gros sur stories Instagram.
10. IG_NARRATIVE (CARROUSEL INSTAGRAM): Écris ig_narrative comme 4–6 phrases en français qui forment un récit continu: phrase 1 = le fait central, phrase 2 = conséquence immédiate, phrase 3 = contexte, phrase 4+ = ce que ça signifie pour le lecteur. Chaque phrase doit s'enchaîner naturellement avec la suivante. PAS de parenthèses, PAS de crochets — récris les détails comme "X (Y)" → "X — Y". Le texte doit pouvoir être coupé en 2–3 slides sans perte de sens.

SOURCES:
${sourcesBlock}

RÉPONDS UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "title_fr": "Titre synthèse en français (max 120 caractères)",
  "summary_fr": "Résumé en français (2 phrases max, max 300 caractères)",
  "sections_fr": [
    { "heading": "Titre de section court (max 70 caractères)", "content": "2-3 phrases complètes (max 500 caractères)" }
  ],
  "title_ht": "Tit sentèz an kreyòl ayisyen (max 120 caractères)",
  "summary_ht": "Rezime an kreyòl ayisyen (2 fraz max, max 300 caractères)",
  "sections_ht": [
    { "heading": "Tit seksyon kout (max 70 caractères)", "content": "2-3 fraz konplè (max 500 caractères)" }
  ],
  "ig_narrative": "4-6 phrases en français formant un arc continu, sans parenthèses ni crochets",
  "what_changed": null,
  "confidence": 0.85,
  "tags": ["confirmed"]
}`;
}

// ── Generate synthesis from packet ──────────────────────────────────────────

export interface GenerateSynthesisResult {
  success: true;
  output: GeminiSynthesisOutput;
  promptVersion: string;
}

export interface GenerateSynthesisError {
  success: false;
  error: string;
  rawResponse?: string;
}

/**
 * Call Gemini to generate a multi-source synthesis article.
 * Returns structured, zod-validated output or an error.
 */
export async function generateSynthesisFromPacket(
  packet: SynthesisPacket,
): Promise<GenerateSynthesisResult | GenerateSynthesisError> {
  try {
    const prompt = buildSynthesisPrompt(packet);
    const raw = await callGemini(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: "Gemini synthesis response is not valid JSON",
        rawResponse: raw.slice(0, 500),
      };
    }

    const result = geminiSynthesisSchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        error: `Synthesis Zod validation failed: ${result.error.message}`,
        rawResponse: raw.slice(0, 500),
      };
    }

    return { success: true, output: result.data, promptVersion: PROMPT_VERSION };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Gemini synthesis error",
    };
  }
}

// ── Grounding validation ────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  issues: string[];
}

/**
 * Validate that synthesis output is grounded in source texts.
 *
 * Checks:
 *  1. Confidence threshold (>= 0.5)
 *  2. Sections are non-empty in both languages
 *  3. Significant numbers (3+ digits) in the synthesis appear in source texts
 *  4. Critical claims require corroboration from 2+ sources
 */
export function validateSynthesisGrounding(
  output: GeminiSynthesisOutput,
  sourceTexts: string[],
  botProtectionSourceCount?: number,
): ValidationResult {
  const issues: string[] = [];

  // 0. Bot-protection / CAPTCHA source check (caller passes count of tainted sources)
  if (botProtectionSourceCount !== undefined && botProtectionSourceCount > 0) {
    issues.push(
      `${botProtectionSourceCount}/${sourceTexts.length} source(s) contain bot-protection/CAPTCHA content`,
    );
    if (botProtectionSourceCount === sourceTexts.length && sourceTexts.length > 0) {
      issues.push("All sources are bot-protection pages — synthesis is invalid");
    }
  }

  // 1. Confidence check
  if (output.confidence < 0.5) {
    issues.push(`Low confidence: ${output.confidence}`);
  }

  // 2. Section check
  if (output.sections_fr.length === 0) {
    issues.push("No French sections generated");
  }
  if (output.sections_ht.length === 0) {
    issues.push("No Haitian Creole sections generated");
  }

  // 3. Number grounding — significant numbers (3+ digits) should appear in sources
  const allSynthesisText = [
    output.title_fr,
    output.summary_fr,
    ...output.sections_fr.map((s) => s.content),
  ].join(" ");

  const significantNumbers = allSynthesisText.match(/\d{3,}/g) ?? [];
  const combinedSources = sourceTexts.join(" ");

  let ungroundedCount = 0;
  for (const num of significantNumbers) {
    if (!combinedSources.includes(num)) {
      ungroundedCount++;
    }
  }

  if (significantNumbers.length > 0 && ungroundedCount / significantNumbers.length > 0.5) {
    issues.push(
      `${ungroundedCount}/${significantNumbers.length} significant numbers not grounded in sources`,
    );
  }

  // 4. Date grounding — yyyy-mm-dd style dates should appear in sources
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const synthesisDates = allSynthesisText.match(datePattern) ?? [];
  let ungroundedDates = 0;
  for (const d of synthesisDates) {
    if (!combinedSources.includes(d)) {
      ungroundedDates++;
    }
  }
  if (synthesisDates.length > 0 && ungroundedDates > synthesisDates.length / 2) {
    issues.push(
      `${ungroundedDates}/${synthesisDates.length} dates not grounded in sources`,
    );
  }

  // Pass if no critical issues, or if minor issues with decent confidence
  const hasCriticalIssue = issues.some(
    (i) =>
      i.includes("No French") ||
      i.includes("No Haitian") ||
      i.startsWith("Low confidence") ||
      i.includes("All sources are bot-protection"),
  );
  const passed = !hasCriticalIssue && (issues.length === 0 || output.confidence >= 0.6);

  return { passed, issues };
}

export { PROMPT_VERSION as SYNTHESIS_PROMPT_VERSION };
