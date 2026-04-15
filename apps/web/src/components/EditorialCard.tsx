import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { CategoryBadge } from "@/components/CategoryBadge";
import {
  formatRelativeDate,
  withLangParam,
} from "@/lib/utils";

interface EditorialCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  /** Override the accent color for the bottom underline */
  accentColor?: string;
  /** Show/hide the image (default: true if article has image) */
  showImage?: boolean;
  /** Display category for the badge */
  displayCategory?: string;
}

/**
 * EditorialCard — premium article card with editorial styling.
 *
 * Visual features:
 * - Grayscale→color image transition on hover (Design 1 pattern)
 * - Accent underline at card bottom
 * - Structured source attribution with "via" prefix
 * - Generous spacing and restrained typography
 */
export function EditorialCard({
  article,
  lang,
  accentColor = "bg-blue-600",
  showImage = true,
  displayCategory,
}: EditorialCardProps) {
  const lq = (path: string) => withLangParam(path, lang);
  const hasImage = showImage && !!article.imageUrl;
  const cat = displayCategory ?? article.category;

  return (
    <Link
      href={lq(`/news/${article.id}`)}
      className="group flex flex-col"
    >
      {/* Image with grayscale→color hover */}
      {hasImage && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-stone-100 mb-4 dark:bg-stone-800">
          <ImageWithFallback
            src={article.imageUrl!}
            alt={article.title}
            className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-[1.03]"
          />
        </div>
      )}

      {/* Eyebrow: category + source */}
      <div className="mb-2 flex items-center gap-2">
        <CategoryBadge category={cat} lang={lang} pill />
        {article.sourceName && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            via {article.sourceName}
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className="mb-2 text-lg font-bold leading-snug tracking-tight text-stone-900 line-clamp-3 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400 sm:text-xl"
        style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
      >
        {article.title}
      </h3>

      {/* Summary */}
      {article.summary && (
        <p className="mb-4 text-sm leading-relaxed text-stone-500 line-clamp-2 dark:text-stone-400">
          {article.summary}
        </p>
      )}

      {/* Accent underline */}
      <div className={`mt-auto h-[2px] w-12 rounded-full ${accentColor}`} />
    </Link>
  );
}
