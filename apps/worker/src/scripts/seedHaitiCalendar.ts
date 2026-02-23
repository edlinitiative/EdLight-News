/**
 * Seed Haiti education calendar events into Firestore.
 *
 * Usage:  pnpm seed:haiti-calendar        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:haiti-calendar
 *
 * Upserts by title+dateISO so reruns are idempotent.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { haitiCalendarRepo } from "@edlight-news/firebase";
import type { CreateHaitiCalendarEvent } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Seed data: 2025–2026 academic year ─────────────────────────────────────

const EVENTS: CreateHaitiCalendarEvent[] = [
  // ── Baccalauréat ──────────────────────────────────────────────────────
  {
    title: "Inscription Baccalauréat 2026",
    dateISO: "2026-02-01",
    endDateISO: "2026-03-15",
    eventType: "exam",
    level: ["bac"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Période d'inscription aux examens du Baccalauréat haïtien (Rhéto et Philo) pour la session 2026.",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },
  {
    title: "Examens Baccalauréat 1ère partie (Rhéto)",
    dateISO: "2026-06-15",
    endDateISO: "2026-06-19",
    eventType: "exam",
    level: ["bac"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Examens du Baccalauréat 1ère partie pour les élèves de Rhéto.",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },
  {
    title: "Examens Baccalauréat 2ème partie (Philo)",
    dateISO: "2026-06-22",
    endDateISO: "2026-06-26",
    eventType: "exam",
    level: ["bac"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Examens du Baccalauréat 2ème partie pour les élèves de Philo.",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },
  {
    title: "Résultats Baccalauréat 2026",
    dateISO: "2026-08-15",
    eventType: "results",
    level: ["bac"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Publication des résultats du Baccalauréat haïtien 2026.",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },

  // ── UEH (Université d'État d'Haïti) ──────────────────────────────────
  {
    title: "Concours d'entrée UEH — Inscription",
    dateISO: "2026-07-01",
    endDateISO: "2026-08-15",
    eventType: "admissions",
    level: ["university"],
    institution: "UEH",
    officialUrl: "https://www.ueh.edu.ht/",
    notes: "Période d'inscription au concours d'entrée de l'Université d'État d'Haïti pour l'année 2026-2027.",
    sources: [{ url: "https://www.ueh.edu.ht/", label: "UEH" }],
  },
  {
    title: "Concours d'entrée UEH — Examens",
    dateISO: "2026-09-15",
    endDateISO: "2026-09-30",
    eventType: "exam",
    level: ["university"],
    institution: "UEH",
    officialUrl: "https://www.ueh.edu.ht/",
    notes: "Examens du concours d'entrée à l'UEH dans les différentes facultés.",
    sources: [{ url: "https://www.ueh.edu.ht/", label: "UEH" }],
  },
  {
    title: "Résultats concours UEH",
    dateISO: "2026-10-15",
    eventType: "results",
    level: ["university"],
    institution: "UEH",
    officialUrl: "https://www.ueh.edu.ht/",
    notes: "Publication des résultats du concours d'entrée à l'UEH.",
    sources: [{ url: "https://www.ueh.edu.ht/", label: "UEH" }],
  },
  {
    title: "Rentrée universitaire UEH 2026-2027",
    dateISO: "2026-11-03",
    eventType: "rentree",
    level: ["university"],
    institution: "UEH",
    officialUrl: "https://www.ueh.edu.ht/",
    notes: "Début des cours à l'Université d'État d'Haïti pour l'année académique 2026-2027.",
    sources: [{ url: "https://www.ueh.edu.ht/", label: "UEH" }],
  },

  // ── Campus France / Études en France ─────────────────────────────────
  {
    title: "Ouverture portail Études en France (Haïti)",
    dateISO: "2026-10-01",
    endDateISO: "2026-12-15",
    eventType: "admissions",
    level: ["university"],
    institution: "Campus France Haïti",
    officialUrl: "https://www.haiti.campusfrance.org/",
    notes: "Ouverture du portail Études en France pour les étudiants haïtiens souhaitant étudier en France en 2027-2028.",
    sources: [{ url: "https://www.haiti.campusfrance.org/", label: "Campus France Haïti" }],
  },
  {
    title: "Date limite Campus France — Licence (DAP)",
    dateISO: "2026-01-17",
    eventType: "admissions",
    level: ["university"],
    institution: "Campus France Haïti",
    officialUrl: "https://www.haiti.campusfrance.org/",
    notes: "Date limite de dépôt des dossiers de Demande d'Admission Préalable (DAP) pour la licence en France.",
    sources: [{ url: "https://www.haiti.campusfrance.org/", label: "Campus France Haïti" }],
  },
  {
    title: "Date limite Campus France — Master",
    dateISO: "2026-03-31",
    eventType: "admissions",
    level: ["university"],
    institution: "Campus France Haïti",
    officialUrl: "https://www.haiti.campusfrance.org/",
    notes: "Date limite générale pour les candidatures en Master via Études en France.",
    sources: [{ url: "https://www.haiti.campusfrance.org/", label: "Campus France Haïti" }],
  },

  // ── Rentrée scolaire & MENFP ────────────────────────────────────────
  {
    title: "Rentrée scolaire 2026-2027",
    dateISO: "2026-09-07",
    eventType: "rentree",
    level: ["ns1"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Rentrée scolaire officielle pour l'enseignement fondamental et secondaire en Haïti.",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },
  {
    title: "Examens officiels 6ème AF",
    dateISO: "2026-06-08",
    endDateISO: "2026-06-10",
    eventType: "exam",
    level: ["ns2"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Examens officiels de fin du cycle fondamental (6ème année).",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },
  {
    title: "Examens officiels 9ème AF",
    dateISO: "2026-06-11",
    endDateISO: "2026-06-13",
    eventType: "exam",
    level: ["ns2"],
    institution: "MENFP",
    officialUrl: "https://menfp.gouv.ht/",
    notes: "Examens officiels de fin du 3ème cycle fondamental (9ème année).",
    sources: [{ url: "https://menfp.gouv.ht/", label: "MENFP" }],
  },

  // ── Bourses & deadlines internationaux ───────────────────────────────
  {
    title: "Date limite Chevening (Haïti)",
    dateISO: "2026-11-05",
    eventType: "admissions",
    level: ["university"],
    institution: "Chevening / British Council",
    officialUrl: "https://www.chevening.org/scholarships/",
    notes: "Date limite de candidature aux bourses Chevening pour les étudiants haïtiens.",
    sources: [{ url: "https://www.chevening.org/scholarships/", label: "Chevening" }],
  },
  {
    title: "Date limite bourses AUF — Mobilité",
    dateISO: "2026-04-15",
    eventType: "admissions",
    level: ["university"],
    institution: "AUF",
    officialUrl: "https://www.auf.org/",
    notes: "Date limite pour les bourses de mobilité de l'Agence Universitaire de la Francophonie.",
    sources: [{ url: "https://www.auf.org/nos-actions/toutes-nos-actions/bourses/", label: "AUF Bourses" }],
  },

  // ── Québec-specific ──────────────────────────────────────────────────
  {
    title: "Date limite admission universités québécoises (automne)",
    dateISO: "2026-03-01",
    eventType: "admissions",
    level: ["university"],
    institution: "Universités du Québec",
    officialUrl: "https://www.bci-qc.ca/admission/",
    notes: "Date limite générale d'admission dans les universités québécoises pour la session d'automne 2026.",
    sources: [{ url: "https://www.bci-qc.ca/admission/", label: "BCI Québec" }],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`📅 Seeding ${EVENTS.length} Haiti education calendar events…\n`);

  let created = 0;
  let updated = 0;

  for (const e of EVENTS) {
    const result = await haitiCalendarRepo.upsertByTitle(e);
    if (result.created) {
      created++;
      console.log(`  ✅  created  ${e.title} (${e.dateISO})`);
    } else {
      updated++;
      console.log(`  ♻️  updated  ${e.title} (${e.dateISO})`);
    }
  }

  console.log(`\n🏁 Done — created: ${created}, updated: ${updated}, total: ${EVENTS.length}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
