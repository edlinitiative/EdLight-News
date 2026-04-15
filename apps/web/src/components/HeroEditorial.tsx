import Link from "next/link";
import { Newspaper } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { CategoryBadge } from "@/components/CategoryBadge";
import { IntelligenceItem } from "@/components/IntelligenceItem";
import {
  formatRelativeDate,
  withLangParam,
  categoryLabel,
  CATEGORY_COLORS,
} from "@/lib/utils";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const OPPORTUNITY_CATS = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

function displayCategory(a: FeedItem): string {
  const cat = a.category ?? "";
  if (cat === "resource" && a.itemType === "utility" && a.utilityType === "daily_fact") {
    return a.geoTag === "HT" ? "local_news" : "news";
  }
  if (OPPORTUNITY_CATS.has(cat)) {
    // simple smell-test: title/summary must contain opportunity keywords
    const blob = `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase();
    const oppWords = ["bourse", "scholarship", "programme", "stage", "concours", "fellowship", "grant", "appel", "candidature", "apply", "deadline", "postuler"];
    if (!oppWords.some((w) => blob.includes(w))) {
      return a.geoTag === "HT" || a.vertical === "haiti" ? "local_news" : "news";
    }
  }
  return cat;
}

/* ── Props ────────────────────────────────────────────────────────────────── */

interface HeroEditorialProps {
  lead: FeedItem | null;
  secondary: FeedItem[];
  lang: ContentLanguage;
}

/**
 * HeroEditorial — Premium asymmetric hero module.
 *
 * Left: lead story with large image, oversized serif headline, source attribution.
 * Right: "Today's Essentials" sidebar — up to 3 secondary stories as intelligence
 *        items plus an editorial pull quote.
 */
export function HeroEditorial({ lead, secondary, lang }: HeroEditorialProps) {
  const fr = lang === "fr";
  const lq = (path: string) => withLangParam(path, lang);

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <Newspaper className="mx-auto mb-3 h-8 w-8 text-stone-300" />
        <p className="text-stone-400">
          {fr ? "Aucun article pour le moment." : "Pa gen atik pou kounye a."}
        </p>
      </div>
    );
  }

  const leadCat = displayCategory(lead);

  return (
    <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-stone-200 bg-white pb-12 pt-6 dark:border-stone-800 dark:bg-stone-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Masthead eyebrow ── */}
        <div className="mb-8 flex items-center gap-3 border-b-2 border-stone-900 pb-3 dark:border-stone-100">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-stone-900 dark:text-stone-100">
            EdLight News
          </span>
          <span className="h-3.5 w-px bg-stone-400 dark:bg-stone-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400 dark:text-stone-500">
            {new Date().toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {/* ── Two-column hero ── */}
        <div className="grid gap-10 lg:grid-cols-12">
          {/* ── Lead story (8 cols) ── */}
          <div className="lg:col-span-8">
            <Link href={lq(`/news/${lead.id}`)} className="group block">
              {/* Category + geo tag */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <CategoryBadge category={leadCat} lang={lang} pill />
                {lead.geoTag === "HT" && leadCat !== "local_news" && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    {fr ? "Haïti" : "Ayiti"}
                  </span>
                )}
              </div>

              {/* Headline — oversized serif */}
              <h1
                className="mb-4 text-3xl font-extrabold leading-[1.08] tracking-tight text-stone-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400 sm:text-4xl lg:text-5xl"
                style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
              >
                {lead.title}
              </h1>

              {/* Summary with left accent border */}
              {lead.summary && (
                <div className="mb-6 border-l-4 border-blue-600 pl-4 dark:border-blue-400">
                  <p className="text-base leading-relaxed text-stone-500 line-clamp-3 dark:text-stone-400 sm:text-lg">
                    {lead.summary}
                  </p>
                </div>
              )}

              {/* Image */}
              {lead.imageUrl && (
                <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl bg-stone-100 shadow-lg dark:bg-stone-800">
                  <ImageWithFallback
                    src={lead.imageUrl}
                    alt={lead.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                  {lead.imageSource === "wikidata" && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/70">
                      Wikimedia
                    </span>
                  )}
                </div>
              )}

              {/* Source attribution */}
              <div className="flex items-center gap-3 text-sm">
                {lead.sourceName && (
                  <span className="font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    via {lead.sourceName}
                  </span>
                )}
                {lead.sourceName && lead.publishedAt && (
                  <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-stone-600" />
                )}
                {lead.publishedAt && (
                  <span className="text-stone-400 dark:text-stone-500">
                    {formatRelativeDate(lead.publishedAt, lang)}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* ── Today's Essentials sidebar (4 cols) ── */}
          <aside className="lg:col-span-4 lg:border-l lg:border-stone-200 lg:pl-8 dark:lg:border-stone-800">
            <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
              {fr ? "Essentiels du jour" : "Esansyèl jou a"}
            </h3>

            <div className="space-y-6">
              {secondary.map((article) => (
                <IntelligenceItem
                  key={article.id}
                  article={article}
                  lang={lang}
                />
              ))}
            </div>

            {/* Editorial pull quote */}
            <div className="mt-8 border-t border-stone-200 pt-8 dark:border-stone-800">
              <div className="flex gap-3">
                <div className="w-1 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                <div>
                  <p
                    className="text-lg font-light italic leading-relaxed text-stone-700 dark:text-stone-300"
                    style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                  >
                    {fr
                      ? "«\u00A0L'information est la nouvelle monnaie de la souveraineté\u00A0; le rôle du curateur est d'en vérifier la pureté.\u00A0»"
                      : "«\u00A0Enfòmasyon se nouvo lajan sovrennte\u00A0; wòl kiratè a se verifye pirete li.\u00A0»"}
                  </p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                    — {fr ? "Comité éditorial, EdLight News" : "Komite editoryal, EdLight News"}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
