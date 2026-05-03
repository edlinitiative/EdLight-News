import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import type { WebImageCacheEntry } from "./webImageSearch.js";
import { cacheKey } from "./webImageSearch.js";

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
  };
};

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

type WikidataSearchResult = {
  id: string;
  label?: string;
  description?: string;
};

type WikiPage = {
  pageid?: number;
  title?: string;
  pageimage?: string;
};

type DirectImage = {
  /** Direct image URL (non-Wikimedia). */
  url: string;
  /** Page URL where the image is displayed / credited. */
  pageUrl: string;
  pageTitle?: string;
  author?: string;
  license?: string;
};

type OverrideHint = {
  test: RegExp;
  /** Exact Wikimedia Commons file title (e.g. "File:Example.jpg"). Highest priority — bypasses search. */
  commonsFile?: string;
  /** Direct image URL for sources outside Wikimedia Commons. Highest priority — bypasses search. */
  directImage?: DirectImage;
  wikipediaFr?: string;
  wikipediaEn?: string;
  commonsQuery?: string;
};

const HISTORY_OVERRIDE_HINTS: OverrideHint[] = [
  {
    test: /verti[eè]res/i,
    wikipediaFr: "Bataille de Vertières",
    wikipediaEn: "Battle of Vertières",
    commonsQuery: "Battle of Vertières Haiti",
  },
  {
    test: /drapeau|arcahaie/i,
    wikipediaFr: "Drapeau d'Haïti",
    wikipediaEn: "Flag of Haiti",
    commonsQuery: "Flag of Haiti",
  },
  {
    test: /bois\s*-?\s*ca[iï]man/i,
    wikipediaFr: "Bois Caïman",
    wikipediaEn: "Bois Caïman ceremony",
    commonsQuery: "Bois Caiman Haiti",
  },
  {
    test: /toussaint\s+louverture/i,
    wikipediaFr: "Toussaint Louverture",
    wikipediaEn: "Toussaint Louverture",
    commonsQuery: "Toussaint Louverture portrait",
  },
  {
    test: /dessalines|jean-jacques\s+dessalines/i,
    wikipediaFr: "Jean-Jacques Dessalines",
    wikipediaEn: "Jean-Jacques Dessalines",
    commonsQuery: "Jean-Jacques Dessalines portrait",
  },
  {
    test: /henri\s+christophe/i,
    wikipediaFr: "Henri Christophe",
    wikipediaEn: "Henri Christophe",
    commonsQuery: "Henri Christophe portrait",
  },
  {
    test: /p[eé]tion|alexandre\s+p[eé]tion/i,
    wikipediaFr: "Alexandre Pétion",
    wikipediaEn: "Alexandre Pétion",
    commonsQuery: "Alexandre Pétion",
  },
  {
    test: /charlemagne\s+p[eé]ralte|p[eé]ralte/i,
    wikipediaFr: "Charlemagne Péralte",
    wikipediaEn: "Charlemagne Péralte",
    commonsQuery: "Charlemagne Péralte",
  },
  {
    test: /faustin\s+soulouque|faustin\s+ier/i,
    wikipediaFr: "Faustin Soulouque",
    wikipediaEn: "Faustin I of Haiti",
    commonsQuery: "Faustin Soulouque portrait",
  },
  {
    test: /massacre\s+du\s+persil|perejil/i,
    wikipediaFr: "Massacre du Persil",
    wikipediaEn: "Parsley massacre",
    commonsQuery: "Parsley massacre",
  },
  {
    test: /gr[eè]ve.*damien|damien.*gr[eè]ve|[eé]cole.*agriculture.*damien/i,
    directImage: {
      url: "https://islandluminous.fiu.edu/PT8/S18/GT.PT8.SL18.SO1.png",
      pageUrl: "https://islandluminous.fiu.edu/part08-slide19.html",
      pageTitle: "The Student Strike at Damien — Island Luminous (FIU)",
      author: "La Relève (May 1936) — University of Florida George A. Smathers Library",
      license: "Public Domain",
    },
    wikipediaFr: "Occupation d'Haïti par les États-Unis",
    wikipediaEn: "United States occupation of Haiti",
    commonsQuery: "United States occupation Haiti 1929",
  },
  {
    test: /occupation\s+am[eé]ricaine|marines\s+am[eé]ricains/i,
    wikipediaFr: "Occupation d'Haïti par les États-Unis",
    wikipediaEn: "United States occupation of Haiti",
    commonsQuery: "United States occupation of Haiti",
  },
  {
    test: /d[eé]part.*aristide|aristide.*d[eé]part|coup\s*d[''\u2019]?\s*[eé]tat.*ha[iï]ti.*200[4]/i,
    commonsFile: "File:Jean-Bertrand Aristide - 1991 (cropped).jpg",
    wikipediaFr: "Jean-Bertrand Aristide",
    wikipediaEn: "Jean-Bertrand Aristide",
    commonsQuery: "Jean-Bertrand Aristide portrait",
  },
  {
    test: /aristide|jean-bertrand\s+aristide/i,
    commonsFile: "File:Jean-Bertrand Aristide - 1991 (cropped).jpg",
    wikipediaFr: "Jean-Bertrand Aristide",
    wikipediaEn: "Jean-Bertrand Aristide",
    commonsQuery: "Jean-Bertrand Aristide",
  },
  {
    test: /mich[eè]le\s+bennett|bennett\s+duvalier|fuite.*duvalier|duvalier.*fuite/i,
    commonsFile: "File:Baby Doc (centrée).jpg",
    wikipediaFr: "Jean-Claude Duvalier",
    wikipediaEn: "Jean-Claude Duvalier",
    commonsQuery: "Jean-Claude Duvalier",
  },
  {
    test: /jean-claude\s+duvalier|baby\s+doc/i,
    commonsFile: "File:Baby Doc (centrée).jpg",
    wikipediaFr: "Jean-Claude Duvalier",
    wikipediaEn: "Jean-Claude Duvalier",
    commonsQuery: "Jean-Claude Duvalier portrait",
  },
  {
    test: /françois\s+duvalier|papa\s+doc/i,
    commonsFile: "File:François Duvalier Presidential Portrait (1957).png",
    wikipediaFr: "François Duvalier",
    wikipediaEn: "François Duvalier",
    commonsQuery: "François Duvalier portrait",
  },
  {
    test: /duvalier/i,
    commonsFile: "File:François Duvalier Presidential Portrait (1957).png",
    wikipediaFr: "François Duvalier",
    wikipediaEn: "François Duvalier",
    commonsQuery: "François Duvalier",
  },
  {
    test: /bol[ií]var|sim[oó]n\s+bol[ií]var/i,
    wikipediaFr: "Simón Bolívar",
    wikipediaEn: "Simón Bolívar",
    commonsQuery: "Simón Bolívar portrait",
  },
  {
    test: /louverture|ind[ée]pendance|r[eé]volution\s+ha[iï]tienne/i,
    wikipediaFr: "Révolution haïtienne",
    wikipediaEn: "Haitian Revolution",
    commonsQuery: "Haitian Revolution engraving",
  },
  {
    test: /cr[eê]te\s*-?\s*[aà]\s*-?\s*pierrot/i,
    wikipediaFr: "Bataille de la Crête-à-Pierrot",
    wikipediaEn: "Battle of Crête-à-Pierrot",
    commonsQuery: "Crête-à-Pierrot Haiti",
  },
  {
    test: /ravine\s*-?\s*[aà]\s*-?\s*couleuvre/i,
    wikipediaFr: "Bataille de la Ravine-à-Couleuvres",
    wikipediaEn: "Battle of Ravine-à-Couleuvres",
    commonsQuery: "Ravine-a-Couleuvres Haiti",
  },
  {
    test: /minustah|minuha|nations\s+unies\s+en\s+ha[iï]ti/i,
    wikipediaFr: "Mission des Nations unies pour la stabilisation en Haïti",
    wikipediaEn: "United Nations Stabilisation Mission in Haiti",
    commonsQuery: "MINUSTAH Haiti",
  },
  {
    test: /uphold\s+democracy|operation\s+uphold/i,
    wikipediaFr: "Opération Uphold Democracy",
    wikipediaEn: "Operation Uphold Democracy",
    commonsQuery: "Operation Uphold Democracy Haiti",
  },
  {
    test: /constitution\s+de\s+1987|constitution\s+ha[iï]tienne/i,
    wikipediaFr: "Constitution haïtienne de 1987",
    wikipediaEn: "Constitution of Haiti",
    commonsQuery: "Constitution of Haiti",
  },
  {
    test: /ren[eé]\s+pr[eé]val/i,
    wikipediaFr: "René Préval",
    wikipediaEn: "René Préval",
    commonsQuery: "René Préval",
  },
  {
    test: /paul\s+magloire/i,
    wikipediaFr: "Paul Magloire",
    wikipediaEn: "Paul Magloire",
    commonsQuery: "Paul Magloire",
  },
  {
    test: /charles\s+rivi[eè]re-?h[eé]rard|rivi[eè]re-?h[eé]rard/i,
    wikipediaFr: "Charles Rivière-Hérard",
    wikipediaEn: "Charles Rivière-Hérard",
    commonsQuery: "Charles Rivière-Hérard",
  },
  {
    test: /rosalvo\s+bobo/i,
    wikipediaFr: "Rosalvo Bobo",
    wikipediaEn: "Rosalvo Bobo",
    commonsQuery: "Rosalvo Bobo",
  },
  {
    test: /daniel\s+fignol[eé]/i,
    commonsFile: "File:Daniel Fignolé speaking to supporters at Institut Mopique.jpg",
    wikipediaFr: "Daniel Fignolé",
    wikipediaEn: "Daniel Fignolé",
    commonsQuery: "Daniel Fignolé",
  },
  {
    test: /jean\s+vilbrun\s+guillaume\s+sam|guillaume\s+sam/i,
    wikipediaFr: "Vilbrun Guillaume Sam",
    wikipediaEn: "Vilbrun Guillaume Sam",
    commonsQuery: "Vilbrun Guillaume Sam",
  },
  {
    test: /fran[cç]ois\s+duvalier|papa\s+doc/i,
    wikipediaFr: "François Duvalier",
    wikipediaEn: "François Duvalier",
    commonsQuery: "François Duvalier portrait",
  },
  {
    test: /massacre\s+de\s+jean-rabel|jean-rabel/i,
    wikipediaFr: "Massacre de Jean-Rabel",
    wikipediaEn: "Jean-Rabel massacre",
    commonsQuery: "Jean-Rabel massacre",
  },
  {
    test: /massacre\s+de\s+l[’']?[eé]glise\s+saint-?jean\s+bosco|saint-?jean\s+bosco/i,
    wikipediaFr: "Massacre de l'église Saint-Jean Bosco",
    wikipediaEn: "St. Jean Bosco massacre",
    commonsQuery: "Saint-Jean Bosco Haiti",
  },
  {
    test: /governors\s+island/i,
    wikipediaFr: "Accord de Governors Island",
    wikipediaEn: "Governors Island Accord",
    commonsQuery: "Governors Island Accord Haiti",
  },
  {
    test: /cap-fran[cç]ais|cap-?ha[iï]tien/i,
    wikipediaFr: "Cap-Haïtien",
    wikipediaEn: "Cap-Haïtien",
    commonsQuery: "Cap-Haitien historical",
  },
  {
    test: /port-au-prince/i,
    wikipediaFr: "Port-au-Prince",
    wikipediaEn: "Port-au-Prince",
    commonsQuery: "Port-au-Prince historical photo",
  },
];

export interface ResolvedHistoryIllustration {
  imageUrl: string;
  pageUrl: string;
  pageTitle?: string;
  provider: "wikimedia_commons" | "manual";
  author?: string;
  license?: string;
  confidence: number;
}

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Licenses considered safe for republication (public domain + CC BY / CC BY-SA). */
const ALLOWED_LICENSES = new Set([
  "public domain",
  "pd",
  "pd-usgov",
  "pd-usgov-military",
  "pd-usgov-military-army",
  "pd-usgov-military-navy",
  "pd-usgov-military-air force",
  "pd-usgov-white house",
  "pd-usgov-potus",
  "pd-usgov-fema",
  "pd-usgov-nasa",
  "pd-usgov-usaid",
  "pd-usgov-dos",
  "pd-author",
  "pd-self",
  "pd-old-70",
  "pd-old-100",
  "pd-old",
  "pd-textlogo",
  "pd-ineligible",
  "cc0",
  "cc0 1.0",
  "cc-zero",
  "cc by 2.0",
  "cc by 3.0",
  "cc by 4.0",
  "cc-by-2.0",
  "cc-by-3.0",
  "cc-by-4.0",
  "cc by-sa 2.0",
  "cc by-sa 3.0",
  "cc by-sa 4.0",
  "cc-by-sa-2.0",
  "cc-by-sa-3.0",
  "cc-by-sa-4.0",
]);

function isAllowedLicense(license?: string): boolean {
  if (!license) return false;
  return ALLOWED_LICENSES.has(license.toLowerCase().trim());
}

function normalizeTitle(raw: string): string {
  return raw
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function simplifyTitle(title: string): string {
  const compact = title
    .replace(/^[^\p{L}]+/u, "")
    .replace(/^(Début|Fin|Prise|Création|Publication|Adoption|Investiture|Naissance|Mort|Assassinat|Retour|Départ|Accord|Signature|Bataille|Soulèvement|Tentative|Coup d'État|Massacre)\s+(de|du|des|d')\s+/iu, "")
    .replace(/\s+\([^)]*\)\s*$/u, "")
    .trim();

  const noAccent = foldAccents(compact);
  return noAccent.replace(/\s+/g, " ").trim();
}

/**
 * Common French historical/political nouns that happen to be capitalised in
 * event titles. They are NOT proper names and produce useless image searches.
 */
const COMMON_FR_EVENT_NOUNS = new Set([
  "Constitution", "Dissolution", "Parlement", "Assemblée", "Commission",
  "Gouvernement", "Déclaration", "Entrée", "Sortie", "Départ", "Arrivée",
  "Retour", "Signature", "Adoption", "Proclamation", "Publication",
  "Création", "Formation", "Fondation", "Élection", "Investiture",
  "Coup", "Accord", "Traité", "Massacre", "Bataille", "Soulèvement",
  "Mort", "Naissance", "Assassinat", "Début", "Fin", "Prise",
]);

function extractProperNames(title: string): string[] {
  const matches = title.match(/[A-ZÀ-ÿ][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-ÿ][\wÀ-ÿ'\-]+){0,3}/g) ?? [];
  return [
    ...new Set(
      matches
        .map((m) => m.trim())
        .filter((m) => m.length >= 4)
        // Exclude single-token common event nouns — they are not person names
        // and generate wrong Commons queries like "Constitution portrait"
        .filter((m) => !COMMON_FR_EVENT_NOUNS.has(m.split(" ")[0]!) || m.includes(" ")),
    ),
  ].slice(0, 4);
}

function maybePersonCandidate(title: string): string | null {
  const patterns = [
    /(?:naissance|mort|assassinat|investiture|retour|départ|discours)\s+de\s+([A-ZÀ-ÿ][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-ÿ][\wÀ-ÿ'\-]+){0,3})/i,
    /([A-ZÀ-ÿ][\wÀ-ÿ'\-]+\s+[A-ZÀ-ÿ][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-ÿ][\wÀ-ÿ'\-]+){0,2})/, // fallback first proper-name chunk
  ];
  for (const re of patterns) {
    const m = title.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

async function searchCommonsImage(query: string): Promise<ResolvedHistoryIllustration | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6"); // File:
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "2160");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EdLight-News-Worker/1.0 (history illustration resolver)" },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };

  const pages = Object.values(json.query?.pages ?? {});
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const imageUrl = info.thumburl ?? info.url;
    if (!imageUrl || !p.pageid) continue;

    const author = stripHtml(info.extmetadata?.Artist?.value);
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value);

    if (!isAllowedLicense(license)) {
      console.debug(
        `[historyIllustrationResolver] Skipping "${p.title}" — license "${license ?? "unknown"}" not in allowlist`,
      );
      continue;
    }

    return {
      imageUrl,
      pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
      pageTitle: p.title,
      provider: "wikimedia_commons",
      author,
      license,
      confidence: 0.72,
    };
  }

  return null;
}

async function getCommonsFileInfo(fileTitle: string): Promise<ResolvedHistoryIllustration | null> {
  const title = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "2160");
  url.searchParams.set("titles", title);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EdLight-News-Worker/1.0 (history illustration resolver)" },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };
  const pages = Object.values(json.query?.pages ?? {});
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || !p.pageid) continue;
    const imageUrl = info.thumburl ?? info.url;
    if (!imageUrl) continue;
    return {
      imageUrl,
      pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
      pageTitle: p.title,
      provider: "wikimedia_commons",
      author: stripHtml(info.extmetadata?.Artist?.value),
      license: stripHtml(info.extmetadata?.LicenseShortName?.value),
      confidence: 0.82,
    };
  }
  return null;
}

async function searchWikidataEntity(query: string): Promise<WikidataSearchResult | null> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "fr");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "1");
  url.searchParams.set("search", query);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EdLight-News-Worker/1.0 (history illustration resolver)" },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { search?: WikidataSearchResult[] };
  return json.search?.[0] ?? null;
}

async function getWikidataCommonsImage(qid: string): Promise<string | null> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("ids", qid);
  url.searchParams.set("props", "claims");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EdLight-News-Worker/1.0 (history illustration resolver)" },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    entities?: Record<
      string,
      {
        claims?: {
          P18?: Array<{
            mainsnak?: { datavalue?: { value?: string } };
          }>;
        };
      }
    >;
  };

  const entity = json.entities?.[qid];
  const image = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return typeof image === "string" && image.length > 0 ? image : null;
}

async function resolveViaWikidata(title: string): Promise<ResolvedHistoryIllustration | null> {
  const entity = await searchWikidataEntity(title);
  if (!entity?.id) return null;
  const file = await getWikidataCommonsImage(entity.id);
  if (!file) return null;

  const info = await getCommonsFileInfo(file);
  if (!info) return null;

  return {
    ...info,
    confidence: 0.9,
  };
}

async function searchWikipediaPageImage(
  query: string,
  lang: "fr" | "en",
): Promise<ResolvedHistoryIllustration | null> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "3");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "name");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EdLight-News-Worker/1.0 (history illustration resolver)" },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
  const pages = Object.values(json.query?.pages ?? {});

  for (const p of pages) {
    if (!p.pageimage) continue;
    const commons = await getCommonsFileInfo(p.pageimage);
    if (!commons) continue;

    return {
      ...commons,
      pageUrl: p.pageid
        ? `https://${lang}.wikipedia.org/?curid=${p.pageid}`
        : commons.pageUrl,
      pageTitle: p.title ?? commons.pageTitle,
      confidence: 0.84,
    };
  }

  return null;
}

/* ── Web image cache (populated by batchWebImageResolve.ts) ───────────────── */

let webImageCache: Record<string, WebImageCacheEntry> | null = null;

function loadWebImageCache(): Record<string, WebImageCacheEntry> {
  if (webImageCache) return webImageCache;
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const cachePath = resolve(__dir, "../data/web-image-cache.json");
    webImageCache = JSON.parse(readFileSync(cachePath, "utf-8"));
    return webImageCache!;
  } catch {
    webImageCache = {};
    return webImageCache;
  }
}

async function resolveViaWebImageCache(
  title: string,
): Promise<ResolvedHistoryIllustration | null> {
  const cache = loadWebImageCache();
  const key = cacheKey(title);
  const entry = cache[key];
  if (!entry) return null;
  return {
    imageUrl: entry.imageUrl,
    pageUrl: entry.pageUrl,
    pageTitle: entry.pageTitle,
    provider: "manual",
    author: entry.sourceDomain,
    license: undefined,
    confidence: 0.91,
  };
}

async function resolveViaOverrideHints(title: string): Promise<ResolvedHistoryIllustration | null> {
  for (const hint of HISTORY_OVERRIDE_HINTS) {
    if (!hint.test.test(title)) continue;

    // Highest priority: direct image pinning (non-Wikimedia source).
    if (hint.directImage) {
      return {
        imageUrl: hint.directImage.url,
        pageUrl: hint.directImage.pageUrl,
        pageTitle: hint.directImage.pageTitle,
        provider: "manual",
        author: hint.directImage.author,
        license: hint.directImage.license,
        confidence: 0.98,
      };
    }

    // Second priority: exact Commons file pinning (no search needed).
    if (hint.commonsFile) {
      const pinned = await getCommonsFileInfo(hint.commonsFile);
      if (pinned) return { ...pinned, confidence: 0.97 };
    }

    if (hint.wikipediaFr) {
      const viaFr = await searchWikipediaPageImage(hint.wikipediaFr, "fr");
      if (viaFr) return { ...viaFr, confidence: Math.max(viaFr.confidence, 0.95) };
    }

    if (hint.wikipediaEn) {
      const viaEn = await searchWikipediaPageImage(hint.wikipediaEn, "en");
      if (viaEn) return { ...viaEn, confidence: Math.max(viaEn.confidence, 0.95) };
    }

    if (hint.commonsQuery) {
      const viaCommons = await searchCommonsImage(hint.commonsQuery);
      if (viaCommons) return { ...viaCommons, confidence: Math.max(viaCommons.confidence, 0.94) };
    }
  }

  return null;
}

async function resolveThematicFallback(title: string): Promise<ResolvedHistoryIllustration | null> {
  const t = foldAccents(title).toLowerCase();

  const themedQueries: Array<{ q: string; lang: "fr" | "en"; confidence: number }> = [];

  if (/bataille|insurrection|revolte|soul[eè]vement|guerre|siege|assaut/.test(t)) {
    themedQueries.push(
      { q: "Révolution haïtienne", lang: "fr", confidence: 0.56 },
      { q: "Haitian Revolution", lang: "en", confidence: 0.56 },
    );
  }

  if (/president|investiture|coup d etat|gouvernement|election|constitution/.test(t)) {
    themedQueries.push(
      { q: "Histoire d'Haïti", lang: "fr", confidence: 0.5 },
      { q: "Politics of Haiti", lang: "en", confidence: 0.5 },
    );
  }

  if (/port-au-prince|cap-francais|cap-haitien/.test(t)) {
    themedQueries.push(
      { q: "Port-au-Prince", lang: "fr", confidence: 0.54 },
      { q: "Cap-Haïtien", lang: "fr", confidence: 0.54 },
    );
  }

  // Last-resort broad context imagery for coverage.
  themedQueries.push(
    { q: "Histoire d'Haïti", lang: "fr", confidence: 0.45 },
    { q: "History of Haiti", lang: "en", confidence: 0.45 },
  );

  for (const candidate of themedQueries) {
    const image = await searchWikipediaPageImage(candidate.q, candidate.lang);
    if (image) {
      return {
        ...image,
        confidence: Math.max(candidate.confidence, image.confidence),
      };
    }
  }

  return null;
}

export async function resolveHistoryIllustration(
  titleFr: string,
  year?: number | null,
): Promise<ResolvedHistoryIllustration | null> {
  const base = normalizeTitle(titleFr);
  if (!base) return null;

  // Pass 0: curated hints for iconic events/people.
  const hinted = await resolveViaOverrideHints(base);
  if (hinted) return hinted;

  // Pass 0.5: pre-computed web image cache (from batchWebImageResolve).
  const cached = await resolveViaWebImageCache(base);
  if (cached) return cached;

  const simplified = simplifyTitle(base);
  const names = extractProperNames(base);

  // Pass 1: entity-first resolution (works well for people and major events).
  // Haiti-contextualised queries come first so Wikidata resolves the Haitian
  // entity before accidentally matching a same-name French history entity
  // (e.g. bare "Révolution" → Q191831 "Révolution française").
  const entityCandidates = [
    `${base} Haïti`,
    `${simplified} Haïti`,
    maybePersonCandidate(base),
    ...names.filter((n) => n.includes(" ")), // multi-word proper names only
    base,
    simplified,
    year ? `${base} ${year}` : null,
  ].filter((q): q is string => Boolean(q));

  for (const q of entityCandidates) {
    const byEntity = await resolveViaWikidata(q);
    if (byEntity) return byEntity;
  }

  // Pass 2: direct Commons file search with historical-art terms.
  const queryCandidates = [
    `${base} Haiti`,
    `${base} Haïti`,
    `${simplified} Haiti`,
    `${simplified} Haïti`,
    year ? `${year} ${base} Haiti` : null,
    `${base} historical illustration Haiti`,
    `${base} engraving Haiti`,
    `${base} painting Haiti`,
    `${base} lithograph Haiti`,
    `${base} gravure Haïti`,
    `${base} battle map Haiti`,
    ...names.map((n) => `${n} Haiti`),
    // Only generate portrait queries for likely person names (multi-word tokens).
    // Single-word common nouns that slipped through extractProperNames would
    // create nonsensical queries like "Constitution portrait" that return
    // French-Revolution constitutional documents.
    ...names.filter((n) => n.includes(" ")).map((n) => `${n} portrait`),
  ].filter((q): q is string => Boolean(q));

  for (const q of queryCandidates) {
    const result = await searchCommonsImage(q);
    if (result) return result;
  }

  // Pass 3: Wikipedia pages -> Commons file (strong boost for historical events).
  // NOTE: bare `base` and `simplified` (without "Haiti") are intentionally
  // excluded. They can match French Wikipedia pages for event-title words like
  // "Révolution" → "Révolution française" → French Revolution image.
  const wikiQueries = [
    `${base} Haiti`,
    `${simplified} Haiti`,
    ...names.map((n) => `${n} Haiti`),
    year ? `${year} ${simplified} Haiti` : null,
  ].filter((q): q is string => Boolean(q));

  for (const q of wikiQueries) {
    const frResult = await searchWikipediaPageImage(q, "fr");
    if (frResult) return frResult;
    const enResult = await searchWikipediaPageImage(q, "en");
    if (enResult) return enResult;
  }

  // Pass 4: thematic fallback for broader event coverage.
  const fallback = await resolveThematicFallback(base);
  if (fallback) return fallback;

  return null;
}
