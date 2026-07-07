/**
 * Country study guides — curated editorial context for "Étudier à l'étranger"
 * pages and (later) the carousel generator.
 *
 * Each guide is a small, hand-written context object per destination. The
 * scholarships themselves are pulled live from the dataset and filtered by
 * `country`, so this file only holds the durable, editorial parts: why study
 * there, language, cost/visa reality, the official pathway, generic steps, and
 * a short FAQ (used for the FAQPage schema + on-page accordion).
 *
 * Accuracy note: keep claims general and correct; specifics (amounts,
 * deadlines) live on the linked official pathway and the live scholarship list.
 */

import type { DatasetCountry } from "@edlight-news/types";

export interface Bilingual {
  fr: string;
  ht: string;
}
export interface BilingualList {
  fr: string[];
  ht: string[];
}

export interface CountryGuide {
  /** URL slug, e.g. "france". */
  slug: string;
  /** Dataset country code used to filter scholarships. */
  country: DatasetCountry;
  /** Brand accent (hex) — reused by the carousel generator later. */
  accent: string;
  /** Flag emoji for headings / chips. */
  flag: string;
  name: Bilingual;
  /** The value hook that leads the page and the social post. */
  hook: Bilingual;
  /** 3–4 reasons this destination fits Haitian students. */
  why: BilingualList;
  language: Bilingual;
  /** Cost / funding reality in one line. */
  cost: Bilingual;
  /** Official application pathway (portal). */
  pathway?: { label: string; url: string };
  /** Generic application steps (destination-level, not per-scholarship). */
  steps: BilingualList;
  faq: { q: Bilingual; a: Bilingual }[];
}

export const COUNTRY_GUIDES: CountryGuide[] = [
  {
    slug: "france",
    country: "FR",
    accent: "#3525cd",
    flag: "🇫🇷",
    name: { fr: "France", ht: "Frans" },
    hook: {
      fr: "Étudier en France depuis Haïti : la langue, la diaspora et des frais publics parmi les plus bas au monde.",
      ht: "Etidye an Frans depi Ayiti : lang lan, dyaspora a, ak frè piblik pami pi ba nan mond lan.",
    },
    why: {
      fr: [
        "Le français : pas de test de langue lourd à passer, un avantage énorme.",
        "Une grande diaspora haïtienne et des universités publiques accessibles.",
        "La bourse Eiffel du gouvernement français (master et doctorat).",
      ],
      ht: [
        "Fransè a : ou pa bezwen pase gwo tès lang, se yon gwo avantaj.",
        "Yon gwo dyaspora ayisyen ak inivèsite piblik ki aksesib.",
        "Bous Eiffel gouvènman fransè a (metriz ak doktora).",
      ],
    },
    language: { fr: "Français (avantage direct pour les Haïtiens)", ht: "Fransè (avantaj dirèk pou Ayisyen)" },
    cost: {
      fr: "Frais publics bas ; plusieurs bourses couvrent les frais et versent une allocation.",
      ht: "Frè piblik ba ; plizyè bous kouvri frè yo epi bay yon alokasyon.",
    },
    pathway: { label: "Campus France (Études en France)", url: "https://www.campusfrance.org/fr" },
    steps: {
      fr: [
        "Créer un dossier sur la plateforme « Études en France » de Campus France.",
        "Choisir vos formations et préparer vos documents (relevés, lettre de motivation).",
        "Passer l'entretien Campus France, puis demander le visa étudiant.",
      ],
      ht: [
        "Kreye yon dosye sou platfòm « Études en France » Campus France la.",
        "Chwazi fòmasyon ou yo epi prepare dokiman ou yo (nòt, lèt motivasyon).",
        "Fè entèvyou Campus France la, epi mande viza etidyan an.",
      ],
    },
    faq: [
      {
        q: { fr: "Faut-il parler français ?", ht: "Èske ou dwe pale fransè ?" },
        a: {
          fr: "Oui, la plupart des programmes sont en français — un vrai avantage pour les Haïtiens. Certains masters sont en anglais.",
          ht: "Wi, pifò pwogram yo an fransè — yon vre avantaj pou Ayisyen. Genyen kèk metriz ki an anglè.",
        },
      },
      {
        q: { fr: "Est-ce cher ?", ht: "Èske li chè ?" },
        a: {
          fr: "Les frais des universités publiques restent bas, et des bourses (comme Eiffel) peuvent couvrir frais et vie courante.",
          ht: "Frè inivèsite piblik yo rete ba, epi bous (tankou Eiffel) ka kouvri frè ak lavi chak jou.",
        },
      },
    ],
  },
  {
    slug: "usa",
    country: "US",
    accent: "#1d4ed8",
    flag: "🇺🇸",
    name: { fr: "États-Unis", ht: "Etazini" },
    hook: {
      fr: "Étudier aux États-Unis quand on est haïtien : ce n'est pas réservé aux riches — l'aide financière et les bourses existent.",
      ht: "Etidye Ozetazini lè w se Ayisyen : se pa pou moun rich sèlman — èd finansye ak bous yo egziste.",
    },
    why: {
      fr: [
        "De nombreuses universités offrent une aide financière importante aux étudiants internationaux.",
        "Le programme Fulbright pour les études supérieures.",
        "EducationUSA conseille gratuitement les candidats haïtiens.",
      ],
      ht: [
        "Anpil inivèsite bay gwo èd finansye pou etidyan entènasyonal yo.",
        "Pwogram Fulbright la pou etid siperyè.",
        "EducationUSA konseye kandida ayisyen yo gratis.",
      ],
    },
    language: { fr: "Anglais (TOEFL, IELTS ou Duolingo English Test)", ht: "Anglè (TOEFL, IELTS oswa Duolingo English Test)" },
    cost: {
      fr: "Élevé sur le papier, mais l'aide financière (need-based) et les bourses le réduisent fortement.",
      ht: "Wo sou papye, men èd finansye a (need-based) ak bous yo diminye l anpil.",
    },
    pathway: { label: "EducationUSA", url: "https://educationusa.state.gov/" },
    steps: {
      fr: [
        "Passer les tests requis (anglais, parfois SAT/GRE) et préparer votre dossier.",
        "Postuler aux universités et demander l'aide financière en même temps.",
        "Après l'admission : formulaire I-20, paiement SEVIS, puis entretien pour le visa F-1.",
      ],
      ht: [
        "Pase tès yo mande yo (anglè, pafwa SAT/GRE) epi prepare dosye ou.",
        "Aplike nan inivèsite yo epi mande èd finansye an menm tan.",
        "Apre admisyon : fòm I-20, peman SEVIS, epi entèvyou pou viza F-1 lan.",
      ],
    },
    faq: [
      {
        q: { fr: "Les études aux USA sont-elles trop chères pour un Haïtien ?", ht: "Èske etid Ozetazini twò chè pou yon Ayisyen ?" },
        a: {
          fr: "Le prix affiché est élevé, mais beaucoup d'universités accordent une aide financière selon les besoins qui peut couvrir la majeure partie des frais.",
          ht: "Pri ki afiche a wo, men anpil inivèsite bay èd finansye selon bezwen ki ka kouvri pi fò nan frè yo.",
        },
      },
      {
        q: { fr: "Quel test d'anglais passer ?", ht: "Ki tès anglè pou pase ?" },
        a: {
          fr: "TOEFL, IELTS ou le Duolingo English Test — le moins cher et faisable depuis Haïti — sont acceptés par la plupart des universités.",
          ht: "TOEFL, IELTS oswa Duolingo English Test — pi bon mache a epi fasil depi Ayiti — pifò inivèsite aksepte yo.",
        },
      },
    ],
  },
  {
    slug: "chine",
    country: "CN",
    accent: "#b91c1c",
    flag: "🇨🇳",
    name: { fr: "Chine", ht: "Lachin" },
    hook: {
      fr: "La bourse du gouvernement chinois (CSC) : 100 % financée — frais, logement et allocation mensuelle.",
      ht: "Bous gouvènman chinwa a (CSC) : 100 % finanse — frè, lojman ak yon alokasyon chak mwa.",
    },
    why: {
      fr: [
        "La Chinese Government Scholarship (CSC) couvre les frais, le logement et une allocation.",
        "Des programmes enseignés en anglais existent (une année de chinois offerte est souvent incluse).",
        "Candidature possible via l'université, le portail CSC ou l'ambassade de Chine.",
      ],
      ht: [
        "Chinese Government Scholarship (CSC) kouvri frè yo, lojman ak yon alokasyon.",
        "Genyen pwogram ki anseye an anglè (yo souvan mete yon ane chinwa gratis).",
        "Ou ka aplike atravè inivèsite a, pòtay CSC a oswa anbasad Lachin nan.",
      ],
    },
    language: { fr: "Anglais ou chinois (année de langue souvent offerte)", ht: "Anglè oswa chinwa (yon ane lang souvan ofri)" },
    cost: {
      fr: "Entièrement financée par la bourse CSC dans la plupart des cas.",
      ht: "Bous CSC a finanse l nèt nan pifò ka.",
    },
    pathway: { label: "China Scholarship Council (CSC)", url: "https://www.campuschina.org/" },
    steps: {
      fr: [
        "Choisir une université et un programme éligibles à la CSC.",
        "Déposer le dossier CSC (numéro d'agence) avec vos documents et lettres.",
        "Après l'admission : formulaire JW201/202, puis visa étudiant X.",
      ],
      ht: [
        "Chwazi yon inivèsite ak yon pwogram ki elijib pou CSC.",
        "Depoze dosye CSC a (nimewo ajans) ak dokiman ak lèt ou yo.",
        "Apre admisyon : fòm JW201/202, epi viza etidyan X la.",
      ],
    },
    faq: [
      {
        q: { fr: "La bourse chinoise est-elle vraiment gratuite ?", ht: "Èske bous chinwa a vrèman gratis ?" },
        a: {
          fr: "La CSC complète couvre les frais de scolarité, le logement universitaire et verse une allocation mensuelle.",
          ht: "CSC konplè a kouvri frè lekòl, lojman inivèsite epi bay yon alokasyon chak mwa.",
        },
      },
      {
        q: { fr: "Faut-il parler chinois ?", ht: "Èske ou dwe pale chinwa ?" },
        a: {
          fr: "Pas forcément : beaucoup de programmes sont en anglais, et une année de langue chinoise est souvent incluse.",
          ht: "Se pa fòseman : anpil pwogram an anglè, epi yo souvan mete yon ane lang chinwa.",
        },
      },
    ],
  },
  {
    slug: "russie",
    country: "RU",
    accent: "#1e3a8a",
    flag: "🇷🇺",
    name: { fr: "Russie", ht: "Larisi" },
    hook: {
      fr: "Le quota du gouvernement russe : études sans frais de scolarité, allocation et logement — via Open Doors et Rossotrudnichestvo.",
      ht: "Kota gouvènman ris la : etid san frè lekòl, alokasyon ak lojman — atravè Open Doors ak Rossotrudnichestvo.",
    },
    why: {
      fr: [
        "Le quota gouvernemental couvre la scolarité, avec allocation et logement.",
        "L'olympiade Open Doors ouvre le master et le doctorat aux internationaux.",
        "Une année préparatoire de russe est offerte avant le programme.",
      ],
      ht: [
        "Kota gouvènman an kouvri lekòl la, ak alokasyon ak lojman.",
        "Olimpyad Open Doors la ouvri metriz ak doktora pou etranje yo.",
        "Yo ofri yon ane preparatwa an ris anvan pwogram nan.",
      ],
    },
    language: { fr: "Russe (année préparatoire offerte) ; certains programmes en anglais", ht: "Ris (ane preparatwa ofri) ; kèk pwogram an anglè" },
    cost: {
      fr: "Sans frais de scolarité via le quota, avec allocation mensuelle.",
      ht: "San frè lekòl atravè kota a, ak alokasyon chak mwa.",
    },
    pathway: { label: "Education in Russia (Rossotrudnichestvo)", url: "https://education-in-russia.com/" },
    steps: {
      fr: [
        "S'inscrire sur le portail « Education in Russia » et choisir des universités.",
        "Passer la sélection (dossier, ou olympiade Open Doors pour le master/doctorat).",
        "Recevoir l'invitation officielle, puis demander le visa étudiant.",
      ],
      ht: [
        "Enskri sou pòtay « Education in Russia » a epi chwazi inivèsite.",
        "Pase seleksyon an (dosye, oswa olimpyad Open Doors pou metriz/doktora).",
        "Resevwa envitasyon ofisyèl la, epi mande viza etidyan an.",
      ],
    },
    faq: [
      {
        q: { fr: "Faut-il payer la scolarité ?", ht: "Èske ou dwe peye lekòl la ?" },
        a: {
          fr: "Avec le quota du gouvernement russe, la scolarité est prise en charge et une allocation est versée.",
          ht: "Ak kota gouvènman ris la, yo pran lekòl la an chaj epi yo bay yon alokasyon.",
        },
      },
      {
        q: { fr: "Dois-je parler russe ?", ht: "Èske mwen dwe pale ris ?" },
        a: {
          fr: "Une année préparatoire de russe est généralement offerte ; certains programmes existent aussi en anglais.",
          ht: "Yo jeneralman ofri yon ane preparatwa an ris ; genyen kèk pwogram tou an anglè.",
        },
      },
    ],
  },
  {
    slug: "canada",
    country: "CA",
    accent: "#b91c1c",
    flag: "🇨🇦",
    name: { fr: "Canada", ht: "Kanada" },
    hook: {
      fr: "Étudier au Canada, surtout au Québec francophone : proximité de la langue et grande communauté haïtienne.",
      ht: "Etidye nan Kanada, sitou nan Kebèk fwankofòn : lang lan pre ou epi gen yon gwo kominote ayisyen.",
    },
    why: {
      fr: [
        "Le Québec est francophone — étudier sans barrière de langue.",
        "Une très grande communauté haïtienne, surtout à Montréal.",
        "Des bourses d'admission et des programmes ouverts aux internationaux.",
      ],
      ht: [
        "Kebèk se fwankofòn — etidye san baryè lang.",
        "Yon trè gwo kominote ayisyen, sitou nan Monreyal.",
        "Bous admisyon ak pwogram ki ouvri pou etranje yo.",
      ],
    },
    language: { fr: "Français (Québec) ou anglais", ht: "Fransè (Kebèk) oswa anglè" },
    cost: {
      fr: "Frais internationaux, mais des bourses d'admission et une preuve de fonds sont requises.",
      ht: "Frè entènasyonal, men gen bous admisyon epi yo mande yon prèv fon.",
    },
    pathway: { label: "EduCanada", url: "https://www.educanada.ca/" },
    steps: {
      fr: [
        "Choisir un établissement et obtenir une lettre d'admission.",
        "Pour le Québec : obtenir le CAQ, puis le permis d'études fédéral.",
        "Fournir une preuve de fonds et préparer votre arrivée.",
      ],
      ht: [
        "Chwazi yon etablisman epi jwenn yon lèt admisyon.",
        "Pou Kebèk : jwenn CAQ la, epi pèmi etid federal la.",
        "Bay yon prèv fon epi prepare rive ou.",
      ],
    },
    faq: [
      {
        q: { fr: "Puis-je étudier en français au Canada ?", ht: "Èske mwen ka etidye an fransè nan Kanada ?" },
        a: {
          fr: "Oui — au Québec, les universités sont francophones, un vrai avantage pour les Haïtiens.",
          ht: "Wi — nan Kebèk, inivèsite yo fwankofòn, yon vre avantaj pou Ayisyen.",
        },
      },
    ],
  },
  {
    slug: "republique-dominicaine",
    country: "DO",
    accent: "#1d4ed8",
    flag: "🇩🇴",
    name: { fr: "République Dominicaine", ht: "Repiblik Dominikèn" },
    hook: {
      fr: "Juste à côté : la République Dominicaine offre des études abordables et accessibles aux Haïtiens.",
      ht: "Jis akote : Repiblik Dominikèn ofri etid abòdab epi aksesib pou Ayisyen.",
    },
    why: {
      fr: [
        "La proximité : pas besoin de traverser un océan.",
        "Des frais souvent plus bas qu'en Amérique du Nord ou en Europe.",
        "Des bourses via le MESCyT (ministère dominicain).",
      ],
      ht: [
        "Li tou pre : ou pa bezwen travèse yon oseyan.",
        "Frè yo souvan pi ba pase Amerik dinò oswa Ewòp.",
        "Bous atravè MESCyT (ministè dominiken an).",
      ],
    },
    language: { fr: "Espagnol", ht: "Panyòl" },
    cost: {
      fr: "Abordable comparé au reste ; des bourses publiques existent.",
      ht: "Abòdab konpare ak lòt yo ; gen bous piblik ki egziste.",
    },
    pathway: { label: "MESCyT", url: "https://www.mescyt.gob.do/" },
    steps: {
      fr: [
        "Choisir une université et vérifier les cours en espagnol.",
        "Préparer vos documents et, si besoin, renforcer votre espagnol.",
        "Demander le visa étudiant dominicain.",
      ],
      ht: [
        "Chwazi yon inivèsite epi tcheke kou yo an panyòl.",
        "Prepare dokiman ou yo epi, si nesesè, ranfòse panyòl ou.",
        "Mande viza etidyan dominiken an.",
      ],
    },
    faq: [
      {
        q: { fr: "Faut-il parler espagnol ?", ht: "Èske ou dwe pale panyòl ?" },
        a: {
          fr: "Oui, la plupart des cours sont en espagnol ; il est utile de le renforcer avant de partir.",
          ht: "Wi, pifò kou yo an panyòl ; li itil pou ranfòse l anvan ou pati.",
        },
      },
    ],
  },
];

export function getCountryGuide(slug: string): CountryGuide | undefined {
  return COUNTRY_GUIDES.find((g) => g.slug === slug);
}
