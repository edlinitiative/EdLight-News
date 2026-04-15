import type { Item, ContentLanguage } from "@edlight-news/types";
import { ClipboardList } from "lucide-react";
import { formatDate, extractDomain } from "@/lib/utils";

export function BoursesFiche({ item, lang }: { item: Item; lang: ContentLanguage }) {
  const opp = item.opportunity;
  if (!opp) return null;

  const labels = {
    deadline:     lang === "fr" ? "Date limite"       : "Dat limit",
    eligibility:  lang === "fr" ? "Éligibilité"       : "Elijibilite",
    coverage:     lang === "fr" ? "Couverture"        : "Kouvèti",
    howToApply:   lang === "fr" ? "Comment postuler"  : "Kijan pou aplike",
    officialLink: lang === "fr" ? "Lien officiel"     : "Lyen ofisyèl",
  };

  const unknown = lang === "fr" ? "Information à confirmer" : "Enfòmasyon pou konfime";

  const rows: { label: string; value: React.ReactNode }[] = [];

  rows.push({
    label: labels.deadline,
    value: opp.deadline ? formatDate(opp.deadline, lang) : <span className="text-stone-400 dark:text-stone-500 italic">{unknown}</span>,
  });

  if (opp.eligibility?.length) {
    rows.push({
      label: labels.eligibility,
      value: (
        <ul className="list-disc pl-4 space-y-0.5">
          {opp.eligibility.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      ),
    });
  }

  if (opp.coverage) {
    rows.push({ label: labels.coverage, value: opp.coverage });
  }

  if (opp.howToApply) {
    rows.push({ label: labels.howToApply, value: opp.howToApply });
  }

  if (opp.officialLink) {
    rows.push({
      label: labels.officialLink,
      value: (
        <a href={opp.officialLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline dark:text-blue-400">
          {extractDomain(opp.officialLink)}
        </a>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-6 dark:border-stone-700 dark:bg-purple-900/20">
      <h2 className="mb-4 text-title-sm dark:text-white">
        <ClipboardList className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Fiche Bourse" : "Fich Bous"}
      </h2>
      <dl className="space-y-3">
        {rows.map(({ label, value }, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,100px)_1fr] sm:grid-cols-[140px_1fr] gap-2 text-sm">
            <dt className="font-medium text-stone-600 dark:text-stone-400">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
