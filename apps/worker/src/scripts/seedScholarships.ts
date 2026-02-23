/**
 * Seed curated scholarships into Firestore.
 *
 * Usage:  pnpm seed:scholarships        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:scholarships
 *
 * Upserts by name so reruns are idempotent.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { scholarshipsRepo } from "@edlight-news/firebase";
import type { CreateScholarship } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Seed data ──────────────────────────────────────────────────────────────

const SCHOLARSHIPS: CreateScholarship[] = [
  {
    name: "Chevening Scholarships",
    country: "UK",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["master"],
    deadline: { dateISO: "2026-11-05", notes: "Cycle annuel", sourceUrl: "https://www.chevening.org/scholarships/" },
    howToApplyUrl: "https://www.chevening.org/scholarships/",
    officialUrl: "https://www.chevening.org/",
    eligibilitySummary: "Bourses du gouvernement britannique pour des leaders émergents. Couvre les frais de scolarité, allocation mensuelle, vol aller-retour et visa.",
    tags: ["prestigious", "government", "uk"],
    sources: [{ url: "https://www.chevening.org/scholarships/", label: "Chevening Official" }],
  },
  {
    name: "Commonwealth Scholarships (CSFP)",
    country: "UK",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["master", "phd"],
    deadline: { dateISO: "2026-12-16", notes: "Varie par pays", sourceUrl: "https://cscuk.fcdo.gov.uk/scholarships/" },
    howToApplyUrl: "https://cscuk.fcdo.gov.uk/apply/",
    officialUrl: "https://cscuk.fcdo.gov.uk/",
    eligibilitySummary: "Bourses pour citoyens du Commonwealth et pays éligibles. Couvre frais de scolarité, allocation, voyage, et plus.",
    tags: ["prestigious", "government", "uk", "developing-countries"],
    sources: [{ url: "https://cscuk.fcdo.gov.uk/scholarships/", label: "CSFP Official" }],
  },
  {
    name: "DAAD Scholarships (Germany)",
    country: "Global",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["master", "phd"],
    deadline: { dateISO: "2026-10-15", notes: "Varie par programme", sourceUrl: "https://www.daad.de/en/studying-in-germany/scholarships/" },
    howToApplyUrl: "https://www.daad.de/en/studying-in-germany/scholarships/",
    officialUrl: "https://www.daad.de/",
    eligibilitySummary: "Le service allemand d'échanges académiques offre des bourses complètes pour études et recherche en Allemagne.",
    tags: ["prestigious", "government", "germany", "research"],
    sources: [{ url: "https://www.daad.de/en/studying-in-germany/scholarships/", label: "DAAD Official" }],
  },
  {
    name: "Erasmus+ (Union Européenne)",
    country: "Global",
    fundingType: "partial",
    eligibleCountries: ["HT"],
    level: ["bachelor", "master", "phd"],
    deadline: { dateISO: "2026-03-15", notes: "Cycle annuel — varie par consortium", sourceUrl: "https://erasmus-plus.ec.europa.eu/" },
    howToApplyUrl: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students",
    officialUrl: "https://erasmus-plus.ec.europa.eu/",
    eligibilitySummary: "Programme de l'UE pour la mobilité étudiante internationale. Couvre partiellement les frais et offre une allocation mensuelle.",
    tags: ["eu", "mobility", "exchange"],
    sources: [{ url: "https://erasmus-plus.ec.europa.eu/", label: "Erasmus+ Official" }],
  },
  {
    name: "Bourses AUF (Agence Universitaire de la Francophonie)",
    country: "Global",
    fundingType: "partial",
    eligibleCountries: ["HT"],
    level: ["master", "phd"],
    deadline: { dateISO: "2026-04-15", notes: "Variable par appel", sourceUrl: "https://www.auf.org/nos-actions/toutes-nos-actions/bourses/" },
    howToApplyUrl: "https://www.auf.org/nos-actions/toutes-nos-actions/bourses/",
    officialUrl: "https://www.auf.org/",
    eligibilitySummary: "L'AUF soutient la mobilité étudiante dans l'espace francophone. Bourses pour masters et doctorats dans les universités partenaires.",
    tags: ["francophone", "auf", "developing-countries"],
    sources: [{ url: "https://www.auf.org/nos-actions/toutes-nos-actions/bourses/", label: "AUF Official" }],
  },
  {
    name: "CSC Scholarships (China Scholarship Council)",
    country: "Global",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["bachelor", "master", "phd"],
    deadline: { dateISO: "2026-03-31", notes: "Cycle annuel", sourceUrl: "https://www.csc.edu.cn/studyinchina" },
    howToApplyUrl: "https://www.csc.edu.cn/studyinchina",
    officialUrl: "https://www.csc.edu.cn/",
    eligibilitySummary: "Le gouvernement chinois offre des bourses complètes couvrant scolarité, hébergement, allocation mensuelle et assurance médicale.",
    tags: ["government", "china", "full-funding"],
    sources: [{ url: "https://www.csc.edu.cn/studyinchina", label: "CSC Official" }],
  },
  {
    name: "Bourses d'études supérieures du Canada (BESC)",
    country: "CA",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["master", "phd"],
    deadline: { dateISO: "2026-12-01", notes: "Varie par université", sourceUrl: "https://www.nserc-crsng.gc.ca/students-etudiants/pg-cs/bellandpostgrad-702702_fra.asp" },
    howToApplyUrl: "https://www.nserc-crsng.gc.ca/students-etudiants/pg-cs/bellandpostgrad-702702_fra.asp",
    officialUrl: "https://www.canada.ca/fr/emploi-developpement-social.html",
    eligibilitySummary: "Programme fédéral canadien de bourses pour la recherche au niveau maîtrise et doctorat. Couvre frais de vie et recherche.",
    tags: ["government", "canada", "research"],
    sources: [{ url: "https://www.nserc-crsng.gc.ca/students-etudiants/pg-cs/bellandpostgrad-702702_fra.asp", label: "BESC Official" }],
  },
  {
    name: "Bourse d'exemption des droits de scolarité (Québec)",
    country: "CA",
    fundingType: "tuition-only",
    eligibleCountries: ["HT"],
    level: ["bachelor", "master", "phd"],
    howToApplyUrl: "https://www.quebec.ca/education/aide-financiere-aux-etudes/bourses-exemption-droits-scolarite",
    officialUrl: "https://www.quebec.ca/education/aide-financiere-aux-etudes",
    eligibilitySummary: "Le Québec offre des exemptions de frais de scolarité majorés pour les étudiants haïtiens, leur permettant de payer les mêmes frais qu'un résident québécois.",
    tags: ["quebec", "tuition-exemption", "haiti-specific"],
    sources: [{ url: "https://www.quebec.ca/education/aide-financiere-aux-etudes/bourses-exemption-droits-scolarite", label: "Québec Official" }],
  },
  {
    name: "MasterCard Foundation Scholars Program",
    country: "Global",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["bachelor", "master"],
    howToApplyUrl: "https://mastercardfdn.org/all/scholars/",
    officialUrl: "https://mastercardfdn.org/all/scholars/",
    eligibilitySummary: "Programme pour jeunes talentueux d'Afrique et de la Caraïbe. Couvre frais de scolarité, hébergement, livres, et soutien académique.",
    tags: ["foundation", "developing-countries", "caribbean"],
    sources: [{ url: "https://mastercardfdn.org/all/scholars/", label: "MCF Scholars Official" }],
  },
  {
    name: "Fulbright Foreign Student Program",
    country: "US",
    fundingType: "full",
    eligibleCountries: ["HT"],
    level: ["master", "phd"],
    deadline: { dateISO: "2026-10-15", notes: "Varie par pays", sourceUrl: "https://foreign.fulbrightonline.org/" },
    howToApplyUrl: "https://foreign.fulbrightonline.org/",
    officialUrl: "https://www.fulbright.org/",
    eligibilitySummary: "Programme phare du gouvernement américain pour études supérieures. Couvre frais de scolarité, allocation mensuelle, assurance santé et vol.",
    tags: ["prestigious", "government", "us"],
    sources: [{ url: "https://foreign.fulbrightonline.org/", label: "Fulbright Official" }],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🎓 Seeding ${SCHOLARSHIPS.length} scholarships…\n`);

  let created = 0;
  let updated = 0;

  for (const s of SCHOLARSHIPS) {
    const result = await scholarshipsRepo.upsertByName(s);
    if (result.created) {
      created++;
      console.log(`  ✅  created  ${s.name}`);
    } else {
      updated++;
      console.log(`  ♻️  updated  ${s.name}`);
    }
  }

  console.log(`\n🏁 Done — created: ${created}, updated: ${updated}, total: ${SCHOLARSHIPS.length}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
