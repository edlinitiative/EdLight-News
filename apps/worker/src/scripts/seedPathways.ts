/**
 * Seed pathways (study-abroad guides) into Firestore.
 *
 * Usage:  pnpm seed:pathways        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:pathways
 *
 * Upserts by goalKey+country so reruns are idempotent.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pathwaysRepo } from "@edlight-news/firebase";
import type { CreatePathway } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Seed data ──────────────────────────────────────────────────────────────

const PATHWAYS: CreatePathway[] = [
  {
    goalKey: "study_abroad",
    title_fr: "Étudier au Canada depuis Haïti",
    title_ht: "Etidye nan Kanada depi Ayiti",
    country: "CA",
    steps: [
      {
        title_fr: "Choisir un programme et une université",
        title_ht: "Chwazi yon pwogram ak yon inivèsite",
        description_fr: "Comparez les universités francophones (UdeM, Laval, UQAM, Sherbrooke) et anglophones (McGill, UofT, UBC). Les universités québécoises offrent des exemptions de frais pour les étudiants haïtiens.",
        description_ht: "Konpare inivèsite frankofòn yo (UdeM, Laval, UQAM, Sherbrooke) ak anglofòn yo (McGill, UofT, UBC). Inivèsite kebèkwa yo ofri egzanpsyon frè pou etidyan ayisyen yo.",
        links: [],
      },
      {
        title_fr: "Préparer les tests de langue",
        title_ht: "Prepare tès lang yo",
        description_fr: "Pour le Québec : TCF, TEF ou DELF/DALF. Pour les universités anglophones : TOEFL, IELTS ou Duolingo English Test. Commencez la préparation 6 mois à l'avance.",
        description_ht: "Pou Kebèk: TCF, TEF oswa DELF/DALF. Pou inivèsite anglofòn yo: TOEFL, IELTS oswa Duolingo English Test. Kòmanse preparasyon 6 mwa alavans.",
        links: [],
      },
      {
        title_fr: "Soumettre la candidature",
        title_ht: "Soumèt kandidati a",
        description_fr: "Postulez directement sur le site de l'université ou via OUAC (Ontario). Dates limites habituelles : 1er mars pour l'automne. Prévoyez les frais de candidature (50-150 CAD).",
        description_ht: "Aplike dirèkteman sou sit inivèsite a oswa via OUAC (Ontario). Dat limit abityèl: 1ye mas pou otòn. Prevwa frè kandidati (50-150 CAD).",
        links: [],
      },
      {
        title_fr: "Obtenir le permis d'études",
        title_ht: "Jwenn pèmi etid la",
        description_fr: "Après l'acceptation, demandez un permis d'études canadien via IRCC. Vous aurez besoin d'une lettre d'acceptation, preuve de fonds suffisants et CAQ (pour le Québec).",
        description_ht: "Apre akseptasyon an, mande yon pèmi etid kanadyen via IRCC. W ap bezwen yon lèt akseptasyon, prèv fon ase ak CAQ (pou Kebèk).",
        links: [],
      },
      {
        title_fr: "Financer vos études",
        title_ht: "Finanse etid ou yo",
        description_fr: "Explorez les bourses : exemption Québec pour Haïtiens, BESC, bourses d'admission par université, et programmes AUF/Francophonie.",
        description_ht: "Eksplore bous yo: egzanpsyon Kebèk pou Ayisyen, BESC, bous admisyon pa inivèsite, ak pwogram AUF/Frankofoni.",
        links: [],
      },
    ],
    sources: [
      { url: "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/etudier-canada.html", label: "IRCC — Étudier au Canada" },
      { url: "https://www.bci-qc.ca/admission/", label: "BCI Québec" },
    ],
  },
  {
    goalKey: "study_abroad",
    title_fr: "Étudier en France depuis Haïti",
    title_ht: "Etidye an Frans depi Ayiti",
    country: "FR",
    steps: [
      {
        title_fr: "Créer votre compte Études en France",
        title_ht: "Kreye kont Études en France ou",
        description_fr: "Inscrivez-vous sur le portail Études en France de Campus France Haïti. Ouverture habituelle : octobre-décembre pour la rentrée suivante.",
        description_ht: "Enskri sou pòtay Études en France Campus France Ayiti. Ouvèti abityèl: oktòb-desanm pou rantre ki vini an.",
        links: [],
      },
      {
        title_fr: "Choisir vos formations",
        title_ht: "Chwazi fòmasyon ou yo",
        description_fr: "Vous pouvez sélectionner jusqu'à 7 formations. Pour la licence : procédure DAP (date limite 17 janvier). Pour le master : directement via les universités ou MonMaster.",
        description_ht: "Ou ka chwazi jiska 7 fòmasyon. Pou lisans: pwosedi DAP (dat limit 17 janvye). Pou metriz: dirèkteman via inivèsite yo oswa MonMaster.",
        links: [],
      },
      {
        title_fr: "Passer l'entretien Campus France",
        title_ht: "Pase entretyen Campus France",
        description_fr: "Entretien pédagogique obligatoire au centre Campus France à Port-au-Prince. Préparez votre projet d'études et motivations.",
        description_ht: "Entretyen pedagojik obligatwa nan sant Campus France nan Pòtoprens. Prepare pwojè etid ou ak motivasyon ou.",
        links: [],
      },
      {
        title_fr: "Obtenir le visa étudiant",
        title_ht: "Jwenn viza etidyan an",
        description_fr: "Après acceptation par une université, déposez votre demande de visa long séjour étudiant au consulat de France.",
        description_ht: "Apre akseptasyon pa yon inivèsite, depoze demand viza long sejou etidyan nan konsila Frans la.",
        links: [],
      },
      {
        title_fr: "Financer vos études en France",
        title_ht: "Finanse etid ou an Frans",
        description_fr: "Les frais de scolarité en université publique sont très bas (~170€/an en licence). Bourses : Campus France, AUF, Erasmus+, bourses régionales.",
        description_ht: "Frè etid nan inivèsite piblik trè ba (~170€/an nan lisans). Bous: Campus France, AUF, Erasmus+, bous rejyonal.",
        links: [],
      },
    ],
    sources: [
      { url: "https://www.haiti.campusfrance.org/", label: "Campus France Haïti" },
      { url: "https://france-visas.gouv.fr/", label: "France Visas" },
    ],
  },
  {
    goalKey: "study_abroad",
    title_fr: "Étudier aux États-Unis depuis Haïti",
    title_ht: "Etidye Ozetazini depi Ayiti",
    country: "US",
    steps: [
      {
        title_fr: "Choisir vos universités",
        title_ht: "Chwazi inivèsite ou yo",
        description_fr: "Recherchez sur Common App, Coalition App ou directement sur les sites des universités. Considérez les universités need-blind pour internationaux (Harvard, Yale, Princeton, MIT, Amherst).",
        description_ht: "Rechèche sou Common App, Coalition App oswa dirèkteman sou sit inivèsite yo. Konsidere inivèsite need-blind pou entènasyonal yo.",
        links: [],
      },
      {
        title_fr: "Passer les tests standardisés",
        title_ht: "Pase tès standardize yo",
        description_fr: "SAT ou ACT (souvent optionnels maintenant), TOEFL/IELTS/DET pour la langue. Inscrivez-vous tôt car les centres en Haïti ont des places limitées.",
        description_ht: "SAT oswa ACT (souvan opsyonèl kounye a), TOEFL/IELTS/DET pou lang nan. Enskri bonè paske sant yo an Ayiti gen plas limite.",
        links: [],
      },
      {
        title_fr: "Préparer votre candidature",
        title_ht: "Prepare kandidati ou",
        description_fr: "Essays, lettres de recommandation, relevés de notes traduits. Date limite : 1er janvier (Regular Decision) ou 1er novembre (Early Decision).",
        description_ht: "Esè, lèt rekòmandasyon, relve nòt tradwi. Dat limit: 1ye janvye (Regular Decision) oswa 1ye novanm (Early Decision).",
        links: [],
      },
      {
        title_fr: "Obtenir le visa F-1",
        title_ht: "Jwenn viza F-1",
        description_fr: "Après acceptation et réception du formulaire I-20, prenez rendez-vous à l'ambassade des États-Unis pour l'entretien de visa.",
        description_ht: "Apre akseptasyon ak resepsyon fòmilè I-20, pran randevou nan anbasad Etazini pou entretyen viza.",
        links: [],
      },
      {
        title_fr: "Financer vos études",
        title_ht: "Finanse etid ou yo",
        description_fr: "Bourses : Fulbright, MasterCard Foundation, bourses universitaires, financial aid (certaines universités offrent une aide complète aux internationaux).",
        description_ht: "Bous: Fulbright, MasterCard Foundation, bous inivèsite, èd finansyè (kèk inivèsite ofri èd konplè pou entènasyonal yo).",
        links: [],
      },
    ],
    sources: [
      { url: "https://www.commonapp.org/", label: "Common App" },
      { url: "https://educationusa.state.gov/", label: "EducationUSA" },
    ],
  },
  {
    goalKey: "study_abroad",
    title_fr: "Étudier au Royaume-Uni depuis Haïti",
    title_ht: "Etidye nan Wayòm Ini depi Ayiti",
    country: "UK",
    steps: [
      {
        title_fr: "Rechercher des programmes via UCAS",
        title_ht: "Rechèche pwogram via UCAS",
        description_fr: "Utilisez UCAS pour trouver et postuler aux programmes de licence (undergraduate). Pour les masters, postulez directement aux universités.",
        description_ht: "Itilize UCAS pou jwenn ak aplike nan pwogram lisans (undergraduate). Pou metriz, aplike dirèkteman nan inivèsite yo.",
        links: [],
      },
      {
        title_fr: "Préparer les tests de langue",
        title_ht: "Prepare tès lang yo",
        description_fr: "IELTS UKVI est le test le plus accepté. Score minimum habituel : 6.0-7.0 selon le programme. Alternative : TOEFL iBT.",
        description_ht: "IELTS UKVI se tès ki pi aksepte a. Nòt minimòm abityèl: 6.0-7.0 selon pwogram nan. Altènatif: TOEFL iBT.",
        links: [],
      },
      {
        title_fr: "Postuler aux bourses",
        title_ht: "Aplike pou bous yo",
        description_fr: "Chevening (master), Commonwealth Scholarships, bourses propres aux universités. Postulez tôt car les délais sont différents des admissions.",
        description_ht: "Chevening (metriz), Commonwealth Scholarships, bous pwòp inivèsite yo. Aplike bonè paske dat limit yo diferan de admisyon yo.",
        links: [],
      },
      {
        title_fr: "Obtenir le visa étudiant (Student Route)",
        title_ht: "Jwenn viza etidyan (Student Route)",
        description_fr: "Après acceptation, obtenez un CAS (Confirmation of Acceptance for Studies) de votre université. Ensuite, demandez le visa Student Route.",
        description_ht: "Apre akseptasyon, jwenn yon CAS (Confirmation of Acceptance for Studies) nan inivèsite ou. Answit, mande viza Student Route.",
        links: [],
      },
    ],
    sources: [
      { url: "https://www.ucas.com/", label: "UCAS" },
      { url: "https://www.gov.uk/student-visa", label: "UK Student Visa" },
    ],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🛤️  Seeding ${PATHWAYS.length} pathways…\n`);

  let created = 0;
  let updated = 0;

  for (const p of PATHWAYS) {
    const result = await pathwaysRepo.upsertByGoalKey(p);
    if (result.created) {
      created++;
      console.log(`  ✅  created  ${p.goalKey} — ${p.title_fr}`);
    } else {
      updated++;
      console.log(`  ♻️  updated  ${p.goalKey} — ${p.title_fr}`);
    }
  }

  console.log(`\n🏁 Done — created: ${created}, updated: ${updated}, total: ${PATHWAYS.length}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
