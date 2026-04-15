/**
 * RelatedEventsSection — "Aussi ce jour-là" grid.
 *
 * Renders a section header followed by a responsive 1/2/3 column
 * grid of RelatedEventCard components driven by real almanac data.
 */

import type { ContentLanguage } from "@edlight-news/types";
import type { SerializableAlmanacEntry } from "./shared";
import { RelatedEventCard } from "./RelatedEventCard";
import { SectionHeader } from "./SectionHeader";

interface RelatedEventsSectionProps {
  entries: SerializableAlmanacEntry[];
  lang: ContentLanguage;
  dateLabel: string;
  showDate?: boolean;
}

export function RelatedEventsSection({
  entries,
  lang,
  dateLabel,
  showDate = false,
}: RelatedEventsSectionProps) {
  if (entries.length === 0) return null;

  const fr = lang === "fr";

  return (
    <section id="related" className="pt-20 md:pt-28">
      <SectionHeader
        eyebrow={fr ? "Repères complémentaires" : "Repè konplemantè"}
        title={fr ? "Aussi ce jour-là" : "Menm jou sa a tou"}
        description={
          fr
            ? `D'autres événements du ${dateLabel} qui enrichissent la mémoire historique, politique et culturelle du pays.`
            : `Lòt evènman ${dateLabel} ki anrichi memwa istorik, politik ak kiltirèl peyi a.`
        }
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
        {entries.map((entry) => (
          <RelatedEventCard
            key={entry.id}
            entry={entry}
            lang={lang}
            showDate={showDate}
          />
        ))}
      </div>
    </section>
  );
}
