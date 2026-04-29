/**
 * Haiti History Daily Publisher
 *
 * Runs once per tick, at ~07:10 Haiti time (UTC-5).
 * Picks today's MM-DD, fetches almanac entries + holiday, produces a single
 * published item with FR + HT content versions.
 *
 * Content is TEMPLATE-BASED from curated structured fields — no LLM invention.
 * HT translations use existing seed data (name_ht / description_ht).
 *
 * All facts must originate from the haiti_history_almanac & haiti_holidays
 * collections, which are seeded from verified sources.
 */

import {
  haitiHistoryAlmanacRepo,
  haitiHistoryAlmanacRawRepo,
  haitiHolidaysRepo,
  historyPublishLogRepo,
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import { callGemini, formatContentVersion } from "@edlight-news/generator";
import type {
  HaitiHistoryAlmanacEntry,
  HaitiHistoryAlmanacRaw,
  HaitiHoliday,
  ContentLanguage,
  QualityFlags,
} from "@edlight-news/types";
import {
  validateHistoryContent,
  validateHistorySources,
  attemptYearFallback,
} from "../validation/historyValidation.js";
import { isHighConfidenceSourceType } from "../historySources/historySourceRegistry.js";
import { generateCustomImage } from "./geminiImageGen.js";
import { resolveHistoryIllustration } from "./historyIllustrationResolver.js";

// ── Config ──────────────────────────────────────────────────────────────────

const HAITI_TZ = "America/Port-au-Prince";

/**
 * Compute the current UTC offset for Haiti dynamically.
 * Haiti observes US Eastern time rules (EST = UTC-5, EDT = UTC-4).
 * Returns the offset in hours (negative = behind UTC, e.g. -4 for EDT, -5 for EST).
 */
function getHaitiOffsetHours(date: Date = new Date()): number {
  const haitiHour = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: HAITI_TZ, hour: "2-digit", hour12: false }).format(date),
    10,
  );
  const utcHour = date.getUTCHours();
  let diff = haitiHour - utcHour; // negative = behind UTC (-4 for EDT)
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

/** Only publish once per day — skip if log already says "published". */
const PUBLISH_HOUR_MIN = 6;
const PUBLISH_HOUR_MAX = 23;

/** Maximum almanac entries to include in one daily post. */
const MAX_ENTRIES_PER_POST = 3;

/** Maximum raw verified events per day (multi-event format). */
const MAX_RAW_EVENTS_PER_DAY = 5;

/** LLM-rewrite: primary event word target. */
const PRIMARY_WORD_TARGET = 500; // 400-600 words

/** LLM-rewrite: secondary event word target. */
const SECONDARY_WORD_TARGET = 135; // 120-150 words

/** Minimum illustration confidence to propagate to published content. */
const MIN_ILLUSTRATION_CONFIDENCE = 0.55;

/** Section with optional image data. */
interface RichSection {
  heading: string;
  content: string;
  imageUrl?: string;
  imageCaption?: string;
  imageCredit?: string;
}

/** Pick the best illustration from a set of almanac entries. */
function pickBestIllustration(
  entries: HaitiHistoryAlmanacEntry[],
): HaitiHistoryAlmanacEntry["illustration"] | null {
  let best: HaitiHistoryAlmanacEntry["illustration"] | null = null;
  let bestConf = -1;
  for (const e of entries) {
    const ill = e.illustration;
    if (!ill?.imageUrl) continue;
    const conf = ill.confidence ?? 0;
    if (conf >= MIN_ILLUSTRATION_CONFIDENCE && conf > bestConf) {
      best = ill;
      bestConf = conf;
    }
  }
  return best;
}

/** Build image credit string from illustration metadata. */
function buildImageCredit(ill: NonNullable<HaitiHistoryAlmanacEntry["illustration"]>): string {
  const parts: string[] = [];
  if (ill.author) parts.push(ill.author);
  if (ill.provider === "wikimedia_commons") parts.push("Wikimedia Commons");
  if (ill.license) parts.push(ill.license);
  return parts.length > 0 ? parts.join(" · ") : "";
}

// ── AI Editorial Illustration ───────────────────────────────────────────────

/** Infer the historical era label from a year for period-accurate visuals. */
function inferEra(year: number | null | undefined): string {
  if (!year) return "historical Haiti";
  if (year < 1804) return "colonial-era / revolutionary Haiti (Saint-Domingue)";
  if (year < 1850) return "early independent Haiti, post-revolution (early 19th century)";
  if (year < 1900) return "19th-century Haiti, era of political upheaval and nation-building";
  if (year < 1960) return "early-to-mid 20th century Haiti, era of modernization";
  if (year < 2000) return "late 20th century Haiti, era of political transition and democracy";
  return "modern-day Haiti (21st century)";
}

/**
 * Build a rich editorial cartoon prompt from almanac entries.
 *
 * Style: Bold editorial illustration like The New Yorker, The Economist,
 * or Time magazine covers. Cartoon-style people are encouraged — it is
 * fine to depict historical figures as stylised illustrated characters.
 */
function buildHistoryImagePrompt(entries: HaitiHistoryAlmanacEntry[]): string {
  const hero = entries[0];
  if (!hero) return "A bold editorial cartoon about Haitian history in the style of The New Yorker.";

  const year = hero.year ?? null;
  const era = inferEra(year);

  // Build rich context for the hero event
  const heroLines: string[] = [
    `MAIN EVENT: "${hero.title_fr}"${year ? ` (year ${year})` : ""}`,
  ];
  if (hero.summary_fr) {
    heroLines.push(`WHAT HAPPENED: ${hero.summary_fr}`);
  }
  if (hero.student_takeaway_fr) {
    heroLines.push(`WHY IT MATTERS: ${hero.student_takeaway_fr}`);
  }

  // Secondary events as brief context
  const others = entries.slice(1, 3);
  const otherLines = others.length > 0
    ? ["", "Also on this day:", ...others.map((e) => `• ${e.title_fr}${e.year ? ` (${e.year})` : ""}`)]
    : [];

  return [
    `Create a bold editorial cartoon illustration of this Haitian historical event.`,
    ``,
    ...heroLines,
    ...otherLines,
    ``,
    `ERA: ${era}`,
    ``,
    `ART DIRECTION:`,
    `- STYLE: Bold, graphic editorial cartoon — like a cover of The New Yorker, The Economist, or Time magazine. Strong outlines, flat bold colours, confident ink-work, slight stylisation. NOT photorealistic, NOT a painting, NOT a textbook illustration.`,
    `- PEOPLE: Draw the historical figures as stylised cartoon characters with expressive faces, period-accurate clothing for ${year ? `${year}` : "the era"}, and dynamic poses that tell the story. Show them front-facing and recognisable as characters (it is perfectly fine to depict people as cartoons).`,
    `- SCENE: Depict the SPECIFIC event described above — the action, the drama, the moment. NOT generic Caribbean scenery. Include setting details appropriate to ${year ? `Haiti in ${year}` : "the era"} (architecture, landscape, objects).`,
    `- COMPOSITION: Strong focal point, dramatic angle, clear visual storytelling. The viewer should immediately understand what is happening.`,
    `- COLOUR: Rich, saturated editorial palette — warm Caribbean tones (golden yellows, deep ocean blues, lush greens, sunset oranges) with bold contrast. Colours should pop.`,
    `- MOOD: Dramatic, dignified, engaging — appropriate for an educational publication aimed at students.`,
    ``,
    `STRICT RULES:`,
    `- The illustration MUST clearly depict the specific event described, not be generic`,
    `- NO text, NO words, NO letters, NO numbers anywhere in the image`,
    `- Portrait orientation (4:5 aspect ratio)`,
    `- Clean, professional, publication-ready quality`,
  ].join("\n");
}

/**
 * Ensure an AI editorial illustration exists for the given almanac entries.
 * Returns the illustration metadata (existing or freshly generated).
 * Falls back gracefully — never blocks publishing.
 */
async function ensureHistoryIllustration(
  monthDay: string,
  entries: HaitiHistoryAlmanacEntry[],
  existingIllustration?: HaitiHistoryAlmanacEntry["illustration"] | null,
): Promise<{ imageUrl: string; imageSource: "gemini_ai" | "wikidata"; confidence: number; attribution?: { name?: string; url?: string; license?: string } } | null> {
  // If the first entry already has a gemini_ai illustration, reuse it
  if (existingIllustration?.provider === "gemini_ai" && existingIllustration.imageUrl) {
    return {
      imageUrl: existingIllustration.imageUrl,
      imageSource: "gemini_ai",
      confidence: existingIllustration.confidence ?? 0.85,
    };
  }

  // Generate new AI illustration
  try {
    const prompt = buildHistoryImagePrompt(entries);
    const storagePath = `histoire/illustrations/${monthDay}.png`;
    const url = await generateCustomImage(prompt, storagePath);

    if (!url) {
      console.warn(`[history-publisher] AI illustration generation failed for ${monthDay}, falling back`);
      return null;
    }

    // Persist illustration metadata on the first almanac entry
    const firstEntry = entries[0];
    if (firstEntry) {
      try {
        await haitiHistoryAlmanacRepo.update(firstEntry.id, {
          illustration: {
            imageUrl: url,
            pageUrl: url,
            provider: "gemini_ai" as const,
            confidence: 0.85,
          },
        } as Partial<typeof firstEntry>);
      } catch (updateErr) {
        console.warn(`[history-publisher] Could not persist illustration metadata: ${updateErr}`);
      }
    }

    console.log(`[history-publisher] ✓ AI illustration generated for ${monthDay}`);
    return {
      imageUrl: url,
      imageSource: "gemini_ai",
      confidence: 0.85,
    };
  } catch (err) {
    console.error(`[history-publisher] AI illustration error for ${monthDay}:`, err);
    return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getHaitiNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + getHaitiOffsetHours(utc) * 60 * 60 * 1000);
}

function getTodayMonthDay(): string {
  const d = getHaitiNow();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function getTodayISO(): string {
  const d = getHaitiNow();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ── Content templates ───────────────────────────────────────────────────────

function buildFrenchBody(
  entries: HaitiHistoryAlmanacEntry[],
  holidays: HaitiHoliday[],
  monthDay: string,
): { title: string; summary: string; body: string; sections: RichSection[] } {
  const [mm, dd] = monthDay.split("-");
  const dateLabel = `${dd}/${mm}`;

  const sections: RichSection[] = [];

  // Holiday section
  if (holidays.length > 0) {
    const holidayTexts = holidays.map((h) => {
      let text = `**${h.name_fr}**`;
      if (h.description_fr) text += ` — ${h.description_fr}`;
      if (h.isNationalHoliday) text += " 🇭🇹 *(Fête nationale)*";
      return text;
    });
    sections.push({
      heading: "🎉 Fèt du jour",
      content: holidayTexts.join("\n\n"),
    });
  }

  // History entries
  for (const entry of entries) {
    const yearLabel = entry.year ? ` (${entry.year})` : "";
    let content = entry.summary_fr;
    if (entry.student_takeaway_fr) {
      content += `\n\n💡 **Pour les étudiants :** ${entry.student_takeaway_fr}`;
    }
    if (entry.sources && entry.sources.length > 0) {
      const sourceLinks = entry.sources.map((s) => `[${s.label}](${s.url})`).join(" · ");
      content += `\n\n📚 Sources : ${sourceLinks}`;
    }
    // Attach illustration if available and confident enough
    const ill = entry.illustration;
    const hasIll = !!ill?.imageUrl && (ill.confidence ?? 0) >= MIN_ILLUSTRATION_CONFIDENCE;
    sections.push({
      heading: `${entry.title_fr}${yearLabel}`,
      content,
      ...(hasIll && ill ? {
        imageUrl: ill.imageUrl,
        imageCaption: ill.pageTitle ?? entry.title_fr,
        imageCredit: buildImageCredit(ill),
      } : {}),
    });
  }

  const title = holidays.length > 0
    ? `${dateLabel} — ${holidays[0]!.name_fr} & Histoire du jour`
    : `${dateLabel} — Histoire d'Haïti du jour`;

  const summary = entries.length > 0
    ? firstCompleteSentence(entries[0]!.summary_fr, 200)
    : holidays.length > 0
      ? (holidays[0]!.description_fr ?? holidays[0]!.name_fr)
      : `Découvrez ce qui s'est passé un ${dateLabel} dans l'histoire d'Haïti.`;

  const body = sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");

  return { title, summary, body, sections };
}

// ── Lightweight FR → Haitian Creole adaptation ──────────────────────────────
// The curated almanac only stores French text. Rather than serving identical
// FR text labeled as HT, we apply common FR→HT word substitutions. This is
// not full translation but produces visibly distinct Creole output.
const FR_HT_SUBS: [RegExp, string][] = [
  // Common articles / prepositions
  [/\bLe\b/g, "Le"], // keep proper nouns
  [/\bles\b/g, "yo"],
  [/\bdes\b/g, "nan"],
  [/\bdu\b/g, "nan"],
  [/\bde la\b/g, "nan"],
  [/\bd'Haïti\b/g, "Ayiti"],
  [/\bHaïti\b/g, "Ayiti"],
  [/\bhaïtien(ne)?s?\b/gi, "ayisyen"],
  // Common verbs
  [/\best\b/g, "se"],
  [/\bétait\b/g, "te"],
  [/\ba été\b/g, "te"],
  [/\bfut\b/g, "te"],
  [/\bsont\b/g, "se"],
  [/\bétaient\b/g, "te"],
  [/\bont été\b/g, "te"],
  // Key words
  [/\bhistoire\b/gi, "istwa"],
  [/\bprésiden(t|ce)\b/gi, "prezidan"],
  [/\bgouvernement\b/gi, "gouvènman"],
  [/\bindépendance\b/gi, "endepandans"],
  [/\brépublique\b/gi, "repiblik"],
  [/\bconstitution\b/gi, "konstitisyon"],
  [/\bpeuple\b/gi, "pèp"],
  [/\bpays\b/gi, "peyi"],
  [/\bvictoire\b/gi, "viktwa"],
  [/\bbataille\b/gi, "batay"],
  [/\barmée\b/gi, "lame"],
  [/\bgénéral\b/gi, "jeneral"],
  [/\bsoldats?\b/gi, "sòlda"],
  [/\bliberté\b/gi, "libète"],
  [/\besclavage\b/gi, "esklavaj"],
  [/\brévolution\b/gi, "revolisyon"],
  [/\bélection\b/gi, "eleksyon"],
  [/\béducation\b/gi, "edikasyon"],
  [/\buniversité\b/gi, "inivèsite"],
  [/\bétudiant(e)?s?\b/gi, "etidyan"],
  [/\bécole\b/gi, "lekòl"],
  [/\bPour les étudiants\b/gi, "Pou etidyan yo"],
  [/\bSources\b/g, "Sous"],
  // Connectors
  [/\bcependant\b/gi, "sepandan"],
  [/\bégalement\b/gi, "tou"],
  [/\bainsi que\b/gi, "ansanm ak"],
  [/\bnotamment\b/gi, "sitou"],
  [/\baujourd'hui\b/gi, "jodi a"],
];

/**
 * Return the first complete sentence(s) from `text` up to `maxChars`.
 * Falls back to a word-boundary cut if no sentence boundary is found.
 */
function firstCompleteSentence(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  // Find the last sentence-ending punctuation within the limit.
  const window = trimmed.slice(0, maxChars);
  const lastEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf(".\n"),
  );
  if (lastEnd > 20) return trimmed.slice(0, lastEnd + 1).trim();
  // No sentence boundary — cut at last word.
  const lastSpace = window.lastIndexOf(" ");
  return (lastSpace > 20 ? window.slice(0, lastSpace) : window).trim();
}

function lightCreoleAdapt(frenchText: string): string {
  let text = frenchText;
  for (const [re, replacement] of FR_HT_SUBS) {
    text = text.replace(re, replacement);
  }
  return text;
}

function buildCreoleBody(
  entries: HaitiHistoryAlmanacEntry[],
  holidays: HaitiHoliday[],
  monthDay: string,
): { title: string; summary: string; body: string; sections: RichSection[] } {
  const [mm, dd] = monthDay.split("-");
  const dateLabel = `${dd}/${mm}`;

  const sections: RichSection[] = [];

  // Holiday section in Creole
  if (holidays.length > 0) {
    const holidayTexts = holidays.map((h) => {
      let text = `**${h.name_ht}**`;
      if (h.description_ht) text += ` — ${h.description_ht}`;
      if (h.isNationalHoliday) text += " 🇭🇹 *(Fèt nasyonal)*";
      return text;
    });
    sections.push({
      heading: "🎉 Fèt jou a",
      content: holidayTexts.join("\n\n"),
    });
  }

  // History entries — apply lightweight FR→HT adaptation
  for (const entry of entries) {
    const yearLabel = entry.year ? ` (${entry.year})` : "";
    let content = lightCreoleAdapt(entry.summary_fr);
    if (entry.student_takeaway_fr) {
      content += `\n\n💡 **Pou etidyan yo :** ${lightCreoleAdapt(entry.student_takeaway_fr)}`;
    }
    if (entry.sources && entry.sources.length > 0) {
      const sourceLinks = entry.sources.map((s) => `[${s.label}](${s.url})`).join(" · ");
      content += `\n\n📚 Sous : ${sourceLinks}`;
    }
    // Attach illustration if available and confident enough
    const ill = entry.illustration;
    const hasIll = !!ill?.imageUrl && (ill.confidence ?? 0) >= MIN_ILLUSTRATION_CONFIDENCE;
    sections.push({
      heading: `${lightCreoleAdapt(entry.title_fr)}${yearLabel}`,
      content,
      ...(hasIll && ill ? {
        imageUrl: ill.imageUrl,
        imageCaption: ill.pageTitle ?? entry.title_fr,
        imageCredit: buildImageCredit(ill),
      } : {}),
    });
  }

  const title = holidays.length > 0
    ? `${dateLabel} — ${holidays[0]!.name_ht} & Istwa jou a`
    : `${dateLabel} — Istwa Ayiti jou a`;

  const summary = holidays.length > 0
    ? (holidays[0]!.description_ht ?? holidays[0]!.name_ht)
    : `Dekouvri sa ki te pase yon ${dateLabel} nan istwa Ayiti.`;

  const body = sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");

  return { title, summary, body, sections };
}

// ── LLM Narrative Rewrite (from verified raw entries) ───────────────────────

/** Prompt for a single primary event — 400-600 word narrative with discussion. */
function buildPrimaryEventPrompt(entry: HaitiHistoryAlmanacRaw, monthDay: string): string {
  return `Tu es historien spécialisé en histoire d'Haïti et rédacteur pour EdLight News, une plateforme éducative pour les étudiants haïtiens.

FAIT VÉRIFIÉ:
- Date : ${monthDay} (année ${entry.year})
- Titre : ${entry.title}
- Résumé : ${entry.shortSummary}
- Catégorie : ${entry.category}
- Source : ${entry.sourcePrimary.name} (${entry.sourcePrimary.url})${entry.sourceSecondary ? `\n- Source secondaire : ${entry.sourceSecondary.name} (${entry.sourceSecondary.url})` : ""}

CONSIGNES STRICTES :
1. Rédige un article narratif de 400 à 600 mots en FRANÇAIS sur cet événement historique.
2. NE JAMAIS inventer de faits. Utilise UNIQUEMENT les informations fournies ci-dessus.
3. Structure :
   a) Introduction contextuelle (1 paragraphe)
   b) Développement historique (2-3 paragraphes)
   c) Section "**Pourquoi cela compte**" — impact sur l'histoire haïtienne (1 paragraphe)
   d) "**Questions pour la discussion**" — exactement 2 questions ouvertes pour les étudiants
4. L'année DOIT être ${entry.year}. Ne mentionne AUCUNE autre année comme date de l'événement.
5. Mentionne la source dans le texte.

RÉPONDS UNIQUEMENT en JSON valide :
{
  "title_fr": "Titre captivant en français (max 120 caractères)",
  "body_fr": "Corps complet en markdown (400-600 mots)",
  "title_ht": "Tit an kreyòl ayisyen",
  "body_ht": "Kò atik la an kreyòl (tradis fidèl du français)",
  "year_mentioned": ${entry.year}
}`;
}

/** Prompt for secondary events — 120-150 word summaries. */
function buildSecondaryEventsPrompt(entries: HaitiHistoryAlmanacRaw[], monthDay: string): string {
  const entriesBlock = entries
    .map(
      (e, i) =>
        `${i + 1}. [${e.year}] ${e.title} — ${e.shortSummary} (Source: ${e.sourcePrimary.name})`,
    )
    .join("\n");

  return `Tu es historien spécialisé en histoire d'Haïti et rédacteur pour EdLight News.

FAITS VÉRIFIÉS pour le ${monthDay} :
${entriesBlock}

CONSIGNES :
1. Pour CHAQUE fait ci-dessus, rédige un résumé narratif de 80 à 120 mots en FRANÇAIS.
2. NE JAMAIS inventer de faits. Utilise UNIQUEMENT les informations fournies.
3. Inclus l'année correcte de chaque événement.
4. Chaque phrase doit être complète — ne jamais couper une phrase à mi-chemin.
5. Donne aussi la version en KREYÒL AYISYEN.

RÉPONDS en JSON valide :
{
  "events": [
    {
      "title_fr": "Titre court",
      "summary_fr": "Résumé 80-120 mots (phrases complètes uniquement)",
      "title_ht": "Tit an kreyòl",
      "summary_ht": "Rezime 80-120 mo (fraz konplè sèlman)",
      "year_mentioned": 1804
    }
  ]
}`;
}

interface LLMPrimaryResult {
  title_fr: string;
  body_fr: string;
  title_ht: string;
  body_ht: string;
  year_mentioned: number;
}

interface LLMSecondaryEvent {
  title_fr: string;
  summary_fr: string;
  title_ht: string;
  summary_ht: string;
  year_mentioned: number;
}

interface LLMSecondaryResult {
  events: LLMSecondaryEvent[];
}

/** Year consistency guard: reject if LLM output year ≠ input year. */
function validateYearConsistency(expected: number, mentioned: number): boolean {
  return expected === mentioned;
}

/**
 * Select the primary event (most institutionally important):
 *  Priority: government > academic > institutional > press > reference
 *  Tie-breaker: oldest year first (more historically significant).
 */
function selectPrimaryEvent(entries: HaitiHistoryAlmanacRaw[]): HaitiHistoryAlmanacRaw {
  const priorityOrder: Record<string, number> = {
    government: 0,
    academic: 1,
    institutional: 2,
    press: 3,
    reference: 4,
  };

  const sorted = [...entries].sort((a, b) => {
    const pa = priorityOrder[a.sourceType] ?? 5;
    const pb = priorityOrder[b.sourceType] ?? 5;
    if (pa !== pb) return pa - pb;
    // Prefer high-confidence categories
    if (isHighConfidenceSourceType(a.sourceType) && !isHighConfidenceSourceType(b.sourceType))
      return -1;
    if (!isHighConfidenceSourceType(a.sourceType) && isHighConfidenceSourceType(b.sourceType))
      return 1;
    // Older events first
    return a.year - b.year;
  });

  return sorted[0]!;
}

/**
 * Build multi-event content from verified raw entries using LLM rewrite.
 * Returns null if LLM call fails or year-consistency check fails.
 */
async function buildRawVerifiedContent(
  verifiedEntries: HaitiHistoryAlmanacRaw[],
  holidays: HaitiHoliday[],
  monthDay: string,
): Promise<{
  frContent: { title: string; summary: string; body: string; sections: { heading: string; content: string }[] };
  htContent: { title: string; summary: string; body: string; sections: { heading: string; content: string }[] };
  citations: { sourceName: string; sourceUrl: string }[];
  usedEntryIds: string[];
} | null> {
  const [mm, dd] = monthDay.split("-");
  const dateLabel = `${dd}/${mm}`;

  // Select primary + secondaries
  const primary = selectPrimaryEvent(verifiedEntries);
  const secondaries = verifiedEntries
    .filter((e) => e.id !== primary.id)
    .slice(0, MAX_RAW_EVENTS_PER_DAY - 1);

  // ── LLM rewrite for primary event ──────────────────────────────────────
  let primaryResult: LLMPrimaryResult;
  try {
    const primaryPrompt = buildPrimaryEventPrompt(primary, monthDay);
    const rawResponse = await callGemini(primaryPrompt);
    primaryResult = JSON.parse(rawResponse) as LLMPrimaryResult;
  } catch (err) {
    console.error(
      `[history-publisher] LLM rewrite failed for primary event "${primary.title}":`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  // Year consistency guard
  if (!validateYearConsistency(primary.year, primaryResult.year_mentioned)) {
    console.error(
      `[history-publisher] Year mismatch in LLM output: expected=${primary.year}, got=${primaryResult.year_mentioned}`,
    );
    return null;
  }

  // ── LLM rewrite for secondary events ───────────────────────────────────
  let secondaryResults: LLMSecondaryEvent[] = [];
  if (secondaries.length > 0) {
    try {
      const secondaryPrompt = buildSecondaryEventsPrompt(secondaries, monthDay);
      const rawResponse = await callGemini(secondaryPrompt);
      const parsed = JSON.parse(rawResponse) as LLMSecondaryResult;
      secondaryResults = parsed.events ?? [];
    } catch (err) {
      console.warn(
        `[history-publisher] LLM rewrite failed for secondary events, continuing with primary only:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Filter out year-inconsistent secondaries
    secondaryResults = secondaryResults.filter((result, idx) => {
      const expected = secondaries[idx]?.year;
      if (expected && !validateYearConsistency(expected, result.year_mentioned)) {
        console.warn(
          `[history-publisher] Dropping secondary event (year mismatch): expected=${expected}, got=${result.year_mentioned}`,
        );
        return false;
      }
      return true;
    });
  }

  // ── Build French content ───────────────────────────────────────────────
  const frSections: { heading: string; content: string }[] = [];
  const htSections: { heading: string; content: string }[] = [];

  // Holiday section
  if (holidays.length > 0) {
    const holidayFr = holidays
      .map((h) => {
        let text = `**${h.name_fr}**`;
        if (h.description_fr) text += ` — ${h.description_fr}`;
        if (h.isNationalHoliday) text += " 🇭🇹 *(Fête nationale)*";
        return text;
      })
      .join("\n\n");
    frSections.push({ heading: "🎉 Fèt du jour", content: holidayFr });

    const holidayHt = holidays
      .map((h) => {
        let text = `**${h.name_ht}**`;
        if (h.description_ht) text += ` — ${h.description_ht}`;
        if (h.isNationalHoliday) text += " 🇭🇹 *(Fèt nasyonal)*";
        return text;
      })
      .join("\n\n");
    htSections.push({ heading: "🎉 Fèt jou a", content: holidayHt });
  }

  // Primary event (long-form)
  frSections.push({
    heading: `${primaryResult.title_fr} (${primary.year})`,
    content: primaryResult.body_fr,
  });
  htSections.push({
    heading: `${primaryResult.title_ht} (${primary.year})`,
    content: primaryResult.body_ht,
  });

  // Secondary events section
  if (secondaryResults.length > 0) {
    const secFrContent = secondaryResults
      .map((r) => `### ${r.title_fr}\n\n${r.summary_fr}`)
      .join("\n\n");
    frSections.push({
      heading: "📜 Autres faits du jour",
      content: secFrContent,
    });

    const secHtContent = secondaryResults
      .map((r) => `### ${r.title_ht}\n\n${r.summary_ht}`)
      .join("\n\n");
    htSections.push({
      heading: "📜 Lòt evènman nan jou sa a",
      content: secHtContent,
    });
  }

  // Build complete bodies
  const frTitle = holidays.length > 0
    ? `${dateLabel} — ${holidays[0]!.name_fr} & ${primaryResult.title_fr}`
    : `${dateLabel} — ${primaryResult.title_fr}`;
  const htTitle = holidays.length > 0
    ? `${dateLabel} — ${holidays[0]!.name_ht} & ${primaryResult.title_ht}`
    : `${dateLabel} — ${primaryResult.title_ht}`;

  const frBody = frSections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  const htBody = htSections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");

  const frSummary = firstCompleteSentence(primaryResult.body_fr, 200);
  const htSummary = firstCompleteSentence(primaryResult.body_ht, 200);

  // Collect citations
  const citations: { sourceName: string; sourceUrl: string }[] = [];
  citations.push({ sourceName: primary.sourcePrimary.name, sourceUrl: primary.sourcePrimary.url });
  if (primary.sourceSecondary) {
    citations.push({ sourceName: primary.sourceSecondary.name, sourceUrl: primary.sourceSecondary.url });
  }
  for (const sec of secondaries) {
    citations.push({ sourceName: sec.sourcePrimary.name, sourceUrl: sec.sourcePrimary.url });
  }

  const usedEntryIds = [primary.id, ...secondaries.map((s) => s.id)];

  return {
    frContent: { title: frTitle, summary: frSummary, body: frBody, sections: frSections },
    htContent: { title: htTitle, summary: htSummary, body: htBody, sections: htSections },
    citations,
    usedEntryIds,
  };
}

// ── Shared publish logic ────────────────────────────────────────────────────

interface PublishContentInput {
  dateISO: string;
  monthDay: string;
  frContent: { title: string; summary: string; body: string; sections: RichSection[] };
  htContent: { title: string; summary: string; body: string; sections: RichSection[] };
  citations: { sourceName: string; sourceUrl: string }[];
  entryIds: string[];
  holidayId?: string;
  warnings?: string[];
  source: "raw-verified-llm" | "template";
  /** Best illustration from almanac entries (if any). */
  heroIllustration?: HaitiHistoryAlmanacEntry["illustration"] | null;
  /** Almanac entries — used for AI illustration generation. */
  entries?: HaitiHistoryAlmanacEntry[];
}

async function publishContent(
  input: PublishContentInput,
): Promise<{ published: boolean; skipped: boolean; reason: string; itemId?: string }> {
  const { dateISO, monthDay, frContent, htContent, citations, entryIds, holidayId, warnings, source, heroIllustration, entries: inputEntries } = input;

  const qualityFlags: QualityFlags = {
    hasSourceUrl: true,
    needsReview: false,
    lowConfidence: false,
    reasons: source === "raw-verified-llm" ? ["llm-rewrite-from-raw"] : [],
  };

  // ── Resolve hero image: prefer real archival photo → live Wikimedia lookup → AI cartoon → branded ──
  // Why this order: Gemini text-to-image cartoons are vibes-correct but factually
  // unreliable for specific Haitian historical events. A curated Wikimedia
  // Commons / Wikipedia portrait or engraving of the actual subject is far more
  // accurate and educational. Gemini is reserved as a last resort when no real
  // image can be found.
  let heroImage: { imageUrl: string; imageSource: "gemini_ai" | "wikidata" | "branded"; imageConfidence?: number; imageAttribution?: { name?: string; url?: string; license?: string } };

  // 1) Pre-seeded Wikimedia illustration on the almanac entry (curated/backfilled).
  if (heroIllustration?.imageUrl) {
    heroImage = {
      imageUrl: heroIllustration.imageUrl,
      imageSource: "wikidata",
      imageConfidence: heroIllustration.confidence ?? 0.7,
      imageAttribution: Object.fromEntries(
        Object.entries({
          name: heroIllustration.author,
          url: heroIllustration.pageUrl,
          license: heroIllustration.license,
        }).filter(([, v]) => v !== undefined)
      ) as { name?: string; url?: string; license?: string },
    };
  } else {
    // 2) Live Wikimedia / Wikipedia / curated-override lookup on the hero title.
    const hero = inputEntries?.[0];
    let liveResolved: Awaited<ReturnType<typeof resolveHistoryIllustration>> = null;
    if (hero?.title_fr) {
      try {
        liveResolved = await resolveHistoryIllustration(hero.title_fr, hero.year ?? undefined);
      } catch (err) {
        console.warn(`[history-publisher] live illustration lookup failed for ${hero.title_fr}:`, err);
      }
    }

    if (liveResolved && liveResolved.confidence >= MIN_ILLUSTRATION_CONFIDENCE) {
      heroImage = {
        imageUrl: liveResolved.imageUrl,
        imageSource: "wikidata",
        imageConfidence: liveResolved.confidence,
        imageAttribution: Object.fromEntries(
          Object.entries({
            name: liveResolved.author,
            url: liveResolved.pageUrl,
            license: liveResolved.license,
          }).filter(([, v]) => v !== undefined)
        ) as { name?: string; url?: string; license?: string },
      };
    } else {
      // 3) Last resort: Gemini editorial cartoon. Reuses any cached gemini_ai
      //    illustration via ensureHistoryIllustration's existing-reuse path.
      const aiResult = inputEntries && inputEntries.length > 0
        ? await ensureHistoryIllustration(monthDay, inputEntries, heroIllustration)
        : null;
      if (aiResult) {
        heroImage = {
          imageUrl: aiResult.imageUrl,
          imageSource: "gemini_ai",
          imageConfidence: aiResult.confidence,
          imageAttribution: aiResult.attribution
            ? (Object.fromEntries(
                Object.entries(aiResult.attribution).filter(([, v]) => v !== undefined)
              ) as { name?: string; url?: string; license?: string })
            : undefined,
        };
      } else {
        heroImage = { imageUrl: "", imageSource: "branded" };
      }
    }
  }

  const canonicalUrl = `edlight://histoire/${dateISO}`;
  const { item } = await itemsRepo.upsertItemByCanonicalUrl({
    rawItemId: `history-daily-${dateISO}`,
    sourceId: "haiti-history-almanac",
    title: frContent.title,
    summary: frContent.summary,
    canonicalUrl,
    category: "event",
    deadline: null,
    evergreen: true,
    confidence: source === "raw-verified-llm" ? 0.97 : 0.95,
    qualityFlags,
    citations,
    itemType: "utility" as const,
    utilityMeta: {
      series: "HaitiHistory",
      utilityType: "history",
      region: ["HT"],
      citations: citations.map((c) => ({ label: c.sourceName, url: c.sourceUrl })),
    },
    audienceFitScore: 0.95,
    geoTag: "HT" as const,
    ...(heroImage.imageUrl ? {
      imageUrl: heroImage.imageUrl,
      imageSource: heroImage.imageSource,
      imageConfidence: heroImage.imageConfidence ?? 0.7,
      ...(heroImage.imageAttribution ? { imageAttribution: heroImage.imageAttribution } : {}),
    } : {
      imageSource: "branded" as const,
    }),
  });

  // Create content versions
  for (const lang of ["fr", "ht"] as ContentLanguage[]) {
    const content = lang === "fr" ? frContent : htContent;
    const fmtHist = formatContentVersion({
      lang,
      title: content.title,
      summary: content.summary,
      body: content.body,
      sections: content.sections,
      sourceCitations: citations.map((c) => ({
        name: c.sourceName,
        url: c.sourceUrl,
      })),
      series: "HaitiHistory",
    });
    await contentVersionsRepo.createContentVersion({
      itemId: item.id,
      channel: "web",
      language: lang,
      title: fmtHist.title,
      summary: fmtHist.summary ?? content.summary,
      body: fmtHist.body ?? content.body,
      status: "published",
      category: "event",
      qualityFlags,
      citations,
      sections: fmtHist.sections ?? content.sections,
      sourceCitations: fmtHist.sourceCitations ?? citations.map((c) => ({
        name: c.sourceName,
        url: c.sourceUrl,
      })),
    });
  }

  // Log success
  await historyPublishLogRepo.upsert({
    dateISO,
    publishedItemId: item.id,
    almanacEntryIds: entryIds,
    holidayId,
    status: "done",
    validationWarnings: warnings && warnings.length > 0 ? warnings : undefined,
  });

  console.log(
    `[history-publisher] Published daily history (${source}) for ${monthDay}: item=${item.id}, entries=${entryIds.length}`,
  );

  return { published: true, skipped: false, reason: `Published (${source})`, itemId: item.id };
}

// ── Main publisher ──────────────────────────────────────────────────────────

export async function runHistoryDailyPublisher(): Promise<{
  published: boolean;
  skipped: boolean;
  reason: string;
  itemId?: string;
}> {
  const haitiNow = getHaitiNow();
  const haitiHour = haitiNow.getUTCHours();
  const monthDay = getTodayMonthDay();
  const dateISO = getTodayISO();

  // Gate: only publish during daytime Haiti hours
  if (haitiHour < PUBLISH_HOUR_MIN || haitiHour > PUBLISH_HOUR_MAX) {
    return { published: false, skipped: true, reason: `Outside publish hours (${haitiHour}h Haiti)` };
  }

  // Gate: check if already published today
  const existingLog = await historyPublishLogRepo.getByDate(dateISO);
  if (existingLog?.status === "done") {
    return { published: false, skipped: true, reason: "Already published today", itemId: existingLog.publishedItemId };
  }

  // Fetch today's entries + holidays + verified raw entries
  const [entries, holidays, verifiedRawEntries] = await Promise.all([
    haitiHistoryAlmanacRepo.listByMonthDay(monthDay),
    haitiHolidaysRepo.listByMonthDay(monthDay),
    haitiHistoryAlmanacRawRepo.listVerifiedByMonthDay(monthDay),
  ]);

  // ── NEW: Try LLM-rewrite from verified raw entries first ──────────────
  if (verifiedRawEntries.length > 0) {
    console.log(
      `[history-publisher] Found ${verifiedRawEntries.length} verified raw entries for ${monthDay}, attempting LLM rewrite...`,
    );
    try {
      const rawContent = await buildRawVerifiedContent(
        verifiedRawEntries,
        holidays,
        monthDay,
      );

      if (rawContent) {
        // Validation gate for LLM-generated content
        const validationSources = rawContent.citations.map((c) => ({
          name: c.sourceName,
          url: c.sourceUrl,
        }));
        const contentValidation = validateHistoryContent({
          title: rawContent.frContent.title,
          sections: rawContent.frContent.sections,
          sources: validationSources,
        });
        const sourceValidation = validateHistorySources({
          sources: validationSources,
          confidence: "high",
        });

        const rawErrors = [...contentValidation.errors, ...sourceValidation.errors];
        const rawWarnings = [...contentValidation.warnings, ...sourceValidation.warnings];

        if (rawErrors.length === 0) {
          // Publish LLM-rewritten content
          if (rawWarnings.length > 0) {
            console.warn(
              `[history-publisher] LLM rewrite warnings for ${monthDay}: ${rawWarnings.join("; ")}`,
            );
          }

          return await publishContent({
            dateISO,
            monthDay,
            frContent: rawContent.frContent,
            htContent: rawContent.htContent,
            citations: rawContent.citations,
            entryIds: rawContent.usedEntryIds,
            holidayId: holidays[0]?.id,
            warnings: rawWarnings,
            source: "raw-verified-llm",
            // LLM path uses raw entries which have no illustrations;
            // fall back to curated almanac entries if available.
            heroIllustration: pickBestIllustration(entries),
            entries,
          });
        } else {
          console.warn(
            `[history-publisher] LLM rewrite validation failed for ${monthDay}, falling back to template: ${rawErrors.join("; ")}`,
          );
        }
      }
    } catch (err) {
      console.warn(
        `[history-publisher] LLM rewrite error for ${monthDay}, falling back to template:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ── FALLBACK: Original template-based flow ─────────────────────────────

  if (entries.length === 0 && holidays.length === 0) {
    await historyPublishLogRepo.upsert({
      dateISO,
      almanacEntryIds: [],
      status: "skipped",
      error: `No almanac entries or holidays for ${monthDay}`,
    });
    return { published: false, skipped: true, reason: `No content for ${monthDay}` };
  }

  // Select up to MAX entries (prefer high confidence first)
  const sortedEntries = [...entries]
    .sort((a, b) => {
      if (a.confidence === "high" && b.confidence !== "high") return -1;
      if (a.confidence !== "high" && b.confidence === "high") return 1;
      return 0;
    })
    .slice(0, MAX_ENTRIES_PER_POST);

  try {
    // Build content for both languages
    const frContent = buildFrenchBody(sortedEntries, holidays, monthDay);
    const htContent = buildCreoleBody(sortedEntries, holidays, monthDay);

    // Collect all citations
    const allCitations = sortedEntries.flatMap((e) =>
      e.sources.map((s) => ({ sourceName: s.label, sourceUrl: s.url })),
    );
    if (holidays.length > 0) {
      for (const h of holidays) {
        for (const s of h.sources) {
          allCitations.push({ sourceName: s.label, sourceUrl: s.url });
        }
      }
    }

    // ── Validation gate ───────────────────────────────────────────────────
    const validationSources = allCitations.map((c) => ({ name: c.sourceName, url: c.sourceUrl }));
    const topConfidence = sortedEntries[0]?.confidence;

    let contentResult = validateHistoryContent({
      title: frContent.title,
      sections: frContent.sections,
      sources: validationSources,
    });
    const sourceResult = validateHistorySources({
      sources: validationSources,
      confidence: topConfidence,
    });

    // Merge results
    let allErrors = [...contentResult.errors, ...sourceResult.errors];
    let allWarnings = [...contentResult.warnings, ...sourceResult.warnings];
    let appliedFallback = false;
    let effectiveTitle = frContent.title;

    // Part 5 — Year fallback: if only a year-mismatch error, try removing year from title
    if (allErrors.length > 0) {
      const yearMismatchErrors = contentResult.errors.filter((e) =>
        e.startsWith("Year mismatch between title and body"),
      );
      const nonYearErrors = allErrors.filter(
        (e) => !e.startsWith("Year mismatch between title and body"),
      );

      if (yearMismatchErrors.length === 1 && nonYearErrors.length === 0 && sourceResult.isValid) {
        const fallback = attemptYearFallback({
          title: frContent.title,
          sections: frContent.sections,
          sources: validationSources,
        });

        if (fallback.cleanedTitle) {
          effectiveTitle = fallback.cleanedTitle;
          contentResult = fallback.result;
          allErrors = [...contentResult.errors, ...sourceResult.errors];
          allWarnings = [...contentResult.warnings, ...sourceResult.warnings];
          appliedFallback = true;
          console.warn(
            `[history-publisher] Year fallback applied for ${monthDay}: "${frContent.title}" → "${effectiveTitle}"`,
          );
        }
      }
    }

    // Block publishing on validation errors
    if (allErrors.length > 0) {
      const errorDetail = allErrors.join("; ");
      console.error(
        `[history-publisher] Validation failed for ${monthDay}:\n  Errors: ${allErrors.join("\n  ")}\n  Warnings: ${allWarnings.join("\n  ")}`,
      );
      await historyPublishLogRepo.upsert({
        dateISO,
        almanacEntryIds: sortedEntries.map((e) => e.id),
        holidayId: holidays[0]?.id,
        status: "failed",
        error: `Validation failed: ${errorDetail}`,
        validationErrors: allErrors,
        validationWarnings: allWarnings,
      });
      return { published: false, skipped: false, reason: `Validation failed: ${errorDetail}` };
    }

    // Log warnings (non-blocking)
    if (allWarnings.length > 0) {
      console.warn(
        `[history-publisher] Validation warnings for ${monthDay}: ${allWarnings.join("; ")}`,
      );
    }

    // Apply effective title (may have been cleaned by fallback)
    if (appliedFallback) {
      frContent.title = effectiveTitle;
    }

    return await publishContent({
      dateISO,
      monthDay,
      frContent,
      htContent,
      citations: allCitations,
      entryIds: sortedEntries.map((e) => e.id),
      holidayId: holidays[0]?.id,
      warnings: allWarnings,
      source: "template",
      heroIllustration: pickBestIllustration(sortedEntries),
      entries: sortedEntries,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[history-publisher] Error publishing for ${monthDay}:`, errorMsg);

    await historyPublishLogRepo.upsert({
      dateISO,
      almanacEntryIds: sortedEntries.map((e) => e.id),
      holidayId: holidays[0]?.id,
      status: "failed",
      error: errorMsg,
    });

    return { published: false, skipped: false, reason: errorMsg };
  }
}
