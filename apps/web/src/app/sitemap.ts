import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap for EdLight News.
 * Static routes + latest published articles when Firestore is available.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = "https://news.edlight.org";
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${BASE}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/bourses`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/opportunites`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/calendrier`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/haiti`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/universites`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/parcours`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/histoire`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/ressources`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/succes`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/closing-soon`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/calendrier-haiti`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/data-deletion`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const { contentVersionsRepo } = await import("@edlight-news/firebase");
    const articles = await contentVersionsRepo.listPublishedForWeb("fr", 200);
    dynamicRoutes = articles.map((a: { id: string; createdAt?: unknown }) => ({
      url: `${BASE}/news/${a.id}`,
      lastModified: a.createdAt
        ? new Date(
            ((a.createdAt as { seconds?: number })?.seconds ?? 0) * 1000,
          ).toISOString()
        : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Firestore unavailable (e.g. during build) — skip dynamic routes
  }

  return [...staticRoutes, ...dynamicRoutes];
}
