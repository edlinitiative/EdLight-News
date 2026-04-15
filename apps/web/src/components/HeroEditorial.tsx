import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { CategoryBadge } from "@/components/CategoryBadge";
import { formatRelativeDate, categoryLabel } from "@/lib/utils";
import { BookmarkButton } from "@/components/BookmarkButton";

interface HeroEditorialProps {
  lead: FeedItem | null;
  secondary: FeedItem[];
  lang: ContentLanguage;
}

export function HeroEditorial({ lead, secondary, lang }: HeroEditorialProps) {
  if (!lead) return null;
  const fr = lang === "fr";

  return (
    <section className="mb-8">
      <div className="grid gap-5 lg:grid-cols-12">
        {/* ── Lead story ── */}
        <div className="lg:col-span-7">
          <Link
            href={`/news/${lead.id}?lang=${lang}`}
            className="group relative block overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800"
          >
            <div className="relative aspect-[4/3] sm:aspect-[16/10]">
              {lead.imageUrl ? (
                <ImageWithFallback
                  src={lead.imageUrl}
                  alt={lead.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-950">
                  <span className="text-4xl font-black tracking-tight text-white/20">EdLight</span>
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Content over image */}
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    {categoryLabel(lead.category ?? "news", lang) || (fr ? "À la une" : "Alaune")}
                  </span>
                  {lead.geoTag === "HT" && (
                    <span className="rounded-lg bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      {fr ? "Haïti" : "Ayiti"}
                    </span>
                  )}
                </div>
                <h2
                  className="text-2xl font-extrabold leading-[1.2] tracking-tight text-white sm:text-3xl lg:text-4xl"
                  style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                >
                  {lead.title}
                </h2>
                {lead.summary && (
                  <p className="mt-3 text-sm leading-relaxed text-white/80 line-clamp-2 sm:text-base">
                    {lead.summary}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3 text-xs text-white/60">
                  {lead.sourceName && (
                    <span className="font-semibold uppercase tracking-wider text-white/70">
                      {lead.sourceName}
                    </span>
                  )}
                  {lead.publishedAt && (
                    <>
                      <span className="text-white/40">·</span>
                      <span>{formatRelativeDate(lead.publishedAt, lang)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* ── Secondary stories ── */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {secondary.slice(0, 3).map((article, idx) => (
            <Link
              key={article.id}
              href={`/news/${article.id}?lang=${lang}`}
              className="group flex gap-4 rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
            >
              {/* Thumbnail */}
              {article.imageUrl && (
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800 sm:h-24 sm:w-32">
                  <ImageWithFallback
                    src={article.imageUrl}
                    alt={article.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                      {categoryLabel(article.category ?? "news", lang)}
                    </span>
                  </div>
                  <h3
                    className="text-sm font-bold leading-snug tracking-tight text-stone-900 line-clamp-2 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 sm:text-[15px]"
                    style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                  >
                    {article.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                  {article.sourceName && (
                    <span className="font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      {article.sourceName}
                    </span>
                  )}
                  {article.publishedAt && (
                    <>
                      <span className="text-stone-300 dark:text-stone-600">·</span>
                      <span>{formatRelativeDate(article.publishedAt, lang)}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
