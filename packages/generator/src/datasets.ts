/**
 * @edlight-news/generator — Dataset Content module
 *
 * Generates student-focused articles FROM structured datasets
 * (universities, scholarships, haiti_calendar, pathways).
 *
 * Unlike utility.ts which generates from scraped web pages,
 * this module generates from our own curated Firestore data.
 */

import { z } from "zod";
import { callGemini } from "./client.js";

// ── Output schemas ──────────────────────────────────────────────────────────

const datasetArticleSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

export const geminiDatasetArticleSchema = z.object({
  title_fr: z.string().min(1).max(200),
  title_ht: z.string().min(1).max(200),
  summary_fr: z.string().min(1).max(500),
  summary_ht: z.string().min(1).max(500),
  sections_fr: z.array(datasetArticleSectionSchema).min(1),
  sections_ht: z.array(datasetArticleSectionSchema).min(1),
  citations: z.array(
    z.object({ label: z.string().min(1), url: z.string().url() }),
  ).min(1),
});

export type GeminiDatasetArticle = z.infer<typeof geminiDatasetArticleSchema>;

// ── Prompt templates ────────────────────────────────────────────────────────

export const DATASET_PROMPT_VERSION = "dataset-v1";

export type DatasetArticleType =
  | "study-abroad-guide"
  | "scholarship-radar"
  | "calendar-digest"
  | "university-spotlight";

interface DatasetPromptInput {
  articleType: DatasetArticleType;
  /** Stringified JSON of the relevant dataset records */
  dataPayload: string;
  /** Optional extra context (e.g. current date for calendar digests) */
  context?: string;
}

const ARTICLE_TYPE_INSTRUCTIONS: Record<DatasetArticleType, string> = {
  "study-abroad-guide": `TYPE: GUIDE ÉTUDES À L'ÉTRANGER (depuis dataset)
Tu reçois une liste d'universités dans un pays cible.
Crée un guide structuré pour un étudiant haïtien qui veut étudier dans ce pays.
STRUCTURE OBLIGATOIRE:
- Section "Vue d'ensemble" (combien d'universités, fourchette de coûts, langues)
- Section "Universités recommandées" (liste avec noms, villes, points forts, frais)
- Section "Tests requis" (langue, standardisés)
- Section "Calendrier des candidatures" (dates limites)
- Section "Bourses disponibles" (lister celles qui acceptent les Haïtiens)
- Section "Conseils pratiques"
CHAQUE universités citée DOIT avoir son admissionsUrl comme citation.`,

  "scholarship-radar": `TYPE: RADAR BOURSES (depuis dataset)
Tu reçois une liste de bourses avec leurs détails.
Crée un article récapitulatif des bourses ouvertes pour les étudiants haïtiens.
STRUCTURE OBLIGATOIRE:
- Section "Bourses ouvertes" (liste avec nom, pays, montant, date limite)
- Section "Comment postuler" (étapes générales)
- Section "Bourses à venir" (celles dont la date limite n'est pas encore passée)
- Section "Conseils pour maximiser vos chances"
CHAQUE bourse citée DOIT avoir son applicationUrl ou officialUrl comme citation.`,

  "calendar-digest": `TYPE: DIGEST CALENDRIER ÉDUCATION (depuis dataset)
Tu reçois les événements à venir du calendrier éducation Haïti.
Crée un récapitulatif des échéances et événements importants.
STRUCTURE OBLIGATOIRE:
- Section "Cette semaine" (événements dans les 7 prochains jours)
- Section "Ce mois" (événements dans les 30 prochains jours)
- Section "À préparer" (événements dans 30-90 jours)
- Section "Conseils de préparation"
CHAQUE date DOIT citer la source officielle (MENFP, UEH, etc).`,

  "university-spotlight": `TYPE: FOCUS UNIVERSITÉ (depuis dataset)
Tu reçois les détails d'une université spécifique.
Crée un profil détaillé pour un étudiant haïtien qui envisage cette université.
STRUCTURE OBLIGATOIRE:
- Section "Présentation" (nom, ville, classement, ambiance)
- Section "Programmes & Spécialités"
- Section "Admission pour Haïtiens" (exigences, tests, plate-forme)
- Section "Coûts & Bourses"
- Section "Vie étudiante & Communauté haïtienne" (si info disponible)
Toute URL citée DOIT provenir des données fournies.`,
};

// ── Core generation function ────────────────────────────────────────────────

export interface GenerateDatasetArticleResult {
  ok: true;
  article: GeminiDatasetArticle;
  promptVersion: string;
}

export interface GenerateDatasetArticleError {
  ok: false;
  error: string;
  raw?: string;
}

export async function generateDatasetArticle(
  input: DatasetPromptInput,
): Promise<GenerateDatasetArticleResult | GenerateDatasetArticleError> {
  const systemPrompt = buildDatasetPrompt(input);

  try {
    const raw = await callGemini(systemPrompt);

    // Try to parse the JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: "No JSON object found in Gemini response", raw };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = geminiDatasetArticleSchema.parse(parsed);

    return { ok: true, article: validated, promptVersion: DATASET_PROMPT_VERSION };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildDatasetPrompt(input: DatasetPromptInput): string {
  const instructions = ARTICLE_TYPE_INSTRUCTIONS[input.articleType];

  return `Tu es un rédacteur expert pour EdLight News, un média éducatif pour les étudiants haïtiens.
Tu génères du contenu en FRANÇAIS (fr) ET en CRÉOLE HAÏTIEN (ht).

${instructions}

DONNÉES STRUCTURÉES (JSON):
\`\`\`json
${input.dataPayload}
\`\`\`

${input.context ? `CONTEXTE SUPPLÉMENTAIRE: ${input.context}` : ""}

RÈGLES GÉNÉRALES:
1. Réponds UNIQUEMENT en JSON valide selon le schéma demandé.
2. Le contenu en créole haïtien (ht) doit être NATUREL — pas une traduction mot-à-mot.
3. CHAQUE affirmation DOIT être sourcée avec une URL des données fournies.
4. Ne fabrique JAMAIS d'URL — utilise uniquement celles du JSON ci-dessus.
5. Le ton doit être professionnel mais accessible pour un étudiant de 17-25 ans.

Réponds avec un objet JSON contenant:
{
  "title_fr": "...",
  "title_ht": "...",
  "summary_fr": "...",
  "summary_ht": "...",
  "sections_fr": [{"heading": "...", "content": "..."}],
  "sections_ht": [{"heading": "...", "content": "..."}],
  "citations": [{"label": "...", "url": "..."}]
}`;
}
