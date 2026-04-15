/**
 * RelatedEventsSection — "Aussi ce jour-là" grid.
 *
 * Renders a section header followed by a responsive 1/2/3 column
 * grid of RelatedEventCard components using array mapping.
 */

import type { RelatedEvent } from "./data";
import { RelatedEventCard } from "./RelatedEventCard";
import { SectionHeader } from "./SectionHeader";

interface RelatedEventsSectionProps {
  events: readonly RelatedEvent[];
}

export function RelatedEventsSection({ events }: RelatedEventsSectionProps) {
  return (
    <section id="related" className="pt-20 md:pt-28">
      <SectionHeader
        eyebrow="Repères complémentaires"
        title="Aussi ce jour-là"
        description="D'autres événements du 1er janvier qui enrichissent la mémoire historique, politique et culturelle du pays."
        linkText="Voir toutes les archives"
        linkHref="#"
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
        {events.map((event) => (
          <RelatedEventCard key={event.year} event={event} />
        ))}
      </div>
    </section>
  );
}
