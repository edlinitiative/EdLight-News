/**
 * Worker job: buildScholarshipCarousel
 *
 * Produces one "Étudier à l'étranger" IG carousel per day, rotating through
 * destinations (France, USA, Chine, Russie, Canada, Rép. Dominicaine). This is
 * the carousel-first scholarship strategy: instead of posting scholarships one
 * by one, we post a country guide — cover, why, a few real bourses, how to
 * apply, and a CTA to the /bourses/etudier/[pays] page.
 *
 * It reuses the existing IG carousel pipeline end to end: the doc is written as
 * igType "scholarship" (→ rendered by the premium `opportunity-carousel`
 * template), scheduled by scheduleIgPost, and published as a native IG carousel
 * by processIgScheduled → publishIgPost.
 *
 * Copy is deliberately short so it passes the ig-engine overflow gate (which
 * blocks — never publishes — a slide whose text doesn't fit).
 *
 * Self-gates: once per day, only inside the Haiti posting window.
 */

import { igQueueRepo, scholarshipsRepo } from "@edlight-news/firebase";
import type {
  IGFormattedPayload,
  IGSlide,
  IGQueueStatus,
  Scholarship,
  DatasetCountry,
} from "@edlight-news/types";

const HAITI_TZ = "America/Port-au-Prince";
const SITE = "news.edlight.org";
const WINDOW_START_HOUR = 6; // 06:00 Haiti — schedules same-day
const WINDOW_END_HOUR = 19; // stop building after 18:59

// ── Country carousel copy (concise, fit-safe FR) ────────────────────────────

interface CarouselCountry {
  slug: string; // /bourses/etudier/[slug]
  country: DatasetCountry;
  name: string; // French display name
  coverHeadline: string; // ≤ ~6 words
  valueLine: string; // one-line value hook
  why: string[]; // 2–3 short bullets
  steps: string[]; // 3 short bullets
  hashtags: string[];
}

const CAROUSEL_COUNTRIES: CarouselCountry[] = [
  {
    slug: "france",
    country: "FR",
    name: "France",
    coverHeadline: "Étudier en France depuis Haïti",
    valueLine: "Le français, la diaspora et des frais publics bas.",
    why: [
      "Pas de test de langue lourd à passer.",
      "Grande diaspora et universités publiques accessibles.",
      "Bourse Eiffel du gouvernement (master, doctorat).",
    ],
    steps: [
      "Créer un dossier « Études en France » (Campus France).",
      "Choisir vos formations et préparer vos documents.",
      "Entretien Campus France, puis visa étudiant.",
    ],
    hashtags: ["#Bourses", "#ÉtudierEnFrance", "#Haiti", "#CampusFrance", "#EdLightNews"],
  },
  {
    slug: "usa",
    country: "US",
    name: "les USA",
    coverHeadline: "Étudier aux USA depuis Haïti",
    valueLine: "Ce n'est pas réservé aux riches : l'aide existe.",
    why: [
      "Beaucoup d'universités offrent une aide financière.",
      "Le programme Fulbright pour les études supérieures.",
      "EducationUSA conseille les Haïtiens gratuitement.",
    ],
    steps: [
      "Passer les tests requis (anglais, parfois SAT).",
      "Postuler et demander l'aide financière ensemble.",
      "Admission, puis I-20 et visa F-1.",
    ],
    hashtags: ["#Bourses", "#ÉtudierAuxUSA", "#Haiti", "#Fulbright", "#EdLightNews"],
  },
  {
    slug: "chine",
    country: "CN",
    name: "la Chine",
    coverHeadline: "Étudier en Chine depuis Haïti",
    valueLine: "La bourse CSC : 100% financée, avec allocation.",
    why: [
      "La CSC couvre frais, logement et allocation.",
      "Des programmes enseignés en anglais existent.",
      "Candidature via université, CSC ou ambassade.",
    ],
    steps: [
      "Choisir une université et un programme CSC.",
      "Déposer le dossier CSC avec vos documents.",
      "Admission, formulaire JW202, puis visa X.",
    ],
    hashtags: ["#Bourses", "#CSC", "#ÉtudierEnChine", "#Haiti", "#EdLightNews"],
  },
  {
    slug: "russie",
    country: "RU",
    name: "la Russie",
    coverHeadline: "Étudier en Russie depuis Haïti",
    valueLine: "Quota d'État : sans frais, allocation et logement.",
    why: [
      "Le quota couvre la scolarité et une allocation.",
      "Open Doors ouvre le master et le doctorat.",
      "Une année de russe est offerte avant.",
    ],
    steps: [
      "S'inscrire sur « Education in Russia ».",
      "Passer la sélection (ou l'olympiade Open Doors).",
      "Invitation officielle, puis visa étudiant.",
    ],
    hashtags: ["#Bourses", "#ÉtudierEnRussie", "#Haiti", "#OpenDoors", "#EdLightNews"],
  },
  {
    slug: "canada",
    country: "CA",
    name: "le Canada",
    coverHeadline: "Étudier au Canada depuis Haïti",
    valueLine: "Le Québec francophone et une grande diaspora.",
    why: [
      "Le Québec est francophone : pas de barrière.",
      "Grande communauté haïtienne, surtout à Montréal.",
      "Bourses d'admission ouvertes aux internationaux.",
    ],
    steps: [
      "Obtenir une lettre d'admission.",
      "Québec : obtenir le CAQ puis le permis d'études.",
      "Fournir une preuve de fonds.",
    ],
    hashtags: ["#Bourses", "#ÉtudierAuCanada", "#Québec", "#Haiti", "#EdLightNews"],
  },
  {
    slug: "republique-dominicaine",
    country: "DO",
    name: "la République Dominicaine",
    coverHeadline: "Étudier en République Dominicaine",
    valueLine: "Juste à côté : abordable et accessible.",
    why: [
      "La proximité : pas besoin de traverser un océan.",
      "Des frais souvent plus bas qu'en Europe.",
      "Des bourses via le MESCyT.",
    ],
    steps: [
      "Choisir une université (cours en espagnol).",
      "Préparer vos documents et votre espagnol.",
      "Demander le visa étudiant dominicain.",
    ],
    hashtags: ["#Bourses", "#RépubliqueDominicaine", "#Haiti", "#EdLightNews"],
  },
];

// ── Time / rotation helpers ─────────────────────────────────────────────────

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

/** Deterministic day-based rotation so each day features a different country. */
function pickCountry(date: Date = new Date()): CarouselCountry {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return CAROUSEL_COUNTRIES[dayIndex % CAROUSEL_COUNTRIES.length]!;
}

// ── Copy fitters (keep every slide under the opportunity-carousel limits) ────

function clampBullet(s: string, maxChars: number): string {
  const t = s.trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "")}…`;
}

function clampBullets(bullets: string[], maxCount: number, maxChars: number): string[] {
  return bullets.slice(0, maxCount).map((b) => clampBullet(b, maxChars));
}

const FUNDING_SHORT: Record<string, string> = {
  full: "Complet",
  partial: "Partiel",
  stipend: "Allocation",
  "tuition-only": "Scolarité",
};

/** Best scholarships first: Haiti-eligible, then fully funded, then by name. */
function rankScholarships(list: Scholarship[]): Scholarship[] {
  const fundingOrder: Record<string, number> = { full: 0, partial: 1, stipend: 2, "tuition-only": 3, unknown: 4 };
  return [...list]
    .filter((s) => (s.haitianEligibility ?? "unknown") !== "no")
    .sort((a, b) => {
      const elig = (s: Scholarship) => (s.haitianEligibility === "yes" ? 0 : 1);
      if (elig(a) !== elig(b)) return elig(a) - elig(b);
      return (fundingOrder[a.fundingType] ?? 4) - (fundingOrder[b.fundingType] ?? 4);
    });
}

function bourseBullet(s: Scholarship): string {
  const name = clampBullet(s.name, 46).replace(/…$/, "").trim();
  const funding = FUNDING_SHORT[s.fundingType];
  return funding ? `${name} — ${funding}` : name;
}

// ── Carousel + caption builders ─────────────────────────────────────────────

function buildPayload(c: CarouselCountry, scholarships: Scholarship[]): IGFormattedPayload {
  const slides: IGSlide[] = [];

  // 1. Cover — headline only (opportunity cover renders it BIG)
  slides.push({ heading: c.coverHeadline, bullets: [] });

  // 2. Why this destination
  slides.push({
    heading: `Pourquoi ${c.name}`,
    bullets: clampBullets(c.why, 3, 82),
    layout: "explanation",
  });

  // 3. Real bourses (only if we have any for this country)
  const bourseBullets = rankScholarships(scholarships).slice(0, 4).map(bourseBullet);
  if (bourseBullets.length > 0) {
    slides.push({
      heading: "Bourses à saisir",
      bullets: bourseBullets,
      layout: "explanation",
    });
  }

  // 4. How to apply
  slides.push({
    heading: "Comment postuler",
    bullets: clampBullets(c.steps, 3, 82),
    layout: "explanation",
  });

  // 5. CTA → guide page
  slides.push({
    heading: "Le guide complet",
    bullets: ["Toutes les bourses et les étapes sur EdLight News.", "Lien dans la bio."],
    layout: "cta",
  });

  const nBourses = bourseBullets.length;
  const caption = [
    `${c.coverHeadline} — le guide 2026.`,
    "",
    c.valueLine,
    ...(nBourses > 0 ? [`${nBourses} bourse${nBourses > 1 ? "s" : ""} vérifiée${nBourses > 1 ? "s" : ""} à saisir dès maintenant.`] : []),
    "",
    `→ Guide complet + toutes les bourses : ${SITE}/bourses/etudier/${c.slug}`,
    "→ Lien dans la bio",
    "",
    c.hashtags.join(" "),
  ].join("\n");

  return { slides, caption };
}

// ── Result type ──────────────────────────────────────────────────────────────

export interface BuildScholarshipCarouselResult {
  queued: boolean;
  skipped: string;
  country?: string;
}

// ── Main job ─────────────────────────────────────────────────────────────────

export async function buildScholarshipCarousel(): Promise<BuildScholarshipCarouselResult> {
  if (!isInWindow()) {
    return { queued: false, skipped: "outside-window" };
  }

  const today = haitiDateKey();

  // Once-per-day gate: skip if any scholarship carousel is already in the
  // pipeline (queued/scheduled) or was posted today.
  const [recent, queued, scheduled] = await Promise.all([
    igQueueRepo.listRecentPosted(1, 30),
    igQueueRepo.listQueuedByScore(40),
    igQueueRepo.listScheduled(30),
  ]);
  const existsToday = [...recent, ...queued, ...scheduled].some(
    (p) => p.sourceContentId.startsWith("scholarship-carousel-") && p.sourceContentId.endsWith(today),
  );
  if (existsToday) {
    return { queued: false, skipped: "already-exists-today" };
  }

  const country = pickCountry();

  let scholarships: Scholarship[] = [];
  try {
    scholarships = await scholarshipsRepo.listByCountry(country.country);
  } catch (err) {
    console.warn(`[buildScholarshipCarousel] listByCountry(${country.country}) failed:`, err);
  }

  const payload = buildPayload(country, scholarships);

  await igQueueRepo.createIGQueueItem({
    sourceContentId: `scholarship-carousel-${country.slug}-${today}`,
    igType: "scholarship",
    score: 80, // ≥75 bypasses the per-type daily cap; high enough to schedule
    status: "queued" as IGQueueStatus,
    targetPostDate: today,
    queuedDate: today,
    reasons: [`Country scholarship carousel — ${country.name}`],
    payload,
  });

  console.log(
    `[buildScholarshipCarousel] Queued "${country.coverHeadline}" for ${today} (${payload.slides.length} slides, ${scholarships.length} bourses in DB)`,
  );
  return { queued: true, skipped: "", country: country.slug };
}
