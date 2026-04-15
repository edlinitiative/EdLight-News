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
 *  3. Deduplicate by dedupeGroupId — merge content from all versions in each group
 *  3b. Title-similarity dedup (safety net for mismatched / missing dedupeGroupIds) — also merges content
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

// ── Content merging helpers ──────────────────────────────────────────────────

/**
 * Split text into sentences (handling French punctuation).
 * Returns normalised (lowercase, no accents) sentences for comparison,
 * paired with the original text.
 */
function splitSentences(text: string): { norm: string; raw: string }[] {
  if (!text) return [];
  // Split on sentence-ending punctuation followed by whitespace or end
  const raw = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15); // skip tiny fragments
  return raw.map((r) => ({ norm: normTitle(r), raw: r }));
}

/**
 * Check whether sentence `a` is substantially contained within any sentence
 * in the `existing` set (>70% word overlap → considered redundant).
 */
function isRedundant(aNorm: string, existing: Set<string>): boolean {
  const aWords = new Set(aNorm.split(" ").filter((w) => w.length > 2));
  if (aWords.size === 0) return true;
  for (const e of existing) {
    const eWords = new Set(e.split(" ").filter((w) => w.length > 2));
    let overlap = 0;
    for (const w of aWords) if (eWords.has(w)) overlap++;
    if (overlap / aWords.size > 0.7) return true;
  }
  return false;
}

/**
 * Merge a group of duplicate articles into one winner, combining unique
 * information from all versions so nothing is lost.
 *
 * Strategy:
 *  - Pick the best "shell" (synthesis > source, newest publishedAt)
 *  - Use the longest summary as the base, then append unique sentences
 *    from other versions' summaries
 *  - Use the longest body as the base, then append unique paragraphs
 *    from other versions' bodies
 *  - Pick the best image across all versions
 *    (publisher > wikidata > branded > screenshot > none)
 *  - Merge citations from all versions
 */
function mergeGroup(
  items: FeedItem[],
): FeedItem & { dupeCount: number } {
  if (items.length === 1) return { ...items[0], dupeCount: 1 };

  // Sort: synthesis first, then by publishedAt desc, then by content length desc
  const sorted = [...items].sort((a, b) => {
    const aSynth = a.itemType === "synthesis" ? 1 : 0;
    const bSynth = b.itemType === "synthesis" ? 1 : 0;
    if (aSynth !== bSynth) return bSynth - aSynth;
    const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (tA !== tB) return tB - tA;
    // Tiebreak by content richness
    const lenA = (a.summary?.length ?? 0) + (a.body?.length ?? 0);
    const lenB = (b.summary?.length ?? 0) + (b.body?.length ?? 0);
    return lenB - lenA;
  });

  // Winner shell = first after sorting
  const winner = { ...sorted[0], dupeCount: items.length };
  const losers = sorted.slice(1);

  // ── Merge summaries ──────────────────────────────────────────────────────
  // Start with the longest summary as base
  const allBySum = [...items].sort(
    (a, b) => (b.summary?.length ?? 0) - (a.summary?.length ?? 0),
  );
  let bestSummary = allBySum[0].summary ?? "";
  const existingSentences = new Set(
    splitSentences(bestSummary).map((s) => s.norm),
  );

  for (const loser of losers) {
    if (!loser.summary) continue;
    for (const sent of splitSentences(loser.summary)) {
      if (!isRedundant(sent.norm, existingSentences)) {
        bestSummary += " " + sent.raw;
        existingSentences.add(sent.norm);
      }
    }
  }
  winner.summary = bestSummary;

  // ── Merge bodies ─────────────────────────────────────────────────────────
  const allByBody = [...items].sort(
    (a, b) => (b.body?.length ?? 0) - (a.body?.length ?? 0),
  );
  let bestBody = allByBody[0].body ?? "";
  const existingBodySentences = new Set(
    splitSentences(bestBody).map((s) => s.norm),
  );

  for (const loser of losers) {
    if (!loser.body) continue;
    // Split body into paragraphs (double newline) for coarser merging
    const paragraphs = loser.body.split(/\n\n+/).filter((p) => p.trim().length > 20);
    for (const para of paragraphs) {
      const paraSentences = splitSentences(para);
      // If >50% of sentences are new, append the whole paragraph
      const newCount = paraSentences.filter(
        (s) => !isRedundant(s.norm, existingBodySentences),
      ).length;
      if (paraSentences.length > 0 && newCount / paraSentences.length > 0.5) {
        bestBody += "\n\n" + para;
        for (const s of paraSentences) existingBodySentences.add(s.norm);
      }
    }
  }
  winner.body = bestBody;

  // ── Pick best image ───────────────────────────────────────────────────────
  // Rank: publisher (real photo) > wikidata > branded > screenshot > none
  const IMAGE_RANK: Record<string, number> = {
    gemini_ai: 5,
    publisher: 4,
    wikidata: 3,
    branded: 2,
    screenshot: 1,
  };

  let bestImageScore = -1;
  for (const item of items) {
    if (!item.imageUrl) continue;
    const score = IMAGE_RANK[item.imageSource ?? ""] ?? 0;
    if (score > bestImageScore) {
      bestImageScore = score;
      winner.imageUrl = item.imageUrl;
      winner.imageSource = item.imageSource;
      winner.imageAttribution = item.imageAttribution;
    }
  }

  // ── Merge citations ──────────────────────────────────────────────────────
  const seenCitations = new Set(
    (winner.citations ?? []).map((c) => c.sourceUrl),
  );
  for (const loser of losers) {
    for (const c of loser.citations ?? []) {
      if (!seenCitations.has(c.sourceUrl)) {
        winner.citations = [...(winner.citations ?? []), c];
        seenCitations.add(c.sourceUrl);
      }
    }
  }

  return winner;
}

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

  // ── 3. Dedupe by dedupeGroupId — collect groups for content merging ────────
  const groupCollector = new Map<string, FeedItem[]>();
  const ungrouped: FeedItem[] = [];

  for (const a of boosted) {
    if (!a.dedupeGroupId) {
      ungrouped.push(a);
      continue;
    }
    const list = groupCollector.get(a.dedupeGroupId) ?? [];
    list.push(a);
    groupCollector.set(a.dedupeGroupId, list);
  }

  const afterGroupId: FeedItem[] = [
    ...[...groupCollector.values()].map(mergeGroup),
    ...ungrouped,
  ];

  // ── 3b. Title-similarity dedup (safety net for mismatched dedupeGroupIds) ─
  // Collect articles with similar titles into groups, then merge each group.
  // Two passes:
  //   a) Exact titleKey match (fast, O(n))
  //   b) Pairwise bigram-Dice across all remaining items (O(n²), n is small)
  const titleBuckets = new Map<string, FeedItem[]>();
  const titleOrphans: FeedItem[] = [];

  for (const a of afterGroupId) {
    const key = titleKey(a.title ?? "");
    if (!key) { titleOrphans.push(a); continue; }
    const list = titleBuckets.get(key) ?? [];
    list.push(a);
    titleBuckets.set(key, list);
  }

  // Merge each titleKey bucket
  const afterTitleKey = [
    ...[...titleBuckets.values()].map(mergeGroup),
    ...titleOrphans.map((a) => ({ ...a, dupeCount: (a as any).dupeCount ?? 1 }) as FeedItem & { dupeCount: number }),
  ];

  // Pass (b): pairwise Dice across ALL remaining items.
  // O(n²) but n ≤ 40 so negligible.
  const mergedBuckets: FeedItem[][] = [];

  for (const item of afterTitleKey) {
    let matched = false;
    for (let i = 0; i < mergedBuckets.length; i++) {
      // Compare against the first item in each bucket (representative)
      if (bigramDice(item.title ?? "", mergedBuckets[i][0].title ?? "") >= DICE_THRESHOLD) {
        mergedBuckets[i].push(item);
        matched = true;
        break;
      }
    }
    if (!matched) mergedBuckets.push([item]);
  }

  const deduped: FeedItem[] = mergedBuckets.map(mergeGroup);

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
