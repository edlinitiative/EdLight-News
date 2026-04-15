import type { ContentLanguage } from "@edlight-news/types";
import type { ThemeCollection } from "./data";

interface ThemeCollectionCardProps {
  theme: ThemeCollection;
  lang: ContentLanguage;
  onExploreClick?: () => void;
}

const gradientByTag: Record<string, string> = {
  politics: "bg-gradient-to-br from-stone-800 to-stone-950",
  resistance: "bg-gradient-to-br from-rose-900 to-rose-950",
  culture: "bg-gradient-to-br from-indigo-900 to-indigo-950",
};

export function ThemeCollectionCard({
  theme,
  lang,
  onExploreClick,
}: ThemeCollectionCardProps) {
  const fr = lang === "fr";
  const gradient =
    gradientByTag[theme.tag] ??
    "bg-gradient-to-br from-stone-800 to-stone-950";

  return (
    <div
      className={`relative flex flex-col justify-end min-h-[380px] rounded-2xl overflow-hidden p-8 ${gradient}`}
    >
      {/* Content */}
      <div className="relative z-10 flex flex-col gap-4 text-white">
        {/* Eyebrow */}
        <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
          {fr ? "Thème" : "Tèm"}
        </span>

        {/* Title */}
        <h3 className="font-serif text-2xl md:text-3xl font-bold leading-tight">
          {fr ? theme.title.fr : theme.title.ht}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed text-white/80 line-clamp-3">
          {fr ? theme.description.fr : theme.description.ht}
        </p>

        {/* Button */}
        {onExploreClick ? (
          <button
            type="button"
            onClick={onExploreClick}
            className="mt-2 self-start rounded-full border border-white/40 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            {fr ? "Explorer ce thème" : "Eksplore tèm sa a"}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="mt-2 self-start rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white/40 cursor-not-allowed"
          >
            {fr ? "Explorer ce thème" : "Eksplore tèm sa a"}
          </button>
        )}
      </div>
    </div>
  );
}
