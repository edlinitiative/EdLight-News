/**
 * Pure helper for choosing IG Story sticker overlays based on the
 * categories present in the morning briefing (Task 1, rollout PR).
 *
 * The morning briefing is an aggregate (taux + facts + N headlines), so we
 * pick ONE primary topic by priority and emit the matching features. This
 * keeps the publisher contract simple (one set of stickers per story) while
 * giving every category an explicit, testable shape.
 *
 * Priority — highest engagement first:
 *   1. taux  / utility   → daily-habit poll (no link sticker)
 *   2. scholarship       → article link + "Postule" CTA
 *   3. opportunity       → article link + "Postule" CTA
 *   4. news   / histoire → article link + "Li plis" CTA
 *   5. default           → bare link to site
 */

export type StoryFeatureTopic =
  | "scholarship"
  | "opportunity"
  | "taux"
  | "utility"
  | "news"
  | "histoire";

export interface StoryFeatures {
  linkUrl?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  ctaText?: string;
}

/**
 * Per-topic features map. Exposed so unit tests can lock the contract for
 * each individual topic; production code goes through `pickStoryFeatures`.
 */
export function featuresForTopic(
  topic: StoryFeatureTopic | undefined,
  articleUrl: string,
): StoryFeatures {
  switch (topic) {
    case "scholarship":
    case "opportunity":
      return { linkUrl: articleUrl, ctaText: "Postule" };
    case "taux":
    case "utility":
      return {
        pollQuestion: "Ou swiv to a chak jou?",
        pollOptions: ["Wi", "Pa vrèman"],
      };
    case "news":
    case "histoire":
      return { linkUrl: articleUrl, ctaText: "Li plis" };
    default:
      return { linkUrl: articleUrl };
  }
}

/**
 * Resolve the briefing's primary topic by priority, then emit features.
 *
 * `present` lists which buckets the briefing contains; order is irrelevant.
 * Topics are evaluated in fixed priority order so a briefing with both
 * taux and scholarship deterministically gets the taux poll.
 */
export function pickStoryFeatures(
  present: ReadonlyArray<StoryFeatureTopic>,
  articleUrl: string,
): StoryFeatures {
  const has = (t: StoryFeatureTopic): boolean => present.includes(t);
  // Priority order — first match wins.
  const ORDER: StoryFeatureTopic[] = [
    "taux",
    "utility",
    "scholarship",
    "opportunity",
    "news",
    "histoire",
  ];
  for (const t of ORDER) {
    if (has(t)) return featuresForTopic(t, articleUrl);
  }
  return featuresForTopic(undefined, articleUrl);
}
