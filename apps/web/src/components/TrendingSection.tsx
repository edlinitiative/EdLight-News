import Link from "next/link";
import { TrendingUp, ArrowRight } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatRelativeDate, withLangParam } from "@/lib/utils";

interface TrendingSectionProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

/**
 * TrendingSection — horizontal scrollable row of trending articles.
 * Server component (no "use client").
 * Receives pre-sorted articles from the page data layer.
 */
export function TrendingSection({ articles, lang }: TrendingSectionProps) {
  if (articles.length === 0) return null;

  const fr = lang === "fr";
  const lq = (href: string) => withLangParam(href, lang);

  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="flex shrink-0 items-center gap-2 text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">
          <TrendingUp className="h-5 w-5 text-rose-500" />
          {fr ? "Tendances" : "Tandans"}
        </h2>
        <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        <Link
          href={lq("/news")}
          className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {fr ? "Tout voir" : "Wè tout"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-2 md:grid-cols-4 sm:overflow-visible">
        {articles.map((article, i) => (
          <Link
            key={article.id}
            href={lq(`/news/${article.id}`)}
            className="group flex min-w-[240px] flex-col gap-2 rounded-xl border border-stone-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900 sm:min-w-0"
          >
            {article.imageUrl && (
              <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                <ImageWithFallback
                  src={article.imageUrl}
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {/* Rank badge */}
                <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white shadow">
                  {i + 1}
                </span>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-sm font-bold leading-snug text-stone-900 line-clamp-2 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                {article.title}
              </h3>
              <p className="mt-auto text-[11px] text-stone-400 dark:text-stone-500">
                {article.sourceName}
                {article.publishedAt && ` · ${formatRelativeDate(article.publishedAt, lang)}`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
