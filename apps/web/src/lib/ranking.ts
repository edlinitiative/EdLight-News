/**
 * Feed ranking utility.
 *
 * Used server-side by both the homepage and /news page to produce a
 * quality-gated, deduplicated, publisher-balanced article list.
 *
 * Rules applied in order:
 *  1. Drop offMission articles
 *  2. Drop scored articles below audienceFitThreshold
 *     (articles with NO score — legacy/pre-v2 — always pass)
 *  3. Deduplicate by dedupeGroupId, keeping the newest publishedAt per group
 *  3b. Title-similarity dedup (safety net for mismatched / missing dedupeGroupIds)
 *  4. Sort: scored articles first (desc by score), then legacy; secondary = publishedAt desc
 *  5. Publisher diversity cap: within the top `topN` slots, no publisher
 *     appears more than `publisherCap` times; bumped articles are inserted
 *     right after the top-N block
 */

import type { FeedItem } from "@/components/news-feed";

// ── Title-similarity helpers (accent-stripped, stop-word-free key) ───────────

/** French / Kreyòl stop words unlikely to distinguish articles. */
const STOP = new Set([
  "de","du","des","la","le","les","l","d","un","une","a","en","et","pour",
  "au","aux","par","sur","dans","avec","ce","ces","son","sa","ses","qui",
  "que","ou","y","il","se","ne","pas","est","sont","ont","ete","peut",
]);

/** Normalize a title: lowercase, strip accents + punctuation, collapse spaces. */
function normTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a dedup key from the first 4 significant words of a normalised title.
 * Skips stop-words so minor phrasing differences don't change the key.
 * 4 words is enough to identify the core topic while ignoring subtitle
 * variations (e.g. "Cap Talent Lab 2026: Plus de 200…" vs "…: Rencontre…").
 */
function titleKey(title: string): string {
  const words = normTitle(title)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
  return words.slice(0, 4).join(" ");
}

/**
 * Dice coefficient on word bigrams — 1.0 = identical, 0.0 = no overlap.
 * Used as a safety-net when two titleKeys differ but the titles are still
 * nearly the same (e.g. one extra qualifier word at the end).
 */
function bigramDice(a: string, b: string): number {
  const bg = (s: string): Set<string> => {
    const w = s.split(" ");
    const set = new Set<string>();
    for (let i = 0; i < w.length - 1; i++) set.add(`${w[i]} ${w[i + 1]}`);
    return set;
  };
  const sa = bg(normTitle(a));
  const sb = bg(normTitle(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let overlap = 0;
  for (const x of sa) if (sb.has(x)) overlap++;
  return (2 * overlap) / (sa.size + sb.size);
}

/** Similarity threshold above which two titles are considered the same story. */
const DICE_THRESHOLD = 0.65;

export interface RankOptions {
  /**
   * Minimum audienceFitScore to include.
   * Items with an undefined score (legacy) always pass regardless of this value.
   */
  audienceFitThreshold: number;
  /** Max articles from the same publisher within the top `topN` slots. */
  publisherCap: number;
  /** How many leading slots the publisher cap applies to. */
  topN: number;
}

export function rankFeed(articles: FeedItem[], opts: RankOptions): FeedItem[] {
  const { audienceFitThreshold, publisherCap, topN } = opts;

  // ── 1. Drop off-mission ──────────────────────────────────────────────────
  const active = articles.filter((a) => !a.offMission);

  // ── 2. Score threshold (legacy = no score always passes) ─────────────────
  const thresholded = active.filter((a) => {
    if (a.audienceFitScore === undefined || a.audienceFitScore === null) {
      return true; // legacy item — passes
    }
    return a.audienceFitScore >= audienceFitThreshold;
  });

  // ── 2b. Boost: utility +0.25, synthesis +0.15 to audienceFitScore ──────
  const boosted = thresholded.map((a) => {
    if (a.itemType === "utility" && a.audienceFitScore != null) {
      return { ...a, audienceFitScore: Math.min(1, a.audienceFitScore + 0.25) };
    }
    if (a.itemType === "synthesis" && a.audienceFitScore != null) {
      return { ...a, audienceFitScore: Math.min(1, a.audienceFitScore + 0.15) };
    }
    return a;
  });

  // ── 3. Dedupe by dedupeGroupId (prefer synthesis, then newest) ───────────
  const groups = new Map<string, FeedItem & { dupeCount: number }>();
  const ungrouped: FeedItem[] = [];

  for (const a of boosted) {
    if (!a.dedupeGroupId) {
      ungrouped.push(a);
      continue;
    }
    const prev = groups.get(a.dedupeGroupId);
    if (!prev) {
      groups.set(a.dedupeGroupId, { ...a, dupeCount: 1 });
    } else {
      // Prefer synthesis items over source items within the same group
      const prevIsSynthesis = prev.itemType === "synthesis";
      const currIsSynthesis = a.itemType === "synthesis";

      if (currIsSynthesis && !prevIsSynthesis) {
        // Current is synthesis, prev is source → replace with synthesis
        groups.set(a.dedupeGroupId, { ...a, dupeCount: prev.dupeCount + 1 });
      } else if (!currIsSynthesis && prevIsSynthesis) {
        // Current is source, prev is synthesis → keep synthesis
        prev.dupeCount += 1;
      } else {
        // Both same type → keep newest publishedAt
        const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tP = prev.publishedAt ? new Date(prev.publishedAt).getTime() : 0;
        if (tA > tP) {
          groups.set(a.dedupeGroupId, {
            ...a,
            dupeCount: prev.dupeCount + 1,
          });
        } else {
          prev.dupeCount += 1;
        }
      }
    }
  }

  const afterGroupId: FeedItem[] = [...groups.values(), ...ungrouped];

  // ── 3b. Title-similarity dedup (safety net for mismatched dedupeGroupIds) ─
  // Two passes:
  //   a) Exact titleKey match (fast, O(n))
  //   b) Pairwise bigram-Dice for remaining short titles (O(n²), n is small)
  const titleGroups = new Map<string, FeedItem & { dupeCount: number }>();
  const titleUngrouped: (FeedItem & { dupeCount: number })[] = [];

  const pickBetter = (
    prev: FeedItem & { dupeCount: number },
    curr: FeedItem,
  ): FeedItem & { dupeCount: number } => {
    const prevSynth = prev.itemType === "synthesis";
    const currSynth = curr.itemType === "synthesis";
    if (currSynth && !prevSynth) return { ...curr, dupeCount: prev.dupeCount + 1 };
    if (!currSynth && prevSynth) { prev.dupeCount += 1; return prev; }
    const tC = curr.publishedAt ? new Date(curr.publishedAt).getTime() : 0;
    const tP = prev.publishedAt ? new Date(prev.publishedAt).getTime() : 0;
    if (tC > tP) return { ...curr, dupeCount: prev.dupeCount + 1 };
    prev.dupeCount += 1;
    return prev;
  };

  for (const a of afterGroupId) {
    const key = titleKey(a.title ?? "");
    if (!key) { titleUngrouped.push({ ...a, dupeCount: (a as any).dupeCount ?? 1 }); continue; }
    const prev = titleGroups.get(key);
    if (!prev) {
      titleGroups.set(key, { ...a, dupeCount: (a as any).dupeCount ?? 1 });
    } else {
      titleGroups.set(key, pickBetter(prev, a));
    }
  }

  // Pass (b): pairwise Dice across ALL remaining items (titleGroups + orphans).
  // O(n²) but n ≤ 40 so negligible.
  const candidates = [...titleGroups.values(), ...titleUngrouped];
  const merged: (FeedItem & { dupeCount: number })[] = [];

  for (const item of candidates) {
    let matched = false;
    for (let i = 0; i < merged.length; i++) {
      if (bigramDice(item.title ?? "", merged[i].title ?? "") >= DICE_THRESHOLD) {
        merged[i] = pickBetter(merged[i], item);
        matched = true;
        break;
      }
    }
    if (!matched) merged.push(item);
  }

  const deduped: FeedItem[] = merged;

  // ── 4. Sort: scored first (desc), then legacy; tiebreak publishedAt desc ──
  deduped.sort((a, b) => {
    const hasA = a.audienceFitScore != null;
    const hasB = b.audienceFitScore != null;
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    if (hasA && hasB) {
      const diff = (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
      if (diff !== 0) return diff;
    }
    const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tB - tA;
  });

  // ── 5. Publisher diversity cap within top N ───────────────────────────────
  const topSlots: FeedItem[] = [];
  const deferred: FeedItem[] = [];
  const remainder: FeedItem[] = [];
  const publisherCounts = new Map<string, number>();

  for (const article of deduped) {
    if (topSlots.length < topN) {
      const publisher = article.sourceName ?? "__unknown__";
      const count = publisherCounts.get(publisher) ?? 0;
      if (count < publisherCap) {
        topSlots.push(article);
        publisherCounts.set(publisher, count + 1);
      } else {
        deferred.push(article);
      }
    } else {
      remainder.push(article);
    }
  }

  // Final order: curated top N → publisher-bumped overflow → rest
  return [...topSlots, ...deferred, ...remainder];
}

/**
 * Alias used by curated page routes.
 * Identical behaviour to rankFeed; the dupeCount field on each returned
 * article serves as the "updateCount" (how many duplicate stories were merged).
 */
export const rankAndDeduplicate = rankFeed;
