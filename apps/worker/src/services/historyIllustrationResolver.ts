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

type OverrideHint = {
  test: RegExp;
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
    test: /occupation\s+am[eé]ricaine|marines\s+am[eé]ricains/i,
    wikipediaFr: "Occupation d'Haïti par les États-Unis",
    wikipediaEn: "United States occupation of Haiti",
    commonsQuery: "United States occupation of Haiti",
  },
  {
    test: /aristide|jean-bertrand\s+aristide/i,
    wikipediaFr: "Jean-Bertrand Aristide",
    wikipediaEn: "Jean-Bertrand Aristide",
    commonsQuery: "Jean-Bertrand Aristide",
  },
  {
    test: /duvalier|fran[cç]ois\s+duvalier|jean-claude\s+duvalier/i,
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
];

export interface ResolvedHistoryIllustration {
  imageUrl: string;
  pageUrl: string;
  pageTitle?: string;
  provider: "wikimedia_commons";
  author?: string;
  license?: string;
  confidence: number;
}

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
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

function extractProperNames(title: string): string[] {
  const matches = title.match(/[A-ZÀ-ÿ][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-ÿ][\wÀ-ÿ'\-]+){0,3}/g) ?? [];
  return [...new Set(matches.map((m) => m.trim()).filter((m) => m.length >= 4))].slice(0, 4);
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
  url.searchParams.set("iiurlwidth", "1280");

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
  url.searchParams.set("iiurlwidth", "1280");
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

async function resolveViaOverrideHints(title: string): Promise<ResolvedHistoryIllustration | null> {
  for (const hint of HISTORY_OVERRIDE_HINTS) {
    if (!hint.test.test(title)) continue;

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

export async function resolveHistoryIllustration(
  titleFr: string,
  year?: number | null,
): Promise<ResolvedHistoryIllustration | null> {
  const base = normalizeTitle(titleFr);
  if (!base) return null;

  // Pass 0: curated hints for iconic events/people.
  const hinted = await resolveViaOverrideHints(base);
  if (hinted) return hinted;

  const simplified = simplifyTitle(base);
  const names = extractProperNames(base);

  // Pass 1: entity-first resolution (works well for people and major events).
  const entityCandidates = [
    base,
    simplified,
    maybePersonCandidate(base),
    ...names,
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
    ...names.map((n) => `${n} portrait`),
  ].filter((q): q is string => Boolean(q));

  for (const q of queryCandidates) {
    const result = await searchCommonsImage(q);
    if (result) return result;
  }

  // Pass 3: Wikipedia pages -> Commons file (strong boost for historical events).
  const wikiQueries = [
    `${base} Haiti`,
    `${simplified} Haiti`,
    base,
    simplified,
    ...names,
    year ? `${year} ${simplified}` : null,
  ].filter((q): q is string => Boolean(q));

  for (const q of wikiQueries) {
    const frResult = await searchWikipediaPageImage(q, "fr");
    if (frResult) return frResult;
    const enResult = await searchWikipediaPageImage(q, "en");
    if (enResult) return enResult;
  }

  return null;
}
