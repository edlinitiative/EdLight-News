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
 *  4. Sort: scored articles first (desc by score), then legacy; secondary = publishedAt desc
 *  5. Publisher diversity cap: within the top `topN` slots, no publisher
 *     appears more than `publisherCap` times; bumped articles are inserted
 *     right after the top-N block
 */

import type { FeedItem } from "@/components/news-feed";

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

  // ── 2b. Synthesis boost: +0.15 to audienceFitScore for synthesis items ───
  const boosted = thresholded.map((a) => {
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

  const deduped: FeedItem[] = [...groups.values(), ...ungrouped];

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
