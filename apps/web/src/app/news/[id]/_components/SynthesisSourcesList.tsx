import type { Item, ContentLanguage } from "@edlight-news/types";
import { Newspaper } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function SynthesisSourcesList({
  item,
  lang,
}: {
  item: Item;
  lang: ContentLanguage;
}) {
  const sourceList = item.sourceList;
  if (!sourceList || sourceList.length === 0) return null;

  return (
    <section className="rounded-2xl border border-stone-200/80 bg-stone-50 p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="mb-3 text-title-sm dark:text-white">
        <Newspaper className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr"
          ? `Sources (${sourceList.length})`
          : `Sous (${sourceList.length})`}
      </h2>
      <ul className="space-y-2">
        {sourceList.map((src, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex-shrink-0 text-stone-400 dark:text-stone-500">•</span>
            <div>
              <span className="font-medium">{src.sourceName}</span>
              <span className="text-stone-400 dark:text-stone-500"> — </span>
              <span className="text-stone-600 dark:text-stone-300">{src.title}</span>
              {src.publishedAt && (
                <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">
                  ({formatDate(src.publishedAt, lang)})
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
