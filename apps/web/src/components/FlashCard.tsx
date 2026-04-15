import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatRelativeDate } from "@/lib/utils";

interface FlashCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  badge?: string;
  bgColor?: string;
}

export function FlashCard({ article, lang, badge, bgColor }: FlashCardProps) {
  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className={[
        "group flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-5",
        bgColor ?? "bg-stone-50 dark:bg-stone-800/50",
        "border-stone-200/60 dark:border-stone-700/60",
      ].join(" ")}
    >
      {/* Image */}
      {article.imageUrl && (
        <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-xl bg-stone-200 dark:bg-stone-700 sm:aspect-square sm:w-32">
          <ImageWithFallback
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        {badge && (
          <span className="inline-block rounded-lg bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600 shadow-sm ring-1 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-400 dark:ring-stone-600/30">
            {badge}
          </span>
        )}
        <h3
          className="text-lg font-bold leading-snug tracking-tight text-stone-900 line-clamp-3 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400"
          style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
        >
          {article.title}
        </h3>
        {article.summary && (
          <p className="text-sm leading-relaxed text-stone-500 line-clamp-2 dark:text-stone-400">
            {article.summary}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
          {article.sourceName && (
            <span className="font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {article.sourceName}
            </span>
          )}
          {article.publishedAt && (
            <>
              {article.sourceName && <span className="text-stone-300 dark:text-stone-600">·</span>}
              <span>{formatRelativeDate(article.publishedAt, lang)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
