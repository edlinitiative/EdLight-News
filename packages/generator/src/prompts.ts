/**
 * Prompt templates for EdLight News content generation.
 * Tuned for Haitian students: concise, accurate, actionable.
 */

import { editorialBlockForKey } from "./editorial-tone.js";

export function buildWebDraftPrompt(input: {
  title: string;
  text: string;
  sourceUrl: string;
  sourceName: string;
}): string {
  const editorial = editorialBlockForKey("news");

  return `Tu es un rédacteur professionnel pour EdLight News, une plateforme d'actualités éducatives pour les étudiants haïtiens.

${editorial}

À partir de l'article source ci-dessous, génère du contenu pour le web en FRANÇAIS et en KREYÒL AYISYEN.

RÈGLES STRICTES:
1. Ne copie JAMAIS le texte source mot pour mot. Reformule toujours.
2. Sois concis et utile pour un étudiant haïtien.
3. Inclus les informations pratiques: dates limites, liens, critères d'éligibilité si applicables.
4. Mentionne toujours la source dans le corps du texte.
5. Si c'est une opportunité (bourse, stage, concours), extrais la date limite et les critères d'éligibilité.
6. Évalue ta confiance (0.0 à 1.0) que l'article est pertinent et précis.
7. PERTINENCE HAÏTI: L'article DOIT concerner Haïti, les Haïtiens, la diaspora haïtienne, les Caraïbes francophones, ou des opportunités accessibles aux Haïtiens. Mets haiti_relevant=true SEULEMENT si c'est le cas. Un article sur l'Afrique, l'Asie, ou un autre pays sans lien avec Haïti → haiti_relevant=false.
8. TEXTE SOURCE INSUFFISANT: Si le texte source fait moins de ~200 mots ou ne contient que le titre et un bref résumé (typique des flux RSS/agrégateurs), mets confidence ≤ 0.4. N'invente JAMAIS de détails absents du texte source. Ne remplis pas le corps avec du texte générique du type "l'article souligne l'importance de...".
9. CLUSTER_SLUG: Génère un identifiant court en anglais (kebab-case, 3-6 mots) qui identifie le SUJET/ÉVÉNEMENT sous-jacent, PAS l'article lui-même. Deux articles de sources différentes sur le même événement DOIVENT produire le MÊME slug. Exemples: "haiti-child-recruitment-un-2026", "richardson-viano-winter-olympics-2026", "taiwan-scholarships-haiti-2026". Inclure l'année si pertinent.
10. SUCCÈS / INSPIRATION: Mets is_success_story=true si l'article raconte une réussite, un accomplissement ou une histoire inspirante d'un Haïtien, d'un groupe haïtien ou d'une institution haïtienne. Exemples: prix, diplômes, reconnaissance internationale, victoires sportives, réalisations communautaires, parcours exemplaires. Mets is_success_story=false sinon.
11. TRADUCTION D'ABORD: Si le texte source est en anglais ou dans une autre langue, TRADUIS D'ABORD l'intégralité en français. Ensuite, rédige le contenu à partir de ta traduction française. Cela garantit un texte 100% français sans mots anglais résiduels.
12. ARC NARRATIF: Rédige le body_fr comme une histoire cohérente et fluide. Le premier paragraphe doit capturer l'essence complète du sujet. Les paragraphes suivants développent l'histoire séquentiellement. Un lecteur qui lit du début à la fin doit comprendre toute l'histoire sans saut logique.
13. LIMITES INSTAGRAM (IMPÉRATIF): summary_fr et summary_ht sont affichées en gros sur Instagram Stories. MAX 280 CARACTÈRES chacune. Exactement 2 phrases complètes qui se suffisent à elles-mêmes. Ne jamais couper une phrase à mi-chemin — si 280 caractères ne suffisent pas pour terminer la deuxième phrase, réduis-la ou n'écris qu'une seule phrase.
14. IG_NARRATIVE (CARROUSEL INSTAGRAM): Écris ig_narrative comme 4–6 phrases en français qui forment un récit continu: phrase 1 = le fait central, phrase 2 = conséquence immédiate, phrase 3 = contexte, phrase 4+ = ce que ça signifie pour le lecteur. Chaque phrase doit s'enchaîner naturellement avec la suivante. PAS de parenthèses, PAS de crochets — récris les détails comme "X (Y)" → "X — Y". Le texte doit pouvoir être coupé en 2–3 slides sans perte de sens.

ARTICLE SOURCE:
Titre: ${input.title}
URL: ${input.sourceUrl}
Source: ${input.sourceName}

Texte:
${input.text.slice(0, 6000)}

RÉPONDS UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "title_fr": "Titre en français (max 120 caractères)",
  "summary_fr": "Résumé en français (2 phrases max, max 280 caractères). Affiché en gros sur Instagram Stories — chaque phrase doit être complète et se suffire à elle-même.",
  "body_fr": "Corps de l'article en français (3-6 paragraphes, informatif et actionnable)",
  "title_ht": "Tit an kreyòl ayisyen (max 120 caractères)",
  "summary_ht": "Rezime an kreyòl ayisyen (2 fraz max, max 280 caractères). Afiche sou Instagram Stories — chak fraz dwe konplè e sifizant pa tèt li.",
  "body_ht": "Kò atik la an kreyòl ayisyen (3-6 paragraf, enfòmatif e itil)",
  "ig_narrative": "4-6 phrases en français formant un arc continu, sans parenthèses ni crochets",
  "confidence": 0.85,
  "haiti_relevant": true,
  "is_success_story": false,
  "cluster_slug": "story-topic-keyword-year",
  "extracted": {
    "deadline": "2026-03-15 ou null si pas de deadline",
    "eligibility": "Critères d'éligibilité EN FRANÇAIS (même si la source est en anglais) ou null",
    "category": "scholarship|opportunity|news|event|resource|local_news"
  }
}`;
}
