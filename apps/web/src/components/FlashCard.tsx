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
        "group flex flex-col gap-4 overflow-hidden rounded-lg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-ambient sm:flex-row sm:items-center sm:gap-5",
        bgColor ?? "bg-surface-container-low",
      ].join(" ")}
      style={{ border: '1px solid rgba(202,196,208,0.1)' }}
    >
      {/* Image */}
      {article.imageUrl && (
        <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-lg bg-surface-container sm:aspect-square sm:w-32">
          <ImageWithFallback
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        {badge && (
          <span className="inline-block rounded-full bg-surface-container-highest px-2.5 py-0.5 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
            {badge}
          </span>
        )}
        <h3
          className="text-title-md font-bold leading-snug tracking-tight text-on-surface line-clamp-3 group-hover:text-primary"
          style={{ fontFamily: "var(--font-display, var(--font-sans))" }}
        >
          {article.title}
        </h3>
        {article.summary && (
          <p className="text-body-md leading-relaxed text-on-surface-variant line-clamp-2">
            {article.summary}
          </p>
        )}
        <div className="flex items-center gap-2 text-label-sm text-on-surface-variant/60">
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
      </div>
    </Link>
  );
}
