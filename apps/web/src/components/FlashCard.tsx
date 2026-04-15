import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatRelativeDate, withLangParam } from "@/lib/utils";

interface FlashCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  /** Badge text (e.g., "Flash Report", "À la une") */
  badge?: string;
  /** Background color class */
  bgColor?: string;
}

/**
 * FlashCard — highlighted featured card with accent background.
 * Inspired by Design 1's "Flash Report" pattern.
 * Designed to stand out in a mixed-density layout.
 */
export function FlashCard({
  article,
  lang,
  badge,
  bgColor = "bg-stone-100 dark:bg-stone-800/50",
}: FlashCardProps) {
  const fr = lang === "fr";
  const lq = (path: string) => withLangParam(path, lang);

  return (
    <Link
      href={lq(`/news/${article.id}`)}
      className={`group block rounded-xl p-6 transition-all hover:shadow-md sm:p-8 ${bgColor}`}
    >
      {/* Badge */}
      {badge && (
        <span className="mb-4 inline-block rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white dark:bg-blue-500">
          {badge}
        </span>
      )}

      {/* Title */}
      <h3
        className="mb-3 text-xl font-extrabold leading-tight tracking-tight text-stone-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400 sm:text-2xl lg:text-3xl"
        style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
      >
        {article.title}
      </h3>

      {/* Summary */}
      {article.summary && (
        <p className="mb-4 text-sm leading-relaxed text-stone-500 line-clamp-3 dark:text-stone-400">
          {article.summary}
        </p>
      )}

      {/* CTA */}
      <span className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
        {fr ? "LIRE L'ANALYSE" : "LI ANALIZ LA"}
        <TrendingUp className="h-4 w-4" />
      </span>
    </Link>
  );
}
