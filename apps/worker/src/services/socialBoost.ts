/**
 * applySocialBoost — boost echo observability wrapper (rollout PR Task 2).
 *
 * Wraps the pure `socialEngagementBoost` / `socialEngagementBoostMulti`
 * helpers from @edlight-news/generator with two side effects:
 *
 *   1. Emit a single structured `socialBoostApplied` log line.
 *   2. Persist a `social_boost_log` Firestore entry (best-effort,
 *      swallowed on failure) so the admin "Boost health" panel can
 *      compute 7-day rollups.
 *
 * Both effects fire only when the resulting boost is > 0, so we don't
 * pollute logs with no-ops on the vast majority of items that have no
 * historical engagement.
 *
 * Pure scoring math stays in the generator package — this module is the
 * thin worker-side adapter that knows about Firestore + the structured
 * log format.
 */
import {
  socialEngagementBoost,
  socialEngagementBoostMulti,
  type SocialPlatform,
} from "@edlight-news/generator";
import { socialBoostLogRepo } from "@edlight-news/firebase";

export interface ApplyBoostInput {
  itemId: string;
  topic: string;
  baseScore: number;
  fb?: Record<string, number> | null;
  th?: Record<string, number> | null;
  x?: Record<string, number> | null;
}

export interface AppliedBoost {
  boost: number;
  boostedScore: number;
  platformsContributed: SocialPlatform[];
  capped: boolean;
}

/** Multi-platform boost with logging + persistence side effects. */
export async function applySocialBoost(input: ApplyBoostInput): Promise<AppliedBoost> {
  const fb = socialEngagementBoost(input.fb ?? null, "fb");
  const th = socialEngagementBoost(input.th ?? null, "th");
  const x = socialEngagementBoost(input.x ?? null, "x");
  const platformsContributed: SocialPlatform[] = (
    [
      ["fb", fb],
      ["th", th],
      ["x", x],
    ] as Array<[SocialPlatform, number]>
  )
    .filter(([, b]) => b > 0)
    .map(([p]) => p);
  const boost = socialEngagementBoostMulti({ fb: input.fb, th: input.th, x: input.x });
  const boostedScore = Math.min(100, input.baseScore + boost);
  const capped = boost === 20;

  if (boost > 0) {
    // Single-line structured log — matches existing worker log shape.
    console.log(
      JSON.stringify({
        event: "socialBoostApplied",
        itemId: input.itemId,
        topic: input.topic,
        baseScore: input.baseScore,
        boostedScore,
        boost,
        platformsContributed,
        capped,
      }),
    );
    try {
      await socialBoostLogRepo.record({
        itemId: input.itemId,
        topic: input.topic,
        baseScore: input.baseScore,
        boostedScore,
        boost,
        platformsContributed,
        capped,
      });
    } catch (err) {
      // Persistence is best-effort; never break scoring on logging failure.
      console.warn(
        `[applySocialBoost] failed to persist boost log: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return { boost, boostedScore, platformsContributed, capped };
}

/**
 * Single-platform sibling — kept for callers that only have one platform
 * worth of historical metrics (current FB queue path). Same side effects.
 */
export async function applySocialBoostSingle(input: {
  itemId: string;
  topic: string;
  baseScore: number;
  platform: SocialPlatform;
  metrics: Record<string, number> | null | undefined;
}): Promise<AppliedBoost> {
  const wrapped: ApplyBoostInput = {
    itemId: input.itemId,
    topic: input.topic,
    baseScore: input.baseScore,
  };
  if (input.platform === "fb") wrapped.fb = input.metrics ?? null;
  else if (input.platform === "th") wrapped.th = input.metrics ?? null;
  else if (input.platform === "x") wrapped.x = input.metrics ?? null;
  return applySocialBoost(wrapped);
}
