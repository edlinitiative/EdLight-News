/**
 * Editorial content constants for the /histoire page.
 *
 * These structured mock/static data constants represent the editorial content
 * displayed on the redesigned /histoire page. They are intended to be replaced
 * by CMS or API data once the backend integration is in place.
 */

// ---------------------------------------------------------------------------
// 1. History Stats
// ---------------------------------------------------------------------------

export const historyStats = [
  { value: "124", label: "repères historiques", sublabel: "Événements du mois" },
  { value: "08", label: "moments majeurs", sublabel: "Dates commémoratives" },
  { value: "12", label: "archives ouvertes", sublabel: "Mois explorés" },
] as const;

// ---------------------------------------------------------------------------
// 2. Date Navigation
// ---------------------------------------------------------------------------

export interface DateNavItem {
  monthDay: string; // "MM-DD"
  label: string; // "29 DÉC", "01 JAN", etc.
  isToday?: boolean;
}

export const dateNavItems: DateNavItem[] = [
  { monthDay: "12-29", label: "29 DÉC" },
  { monthDay: "12-30", label: "30 DÉC" },
  { monthDay: "12-31", label: "31 DÉC" },
  { monthDay: "01-01", label: "01 JAN", isToday: true },
  { monthDay: "01-02", label: "02 JAN" },
  { monthDay: "01-03", label: "03 JAN" },
  { monthDay: "01-04", label: "04 JAN" },
  { monthDay: "01-05", label: "05 JAN" },
];

// ---------------------------------------------------------------------------
// 3. Featured Spotlight
// ---------------------------------------------------------------------------

export interface FeaturedEvent {
  year: number;
  title: string;
  subtitle: string;
  summary: string;
  quote: string;
  significance: string;
  tags: string[];
  imageUrl: string;
  imageAlt: string;
}

export const featuredSpotlight: FeaturedEvent = {
  year: 1804,
  title: "L'acte de Gonaïves",
  subtitle: "Jour de l'Indépendance",
  summary:
    "Au-delà de la naissance d'une nation, cette date représente l'effondrement symbolique du système colonial esclavagiste. Haïti devient le premier État noir libre du monde moderne.",
  quote:
    "« Nous avons juré de mourir plutôt que de vivre sous la domination de quiconque. »",
  significance:
    "L'indépendance haïtienne constitue un séisme géopolitique majeur. Elle transforme le langage de la liberté, inspire les luttes anticoloniales et demeure une référence politique, morale et symbolique bien au-delà de la Caraïbe.",
  tags: ["Jour de l'Indépendance", "Document vérifié"],
  imageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQch4SNGpBV7chouYLgC061BtZfEhs8MHZH_N8zh9V8H98B31gfp-YK1HpskRKqHRyOGyP3zNt1LZGfnLUKLkGQrPocA5GLg2DHWhcCSG-VSLlpaJldMOEKIghMDSZvaLN1ITdkT4lUHnExWZrri5HW6bsqUTbe37EeQo-8IZfL7l816fwR2OOB1UDatA47tKYr_YUyOMxyF-LGvM-KQR6shuS6I2VQ-jGim2qiN2sg0r4H_IP1jXIBxG_bFumDo6zPgKRxzWg2hs",
  imageAlt: "Tableau historique de l'indépendance",
};

// ---------------------------------------------------------------------------
// 4. Related Events
// ---------------------------------------------------------------------------

export interface RelatedEvent {
  year: number;
  category: string;
  title: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
}

export const relatedEvents: RelatedEvent[] = [
  {
    year: 1904,
    category: "Diplomatie",
    title: "Centenaire de l'Indépendance : festivités nationales",
    summary:
      "Sous la présidence de Nord Alexis, Haïti célèbre son premier siècle de liberté malgré un contexte politique tendu.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAMHkm155orKq2fa54PMdH7jiiAe6Mri_tA1wluKtoOaeP8ikkY1eNh3I-ws0-gU_AQAiWZfYRpChAG4uJoAXeE5-daGzqiaDdEUqc9SLybWHVpMQJiUgSptn5OemjgMroLAOy6uoWhm3SZDdfNPfjuQZ9eAOTOVAeGPB_jqlRBkQwuZb2wvlb-OrGUfndi0dV4lam_bznlrCSCvhx4d6llqoVz3514OoQ_Sh_L1pXshQFnhR3MUXLJzK1GBL80Ii8M3ySgQ2qOCtk",
    imageAlt: "Ancienne architecture coloniale",
  },
  {
    year: 1954,
    category: "Politique",
    title: "Inauguration de nouveaux monuments à Gonaïves",
    summary:
      "Le 150e anniversaire met en scène une mémoire nationale active, dans une période de modernisation urbaine et symbolique.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAXc_w3LDA1Y-9BRoLYZLgeqXJj3naoSXrPNqCaXG4lI60DdoZGfOxXILlO0cHq7Zn2P-5TytiymLqSSO5fyZh4rQqfZ2prf4d5-LJFrg9FwGGo0qYzxL9HcXliisy4pSPMhWeX20PSSzzqZLik5FfkqncV_XnFtcAzzJ-bdS4JF6Kq-irbMrZpECjdg85VSO-udAaXtYNh1yTEsQUDi6uWFZsnk-70rxtf8JvA8rezxzkcwmjbWqAGiDtlRhqkWpVKeeQjiMylzI0",
    imageAlt: "Rassemblement populaire",
  },
  {
    year: 2004,
    category: "Culture",
    title: "Bicentenaire : entre crise et mémoire",
    summary:
      "Une année charnière où le passé glorieux du pays est réactivé au sein d'un climat de mutation institutionnelle profonde.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC4xxmJCxXVTtoRcHm_4v45ScWnBv_7jaazgooqwvYya7sG6UUo42P8bwwiYIYqSqrEIpkZNPnnjW89-QYgutmwKxgyvGddfNij5AQOKoPQxskjrH8KcEiDIpmJAw9dmNFhXUbFMfvVWMnuq07Ys4iz6FA3L8qdANfKew3OZz2uaURrYiRjx6MkBCtXwhWnlANzd_oD3G1TU8viF4-Ad2OWlJJ5DKIYEDFhZxJ0rly9JGmXuZ4c5N-tvKKzQvFobfje0Ki8nyefSwY",
    imageAlt: "Scène culturelle haïtienne",
  },
];

// ---------------------------------------------------------------------------
// 5. Theme Collections
// ---------------------------------------------------------------------------

export interface ThemeCollection {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

export const themeCollections: ThemeCollection[] = [
  {
    title: "Politique",
    description:
      "Traités, constitutions, pouvoirs, ruptures institutionnelles et visions concurrentes de l'État haïtien.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuClkHaTdKgEufMQ5rBgAm6GXpwGwF0ngMQuLpxOiPFKgYWkogc9ak_plXbSF4AABCgnZzFKe6bzxYVYgbgexCIKvsRMsR8H5O148bciTs5np3s3zq3DYJqNBsx6n20CEluwTiHZ0ZIHpHU04NjA0ZQg91LmFL3v-XrzRi54S-8tjXG9GS6C2tk7hqKTf4NoozO2KVnsReqOcmKBUoS2InLYtC3SMIEf2kd7vr2pHXp6yexzgNW-g7T2LdgT5CLWbiXV-4O8rgj9bZs",
    imageAlt: "Archives politiques",
  },
  {
    title: "Résistance",
    description:
      "Marronnage, soulèvements, contre-pouvoirs et formes populaires de refus qui traversent l'histoire du pays.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBaVjoSZ7ob11hqomMWRyfjshYEEreTGcQn0xw2LJqkn9j4wrmkdIuPXu2BJsEiXXfi2h31L_kmqi0FDOwy9bI9T7bvpr8hrCA2qtp-8clhCphyM16iJPcmJud2o8AGqCBlC89F0YasvUxcZ7pXuo5UAFjxdjebjdnb5JVusxay9K6LQH7gr90pDxXNfIjCAXAa4_hxfQ0Dcibaj_otZyUghkXBtYvbEzidYq2cvbMGG9ZpAuu82O8ZdfELgFOm9-c3cjfbOfCy1UM",
    imageAlt: "Symboles de résistance",
  },
  {
    title: "Culture",
    description:
      "Littérature, arts, musique, spiritualités et imaginaires qui donnent à la mémoire haïtienne sa densité propre.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbxov6EzWK_OK_V4bZrvGxf6phCCRu_rM0zkn9DycmifBYWVGA7uXQaWdjz3d6GzzO2MAzqmEco1lz1d5a31nDzHmUjECGVbQdJXQhpOfdSwVaQi5vBuNRJJyWBkhbvhpYpROGVbpsDEcjmtQpr7lUGfzqM7NDT2vFDqGT_4L3Jz2ynXLP7d8oN6P5hG0ax5QHKBHofH20B50WYJ-JDSymBLdA4vByTLsZ_i6ITu4k70kY-3vOMnr9VxEY2eaKvOonTVA-fD-HTME",
    imageAlt: "Art et littérature",
  },
];

// ---------------------------------------------------------------------------
// 6. Hero Content
// ---------------------------------------------------------------------------

export const heroContent = {
  eyebrow: "Éphéméride haïtienne",
  headline: "La mémoire",
  headlineAccent: "vivante",
  headlineSuffix: "d'Haïti.",
  description:
    "Chaque jour porte une page de l'histoire d'Haïti. Cette section transforme les dates fondatrices, les luttes, les symboles et les trajectoires nationales en une archive éditoriale plus immersive, plus lisible et plus précieuse.",
  heroImageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQch4SNGpBV7chouYLgC061BtZfEhs8MHZH_N8zh9V8H98B31gfp-YK1HpskRKqHRyOGyP3zNt1LZGfnLUKLkGQrPocA5GLg2DHWhcCSG-VSLlpaJldMOEKIghMDSZvaLN1ITdkT4lUHnExWZrri5HW6bsqUTbe37EeQo-8IZfL7l816fwR2OOB1UDatA47tKYr_YUyOMxyF-LGvM-KQR6shuS6I2VQ-jGim2qiN2sg0r4H_IP1jXIBxG_bFumDo6zPgKRxzWg2hs",
  heroImageAlt: "Tableau historique de l'indépendance",
  heroBadge: "À la une aujourd'hui",
  heroTitle: "L'acte de Gonaïves",
  heroDescription:
    "Le 1er janvier 1804, Haïti n'affirme pas seulement son indépendance. Elle fracture l'ordre colonial mondial et ouvre une nouvelle grammaire politique de la liberté.",
  heroMeta: "1804 · Gonaïves · Indépendance",
} as const;

// ---------------------------------------------------------------------------
// 7. Navigation Links
// ---------------------------------------------------------------------------

export const navLinks = [
  { href: "#hero", label: "Accueil" },
  { href: "#date-nav", label: "Dates" },
  { href: "#spotlight", label: "Fait marquant" },
  { href: "#related", label: "Aussi ce jour-là" },
  { href: "#themes", label: "Thèmes" },
] as const;

// ---------------------------------------------------------------------------
// 8. Footer Sections
// ---------------------------------------------------------------------------

export const footerSections = [
  {
    title: "Navigation",
    links: [
      { href: "#hero", label: "Accueil" },
      { href: "#spotlight", label: "Fait marquant" },
      { href: "#themes", label: "Thèmes" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { href: "#", label: "Archive Access" },
      { href: "#", label: "Ethical Guidelines" },
      { href: "#", label: "Contact" },
    ],
  },
] as const;
