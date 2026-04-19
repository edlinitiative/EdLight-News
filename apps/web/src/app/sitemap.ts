import type { MetadataRoute } from "next";

const BASE = "https://news.edlight.org";

/** Convert Firestore timestamp-like objects to ISO string */
function toISO(ts: unknown): string | undefined {
  if (!ts) return undefined;
  const seconds = (ts as { seconds?: number })?.seconds;
  if (seconds) return new Date(seconds * 1000).toISOString();
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === "string") return ts;
  return undefined;
}

/**
 * Dynamic sitemap for EdLight News.
 *
 * Includes all public static pages, category pages, and dynamically
 * generated article, scholarship, and author URLs from Firestore.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const ARTICLE_LIMIT = 2500;

  /* ── Static routes ──────────────────────────────────────────────── */
  const staticRoutes: MetadataRoute.Sitemap = [
    // Core pages — highest priority
    { url: BASE, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${BASE}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/bourses`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/opportunites`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/closing-soon`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/calendrier`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/haiti`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },

    // Category / section pages
    { url: `${BASE}/business`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/education`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/technology`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/world`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/opinion`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/explainers`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/universites`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/parcours`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/histoire`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/ressources`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/calendrier-haiti`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/succes`, lastModified: now, changeFrequency: "daily", priority: 0.6 },

    // Informational pages
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/editorial-standards`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },

    // Legal pages
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/data-deletion`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  /* ── Dynamic routes (from Firestore) ────────────────────────────── */
  let articleRoutes: MetadataRoute.Sitemap = [];
  let scholarshipRoutes: MetadataRoute.Sitemap = [];
  let authorRoutes: MetadataRoute.Sitemap = [];

  try {
    const {
      contentVersionsRepo,
      scholarshipsRepo,
      contributorProfilesRepo,
    } = await import("@edlight-news/firebase");

    // Fetch all dynamic content in parallel
    const [articlesFr, articlesHt, scholarships, contributors] = await Promise.all([
      contentVersionsRepo.listPublishedForWeb("fr", ARTICLE_LIMIT).catch(() => []),
      contentVersionsRepo.listPublishedForWeb("ht", ARTICLE_LIMIT).catch(() => []),
      scholarshipsRepo.listAll().catch(() => []),
      contributorProfilesRepo.listAll().catch(() => []),
    ]);

    const articles = [...articlesFr, ...articlesHt];

    // Published articles → /news/[id]
    articleRoutes = articles.map(
      (a: { id: string; createdAt?: unknown; updatedAt?: unknown }) => ({
        url: `${BASE}/news/${a.id}`,
        lastModified: toISO(a.updatedAt) ?? toISO(a.createdAt) ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }),
    );

    // All scholarships → /bourses/[id]
    scholarshipRoutes = scholarships.map(
      (s: { id: string; updatedAt?: unknown; verifiedAt?: unknown }) => ({
        url: `${BASE}/bourses/${s.id}`,
        lastModified: toISO(s.updatedAt) ?? toISO(s.verifiedAt) ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }),
    );

    // Published contributors → /auteur/[slug]
    authorRoutes = contributors
      .filter((c: { slug?: string }) => c.slug)
      .map(
        (c: { slug: string; createdAt?: unknown; updatedAt?: unknown }) => ({
          url: `${BASE}/auteur/${c.slug}`,
          lastModified: toISO(c.updatedAt) ?? toISO(c.createdAt) ?? now,
          changeFrequency: "monthly" as const,
          priority: 0.4,
        }),
      );
  } catch {
    // Firestore unavailable (e.g. during build) — skip dynamic routes
  }

  return [
    ...staticRoutes,
    ...articleRoutes,
    ...scholarshipRoutes,
    ...authorRoutes,
  ];
}
