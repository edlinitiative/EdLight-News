/**
 * @edlight-news/generator — Utility Magazine module
 *
 * Generates student-focused original content for six recurring series.
 * Includes strict grounding validation + per-series prompt templates.
 */

import { z } from "zod";
import { callGemini } from "./client.js";
import type { UtilitySeries } from "@edlight-news/types";
import { editorialBlockForSeries } from "./editorial-tone.js";

// ── Gemini output schema for utility content ────────────────────────────────

const utilitySectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

const utilityFactDeadlineSchema = z.object({
  label: z.string().min(1),
  dateISO: z.string(),
  sourceUrl: z.string().url(),
});

export const geminiUtilitySchema = z.object({
  title_fr: z.string().min(1).max(200),
  title_ht: z.string().min(1).max(200),
  summary_fr: z.string().min(1).max(500),
  summary_ht: z.string().min(1).max(500),
  sections_fr: z.array(utilitySectionSchema).min(1),
  sections_ht: z.array(utilitySectionSchema).min(1),
  facts: z.object({
    deadlines: z.array(utilityFactDeadlineSchema),
    requirements: z.array(z.string()),
    steps: z.array(z.string()),
    eligibility: z.array(z.string()),
    notes: z.array(z.string()).optional(),
  }),
  citations: z.array(
    z.object({ label: z.string().min(1), url: z.string().url() }),
  ).min(1),
});

export type GeminiUtilityOutput = z.infer<typeof geminiUtilitySchema>;

// ── Source packet types ─────────────────────────────────────────────────────

export interface UtilitySourcePacket {
  url: string;
  label: string;
  domain: string;
  extractedText: string;
  detectedDates: string[];
  pageTitle: string;
}

export interface UtilityGenerateInput {
  series: UtilitySeries;
  rotationKey?: string;
  sourcePackets: UtilitySourcePacket[];
}

// ── Per-series mini-templates ───────────────────────────────────────────────

const SERIES_INSTRUCTIONS: Record<UtilitySeries, string> = {
  StudyAbroad: `TYPE: ÉTUDIER À L'ÉTRANGER
Crée un guide pour un étudiant haïtien souhaitant étudier dans ce pays.
STRUCTURE OBLIGATOIRE:
- Section "Conditions & Pré-requis" (diplômes, tests de langue, GPA)
- Section "Démarches étape par étape" (candidature, visa, logement)
- Section "Calendrier" (dates limites, timeline typique)
- Section "Erreurs courantes à éviter"
- Section "Liens utiles" (liens officiels uniquement, issus des sources)
Extrais TOUTES les dates limites avec sourceUrl. Sois très concret.`,

  Career: `TYPE: CARRIÈRE & EMPLOI
Crée un guide actionnable pour un étudiant haïtien sur ce sujet carrière.
STRUCTURE OBLIGATOIRE:
- Section "Comprendre le sujet" (contexte, pourquoi c'est important)
- Section "Plan d'action en 30 jours" (étapes concrètes et réalistes)
- Section "Outils & Ressources" (sites, apps, templates — issus des sources)
- Section "Conseils pratiques" (erreurs à éviter, astuces)
Inclus des exercices concrets si applicable.`,

  ScholarshipRadar: `TYPE: BOURSES & OPPORTUNITÉS
Crée un article détaillé sur cette bourse ou opportunité.
STRUCTURE OBLIGATOIRE:
- Section "Résumé de l'opportunité" (montant, couverture, durée)
- Section "Critères d'éligibilité" (qui peut postuler)
- Section "Documents requis" (liste précise)
- Section "Comment postuler" (étapes, lien officiel)
- Section "Date limite" (date exacte avec sourceUrl, ou "à confirmer")
Extrais ABSOLUMENT la date limite et le lien officiel de candidature.`,
  ScholarshipRadarWeekly: `TYPE: DIGEST BOURSES HEBDOMADAIRE
Ce type est généré par script (pas par Gemini). Si tu reçois ce prompt, retourne
un résumé simple des bourses avec dates limites proches.`,
  HaitiHistory: `TYPE: HISTOIRE D'HAÏTI (contenu snackable)
Crée un article historique court mais riche pour un étudiant haïtien.
STRUCTURE OBLIGATOIRE:
- Section "L'histoire" (récit engageant, 2-3 paragraphes max)
- Section "Contexte" (pourquoi cet événement/période est important)
- Section "Pourquoi ça compte aujourd'hui" (lien avec le présent)
- Section "Sources" (références citées)
Sois narratif mais rigoureux. Chaque fait DOIT venir d'une source.`,

  HaitiFactOfTheDay: `TYPE: FÈT / FAIT DU JOUR
Crée UN SEUL fait intéressant sur Haïti, vérifié et sourcé.
STRUCTURE OBLIGATOIRE:
- Section "Le fait" (une phrase-choc + explication courte, 1 paragraphe)
- Section "Contexte rapide" (2-3 phrases de contexte)
- Section "Source" (d'où vient cette information)
Sois concis — c'est un format "snackable". Le fait doit surprendre ou éduquer.`,

  HaitianOfTheWeek: `TYPE: HAÏTIEN(NE) DE LA SEMAINE
Crée un profil inspirant d'une personnalité haïtienne remarquable.
STRUCTURE OBLIGATOIRE:
- Section "Qui est-ce ?" (nom, domaine, accomplissement principal)
- Section "Parcours" (jalons clés de sa carrière/vie)
- Section "Ce qui le/la rend remarquable" (impact, innovation, changement)
- Section "Leçons pour les étudiants" (ce qu'on peut apprendre)
- Section "Sources" (biographie, interviews, références)
Sois inspirant mais factuel. Chaque affirmation DOIT être sourcée.`,

  HaitiEducationCalendar: `TYPE: CALENDRIER ÉDUCATION HAÏTI
Crée un calendrier vivant des échéances scolaires et universitaires en Haïti.
STRUCTURE OBLIGATOIRE:
- Section "Dates clés" (liste de TOUTES les échéances détectées: rentrée, inscriptions, examens Bac/NS, résultats, admissions UEH, admissions universités privées)
- Section "Comment s'inscrire" (étapes concrètes pour les inscriptions en cours ou à venir)
- Section "Liens officiels" (liens vers MENFP, UEH, universités — UNIQUEMENT les URLs des sources fournies)
- Section "À confirmer" (dates/infos non confirmées par une source officielle)
RÈGLES SPÉCIALES CALENDRIER:
1. Chaque date DOIT avoir un sourceUrl pointant vers la source officielle.
2. Si une date ne peut PAS être confirmée par une source officielle (priority>=100), mets-la dans "À confirmer" avec dateISO="".
3. N'INVENTE JAMAIS de date. Écris "date à confirmer" si l'information manque.
4. Utilise le champ "notes" pour les perturbations/mises à jour/grèves/reports.
5. Inclus ABSOLUMENT les mots-clés: inscription, admission, concours, bac, NS, rentrée, calendrier, résultats, session.
6. Le contenu DOIT être ancré dans les sources officielles haïtiennes (MENFP, UEH).`,
};

// ── Prompt builder ──────────────────────────────────────────────────────────

export const UTILITY_PROMPT_VERSION = "utility-magazine-v3";

export function buildUtilityPrompt(input: UtilityGenerateInput): string {
  const sourcesBlock = input.sourcePackets
    .map(
      (s, i) =>
        `SOURCE ${i + 1}:\nLabel: ${s.label}\nURL: ${s.url}\nDomaine: ${s.domain}\nTitre page: ${s.pageTitle}\nDates détectées: ${s.detectedDates.length > 0 ? s.detectedDates.join(", ") : "aucune"}\nTexte:\n${s.extractedText}\n---`,
    )
    .join("\n\n");

  const rotationNote = input.rotationKey
    ? `\nPAYS FOCUS: ${input.rotationKey}\n`
    : "";

  const seriesInstr = SERIES_INSTRUCTIONS[input.series];
  const editorial = editorialBlockForSeries(input.series);

  return `Tu es un rédacteur expert pour EdLight Student Utility Magazine, une publication éducative pour les étudiants haïtiens.
${rotationNote}
${editorial}

${seriesInstr}

RÈGLES STRICTES DE GROUNDING:
1. Utilise UNIQUEMENT les informations des sources fournies ci-dessous.
2. Chaque date/chiffre DOIT avoir un sourceUrl référençant une URL source.
3. Si une information manque, écris "à confirmer" — n'INVENTE JAMAIS.
4. N'utilise JAMAIS les expressions: "je pense", "peut-être", "probablement", "il semble que", "il est possible", "on peut supposer".
5. Cite les sources par nom dans le texte (ex: "Selon Campus France…").
6. Termine par une liste Sources.

SOURCES:
${sourcesBlock}

RÉPONDS UNIQUEMENT en JSON valide:
{
  "title_fr": "Titre FR (max 150 car., informatif)",
  "title_ht": "Tit HT",
  "summary_fr": "Résumé FR (2-3 phrases, max 400 car.)",
  "summary_ht": "Rezime HT",
  "sections_fr": [{"heading":"…","content":"…"}],
  "sections_ht": [{"heading":"…","content":"…"}],
  "facts": {
    "deadlines": [{"label":"…","dateISO":"2026-03-15","sourceUrl":"https://…"}],
    "requirements": ["…"],
    "steps": ["…"],
    "eligibility": ["…"],
    "notes": ["…"]
  },
  "citations": [{"label":"…","url":"https://…"}]
}`;
}

// ── Generate ────────────────────────────────────────────────────────────────

export interface GenerateUtilityResult {
  success: true;
  output: GeminiUtilityOutput;
  promptVersion: string;
}

export interface GenerateUtilityError {
  success: false;
  error: string;
  rawResponse?: string;
}

export async function generateUtilityFromPackets(
  input: UtilityGenerateInput,
): Promise<GenerateUtilityResult | GenerateUtilityError> {
  try {
    const prompt = buildUtilityPrompt(input);
    const raw = await callGemini(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: "Gemini utility response is not valid JSON",
        rawResponse: raw.slice(0, 500),
      };
    }

    const result = geminiUtilitySchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        error: `Utility Zod validation failed: ${result.error.message}`,
        rawResponse: raw.slice(0, 500),
      };
    }

    return { success: true, output: result.data, promptVersion: UTILITY_PROMPT_VERSION };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Gemini utility error",
    };
  }
}

// ── Grounding + quality validation ──────────────────────────────────────────

export interface UtilityValidationResult {
  passed: boolean;
  issues: string[];
}

/** Speculation markers that should never appear in output. */
const SPECULATION_MARKERS = [
  "i think", "je pense", "peut-être", "maybe", "probably", "probablement",
  "il semble que", "it seems", "on peut supposer", "il est possible",
  "we can assume",
];

/**
 * Validate utility output: grounding, citation counts, speculation markers,
 * allowlist domain enforcement.
 */
export function validateUtilityJson(
  sourcePackets: UtilitySourcePacket[],
  output: GeminiUtilityOutput,
  series: UtilitySeries,
  allowlistDomains?: string[],
): UtilityValidationResult {
  const issues: string[] = [];
  const sourceUrlSet = new Set(sourcePackets.map((s) => s.url));
  const allSourceText = sourcePackets.map((s) => s.extractedText).join(" ");

  // 1. Deadline sourceUrl grounding
  for (const dl of output.facts.deadlines) {
    if (!sourceUrlSet.has(dl.sourceUrl)) {
      issues.push(`Deadline "${dl.label}" references unknown sourceUrl: ${dl.sourceUrl}`);
    }
  }

  // 2. Deadline date grounding
  for (const dl of output.facts.deadlines) {
    if (dl.dateISO && dl.dateISO.length > 0) {
      const dateStr = dl.dateISO;
      const parts = dateStr.split("-");
      const hasExact = allSourceText.includes(dateStr);
      const hasYM = parts.length >= 2 && allSourceText.includes(`${parts[0]}-${parts[1]}`);
      const hasY = parts.length >= 1 && allSourceText.includes(parts[0]!);
      if (!hasExact && !hasYM && !hasY) {
        issues.push(`Deadline date "${dateStr}" for "${dl.label}" not found in source text`);
      }
    }
  }

  // 3. Citation count by series
  const citCount = output.citations.length;
  const needsTwo = ["StudyAbroad", "Career", "HaitiHistory", "HaitianOfTheWeek"];
  const needsOne = ["ScholarshipRadar", "HaitiFactOfTheDay", "HaitiEducationCalendar"];

  if (needsTwo.includes(series) && citCount < 2) {
    issues.push(`${series} requires at least 2 citations, got ${citCount}`);
  } else if (needsOne.includes(series) && citCount < 1) {
    issues.push(`${series} requires at least 1 citation, got ${citCount}`);
  }

  // At least one citation must match a source URL
  const hasOfficial = output.citations.some((c) => sourceUrlSet.has(c.url));
  if (!hasOfficial) {
    issues.push("No citation URL matches a provided source URL");
  }

  // 4. Section checks
  if (output.sections_fr.length === 0) issues.push("No French sections generated");
  if (output.sections_ht.length === 0) issues.push("No Haitian Creole sections generated");

  // 5. Speculation marker detection
  const allText = [
    output.title_fr, output.summary_fr,
    ...output.sections_fr.map((s) => s.content),
    output.title_ht, output.summary_ht,
    ...output.sections_ht.map((s) => s.content),
  ].join(" ").toLowerCase();

  for (const marker of SPECULATION_MARKERS) {
    if (allText.includes(marker)) {
      issues.push(`Speculation marker found: "${marker}"`);
    }
  }

  // 5b. "À confirmer" placeholder detection — sources returned no real content
  const confirmCount =
    (allText.match(/[àa] confirmer/gi)?.length ?? 0) +
    (allText.match(/pou konfime/gi)?.length ?? 0);
  if (confirmCount >= 3) {
    issues.push(
      `Excessive placeholder content: ${confirmCount}× "à confirmer" — sources likely returned no usable text`,
    );
  }

  // 6. Allowlist domain enforcement
  if (allowlistDomains && allowlistDomains.length > 0) {
    const domainSet = new Set(allowlistDomains.map((d) => d.toLowerCase()));
    for (const cit of output.citations) {
      try {
        const citDomain = new URL(cit.url).hostname.replace(/^www\./, "").toLowerCase();
        const isAllowed = [...domainSet].some(
          (d) => citDomain === d || citDomain.endsWith(`.${d}`),
        );
        if (!isAllowed) {
          issues.push(`Citation "${cit.label}" uses non-allowlisted domain: ${citDomain}`);
        }
      } catch {
        issues.push(`Citation "${cit.label}" has invalid URL: ${cit.url}`);
      }
    }
  }

  const hasCritical = issues.some(
    (i) =>
      i.includes("No French") ||
      i.includes("No Haitian") ||
      i.includes("references unknown sourceUrl") ||
      i.includes("Speculation marker") ||
      i.includes("Excessive placeholder content"),
  );

  // 7. HaitiEducationCalendar strict validation
  if (series === "HaitiEducationCalendar") {
    // Require at least 1 citation from an official domain (priority >= 100 → tracked via allowlistDomains)
    const officialDomains = new Set(["menfp.gouv.ht", "ueh.edu.ht"]);
    const hasOfficialCitation = output.citations.some((c) => {
      try {
        const citDomain = new URL(c.url).hostname.replace(/^www\./, "").toLowerCase();
        return [...officialDomains].some(
          (d) => citDomain === d || citDomain.endsWith(`.${d}`),
        );
      } catch {
        return false;
      }
    });
    if (!hasOfficialCitation) {
      issues.push("HaitiEducationCalendar: no citation from an official domain (menfp.gouv.ht or ueh.edu.ht)");
    }

    // Every deadline with a dateISO must have a sourceUrl in the allowlist
    if (allowlistDomains && allowlistDomains.length > 0) {
      const dlDomainSet = new Set(allowlistDomains.map((d) => d.toLowerCase()));
      for (const dl of output.facts.deadlines) {
        if (dl.dateISO && dl.dateISO.length > 0) {
          try {
            const dlDomain = new URL(dl.sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
            const dlAllowed = [...dlDomainSet].some(
              (d) => dlDomain === d || dlDomain.endsWith(`.${d}`),
            );
            if (!dlAllowed) {
              issues.push(`Calendar deadline "${dl.label}" sourceUrl domain not in allowlist: ${dlDomain}`);
            }
          } catch {
            issues.push(`Calendar deadline "${dl.label}" has invalid sourceUrl: ${dl.sourceUrl}`);
          }
        }
      }
    }
  }

  return { passed: !hasCritical && issues.length === 0, issues };
}

export { type UtilitySeries } from "@edlight-news/types";
