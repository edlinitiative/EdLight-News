/**
 * Cold-start poll-story builder.
 *
 * Produces a single-slide IG Story payload that asks the audience a simple
 * yes/no or A/B question. Designed to drive Story replies (a strong signal
 * to the IG ranking algorithm and a cheap engagement win during the
 * follower-zero phase).
 *
 * Deterministic daily rotation: the same dateKey (Haiti local YYYY-MM-DD)
 * always picks the same template. Operators can preview tomorrow's poll by
 * running this with the future date.
 *
 * No external dependencies — no Firestore writes, no LLM calls. Works
 * offline. Tests can pin the dateKey + topic and assert the exact output.
 *
 * @module buildPollStoryFromTopic
 */

export type PollTopic = "taux" | "scholarship" | "general";

export interface PollTemplate {
  /** Stable template id used for logging + dedup. */
  id: string;
  /** Question text (FR primary, fed into the existing story renderer). */
  questionFr: string;
  /** Optional Haitian Creole variant — falls back to FR when undefined. */
  questionHt?: string;
  /** Two answer choices, max 24 chars each (IG poll-sticker constraint). */
  choices: [string, string];
}

/**
 * Per-topic template pool. Order is intentional — index 0 is the safest
 * default for a brand-new audience; later entries are higher-engagement
 * but more opinionated. Rotation walks the array with a daily offset so
 * we don't repeat the same template two days in a row.
 *
 * @internal exported for tests
 */
export const POLL_TEMPLATES: Record<PollTopic, PollTemplate[]> = {
  taux: [
    {
      id: "taux.surveys-rate-direction",
      questionFr: "Le taux va-t-il monter cette semaine ?",
      questionHt: "Eske to a pral monte semèn sa a ?",
      choices: ["Oui", "Non"],
    },
    {
      id: "taux.usd-vs-htg-budget",
      questionFr: "Tu reçois ton salaire en…",
      questionHt: "Ki sa ou resevwa salè w ?",
      choices: ["HTG", "USD"],
    },
    {
      id: "taux.daily-check",
      questionFr: "Tu vérifies le taux chaque jour ?",
      questionHt: "Ou verifye to a chak jou ?",
      choices: ["Oui", "Parfois"],
    },
  ],
  scholarship: [
    {
      id: "scholarship.applying-now",
      questionFr: "Tu appliques à une bourse cette année ?",
      questionHt: "W ap aplike pou yon bous ane sa a ?",
      choices: ["Oui", "Pas encore"],
    },
    {
      id: "scholarship.country-pref",
      questionFr: "Tu préfères étudier…",
      choices: ["En Haïti", "À l'étranger"],
    },
    {
      id: "scholarship.field-of-study",
      questionFr: "Domaine qui t'intéresse ?",
      choices: ["STEM", "Sciences sociales"],
    },
  ],
  general: [
    {
      id: "general.daily-format",
      questionFr: "Quel format tu préfères le matin ?",
      questionHt: "Ki fòma w pi renmen nan maten ?",
      choices: ["Taux", "Histoire"],
    },
    {
      id: "general.cta-share",
      questionFr: "Tu partages les news avec tes amis ?",
      choices: ["Souvent", "Rarement"],
    },
    {
      id: "general.lang-pref",
      questionFr: "Quelle langue tu préfères ?",
      choices: ["Français", "Kreyòl"],
    },
  ],
};

/**
 * Compute a stable day-of-year integer from a Haiti dateKey (YYYY-MM-DD).
 * Used as the rotation offset so the template choice is deterministic per
 * date and per topic.
 */
function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return 0;
  // Use a UTC-based math so DST never shifts the day-of-year for the same
  // calendar date.
  const start = Date.UTC(y, 0, 0);
  const cur = Date.UTC(y, m - 1, d);
  return Math.floor((cur - start) / (24 * 60 * 60 * 1000));
}

/**
 * Pick a poll template for a given topic + Haiti dateKey.
 *
 * Deterministic: identical inputs always return the same template. Caller
 * may persist the chosen `id` to a rotation history if cross-topic dedup
 * is required (out of scope for the v1 cold-start launch).
 */
export function pickPollTemplate(
  topic: PollTopic,
  dateKey: string,
): PollTemplate {
  const pool = POLL_TEMPLATES[topic];
  if (!pool || pool.length === 0) {
    throw new Error(`buildPollStoryFromTopic: no templates for topic "${topic}"`);
  }
  const idx = dayOfYear(dateKey) % pool.length;
  return pool[idx]!;
}

export interface PollStoryPayload {
  topic: PollTopic;
  dateKey: string;
  templateId: string;
  questionFr: string;
  questionHt: string;
  choices: [string, string];
}

/**
 * Build a poll-story payload for the given topic + Haiti dateKey.
 *
 * Returns a plain data object the calling job can persist to the IG story
 * queue or pass to the renderer. No Firestore writes happen here.
 */
export function buildPollStoryFromTopic(
  topic: PollTopic,
  dateKey: string,
): PollStoryPayload {
  const tpl = pickPollTemplate(topic, dateKey);
  return {
    topic,
    dateKey,
    templateId: tpl.id,
    questionFr: tpl.questionFr,
    questionHt: tpl.questionHt ?? tpl.questionFr,
    choices: tpl.choices,
  };
}
