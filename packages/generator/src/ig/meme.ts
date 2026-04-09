/**
 * @edlight-news/generator – IG Meme Generator
 *
 * Generates Litquidity-style meme slides for IG carousels using Gemini.
 * Picks the best meme template for an article and writes punchy, relatable
 * captions aimed at Haitian students.
 *
 * Rules:
 * - Always student-safe, culturally respectful
 * - Humor targets the SITUATION, never people or groups
 * - Bilingual flavor: French + Kreyòl sprinkles are encouraged
 * - Must be self-contained — funny even without reading the article
 */

import type { Item, IGMemeTemplate, IGMemeSlide, IGMemePanel } from "@edlight-news/types";
import { callLLM } from "../client.js";

// ── Template metadata (helps Gemini pick the right one) ────────────────────

interface TemplateSpec {
  id: IGMemeTemplate;
  /** How many panels this template needs */
  panels: number;
  /** Plain-English description for the prompt */
  description: string;
  /** Which article types this works best for */
  bestFor: string[];
}

const MEME_TEMPLATES: TemplateSpec[] = [
  {
    id: "drake",
    panels: 2,
    description: "Top panel = the bad/boring option the student rejects, bottom panel = the good/exciting option they prefer",
    bestFor: ["scholarship", "opportunity", "news"],
  },
  {
    id: "expanding-brain",
    panels: 4,
    description: "4 tiers from basic to galaxy-brain, each one a more advanced take on the same topic",
    bestFor: ["scholarship", "opportunity", "utility"],
  },
  {
    id: "nobody",
    panels: 2,
    description: "First panel: 'Personne:' (nobody/nothing), Second panel: 'Étudiants haïtiens:' + the relatable reaction",
    bestFor: ["news", "scholarship", "opportunity"],
  },
  {
    id: "starter-pack",
    panels: 4,
    description: "4 items/traits that define the starter pack (e.g., 'Scholarship Application Starter Pack')",
    bestFor: ["scholarship", "opportunity", "utility"],
  },
  {
    id: "two-buttons",
    panels: 2,
    description: "Two equally tempting options the student can't choose between — the classic anxious decision",
    bestFor: ["scholarship", "opportunity"],
  },
  {
    id: "tell-me",
    panels: 2,
    description: "First panel: the setup 'Dis-moi X sans me dire X', Second panel: the punchline",
    bestFor: ["news", "histoire", "utility"],
  },
  {
    id: "distracted",
    panels: 3,
    description: "Panel 1: what you should focus on, Panel 2: the distraction, Panel 3: what you're ignoring. Classic distracted boyfriend.",
    bestFor: ["news", "scholarship"],
  },
  {
    id: "comparison",
    panels: 2,
    description: "Side-by-side 'Attente vs Réalité' or 'Avant vs Après' comparison",
    bestFor: ["histoire", "news", "utility"],
  },
  {
    id: "reaction",
    panels: 2,
    description: "Panel 1: the situation/headline, Panel 2: the emoji + reaction punchline",
    bestFor: ["news", "histoire"],
  },
];

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildMemePrompt(item: Item, igType: string): string {
  const templatesBlock = MEME_TEMPLATES
    .filter((t) => t.bestFor.includes(igType))
    .map((t) => `- "${t.id}" (${t.panels} panels): ${t.description}`)
    .join("\n");

  return `Tu es un meme-lord de la finance étudiante haïtienne — pense Litquidity mais pour les étudiants haïtiens et la diaspora.

ARTICLE:
Titre: ${item.title}
Résumé: ${item.summary}
Type: ${igType}
${item.deadline ? `Date limite: ${item.deadline}` : ""}
${item.geoTag ? `Géo: ${item.geoTag}` : ""}

TEMPLATES DISPONIBLES:
${templatesBlock}

RÈGLES:
1. Choisis LE template le plus drôle pour cet article.
2. Écris des textes COURTS (max 60 caractères par panel). Punchy. Instagrammable.
3. Le meme doit être COMPRÉHENSIBLE seul, sans lire l'article.
4. L'humour cible la SITUATION, jamais des personnes ou groupes ethniques.
5. Mélange français + kreyòl ayisyen pour la saveur (ex: "Lè w jwenn bous la" ou "Mon CV après 3h du mat").
6. Ajoute un emoji pertinent par panel.
7. Le ton doit être: witty (malin), wholesome (positif), ironic (ironique), ou hype (excité). Choisis celui qui colle le mieux.
8. Ajoute un topicLine court (max 50 chars) qui introduit le meme — comme un petit titre au-dessus.

RÉPONDS UNIQUEMENT en JSON valide:
{
  "template": "le-template-id",
  "topicLine": "Quand tu cherches une bourse...",
  "tone": "witty",
  "panels": [
    { "text": "texte panel 1", "emoji": "😅" },
    { "text": "texte panel 2", "emoji": "🔥" }
  ]
}`;
}

// ── Validation ──────────────────────────────────────────────────────────────

const VALID_TEMPLATES = new Set<string>(MEME_TEMPLATES.map((t) => t.id));
const VALID_TONES = new Set(["witty", "wholesome", "ironic", "hype"]);

/**
 * Light safety check — block anything obviously problematic.
 * Not a full moderation pass, but catches the worst.
 */
function isMemeTextSafe(text: string): boolean {
  const lower = text.toLowerCase();
  const blocklist = [
    "voodoo", "vodou", "zombie", "cannibal", "boat people", "shithole",
    "nègre", "nigger", "retard", "bordel", "putain", "merde",
  ];
  return !blocklist.some((word) => lower.includes(word));
}

function validateMemeOutput(raw: unknown): IGMemeSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Check template
  if (typeof obj.template !== "string" || !VALID_TEMPLATES.has(obj.template)) return null;

  // Check tone
  if (typeof obj.tone !== "string" || !VALID_TONES.has(obj.tone)) return null;

  // Check panels
  if (!Array.isArray(obj.panels) || obj.panels.length < 2 || obj.panels.length > 4) return null;

  const panels: IGMemePanel[] = [];
  for (const p of obj.panels) {
    if (!p || typeof p !== "object") return null;
    const panel = p as Record<string, unknown>;
    if (typeof panel.text !== "string" || panel.text.length === 0) return null;
    if (panel.text.length > 100) return null; // Too long for a meme
    if (!isMemeTextSafe(panel.text)) return null;
    panels.push({
      text: panel.text,
      emoji: typeof panel.emoji === "string" ? panel.emoji : undefined,
    });
  }

  // Validate panel count matches template expectation
  const spec = MEME_TEMPLATES.find((t) => t.id === obj.template);
  if (spec && panels.length !== spec.panels) return null;

  const topicLine =
    typeof obj.topicLine === "string" && obj.topicLine.length <= 80
      ? obj.topicLine
      : undefined;

  if (topicLine && !isMemeTextSafe(topicLine)) return null;

  return {
    template: obj.template as IGMemeTemplate,
    panels,
    topicLine,
    tone: obj.tone as IGMemeSlide["tone"],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface GenerateMemeResult {
  success: true;
  meme: IGMemeSlide;
}

export interface GenerateMemeError {
  success: false;
  error: string;
}

/**
 * Generate a Litquidity-style meme slide for an article.
 *
 * Uses Gemini to pick the best template + write punchy panel texts.
 * Returns null-safe: if AI fails or outputs unsafe content, returns an error
 * and the pipeline continues without a meme (graceful degradation).
 */
export async function generateMemeSlide(
  item: Item,
  igType: string,
): Promise<GenerateMemeResult | GenerateMemeError> {
  try {
    const prompt = buildMemePrompt(item, igType);
    const raw = await callLLM(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, error: "Gemini meme response is not valid JSON" };
    }

    const meme = validateMemeOutput(parsed);
    if (!meme) {
      return { success: false, error: "Meme output failed validation or safety check" };
    }

    return { success: true, meme };
  } catch (err) {
    return {
      success: false,
      error: `Meme generation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check whether an article is a good candidate for a meme.
 * Memes work best on relatable, high-engagement topics.
 */
export function isMemeWorthy(item: Item, igType: string): boolean {
  // Always worth trying for scholarships and opportunities (high engagement)
  if (igType === "scholarship" || igType === "opportunity") return true;

  // News: only if it has strong Haiti relevance or audience fit
  if (igType === "news") {
    const hasHaitiGeo = item.geoTag === "HT" || item.geoTag === "Diaspora";
    const hasAudienceFit = (item.audienceFitScore ?? 0) >= 0.7;
    return hasHaitiGeo || hasAudienceFit;
  }

  // Histoire: good for nostalgic/cultural memes
  if (igType === "histoire") return true;

  // Utility: only if it's a practical student topic
  if (igType === "utility") {
    const studentKeywords = ["bourse", "visa", "inscription", "admission", "campus", "cv", "stage"];
    const title = item.title.toLowerCase();
    return studentKeywords.some((kw) => title.includes(kw));
  }

  return false;
}

/**
 * Get the list of available meme templates (for testing/debugging).
 */
export function getMemeTemplates(): readonly TemplateSpec[] {
  return MEME_TEMPLATES;
}
