import type { Item, ContentLanguage } from "@edlight-news/types";
import { extractDomain } from "@/lib/utils";

export function SourceLinks({ item, lang }: { item: Item | null; lang: ContentLanguage }) {
  if (!item?.source?.originalUrl && !item?.canonicalUrl) return null;
  const fr = lang === "fr";

  const originalUrl = item.source?.originalUrl ?? item.canonicalUrl;
  const aggregatorUrl = item.source?.aggregatorUrl;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <a
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 font-medium text-blue-700 ring-1 ring-inset ring-blue-100 transition-all hover:bg-blue-100 hover:shadow-sm dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800/40 dark:hover:bg-blue-800"
      >
        <span>{fr ? "Source officielle" : "Sous ofisyèl"}</span>
        <span className="text-xs text-blue-400 dark:text-blue-500">({extractDomain(originalUrl)})</span>
      </a>
      {aggregatorUrl && aggregatorUrl !== originalUrl && (
        <a
          href={aggregatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-50 px-4 py-2 text-stone-600 ring-1 ring-inset ring-stone-200/60 transition-all hover:bg-stone-100 hover:shadow-sm dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-700"
        >
          <span>{fr ? "Via agrégateur" : "Via agregatè"}</span>
          <span className="text-xs text-stone-400 dark:text-stone-500">({extractDomain(aggregatorUrl)})</span>
        </a>
      )}
    </div>
  );
}
