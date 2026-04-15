import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatRelativeDate, withLangParam } from "@/lib/utils";

interface IntelligenceItemProps {
  article: FeedItem;
  lang: ContentLanguage;
}

/**
 * IntelligenceItem — compact sidebar story block.
 * Colored eyebrow label + bold title + optional summary + source line.
 * Inspired by Design 2's "Weekly Intelligence" sidebar pattern.
 */
export function IntelligenceItem({ article, lang }: IntelligenceItemProps) {
  const lq = (path: string) => withLangParam(path, lang);

  // Determine eyebrow color based on vertical/category
  const eyebrowColor =
    article.vertical === "haiti" || article.geoTag === "HT"
      ? "text-red-600 dark:text-red-400"
      : article.vertical === "opportunites" || article.category === "scholarship"
        ? "text-purple-600 dark:text-purple-400"
        : article.vertical === "education"
          ? "text-teal-600 dark:text-teal-400"
          : "text-blue-600 dark:text-blue-400";

  // Determine eyebrow label
  const fr = lang === "fr";
  const eyebrowLabel =
    article.vertical === "haiti" || article.geoTag === "HT"
      ? (fr ? "Haïti" : "Ayiti")
      : article.vertical === "opportunites" || article.category === "scholarship"
        ? (fr ? "Opportunité" : "Okazyon")
        : article.vertical === "education"
          ? (fr ? "Éducation" : "Edikasyon")
          : article.vertical === "world"
            ? (fr ? "International" : "Entènasyonal")
            : (fr ? "Actualité" : "Nouvèl");

  return (
    <Link
      href={lq(`/news/${article.id}`)}
      className="group flex gap-4"
    >
      {/* Thumbnail */}
      {article.imageUrl && (
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
          <ImageWithFallback
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <span className={`block text-[10px] font-bold uppercase tracking-widest ${eyebrowColor} mb-1`}>
          {eyebrowLabel}
          {article.sourceName && (
            <span className="text-stone-400 dark:text-stone-500"> · {article.sourceName}</span>
          )}
        </span>
        <h4 className="text-sm font-bold leading-snug text-stone-900 line-clamp-3 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
          {article.title}
        </h4>
        {article.publishedAt && (
          <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
            {formatRelativeDate(article.publishedAt, lang)}
          </p>
        )}
      </div>
    </Link>
  );
}
