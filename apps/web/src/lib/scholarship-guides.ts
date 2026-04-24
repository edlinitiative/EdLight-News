export interface ScholarshipGuideTimelineItem {
  phase: string;
  window: string;
  details: string;
}

export interface ScholarshipGuideStep {
  title: string;
  details: string;
  actionUrl?: string;
}

export interface ScholarshipGuideLink {
  label: string;
  url: string;
}

export interface ScholarshipGuide {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  level: string;
  funding: string;
  competitiveness: string;
  overview: string;
  whyForHaiti: string[];
  timeline: ScholarshipGuideTimelineItem[];
  steps: ScholarshipGuideStep[];
  documents: string[];
  mistakes: string[];
  officialLinks: ScholarshipGuideLink[];
}

export const SCHOLARSHIP_GUIDES: ScholarshipGuide[] = [
  {
    slug: "uwc-haiti",
    title: "UWC Haïti",
    subtitle: "Guide secondaire international (16–19 ans)",
    region: "Global / Amérique latine",
    level: "Secondaire (IB)",
    funding: "Complet ou partiel selon besoin",
    competitiveness: "Élevée",
    overview:
      "UWC est une porte d'entrée de très haut niveau pour les élèves haïtiens en fin de secondaire. Le comité national haïtien sélectionne les candidats et les place dans un campus UWC (dont Costa Rica).",
    whyForHaiti: [
      "Accès à un diplôme IB reconnu mondialement.",
      "Réseau international puissant avant l'université.",
      "Très bonne passerelle vers des bourses universitaires ensuite.",
    ],
    timeline: [
      { phase: "Ouverture des candidatures", window: "Septembre", details: "Publication de l'appel par le comité national." },
      { phase: "Dossier + tests", window: "Octobre – Décembre", details: "Sélection académique + leadership + engagement." },
      { phase: "Entretiens finaux", window: "Décembre – Janvier", details: "Entretiens avec jury national." },
      { phase: "Placements campus", window: "Février – Avril", details: "Affectation dans un collège UWC selon profil et places." },
    ],
    steps: [
      { title: "Vérifier l'éligibilité d'âge", details: "Généralement 15–17 ans au moment de la candidature." },
      { title: "Préparer dossier académique", details: "Relevés, résultats, activités extrascolaires, engagement communautaire." },
      { title: "Montrer le potentiel de leadership", details: "Exemples concrets d'impact dans école/communauté." },
      { title: "Postuler via le comité national", details: "Suivre strictement les instructions de UWC Haïti.", actionUrl: "https://www.uwc.org/apply" },
    ],
    documents: [
      "Relevés scolaires récents",
      "Pièce d'identité / passeport",
      "Lettre(s) de recommandation",
      "Essais personnels",
      "Preuves d'activités / engagement",
    ],
    mistakes: [
      "Attendre la dernière semaine pour rassembler les recommandations.",
      "Sous-estimer l'importance du projet personnel et de l'impact social.",
      "Candidature trop générique sans vision claire de contribution.",
    ],
    officialLinks: [
      { label: "UWC – Apply", url: "https://www.uwc.org/apply" },
      { label: "UWC Global", url: "https://www.uwc.org/" },
    ],
  },
  {
    slug: "rhodes-haiti",
    title: "Rhodes Scholarship",
    subtitle: "Oxford – guide candidatures Haïti (Global constituency)",
    region: "UK",
    level: "Master / PhD",
    funding: "Complet",
    competitiveness: "Très élevée",
    overview:
      "Rhodes est parmi les bourses les plus prestigieuses au monde. Pour Haïti, la voie typique est la constituency Global. Le dossier exige excellence académique + leadership + service.",
    whyForHaiti: [
      "Effet transformateur de réseau (Oxford + Rhodes alumni).",
      "Financement total + forte reconnaissance internationale.",
      "Très bon levier pour leadership public et institutionnel en Haïti.",
    ],
    timeline: [
      { phase: "Ouverture", window: "Juin", details: "Calendrier publié sur Rhodes House." },
      { phase: "Soumission", window: "Septembre – Octobre", details: "Deadlines varient par constituency." },
      { phase: "Entretiens", window: "Novembre", details: "Panels finaux pour les shortlists." },
      { phase: "Annonce", window: "Décembre", details: "Décision finale et préparation admission Oxford." },
    ],
    steps: [
      { title: "Identifier la bonne constituency", details: "Global pour les pays sans voie dédiée." , actionUrl: "https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/which-scholarship-to-apply-for/"},
      { title: "Construire un dossier narratif fort", details: "Lien clair entre parcours, service, et vision d'impact en Haïti." },
      { title: "Sécuriser références d'exception", details: "Recommandants académiques et de leadership crédibles." },
      { title: "Préparer entretien stratégique", details: "Capacité d'analyse, humilité, clarté de mission." },
    ],
    documents: [
      "Relevés universitaires complets",
      "Personal statement",
      "CV académique + impact",
      "5–8 lettres de recommandation",
      "Pièces d'identité / nationalité",
    ],
    mistakes: [
      "Dossier trop centré sur les titres et pas assez sur l'impact concret.",
      "Recommandations tardives ou trop faibles.",
      "Projet post-Oxford flou pour Haïti.",
    ],
    officialLinks: [
      { label: "Rhodes House", url: "https://www.rhodeshouse.ox.ac.uk/" },
      {
        label: "Which scholarship to apply for",
        url: "https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/which-scholarship-to-apply-for/",
      },
    ],
  },
  {
    slug: "fulbright-haiti",
    title: "Fulbright Foreign Student",
    subtitle: "Guide Haïti – études supérieures aux États-Unis",
    region: "US",
    level: "Master / PhD",
    funding: "Complet",
    competitiveness: "Élevée",
    overview:
      "Fulbright est une bourse gouvernementale américaine de référence. La candidature haïtienne se coordonne avec l'ambassade US à Port-au-Prince.",
    whyForHaiti: [
      "Financement complet et visibilité internationale.",
      "Accès à des universités américaines de haut niveau.",
      "Réseau Fulbright très utile pour retour et contribution nationale.",
    ],
    timeline: [
      { phase: "Annonce locale", window: "Mars – Mai", details: "Publication locale par l'ambassade US." },
      { phase: "Dossier", window: "Mai – Juillet", details: "Tests, recommandations, essais." },
      { phase: "Entretiens", window: "Octobre – Novembre", details: "Shortlist et entretiens de sélection." },
      { phase: "Placement universitaire", window: "Décembre – Avril", details: "Affectation via IIE." },
    ],
    steps: [
      { title: "Suivre l'appel de l'ambassade", details: "Ne pas dépendre seulement du calendrier global.", actionUrl: "https://ht.usembassy.gov/education-culture/" },
      { title: "Préparer anglais académique", details: "TOEFL/IELTS solide pour maximiser placement." },
      { title: "Soigner l'essai d'impact", details: "Montrer contribution claire à Haïti après études." },
      { title: "Préparer les entretiens", details: "Leadership, cohérence du projet, maturité professionnelle." },
    ],
    documents: [
      "Diplômes et relevés",
      "TOEFL/IELTS",
      "CV",
      "Essais Fulbright",
      "Lettres de recommandation",
    ],
    mistakes: [
      "Ignorer les consignes locales spécifiques Haïti.",
      "Essai trop vague sur l'après-bourse.",
      "Application soumise sans relecture éditoriale sérieuse.",
    ],
    officialLinks: [
      { label: "Fulbright Foreign Student", url: "https://foreign.fulbrightonline.org/" },
      { label: "US Embassy Haiti", url: "https://ht.usembassy.gov/education-culture/" },
    ],
  },
  {
    slug: "daad-haiti",
    title: "DAAD Scholarships",
    subtitle: "Guide Allemagne – master, recherche et politiques publiques",
    region: "Allemagne",
    level: "Master / PhD",
    funding: "Complet (selon programme)",
    competitiveness: "Élevée",
    overview:
      "Le DAAD regroupe plusieurs programmes. Pour les candidats haïtiens, EPOS et Helmut-Schmidt sont souvent les plus stratégiques.",
    whyForHaiti: [
      "Excellente voie vers expertise technique et institutionnelle.",
      "Beaucoup de programmes en anglais.",
      "Forte valeur de retour pour secteurs publics/ONG/éducation en Haïti.",
    ],
    timeline: [
      { phase: "Identification programme", window: "Mai – Août", details: "Choisir programme DAAD adapté au profil." },
      { phase: "Soumission", window: "Août – Octobre", details: "Dates variables selon filière." },
      { phase: "Sélection", window: "Novembre – Février", details: "Évaluations et admissions." },
      { phase: "Départ", window: "Septembre suivant", details: "Préparation visa, logement, langue." },
    ],
    steps: [
      { title: "Choisir la bonne piste DAAD", details: "EPOS, Helmut-Schmidt, ou recherche doctorale.", actionUrl: "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/" },
      { title: "Aligner projet et impact", details: "Montrer usage concret des compétences pour Haïti." },
      { title: "Renforcer dossier académique", details: "Recommandations fortes + cohérence parcours/projet." },
      { title: "Anticiper le visa", details: "Préparer très tôt la documentation financière/administrative." },
    ],
    documents: [
      "Diplômes et relevés traduits",
      "CV académique",
      "Motivation letter",
      "Lettres de recommandation",
      "Preuve de langue selon programme",
    ],
    mistakes: [
      "Postuler à un programme mal aligné au profil.",
      "Négliger les exigences de traduction/certification.",
      "Sous-estimer le temps de traitement administratif.",
    ],
    officialLinks: [
      { label: "DAAD Official", url: "https://www.daad.de/en/studying-in-germany/scholarships/" },
      { label: "DAAD Database", url: "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/" },
    ],
  },
  {
    slug: "erasmus-haiti",
    title: "Erasmus Mundus",
    subtitle: "Guide master conjoint Europe pour candidats haïtiens",
    region: "Union européenne",
    level: "Master",
    funding: "Complet",
    competitiveness: "Très élevée",
    overview:
      "Erasmus Mundus finance des masters conjoints multi-pays avec allocation mensuelle, frais et mobilité. Chaque consortium a son propre calendrier.",
    whyForHaiti: [
      "Diplôme multi-institution très valorisé.",
      "Exposition internationale très forte.",
      "Excellent levier pour carrières régionales et globales.",
    ],
    timeline: [
      { phase: "Recherche programmes", window: "Septembre – Décembre", details: "Identifier 3–5 programmes pertinents." },
      { phase: "Soumissions", window: "Janvier – Février", details: "Deadlines par consortium." },
      { phase: "Résultats", window: "Mars – Mai", details: "Shortlists puis admission/bourse." },
      { phase: "Mobilité", window: "Septembre", details: "Départ vers premier campus." },
    ],
    steps: [
      { title: "Cibler les bons consortiums", details: "Sélectionner par discipline et prérequis réels.", actionUrl: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en" },
      { title: "Préparer un dossier compétitif", details: "Motivation spécifique à chaque consortium." },
      { title: "Optimiser l'anglais académique", details: "TOEFL/IELTS souvent déterminant." },
      { title: "Préparer plan de financement annexe", details: "Anticiper frais initiaux avant versement complet." },
    ],
    documents: [
      "Relevés + diplômes",
      "CV Europass (ou équivalent)",
      "Motivation letters ciblées",
      "Références académiques",
      "Preuve d'anglais",
    ],
    mistakes: [
      "Envoyer la même lettre à tous les consortiums.",
      "Ignorer le fit disciplinaire réel.",
      "S'attendre à un calendrier unique Erasmus (il n'existe pas).",
    ],
    officialLinks: [
      { label: "Erasmus Mundus Catalogue", url: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en" },
      { label: "Erasmus+ official", url: "https://erasmus-plus.ec.europa.eu/" },
    ],
  },
  {
    slug: "chevening-haiti",
    title: "Chevening Scholarships",
    subtitle: "Guide UK leadership track pour candidats haïtiens",
    region: "UK",
    level: "Master",
    funding: "Complet",
    competitiveness: "Très élevée",
    overview:
      "Chevening finance une année de master au Royaume-Uni pour profils à fort potentiel de leadership. Les essais et la cohérence de trajectoire sont critiques.",
    whyForHaiti: [
      "Bourse d'État complète et très reconnue.",
      "Forte composante leadership et policy.",
      "Réseau alumni utile pour influence locale/régionale.",
    ],
    timeline: [
      { phase: "Ouverture", window: "Août", details: "Ouverture portail Chevening." },
      { phase: "Clôture", window: "Novembre", details: "Soumission finale des essais." },
      { phase: "Entretiens", window: "Février – Avril", details: "Panels ambassade/commission." },
      { phase: "Conditions finales", window: "Juin – Juillet", details: "Admissions universitaires à finaliser." },
    ],
    steps: [
      { title: "Valider les critères", details: "Expérience professionnelle + citoyenneté + retour au pays.", actionUrl: "https://www.chevening.org/scholarships/" },
      { title: "Écrire des essais stratégiques", details: "Leadership, networking, plan d'études, objectifs de carrière." },
      { title: "Choisir 3 programmes UK cohérents", details: "Programmes réalistes et alignés avec projet." },
      { title: "Préparer entretien haute intensité", details: "Narratif d'impact précis pour Haïti." },
    ],
    documents: [
      "Passeport",
      "Relevés + diplômes",
      "Essais Chevening",
      "Références",
      "Preuve d'admissions UK (phase finale)",
    ],
    mistakes: [
      "Essais trop abstraits et sans preuves d'impact.",
      "Choix de masters incohérents entre eux.",
      "Sous-préparer l'entretien oral.",
    ],
    officialLinks: [
      { label: "Chevening Official", url: "https://www.chevening.org/" },
      { label: "Apply", url: "https://www.chevening.org/scholarships/" },
    ],
  },
  {
    slug: "mastercard-haiti",
    title: "Mastercard Foundation Scholars",
    subtitle: "Guide partenaires et stratégie candidature Haïti",
    region: "Global",
    level: "Bachelor / Master",
    funding: "Complet",
    competitiveness: "Élevée",
    overview:
      "Le programme Mastercard Foundation passe par des universités partenaires. La bonne stratégie est de sélectionner les partenaires accessibles aux profils haïtiens et d'optimiser le dossier leadership + impact.",
    whyForHaiti: [
      "Financement complet + accompagnement long terme.",
      "Réseau de leadership orienté impact social.",
      "Partenaires alignés sur agriculture, santé, innovation, policy.",
    ],
    timeline: [
      { phase: "Sélection des partenaires", window: "Septembre – Novembre", details: "Identifier universités ouvrant aux candidats haïtiens." },
      { phase: "Candidatures", window: "Novembre – Mars", details: "Chaque partenaire a son cycle." },
      { phase: "Entretiens / décisions", window: "Mars – Juin", details: "Dépend des universités." },
      { phase: "Pré-départ", window: "Été", details: "Visa, onboarding, préparation académique." },
    ],
    steps: [
      { title: "Choisir les universités partenaires", details: "Commencer par celles avec historique de candidats caribéens.", actionUrl: "https://mastercardfdn.org/all/scholars/scholars-program-partners/" },
      { title: "Construire dossier orienté impact", details: "Leadership communautaire démontré + résultats mesurables." },
      { title: "Adapter chaque motivation", details: "Éviter les lettres génériques entre partenaires." },
      { title: "Préparer preuves financières et académiques", details: "Anticiper demandes administratives de chaque université." },
    ],
    documents: [
      "Relevés et diplômes",
      "Lettres de recommandation",
      "Essais de leadership",
      "CV / portfolio d'impact",
      "Pièces administratives université",
    ],
    mistakes: [
      "Postuler à trop de partenaires sans personnalisation.",
      "Négliger la preuve de leadership concret.",
      "Dossier administratif incomplet à la deadline.",
    ],
    officialLinks: [
      { label: "Mastercard Scholars", url: "https://mastercardfdn.org/all/scholars/" },
      {
        label: "Program partners",
        url: "https://mastercardfdn.org/all/scholars/scholars-program-partners/",
      },
    ],
  },
];

export function getScholarshipGuide(slug: string): ScholarshipGuide | undefined {
  return SCHOLARSHIP_GUIDES.find((g) => g.slug === slug);
}
