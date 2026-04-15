import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { BookmarkButton } from "@/components/BookmarkButton";
import { formatRelativeDate, categoryLabel, CATEGORY_COLORS } from "@/lib/utils";

interface EditorialCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  displayCategory?: string;
  showImage?: boolean;
}

export function EditorialCard({
  article,
  lang,
  displayCategory,
  showImage = true,
}: EditorialCardProps) {
  const cat = displayCategory ?? article.category ?? "";
  const label = categoryLabel(cat, lang);
  const hasImage = showImage && !!article.imageUrl && !(
    article.itemType === "utility" && article.imageSource === "branded"
  );
  const fr = lang === "fr";

  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
    >
      {/* Image */}
      {hasImage && (
        <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 dark:bg-stone-800">
          <ImageWithFallback
            src={article.imageUrl!}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          {/* Category overlay at bottom-left */}
          {label && (
            <div className="absolute bottom-3 left-3">
              <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 shadow-sm backdrop-blur-sm dark:bg-stone-900/90 dark:text-stone-300">
                {label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        {/* Category (when no image) */}
        {!hasImage && label && (
          <span className="w-fit rounded-lg bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            {label}
          </span>
        )}

        {/* Title */}
        <h3
          className="text-lg font-bold leading-snug tracking-tight text-stone-900 line-clamp-2 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400"
          style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p className="text-sm leading-relaxed text-stone-500 line-clamp-2 dark:text-stone-400">
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
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
          <BookmarkButton articleId={article.id} lang={lang} />
        </div>
      </div>
    </Link>
  );
}
