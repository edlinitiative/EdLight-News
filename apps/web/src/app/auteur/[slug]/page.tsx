/**
 * /auteur/[slug] — Public contributor profile page.
 *
 * Displays the contributor's bio, photo, and all articles they've authored.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Feather, ExternalLink } from "lucide-react";
import { contributorProfilesRepo, itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";
import { getLangFromSearchParams, fetchEnrichedFeed } from "@/lib/content";
import { NewsFeed } from "@/components/news-feed";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";

export const revalidate = 600; // 10 min

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const contributor = await contributorProfilesRepo.getBySlug(params.slug);
  if (!contributor) return { title: "Not found" };

  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = `${contributor.displayName} — EdLight News`;
  const description = contributor.bio
    ?? (fr
      ? `Articles et contributions de ${contributor.displayName} sur EdLight News.`
      : `Atik ak kontribisyon ${contributor.displayName} sou EdLight News.`);

  return {
    title,
    description,
    ...buildOgMetadata({
      title,
      description,
      path: `/auteur/${params.slug}`,
      lang,
      image: contributor.photoUrl,
    }),
  };
}

export default async function ContributorPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { lang?: string };
}) {
  const contributor = await contributorProfilesRepo.getBySlug(params.slug);
  if (!contributor) notFound();

  const lang = (searchParams.lang === "ht" ? "ht" : "fr") as ContentLanguage;
  const l = (href: string) => withLangParam(href, lang);
  const fr = lang === "fr";

  // Get articles by this contributor
  let articles: Awaited<ReturnType<typeof fetchEnrichedFeed>> = [];
  try {
    const allArticles = await fetchEnrichedFeed(lang, 200);
    articles = allArticles.filter((a) => a.authorSlug === params.slug);
  } catch (err) {
    console.error("[EdLight] /auteur feed fetch failed:", err);
  }

  const initial = contributor.displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500"
      >
        <Link
          href={l("/")}
          className="transition-colors hover:text-stone-700 dark:hover:text-stone-300"
        >
          {fr ? "Accueil" : "Akèy"}
        </Link>
        <span>›</span>
        <span className="font-medium text-stone-500 dark:text-stone-400">
          {contributor.displayName}
        </span>
      </nav>

      {/* Profile header */}
      <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        {contributor.photoUrl ? (
          <img
            src={contributor.photoUrl}
            alt={contributor.displayName}
            className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-100 dark:ring-blue-900/30"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-700 ring-4 ring-blue-50 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-900/20">
            {initial}
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
              {contributor.displayName}
            </h1>
            {contributor.verified && (
              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {fr ? "Vérifié" : "Verifye"}
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {fr ? roleLabel(contributor.role, "fr") : roleLabel(contributor.role, "ht")}
          </p>
          {contributor.bio && (
            <p className="max-w-xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {contributor.bio}
            </p>
          )}
          {/* Social links */}
          {contributor.socialLinks && (
            <div className="flex items-center gap-3 pt-1">
              {contributor.socialLinks.website && (
                <a
                  href={contributor.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="h-3 w-3" />
                  Site web
                </a>
              )}
              {contributor.socialLinks.twitter && (
                <a
                  href={`https://twitter.com/${contributor.socialLinks.twitter.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  @{contributor.socialLinks.twitter.replace(/^@/, "")}
                </a>
              )}
              {contributor.socialLinks.linkedin && (
                <a
                  href={contributor.socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  LinkedIn
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Articles */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
          <Feather className="mr-1.5 inline-block h-4 w-4" />
          {fr
            ? `Articles de ${contributor.displayName}`
            : `Atik ${contributor.displayName}`}
          <span className="ml-1.5 text-sm font-normal text-stone-400">({articles.length})</span>
        </h2>

        {articles.length > 0 ? (
          <NewsFeed articles={articles} serverLang={lang} preRanked />
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center dark:border-stone-700">
            <Feather className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600" />
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
              {fr
                ? "Aucun article publié pour le moment."
                : "Pa gen atik pibliye pou kounye a."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function roleLabel(role: string, lang: "fr" | "ht"): string {
  const labels: Record<string, { fr: string; ht: string }> = {
    intern: { fr: "Stagiaire", ht: "Estajyè" },
    editor: { fr: "Rédacteur", ht: "Redaktè" },
    admin: { fr: "Administrateur", ht: "Administratè" },
  };
  return labels[role]?.[lang] ?? role;
}
