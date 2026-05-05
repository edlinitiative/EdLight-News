/**
 * Shared adapter: worker `Item` + optional `ContentVersion` → social v2
 * generator input shape.
 *
 * The same mapping is needed by the FB, Threads, and IG queue builders
 * (and any future surface that consumes the social v2 generator). Keeping
 * a single copy here means new fields on `SocialArticleInput` only need
 * to be wired in one place.
 *
 * `topicForSocialItem` is the mirror helper — same category logic, exposed
 * separately because the queue builders also use it for scoring and for the
 * pre-skip on story-only categories.
 */

import type { Item, ContentVersion } from "@edlight-news/types";
import type { SocialArticleInput } from "@edlight-news/generator";

export type SocialTopic =
  | "scholarship"
  | "opportunity"
  | "education"
  | "news"
  | "story_only"
  | "other";

/**
 * Resolve the social topic for an item from its category, vertical, and
 * synthetic canonical URLs. Story-only categories (Taux, Histoire, internal
 * utility) are recognised so the queue builders can skip them before they
 * ever hit the social generator.
 */
export function topicForSocialItem(item: Item): SocialTopic {
  const category = item.category?.toLowerCase() ?? "";
  const vertical = item.vertical?.toLowerCase() ?? "";

  if (
    category === "taux" ||
    category === "histoire" ||
    category === "utility" ||
    vertical === "histoire" ||
    vertical === "taux" ||
    vertical === "utility" ||
    item.canonicalUrl?.startsWith("edlight://histoire/") ||
    item.canonicalUrl?.startsWith("edlight://utility/") ||
    item.canonicalUrl?.startsWith("edlight://taux/")
  ) {
    return "story_only";
  }

  if (
    category === "scholarship" ||
    category === "bourses" ||
    vertical === "bourses"
  ) {
    return "scholarship";
  }
  if (
    category === "opportunity" ||
    category === "concours" ||
    category === "stages" ||
    category === "programmes" ||
    vertical === "opportunites"
  ) {
    return "opportunity";
  }
  if (vertical === "education") {
    return "education";
  }
  if (
    category === "news" ||
    category === "local_news" ||
    vertical === "news" ||
    vertical === "haiti" ||
    vertical === "world" ||
    vertical === "business" ||
    vertical === "technology" ||
    vertical === "explainers"
  ) {
    return "news";
  }
  return "other";
}

/**
 * Build the SocialArticleInput passed to `generateSocialPosts`. Returns
 * null when the item lacks a usable title (the social generator needs at
 * least that to anchor the prompt).
 *
 * Story-only items still get a valid input (with `category` set to "Taux"
 * or "Histoire") so the LLM produces `instagram.post_type === "story_only"`
 * and the adapters return null for the feed surfaces.
 */
export function toSocialInput(
  item: Item,
  cv: ContentVersion | undefined,
  articleUrl: string,
): SocialArticleInput | null {
  const topic = topicForSocialItem(item);
  const rawCategory = item.category?.toLowerCase() ?? "";
  const rawVertical = item.vertical?.toLowerCase() ?? "";

  let category: SocialArticleInput["category"] = "Autre";
  if (topic === "scholarship") category = "Bourses";
  else if (topic === "opportunity") category = "Opportunités";
  else if (topic === "education") category = "Éducation";
  else if (topic === "news") category = "Actualités";
  else if (
    rawCategory === "taux" ||
    rawVertical === "taux" ||
    item.canonicalUrl?.startsWith("edlight://taux/") ||
    item.canonicalUrl?.startsWith("edlight://utility/")
  ) {
    category = "Taux";
  } else if (
    rawCategory === "histoire" ||
    rawVertical === "histoire" ||
    item.canonicalUrl?.startsWith("edlight://histoire/")
  ) {
    category = "Histoire";
  }

  const language: "fr" | "ht" = cv?.language === "ht" ? "ht" : "fr";
  const title = cv?.title || item.title;
  if (!title || title.length < 10) return null;
  const summary = cv?.summary || (item as { summary?: string }).summary || "";
  const body = cv?.body || item.extractedText || "";
  const publishedAt = (() => {
    const raw = (cv as unknown as { publishedAt?: unknown } | undefined)
      ?.publishedAt;
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw === "string") return raw;
    return new Date().toISOString();
  })();
  const opportunity =
    (item as { opportunity?: Record<string, unknown> }).opportunity ?? {};

  return {
    articleId: item.id,
    url: articleUrl,
    category,
    language,
    title,
    summary,
    body,
    publishedAt,
    deadline: (opportunity as { deadline?: string }).deadline ?? null,
    country: (opportunity as { country?: string }).country ?? null,
    institution: (opportunity as { institution?: string }).institution ?? null,
    level: null,
    coverage: ((opportunity as { coverage?: string[] }).coverage as string[]) ?? [],
    eligibility:
      ((opportunity as { eligibility?: string[] }).eligibility as string[]) ?? [],
    documents:
      ((opportunity as { documents?: string[] }).documents as string[]) ?? [],
    applicationUrl:
      (opportunity as { applicationUrl?: string }).applicationUrl ?? null,
    imageUrl: item.imageUrl ?? null,
  };
}
