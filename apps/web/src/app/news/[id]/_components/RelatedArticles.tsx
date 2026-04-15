import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { categoryLabel, CATEGORY_COLORS, formatDate } from "@/lib/utils";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";

interface RelatedArticlesProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

/**
 * "Related articles" section — shows thematically related articles
 * at the end of an article, using enriched feed items with images.
 */
export function RelatedArticles({ articles, lang }: RelatedArticlesProps) {
  if (!articles || articles.length === 0) return null;
  const fr = lang === "fr";

  return (
    <section className="relative">
      {/* Section header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-stone-200 via-stone-200 to-transparent dark:from-stone-700 dark:via-stone-700" />
        <h2 className="text-label-lg uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {fr ? "À lire aussi" : "Li tou"}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-stone-200 via-stone-200 to-transparent dark:from-stone-700 dark:via-stone-700" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.slice(0, 3).map((article) => {
          const catColor = CATEGORY_COLORS[article.category ?? ""] ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300";
          const catLbl = categoryLabel(article.category ?? "", lang);
          const pubDate = article.publishedAt
            ? formatDate(article.publishedAt, lang)
            : null;

          return (
            <Link
              key={article.id}
              href={`/news/${article.id}?lang=${lang}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 dark:border-stone-700/60 dark:bg-stone-900 dark:hover:shadow-card-dark-hover"
            >
              {/* Thumbnail */}
              {article.imageUrl && article.imageSource !== "branded" && (
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                  <ImageWithFallback
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    fallback={
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-700">
                        <span className="text-xs font-bold tracking-wide text-stone-300 dark:text-stone-600">
                          EDLIGHT
                        </span>
                      </div>
                    }
                  />
                </div>
              )}

              <div className="flex flex-1 flex-col gap-2 p-4">
                {/* Category + date */}
                <div className="flex items-center gap-2">
                  {catLbl && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColor}`}>
                      {catLbl}
                    </span>
                  )}
                  {pubDate && (
                    <span className="text-[11px] text-stone-400 dark:text-stone-500">
                      {pubDate}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="line-clamp-2 text-title-sm leading-snug text-stone-900 transition-colors group-hover:text-primary dark:text-stone-100 dark:group-hover:text-blue-400">
                  {article.title}
                </h3>

                {/* Short summary */}
                {article.summary && (
                  <p className="line-clamp-2 text-body-sm text-stone-500 dark:text-stone-400">
                    {article.summary}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
