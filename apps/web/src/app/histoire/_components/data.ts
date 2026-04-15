/**
 * Static editorial content for /histoire.
 * Only contains aspirational theme collections — all other content
 * is derived from real almanac data at render time.
 */

import type { ContentLanguage } from "@edlight-news/types";

// ---------------------------------------------------------------------------
// Theme Collections (aspirational exploration categories)
// ---------------------------------------------------------------------------

export interface ThemeCollection {
  tag: string; // maps to AlmanacTag for future filtering
  title: { fr: string; ht: string };
  description: { fr: string; ht: string };
}

export const themeCollections: ThemeCollection[] = [
  {
    tag: "politics",
    title: { fr: "Politique", ht: "Politik" },
    description: {
      fr: "Traités, constitutions, pouvoirs, ruptures institutionnelles et visions concurrentes de l'État haïtien.",
      ht: "Trete, konstitisyon, pouvwa, riptir enstitisyonèl ak vizyon konkirant Eta ayisyen an.",
    },
  },
  {
    tag: "resistance",
    title: { fr: "Résistance", ht: "Rezistans" },
    description: {
      fr: "Marronnage, soulèvements, contre-pouvoirs et formes populaires de refus qui traversent l'histoire du pays.",
      ht: "Mawonaj, soulèvman, kont-pouvwa ak fòm popilè refize ki travèse istwa peyi a.",
    },
  },
  {
    tag: "culture",
    title: { fr: "Culture", ht: "Kilti" },
    description: {
      fr: "Littérature, arts, musique, spiritualités et imaginaires qui donnent à la mémoire haïtienne sa densité propre.",
      ht: "Literati, la, mizik, espirityalite ak imajinè ki bay memwa ayisyen an dansite pwòp li.",
    },
  },
];
