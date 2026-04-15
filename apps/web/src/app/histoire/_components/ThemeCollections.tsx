/**
 * ThemeCollections — "Explorer la mémoire par grands ensembles" section.
 *
 * Centered section header + responsive 1/3 column grid of
 * immersive ThemeCollectionCard components.
 */

import type { ThemeCollection } from "./data";
import { ThemeCollectionCard } from "./ThemeCollectionCard";
import { SectionHeader } from "./SectionHeader";

interface ThemeCollectionsProps {
  themes: readonly ThemeCollection[];
}

export function ThemeCollections({ themes }: ThemeCollectionsProps) {
  return (
    <section id="themes" className="pt-20 md:pt-28">
      <SectionHeader
        eyebrow="Exploration thématique"
        title="Explorer la mémoire par grands ensembles"
        align="center"
      />

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {themes.map((theme) => (
          <ThemeCollectionCard key={theme.title} theme={theme} />
        ))}
      </div>
    </section>
  );
}
