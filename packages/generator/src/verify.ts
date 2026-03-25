/**
 * @edlight-news/generator — Dataset Verification module
 *
 * Phase 2: LLM-powered field extraction from source HTML.
 *
 * For each dataset type, sends truncated page HTML + current record to Gemini
 * and asks it to extract the latest structured fields.  The caller diffs the
 * result against the existing record and only writes changed fields.
 *
 * Safety:
 *  - Every extracted field is optional so Gemini can say "I couldn't find it"
 *    without producing a null that overwrites good data.
 *  - A `confidence` score lets the caller gate whether to apply the update.
 *  - `pageRelevant` lets Gemini signal the page has changed topic entirely.
 */

import { z } from "zod";
import { callGemini } from "./client.js";

// ── Max HTML length sent to Gemini (tokens ≈ chars/4, keep well under 128k) ─
// Reduced from 30K to 15K — most relevant data is in the first 15K chars,
// and this halves the per-call token cost for dataset verification.
const MAX_HTML_CHARS = 15_000;

// ══════════════════════════════════════════════════════════════════════════════
// ── Output schemas ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export const verifyUniversitySchema = z.object({
  pageRelevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  name: z.string().optional(),
  city: z.string().optional(),
  tuitionBand: z.enum(["low", "medium", "high", "unknown"]).optional(),
  applicationDeadline: z.string().optional(),
  internationalAdmissionsUrl: z.string().optional(),
  scholarshipUrl: z.string().optional(),
  englishTests: z.array(z.string()).optional(),
  frenchTests: z.array(z.string()).optional(),
  applicationPlatform: z.string().optional(),
  languages: z.array(z.string()).optional(),
});
export type VerifyUniversityResult = z.infer<typeof verifyUniversitySchema>;

export const verifyScholarshipSchema = z.object({
  pageRelevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  name: z.string().optional(),
  fundingType: z.enum(["full", "partial", "stipend", "tuition-only", "unknown"]).optional(),
  deadlineDateISO: z.string().optional(),
  deadlineNotes: z.string().optional(),
  eligibilitySummary: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  howToApplyUrl: z.string().optional(),
  eligibleCountries: z.array(z.string()).optional(),
  recurring: z.boolean().optional(),
});
export type VerifyScholarshipResult = z.infer<typeof verifyScholarshipSchema>;

export const verifyCalendarEventSchema = z.object({
  pageRelevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  title: z.string().optional(),
  startDateISO: z.string().optional(),
  endDateISO: z.string().optional(),
  dateISO: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
export type VerifyCalendarEventResult = z.infer<typeof verifyCalendarEventSchema>;

// ══════════════════════════════════════════════════════════════════════════════
// ── Prompt builders ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function truncateHtml(html: string): string {
  if (html.length <= MAX_HTML_CHARS) return html;
  return html.slice(0, MAX_HTML_CHARS) + "\n[…truncated…]";
}

const COMMON_RULES = `RÈGLES:
1. Réponds UNIQUEMENT en JSON valide.
2. Mets "pageRelevant": false si la page n'a aucun rapport avec le sujet demandé (page d'erreur, contenu complètement différent, paywall vide).
3. Mets "confidence": 0-1 indiquant ta certitude sur les données extraites.
4. OMET un champ (ne l'inclus pas) si tu ne trouves pas l'information sur la page. N'invente rien.
5. Les dates doivent être au format YYYY-MM-DD.
6. N'inclus PAS de markdown ou de backticks dans ta réponse.`;

export function buildVerifyUniversityPrompt(
  currentRecord: { name: string; country: string; admissionsUrl: string },
  html: string,
): string {
  return `Tu es un vérificateur de données pour EdLight News.
Tu reçois une page web d'admission d'une université ET les données actuelles de notre base.
Extrais les informations les plus récentes de la page.

DONNÉES ACTUELLES:
- Nom: ${currentRecord.name}
- Pays: ${currentRecord.country}
- URL: ${currentRecord.admissionsUrl}

${COMMON_RULES}

Réponds avec:
{
  "pageRelevant": true/false,
  "confidence": 0.0-1.0,
  "name": "nom officiel si différent",
  "city": "ville",
  "tuitionBand": "low|medium|high|unknown",
  "applicationDeadline": "YYYY-MM-DD",
  "internationalAdmissionsUrl": "URL si trouvée",
  "scholarshipUrl": "URL si trouvée",
  "englishTests": ["TOEFL", "IELTS"],
  "frenchTests": ["TCF", "DELF"],
  "applicationPlatform": "ex: Common App, Campus France",
  "languages": ["fr", "en"]
}

PAGE HTML:
${truncateHtml(html)}`;
}

export function buildVerifyScholarshipPrompt(
  currentRecord: { name: string; country: string; officialUrl: string },
  html: string,
): string {
  return `Tu es un vérificateur de données pour EdLight News.
Tu reçois la page officielle d'une bourse ET les données actuelles de notre base.
Extrais les informations les plus récentes de la page.

DONNÉES ACTUELLES:
- Nom: ${currentRecord.name}
- Pays: ${currentRecord.country}
- URL: ${currentRecord.officialUrl}

${COMMON_RULES}

Réponds avec:
{
  "pageRelevant": true/false,
  "confidence": 0.0-1.0,
  "name": "nom officiel si différent",
  "fundingType": "full|partial|stipend|tuition-only|unknown",
  "deadlineDateISO": "YYYY-MM-DD",
  "deadlineNotes": "notes sur la date limite",
  "eligibilitySummary": "résumé des critères",
  "requirements": ["exigence 1", "exigence 2"],
  "howToApplyUrl": "URL du formulaire",
  "eligibleCountries": ["HT", "Global"],
  "recurring": true/false
}

PAGE HTML:
${truncateHtml(html)}`;
}

export function buildVerifyCalendarEventPrompt(
  currentRecord: { title: string; institution: string; officialUrl: string },
  html: string,
): string {
  return `Tu es un vérificateur de données pour EdLight News.
Tu reçois une page officielle d'une institution éducative haïtienne ET les données actuelles d'un événement du calendrier.
Extrais les informations les plus récentes de la page.

DONNÉES ACTUELLES:
- Titre: ${currentRecord.title}
- Institution: ${currentRecord.institution}
- URL: ${currentRecord.officialUrl}

${COMMON_RULES}

Réponds avec:
{
  "pageRelevant": true/false,
  "confidence": 0.0-1.0,
  "title": "titre mis à jour si différent",
  "startDateISO": "YYYY-MM-DD",
  "endDateISO": "YYYY-MM-DD",
  "dateISO": "YYYY-MM-DD (date unique si pas de plage)",
  "location": "lieu",
  "notes": "informations supplémentaires"
}

PAGE HTML:
${truncateHtml(html)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Core verify functions ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export interface VerifySuccess<T> {
  ok: true;
  data: T;
}

export interface VerifyError {
  ok: false;
  error: string;
  raw?: string;
}

export type VerifyResult<T> = VerifySuccess<T> | VerifyError;

/** Minimum confidence to accept Gemini's extraction. */
export const VERIFY_CONFIDENCE_THRESHOLD = 0.5;

async function runVerify<T>(
  prompt: string,
  schema: z.ZodType<T>,
  label: string,
): Promise<VerifyResult<T>> {
  try {
    const raw = await callGemini(prompt);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: `No JSON in Gemini response for ${label}`, raw: raw.slice(0, 300) };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = schema.parse(parsed);
    return { ok: true, data: validated };
  } catch (err) {
    return {
      ok: false,
      error: `Verify ${label}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function verifyUniversity(
  currentRecord: { name: string; country: string; admissionsUrl: string },
  html: string,
): Promise<VerifyResult<VerifyUniversityResult>> {
  const prompt = buildVerifyUniversityPrompt(currentRecord, html);
  return runVerify(prompt, verifyUniversitySchema, `university:${currentRecord.name}`);
}

export async function verifyScholarship(
  currentRecord: { name: string; country: string; officialUrl: string },
  html: string,
): Promise<VerifyResult<VerifyScholarshipResult>> {
  const prompt = buildVerifyScholarshipPrompt(currentRecord, html);
  return runVerify(prompt, verifyScholarshipSchema, `scholarship:${currentRecord.name}`);
}

export async function verifyCalendarEvent(
  currentRecord: { title: string; institution: string; officialUrl: string },
  html: string,
): Promise<VerifyResult<VerifyCalendarEventResult>> {
  const prompt = buildVerifyCalendarEventPrompt(currentRecord, html);
  return runVerify(prompt, verifyCalendarEventSchema, `calendar:${currentRecord.title}`);
}
