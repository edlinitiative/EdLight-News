import type { Item, ContentLanguage } from "@edlight-news/types";
import { ClipboardList, Calendar } from "lucide-react";

export function UtilityFactsFiche({
  item,
  lang,
}: {
  item: Item;
  lang: ContentLanguage;
}) {
  const meta = item.utilityMeta;
  if (!meta?.extractedFacts) return null;
  const facts = meta.extractedFacts;
  const hasContent =
    (facts.deadlines?.length ?? 0) > 0 ||
    (facts.requirements?.length ?? 0) > 0 ||
    (facts.steps?.length ?? 0) > 0 ||
    (facts.eligibility?.length ?? 0) > 0;
  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6 dark:border-stone-700 dark:bg-violet-900/20">
      <h2 className="mb-4 text-title-sm dark:text-white">
        <ClipboardList className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Informations clés" : "Enfòmasyon kle"}
      </h2>
      <dl className="space-y-3">
        {facts.deadlines && facts.deadlines.length > 0 && (
          <div>
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
              {lang === "fr" ? "Dates limites" : "Dat limit yo"}
            </dt>
            <dd className="mt-1">
              <ul className="space-y-1">
                {facts.deadlines.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                    <span>
                      {d.label}
                      {d.dateISO ? (
                        <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">{d.dateISO}</span>
                      ) : (
                        <span className="ml-1 italic text-stone-400 dark:text-stone-500">
                          {lang === "fr" ? "(à confirmer)" : "(pou konfime)"}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {facts.eligibility && facts.eligibility.length > 0 && (
          <div>
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
              {lang === "fr" ? "Éligibilité" : "Elijibilite"}
            </dt>
            <dd className="mt-1">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {facts.eligibility.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </dd>
          </div>
        )}
        {facts.requirements && facts.requirements.length > 0 && (
          <div>
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
              {lang === "fr" ? "Exigences" : "Egzijans yo"}
            </dt>
            <dd className="mt-1">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {facts.requirements.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </dd>
          </div>
        )}
        {facts.steps && facts.steps.length > 0 && (
          <div>
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
              {lang === "fr" ? "Étapes" : "Etap yo"}
            </dt>
            <dd className="mt-1">
              <ol className="list-decimal pl-4 space-y-0.5 text-sm">
                {facts.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
