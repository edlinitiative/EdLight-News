import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité | EdLight News",
  description:
    "Découvrez comment EdLight News traite vos données et protège votre vie privée.",
};

const sections = [
  {
    icon: "shield",
    en: {
      title: "Our Commitment",
      body: "EdLight News is a free educational platform dedicated to Haitian students and the global diaspora. We are built on a principle of minimal data collection. We do not require you to create an account, and we do not track you across the web.",
    },
    fr: {
      title: "Notre engagement",
      body: "EdLight News est une plateforme éducative gratuite dédiée aux étudiants haïtiens et à la diaspora mondiale. Nous sommes fondés sur le principe de collecte minimale de données. Nous ne vous demandons pas de créer un compte et nous ne vous suivons pas sur le web.",
    },
    ht: {
      title: "Angajman nou",
      body: "EdLight News se yon platfòm edikasyon gratis ki dedye pou elèv ayisyen yo ak dyaspora mondyal la. Nou konstri sou prensip koleksyon done minimòm. Nou pa mande ou kreye yon kont, e nou pa swiv ou sou entènèt.",
    },
  },
  {
    icon: "database",
    en: {
      title: "Information We Collect",
      body: "We do not collect personal information. Anonymous, aggregated analytics (e.g. page view counts) may be gathered by our infrastructure provider for performance and reliability purposes. No identifiable data is retained.",
    },
    fr: {
      title: "Informations que nous collectons",
      body: "Nous ne collectons pas d'informations personnelles. Des analyses anonymes et agrégées (ex. nombre de pages vues) peuvent être recueillies par notre fournisseur d'infrastructure à des fins de performance et de fiabilité. Aucune donnée identifiable n'est conservée.",
    },
    ht: {
      title: "Enfòmasyon nou kolekte",
      body: "Nou pa kolekte enfòmasyon pèsonèl. Analiz anonim ak agreje (ex. kantite paj yo vizite) ka rasanble pa founisè enfrastrikti nou an pou pèfòmans ak fiabilite. Pa gen done idantifyab ki konsève.",
    },
  },
  {
    icon: "share",
    en: {
      title: "Data Sharing",
      body: "We do not sell, rent, or trade your data. We do not share any information with advertisers or data brokers. Period.",
    },
    fr: {
      title: "Partage des données",
      body: "Nous ne vendons, ne louons ni n'échangeons vos données. Nous ne partageons aucune information avec des annonceurs ou des courtiers en données.",
    },
    ht: {
      title: "Pataj done",
      body: "Nou pa vann, pa lwe, ni pa echanje done ou yo. Nou pa pataje okenn enfòmasyon ak anonsè oswa koutye done.",
    },
  },
  {
    icon: "link",
    en: {
      title: "Third-Party Services",
      body: "Our platform relies on trusted third-party providers — including infrastructure and content-delivery services — each governed by their own privacy practices. We encourage you to review their policies if you have concerns.",
    },
    fr: {
      title: "Services tiers",
      body: "Notre plateforme s'appuie sur des prestataires tiers de confiance — notamment des services d'infrastructure et de diffusion de contenu — chacun régi par ses propres pratiques de confidentialité. Nous vous encourageons à consulter leurs politiques si vous avez des questions.",
    },
    ht: {
      title: "Sèvis tyès pati",
      body: "Platfòm nou an depann de founisè tyès pati fyab — enkli sèvis enfrastrikti ak livrezon kontni — chak gouvène pa pwòp pratik konfidansyalite yo. Nou ankouraje ou revize politik yo si ou gen kesyon.",
    },
  },
  {
    icon: "refresh",
    en: {
      title: "Policy Updates",
      body: "We may update this policy from time to time to reflect changes in our services or applicable regulations. The effective date at the top of this page will always reflect the most recent revision.",
    },
    fr: {
      title: "Mises à jour de la politique",
      body: "Nous pouvons mettre à jour cette politique de temps à autre pour refléter les changements dans nos services ou les réglementations applicables. La date en haut de cette page reflète toujours la révision la plus récente.",
    },
    ht: {
      title: "Mizajou politik",
      body: "Nou ka mete ajou politik sa a tanzantan pou reflete chanjman nan sèvis nou yo oswa règleman ki aplikab. Dat an wo paj sa a toujou reflete dènye revizyon an.",
    },
  },
];

const iconPaths: Record<string, string> = {
  shield:
    "M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z",
  database:
    "M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zM4 9v3c0 2.21 3.58 4 8 4s8-1.79 8-4V9c0 2.21-3.58 4-8 4s-8-1.79-8-4zm0 5v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4s-8-1.79-8-4z",
  share:
    "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  refresh:
    "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-[#08142a] to-stone-950">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-5">
            <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              Confidentialité · Privacy · Konfidansyalite
            </span>
          </div>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Politique de{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              confidentialité
            </span>
          </h1>
          <p className="mb-2 max-w-2xl text-lg leading-relaxed text-stone-300">
            Privacy Policy · Politik konfidansyalite
          </p>
          <p className="text-sm text-stone-500">
            Effective date: April 15, 2026
          </p>
        </div>
      </section>

      {/* ── Sections ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:gap-8">
          {sections.map((s) => (
            <article
              key={s.en.title}
              className="rounded-2xl border border-stone-800 bg-stone-900/60 p-6 sm:p-8"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/20">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5 text-blue-400"
                  >
                    <path d={iconPaths[s.icon]} />
                  </svg>
                </span>
                <h2 className="text-lg font-bold text-white">{s.fr.title}</h2>
              </div>

              {/* FR */}
              <p className="mb-4 text-stone-300 leading-relaxed">{s.fr.body}</p>

              <div className="grid gap-4 border-t border-stone-800 pt-4 sm:grid-cols-2">
                {/* EN */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
                    English
                  </p>
                  <p className="text-sm text-stone-400 leading-relaxed">
                    {s.en.body}
                  </p>
                </div>
                {/* HT */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
                    Kreyòl Ayisyen
                  </p>
                  <p className="text-sm text-stone-400 leading-relaxed">
                    {s.ht.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ── Contact ───────────────────────────────────────────── */}
        <div className="mt-10 rounded-2xl border border-stone-700 bg-gradient-to-br from-stone-900 to-stone-950 p-8 text-center">
          <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-stone-500">
            Contact
          </p>
          <p className="mb-4 text-stone-300">
            Questions about this policy? We&rsquo;re here to help.
            <br />
            <span className="text-stone-400">
              Des questions ? Nou la pou ede ou.
            </span>
          </p>
          <a
            href="mailto:contact@edlightinitiative.org"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            contact@edlightinitiative.org
          </a>
        </div>
      </section>
    </div>
  );
}
