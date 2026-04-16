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
      className="group flex flex-col overflow-hidden transition-all duration-300"
    >
      {/* Image */}
      {hasImage && (
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-container dark:bg-surface-container">
          <ImageWithFallback
            src={article.imageUrl!}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          {/* Category overlay at bottom-left */}
          {label && (
            <div className="absolute bottom-3 left-3">
              <span className="rounded-full bg-surface/90 px-2.5 py-1 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant shadow-soft backdrop-blur-sm">
                {label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-0">
        {/* Category (when no image) */}
        {!hasImage && label && (
          <span className="w-fit rounded-full bg-surface-container-highest px-2.5 py-0.5 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
            {label}
          </span>
        )}

        {/* Title */}
        <h3
          className="text-title-md font-bold leading-snug tracking-tight text-on-surface line-clamp-2 group-hover:text-primary"
          style={{ fontFamily: "var(--font-display, var(--font-sans))" }}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p className="text-body-md leading-relaxed text-on-surface-variant line-clamp-2">
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-label-sm text-on-surface-variant/70 dark:text-on-surface-variant">
            {article.sourceName && (
              <span className="font-semibold uppercase tracking-wider text-on-surface-variant">
                {article.sourceName}
              </span>
            )}
            {article.publishedAt && (
              <>
                {article.sourceName && <span className="text-outline-variant">·</span>}
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
