/**
 * scholarship-export.ts
 *
 * Generates an Excel-compatible CSV download of scholarships.
 * Uses UTF-8 BOM so Excel renders accented characters correctly.
 * No external dependencies required (CSV opens natively in Excel,
 * Google Sheets, Numbers, LibreOffice).
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import type { SerializedScholarship } from "@/components/BoursesFilters";

const COUNTRY_NAMES_FR: Record<DatasetCountry, string> = {
  US: "États-Unis",
  CA: "Canada",
  FR: "France",
  UK: "Royaume-Uni",
  DO: "Rép. Dominicaine",
  MX: "Mexique",
  CN: "Chine",
  RU: "Russie",
  HT: "Haïti",
  Global: "International",
};

const COUNTRY_NAMES_HT: Record<DatasetCountry, string> = {
  US: "Etazini",
  CA: "Kanada",
  FR: "Frans",
  UK: "Wayòm Ini",
  DO: "Rep. Dominikèn",
  MX: "Meksik",
  CN: "Lachin",
  RU: "Larisi",
  HT: "Ayiti",
  Global: "Entènasyonal",
};

const LEVEL_NAMES_FR: Record<AcademicLevel, string> = {
  bachelor: "Bachelor",
  master: "Master",
  phd: "PhD",
  short_programs: "Courts programmes",
};

const LEVEL_NAMES_HT: Record<AcademicLevel, string> = {
  bachelor: "Lisans",
  master: "Metriz",
  phd: "Doktora",
  short_programs: "Pwogram kout",
};

const FUNDING_NAMES_FR: Record<string, string> = {
  full: "Complet",
  partial: "Partiel",
  stipend: "Bourse d'entretien",
  "tuition-only": "Scolarité seulement",
  unknown: "Inconnu",
};

const FUNDING_NAMES_HT: Record<string, string> = {
  full: "Konplè",
  partial: "Pasyèl",
  stipend: "Alokasyon",
  "tuition-only": "Frè etid sèlman",
  unknown: "Enkonni",
};

const ELIGIBILITY_NAMES_FR: Record<string, string> = {
  yes: "Oui",
  no: "Non",
  unknown: "À vérifier",
};

const ELIGIBILITY_NAMES_HT: Record<string, string> = {
  yes: "Wi",
  no: "Non",
  unknown: "Pou verifye",
};

const MONTH_NAMES_FR = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MONTH_NAMES_HT = [
  "", "Janvye", "Fevriye", "Mas", "Avril", "Me", "Jen",
  "Jiyè", "Out", "Septanm", "Oktòb", "Novanm", "Desanm",
];

/** Format deadline for display in spreadsheet. */
function formatDeadline(s: SerializedScholarship, lang: ContentLanguage): string {
  const fr = lang === "fr";
  const dl = s.deadline;
  if (!dl) return fr ? "À confirmer" : "Pou konfime";

  if (dl.dateISO) {
    // Excel handles ISO dates well; keep ISO + month name for readability
    const d = new Date(dl.dateISO);
    if (!Number.isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, "0");
      const monthName = (fr ? MONTH_NAMES_FR : MONTH_NAMES_HT)[d.getUTCMonth() + 1];
      const year = d.getUTCFullYear();
      return `${day} ${monthName} ${year}`;
    }
    return dl.dateISO;
  }

  if (dl.month) {
    const monthName = (fr ? MONTH_NAMES_FR : MONTH_NAMES_HT)[dl.month] ?? "";
    return fr ? `~ ${monthName} (récurrent)` : `~ ${monthName} (rekiran)`;
  }

  if (dl.notes) return dl.notes;
  return fr ? "À confirmer" : "Pou konfime";
}

/** Compute days-until-deadline for sorting/info column. */
function daysUntil(dateISO?: string): string {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return String(diff);
}

/** Escape a value for CSV (RFC 4180). */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str === "") return "";
  // Quote if contains comma, quote, newline, or leading/trailing whitespace
  if (/[",\n\r]/.test(str) || str !== str.trim()) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV row from an array of values. */
function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

/** Build the CSV content (UTF-8 BOM + header + data rows). */
export function buildScholarshipsCSV(
  scholarships: SerializedScholarship[],
  lang: ContentLanguage,
): string {
  const fr = lang === "fr";

  const headers = fr
    ? [
        "Nom",
        "Pays",
        "Type",
        "Financement",
        "Niveaux",
        "Date limite",
        "Jours restants",
        "Éligible Haïti",
        "Récurrent",
        "Résumé éligibilité",
        "Tags",
        "Site officiel",
        "Comment postuler",
        "Sources",
        "Vérifié le",
        "ID",
        "Lien EdLight",
      ]
    : [
        "Non",
        "Peyi",
        "Tip",
        "Finansman",
        "Nivo",
        "Dat limit",
        "Jou ki rete",
        "Elijib Ayiti",
        "Rekiran",
        "Rezime elijibilite",
        "Tags",
        "Sit ofisyèl",
        "Kijan pou aplike",
        "Sous yo",
        "Verifye nan",
        "ID",
        "Lyen EdLight",
      ];

  const baseUrl = "https://news.edlight.org";
  const langSuffix = lang !== "fr" ? `?lang=${lang}` : "";

  const rows: string[] = [csvRow(headers)];

  for (const s of scholarships) {
    const countryName = (fr ? COUNTRY_NAMES_FR : COUNTRY_NAMES_HT)[s.country] ?? s.country;
    const kindName =
      (s.kind ?? "program") === "directory"
        ? (fr ? "Répertoire" : "Repètwa")
        : (fr ? "Programme" : "Pwogram");
    const fundingName =
      (fr ? FUNDING_NAMES_FR : FUNDING_NAMES_HT)[s.fundingType] ?? s.fundingType;
    const levelNames = s.level
      .map((l) => (fr ? LEVEL_NAMES_FR : LEVEL_NAMES_HT)[l] ?? l)
      .join(" / ");
    const elig = s.haitianEligibility ?? "unknown";
    const eligName = (fr ? ELIGIBILITY_NAMES_FR : ELIGIBILITY_NAMES_HT)[elig] ?? elig;
    const sourcesStr = (s.sources ?? [])
      .map((src) => `${src.label}: ${src.url}`)
      .join(" | ");
    const verified = s.verifiedAtISO
      ? new Date(s.verifiedAtISO).toISOString().slice(0, 10)
      : "";

    rows.push(
      csvRow([
        s.name,
        countryName,
        kindName,
        fundingName,
        levelNames,
        formatDeadline(s, lang),
        daysUntil(s.deadline?.dateISO),
        eligName,
        s.recurring ? (fr ? "Oui" : "Wi") : "",
        s.eligibilitySummary ?? "",
        (s.tags ?? []).join(" | "),
        s.officialUrl,
        s.howToApplyUrl ?? "",
        sourcesStr,
        verified,
        s.id,
        `${baseUrl}/bourses/${s.id}${langSuffix}`,
      ]),
    );
  }

  // Excel needs UTF-8 BOM to render accents correctly
  const BOM = "\uFEFF";
  return BOM + rows.join("\r\n");
}

/** Trigger a browser download of the scholarships CSV. */
export function downloadScholarshipsCSV(
  scholarships: SerializedScholarship[],
  lang: ContentLanguage,
): void {
  const csv = buildScholarshipsCSV(scholarships, lang);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `edlight-bourses-${today}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Free memory after the download starts
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
