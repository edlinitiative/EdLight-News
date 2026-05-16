import type { ReelTopic, ReelTemplate } from "./types.js";
import {
  extractHeroNumber,
  type HeroNumber,
  type HeroNumberSource,
} from "./extractHeroNumber.js";

/**
 * Per-topic template preference, in priority order.
 *
 * Editorial reasoning per topic:
 *   - scholarship: BigStatistic (deadline countdown) wins on screenshot share.
 *   - opportunity: HeadlinePhoto (the role + photo) is the most direct sell.
 *   - taux:        BigStatistic is canonical — it's literally a number.
 *   - news:        HeadlinePhoto first; PullQuote when there's a real quote.
 *   - histoire:    PullQuote — archival quotes feel definitive.
 *   - fact:        NumberedPoints — "3 things to know" reads naturally.
 *   - education:   NumberedPoints (lesson plans) → HeadlinePhoto for variety.
 *
 * Templates *not* listed for a topic are explicitly disallowed (e.g. PullQuote
 * for taux makes no sense — there's no quote in an exchange rate).
 */
export const TEMPLATE_PREFERENCE: Record<ReelTopic, ReelTemplate[]> = {
  scholarship: ["BigStatistic", "NumberedPoints", "HeadlinePhoto", "PullQuote"],
  opportunity: ["HeadlinePhoto", "NumberedPoints", "BigStatistic"],
  taux: ["BigStatistic", "HeadlinePhoto"],
  news: ["HeadlinePhoto", "PullQuote", "BigStatistic"],
  histoire: ["PullQuote", "HeadlinePhoto", "NumberedPoints"],
  fact: ["NumberedPoints", "BigStatistic", "PullQuote"],
  education: ["NumberedPoints", "HeadlinePhoto", "PullQuote"],
};

/**
 * Cheap deterministic string hash (FNV-1a 32-bit). Sufficient for "spread
 * itemIds across template indices" — we don't need cryptographic strength.
 */
function hashCode(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned 32-bit
}

/**
 * Pick a template deterministically by `(topic, dayOfWeek, itemId)`.
 *
 * Determinism matters because:
 *  1. Re-running build for the same item → same template (idempotent).
 *  2. Topics rotate naturally across days without a stored cursor.
 *
 * `dayOfWeek` is `0..6` (UTC). The caller passes `new Date().getUTCDay()`.
 */
export function pickTemplate(
  topic: ReelTopic,
  dayOfWeek: number,
  itemId: string,
): ReelTemplate {
  const list = TEMPLATE_PREFERENCE[topic];
  if (!list || list.length === 0) {
    // Defensive — should be caught by the test suite for new topics.
    throw new Error(`pickTemplate: no preference list for topic "${topic}"`);
  }
  const idx = (hashCode(itemId) + dayOfWeek) % list.length;
  // We've narrowed `list` to non-empty above, so this index is safe.
  return list[idx]!;
}

// ── Downgrade rules ────────────────────────────────────────────────────────

/**
 * Result of `pickTemplateWithDowngrade`. When `downgraded` is true the
 * orchestrator should also emit `templateDowngraded` to logs.
 */
export interface PickTemplateResult {
  template: ReelTemplate;
  /** True iff the original pick was rejected and we moved down the list. */
  downgraded: boolean;
  /** The original (rejected) template, when `downgraded`. */
  from?: ReelTemplate;
  /** Why we downgraded (e.g. "no-salient-number"). */
  reason?: string;
  /** Salient hero number found, if any. Forwarded to the script prompt. */
  heroNumber: HeroNumber | null;
}

/**
 * Pick a template, then verify content-level constraints. Currently this
 * downgrades `BigStatistic` when the source has no salient number (only the
 * year, or no number at all) — that is the v1 bug where "2026" landed as
 * the hero of a scholarship reel.
 *
 * Other templates pass through unchanged for now; further content-aware
 * downgrades (e.g. PullQuote without a real quote) live in the LLM stage and
 * surface as `TemplateRequirementError`, which `buildReel` already retries.
 */
export function pickTemplateWithDowngrade(
  topic: ReelTopic,
  dayOfWeek: number,
  itemId: string,
  source: HeroNumberSource,
): PickTemplateResult {
  const initial = pickTemplate(topic, dayOfWeek, itemId);
  const hero = extractHeroNumber(source);

  if (initial === "BigStatistic" && (hero === null || hero.kind === "year")) {
    const list = TEMPLATE_PREFERENCE[topic] ?? [];
    const next = list.find((t) => t !== "BigStatistic");
    if (next) {
      return {
        template: next,
        downgraded: true,
        from: "BigStatistic",
        reason: hero === null ? "no-salient-number" : "year-only-salient-number",
        heroNumber: hero,
      };
    }
    // Single-template topic that's BigStatistic-only — keep it; the LLM will
    // do its best with the year.
  }

  return { template: initial, downgraded: false, heroNumber: hero };
}
