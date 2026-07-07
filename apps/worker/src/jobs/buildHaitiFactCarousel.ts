/**
 * Worker job: buildHaitiFactCarousel — "Fierté haïtienne / Le savais-tu ?"
 *
 * A daily, positive fact-of-the-day carousel about Haiti — the proud, uplifting
 * side (distinct from the dated `histoire` posts, which cover events that are
 * sometimes somber). Facts are CURATED and verified (never LLM-invented) so a
 * "proud fact" is never wrong.
 *
 * Reuses the IG carousel pipeline: written as igType "utility" (the daily
 * fait-du-jour slot → rendered by the premium `explainer-carousel` template),
 * scheduled by scheduleIgPost, published as a native IG carousel. Copy is short
 * (fit gate) and all-French (needsReview gate). A cover landmark/portrait image
 * gives it visual punch; a failed image URL falls back to the navy cover.
 *
 * Self-gates: once/day, Haiti posting window, rotates through the fact list.
 */

import { igQueueRepo } from "@edlight-news/firebase";
import type { IGFormattedPayload, IGSlide, IGQueueStatus } from "@edlight-news/types";

const HAITI_TZ = "America/Port-au-Prince";
const WINDOW_START_HOUR = 6;
const WINDOW_END_HOUR = 19;

const WM = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1200`;

const IMG = {
  flag: WM("Flag_of_Haiti.svg"),
  citadelle: WM("Citadelle_Laferrière.jpg"),
  toussaint: WM("Toussaint_Louverture.jpg"),
  dessalines: WM("Jean_Jacques_Dessalines.jpg"),
};

// ── Curated proud-Haiti facts (verified, all-French) ────────────────────────

interface HaitiFact {
  id: string;
  cover: string; // ≤ ~8 words
  deck: string; // short cover sub-line
  detail: string[]; // 2–3 short bullets
  pride: string; // one "why it's a source of pride" line
  heroImage: string;
}

const FACTS: HaitiFact[] = [
  {
    id: "premiere-republique-noire",
    cover: "1804 : la première république noire",
    deck: "Née d'une révolte d'esclaves victorieuse.",
    detail: [
      "Haïti devient le premier pays libéré par ses esclaves.",
      "La première nation à abolir définitivement l'esclavage.",
    ],
    pride: "Un exemple de liberté pour le monde entier.",
    heroImage: IMG.flag,
  },
  {
    id: "citadelle-laferriere",
    cover: "La Citadelle Laferrière",
    deck: "La plus grande forteresse des Amériques.",
    detail: [
      "Bâtie après l'indépendance pour défendre la liberté.",
      "Classée au patrimoine mondial de l'UNESCO.",
    ],
    pride: "Un chef-d'œuvre élevé par des mains libres.",
    heroImage: IMG.citadelle,
  },
  {
    id: "toussaint-louverture",
    cover: "Toussaint Louverture",
    deck: "Le stratège de la révolution haïtienne.",
    detail: [
      "Il mène les esclaves vers la liberté.",
      "Son nom inspire les luttes pour la dignité partout.",
    ],
    pride: "Une figure mondiale de la liberté.",
    heroImage: IMG.toussaint,
  },
  {
    id: "dessalines-independance",
    cover: "Dessalines, père de l'indépendance",
    deck: "Le 1er janvier 1804, Haïti est libre.",
    detail: [
      "Jean-Jacques Dessalines proclame l'indépendance.",
      "Premier chef d'État de la nation libre.",
    ],
    pride: "Le fondateur de la première nation noire libre.",
    heroImage: IMG.dessalines,
  },
  {
    id: "haiti-aide-amerique-latine",
    cover: "Haïti a aidé à libérer l'Amérique latine",
    deck: "Un phare de liberté pour tout un continent.",
    detail: [
      "Le président Pétion soutient Simón Bolívar : asile, armes, moyens.",
      "En échange d'abolir l'esclavage dans les terres libérées.",
    ],
    pride: "La liberté d'Haïti a éclairé tout un continent.",
    heroImage: IMG.flag,
  },
  {
    id: "chasseurs-volontaires-savannah",
    cover: "Des Haïtiens à la naissance des USA",
    deck: "Le courage haïtien reconnu à l'étranger.",
    detail: [
      "Les Chasseurs-Volontaires combattent à Savannah en 1779.",
      "Pour l'indépendance américaine.",
    ],
    pride: "Un héritage de bravoure salué jusqu'aux États-Unis.",
    heroImage: IMG.flag,
  },
  {
    id: "creole-haitien",
    cover: "Le créole haïtien, une vraie langue",
    deck: "Parlée par des millions de personnes.",
    detail: [
      "Langue officielle d'Haïti, riche et vivante.",
      "Née de la résistance et de la créativité du peuple.",
    ],
    pride: "Une langue qui unit tout un peuple.",
    heroImage: IMG.flag,
  },
  {
    id: "bwa-kayiman",
    cover: "Bwa Kayiman, 1791",
    deck: "L'étincelle de la révolution.",
    detail: [
      "La cérémonie qui déclencha le soulèvement.",
      "Le point de départ de la marche vers la liberté.",
    ],
    pride: "Le moment qui changea le cours de l'histoire.",
    heroImage: IMG.citadelle,
  },
];

// ── Time / rotation ─────────────────────────────────────────────────────────

function toHaiti(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: HAITI_TZ }));
}

function haitiDateKey(date: Date = new Date()): string {
  const h = toHaiti(date);
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

/** @internal exported for tests */
export function isInWindow(date: Date = new Date()): boolean {
  const h = toHaiti(date).getHours();
  return h >= WINDOW_START_HOUR && h < WINDOW_END_HOUR;
}

function pickFact(date: Date = new Date()): HaitiFact {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return FACTS[dayIndex % FACTS.length]!;
}

// ── Payload ─────────────────────────────────────────────────────────────────

function buildPayload(f: HaitiFact): IGFormattedPayload {
  const slides: IGSlide[] = [
    // Cover — fact headline + deck over a landmark/portrait image
    { heading: f.cover, bullets: [f.deck], backgroundImage: f.heroImage },
    // The fact itself
    { heading: "Le savais-tu ?", bullets: f.detail, layout: "explanation" },
    // Why it's a source of pride
    { heading: "Fierté haïtienne", bullets: [f.pride], layout: "explanation" },
    // CTA (one bullet only — the layout renders bullets as a single tagline)
    {
      heading: "Suis EdLight News",
      bullets: ["L'histoire et la fierté d'Haïti, chaque jour — lien dans la bio."],
      layout: "cta",
    },
  ];

  const caption = [
    `${f.cover}.`,
    "",
    `${f.deck} ${f.pride}`,
    "",
    "🇭🇹 Chak jou, yon rezon pou nou fyè de peyi nou.",
    "",
    "→ Suis @edlightnews pour l'histoire et la fierté d'Haïti, chaque jour.",
    "",
    "#FiertéHaïtienne #Haiti #Ayiti #LeSavaisTu #HistoireHaïti #EdLightNews",
  ].join("\n");

  return { slides, caption };
}

// ── Main job ─────────────────────────────────────────────────────────────────

export interface BuildHaitiFactResult {
  queued: boolean;
  skipped: string;
  fact?: string;
}

export async function buildHaitiFactCarousel(): Promise<BuildHaitiFactResult> {
  if (!isInWindow()) return { queued: false, skipped: "outside-window" };

  const today = haitiDateKey();

  const [recent, queued, scheduled] = await Promise.all([
    igQueueRepo.listRecentPosted(1, 30),
    igQueueRepo.listQueuedByScore(40),
    igQueueRepo.listScheduled(30),
  ]);
  const existsToday = [...recent, ...queued, ...scheduled].some(
    (p) => p.sourceContentId.startsWith("haiti-fact-") && p.sourceContentId.endsWith(today),
  );
  if (existsToday) return { queued: false, skipped: "already-exists-today" };

  const fact = pickFact();
  const payload = buildPayload(fact);

  await igQueueRepo.createIGQueueItem({
    sourceContentId: `haiti-fact-${fact.id}-${today}`,
    igType: "utility", // daily fait-du-jour slot → explainer-carousel template
    score: 85, // wins the daily utility staple slot; ≥75 bypasses the type cap
    status: "queued" as IGQueueStatus,
    targetPostDate: today,
    queuedDate: today,
    reasons: [`Haiti pride fact of the day — ${fact.id}`],
    payload,
  });

  console.log(`[buildHaitiFactCarousel] Queued "${fact.cover}" for ${today}`);
  return { queued: true, skipped: "", fact: fact.id };
}
