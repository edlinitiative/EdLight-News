/**
 * Haitian Creole glossary for EdLight News content generation.
 * Maps French / English terms to their standard Kreyòl Ayisyen equivalents.
 *
 * Canonical reference for LLM prompts — keeps every generated article
 * consistent with official Creole orthography.
 */

export const CREOLE_GLOSSARY: Record<string, string> = {
  /* ── Proper nouns / Place names ─────────────────────────── */
  "Haïti": "Ayiti",
  "Port-au-Prince": "Pòtoprens",
  "Cap-Haïtien": "Okap",
  "Citadelle Laferrière": "Sitadèl Lafèryè",
  "Palais Sans-Souci": "Palè San Sousi",
  "Les Cayes": "Okay",

  /* ── Government / Institutions ──────────────────────────── */
  "Ministère": "Ministè",
  "Président": "Prezidan",
  "Gouvernement": "Gouvènman",
  "Parlement": "Palman",
  "Constitution": "Konstitisyon",
  "Élection": "Eleksyon",
  "Police Nationale": "Polis Nasyonal",
  "Condition Féminine": "Kondisyon Feminin",

  /* ── Education terms ────────────────────────────────────── */
  "Bourse": "Bous",
  "Université": "Inivèsite",
  "Étudiant": "Etidyan",
  "Diplôme": "Diplòm",
  "Formation": "Fòmasyon",
  "Concours": "Konkou",
  "Stage": "Estaj",
  "Examen": "Egzamen",
  "Baccalauréat": "Bakaloreya",

  /* ── News / Media terms ─────────────────────────────────── */
  "Actualités": "Nouvèl / Aktyalite",
  "Article": "Atik",
  "Source": "Sous",
  "Opportunité": "Okazyon",
  "Ressource": "Resous",
  "Événement": "Evènman",
  "Calendrier": "Kalandriye",
  "Date limite": "Dat limit",

  /* ── Common verbs / phrases ─────────────────────────────── */
  "En savoir plus": "Aprann plis",
  "Voir tout": "Wè tout",
  "S'inscrire": "Enskri",
  "Postuler": "Aplike / Poze kandidati",
  "Fermer": "Fèmen",
  "Dernière mise à jour": "Dènye mizajou",
};

/**
 * Returns a formatted glossary + orthographic-rules block
 * ready for injection into an LLM prompt.
 */
export function getCreoleGlossaryBlock(): string {
  const entries = Object.entries(CREOLE_GLOSSARY)
    .map(([fr, ht]) => `  - ${fr} → ${ht}`)
    .join("\n");

  return `GLOSÈ KREYÒL / GLOSSAIRE CRÉOLE (obligatoire pour toute traduction):
${entries}

RÈGLES ORTHOGRAPHIQUES KREYÒL:
  - Utilise "è" (e ouverte), jamais "e" simple pour le son /ɛ/.
  - Utilise "ò" (o ouverte) pour le son /ɔ/.
  - "ou" = "you" en anglais (2e personne).
  - Utilise "w" et non "oi" pour le son /w/.
  - Ne JAMAIS mélanger français et créole dans la même phrase.
  - Pas d'articles français (le, la, les, un, une, des) — utilise les déterminants créoles (la, a, yo, yon).
  - Les verbes ne se conjuguent pas — utilise les marqueurs de temps (te, ap, pral, ta).`;
}
