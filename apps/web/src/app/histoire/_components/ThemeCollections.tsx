import type { ContentLanguage } from "@edlight-news/types";
import { themeCollections } from "./data";
import { ThemeCollectionCard } from "./ThemeCollectionCard";
import { SectionHeader } from "./SectionHeader";

interface ThemeCollectionsProps {
  lang: ContentLanguage;
  onExploreClick?: () => void;
}

export function ThemeCollections({
  lang,
  onExploreClick,
}: ThemeCollectionsProps) {
  const fr = lang === "fr";

  return (
    <section className="py-16 px-4 md:px-8">
      <SectionHeader
        eyebrow={fr ? "Exploration thématique" : "Eksplorasyon tematik"}
        title={
          fr
            ? "Explorer la mémoire par grands ensembles"
            : "Eksplore memwa a pa gwo ansanm"
        }
        align="center"
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {themeCollections.map((theme) => (
          <ThemeCollectionCard
            key={theme.tag}
            theme={theme}
            lang={lang}
            onExploreClick={onExploreClick}
          />
        ))}
      </div>
    </section>
  );
}
