/**
 * Allowlist of credible source domains for the Haiti History Almanac.
 *
 * All entries MUST cite at least one source from an allowed domain.
 * This ensures academic / encyclopaedic grounding — no invented facts.
 */

export const HISTORY_ALLOWED_DOMAINS: readonly string[] = [
  // Encyclopaedias
  "en.wikipedia.org",
  "fr.wikipedia.org",
  "ht.wikipedia.org",
  "britannica.com",
  "larousse.fr",

  // University / academic
  "brown.edu",
  "harvard.edu",
  "yale.edu",
  "duke.edu",
  "columbia.edu",
  "mit.edu",
  "stanford.edu",
  "ufdc.ufl.edu",          // University of Florida Digital Collections (Caribbean)
  "dloc.com",              // Digital Library of the Caribbean
  "jstor.org",
  "scholar.google.com",
  "cairn.info",
  "persee.fr",
  "erudit.org",

  // Museums & archives
  "nmaahc.si.edu",         // Smithsonian African American Museum
  "loc.gov",               // Library of Congress
  "gallica.bnf.fr",        // Bibliothèque nationale de France
  "archivesnationales.culture.gouv.fr",
  "smithsonianmag.com",
  "mupanah.ht",            // Musée du Panthéon National Haïtien

  // Haiti government & institutions
  "primature.gouv.ht",
  "menfp.gouv.ht",
  "bfrh.gouv.ht",

  // International organisations
  "un.org",
  "unicef.org",
  "worldbank.org",
  "oas.org",
  "iwgia.org",

  // Reliable media & reference
  "lenouvelliste.com",     // Haiti's newspaper of record
  "alterpresse.org",
  "haitilibre.com",
  "ayibopost.com",
  "bbc.com",
  "theguardian.com",
  "nytimes.com",
  "lemonde.fr",
  "rfi.fr",
  "history.com",
  "nationalgeographic.com",
  "aljazeera.com",
  "reuters.com",
  "apnews.com",

  // Haiti-specific scholarship
  "haitianhistory.org",
  "kreyol.com",
  "haitiancreole.info",
  "windowsonhaiti.com",
] as const;

/**
 * Check whether a URL belongs to an allowed source domain.
 * Returns true if the hostname ends with one of the allowed domains.
 */
export function isAllowedSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return HISTORY_ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

/**
 * Validate that at least one source URL in the array comes from an allowed domain.
 * Throws if none match.
 */
export function assertHasAllowedSource(sources: { url: string }[]): void {
  const hasAllowed = sources.some((s) => isAllowedSource(s.url));
  if (!hasAllowed) {
    const domains = sources.map((s) => {
      try { return new URL(s.url).hostname; } catch { return s.url; }
    });
    throw new Error(
      `No allowed source domain found. Got: [${domains.join(", ")}]. ` +
      `At least one source must belong to a credible domain from the allowlist.`,
    );
  }
}
