import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation | EdLight News",
  description:
    "Les conditions régissant l'utilisation de la plateforme EdLight News.",
};

const sections = [
  {
    icon: "info",
    en: {
      title: "About EdLight News",
      body: "EdLight News is a free, non-commercial educational platform operated by EdLight Initiative. We aggregate scholarships, academic opportunities, and news to help Haitian students and the diaspora access information that can change their lives.",
    },
    fr: {
      title: "À propos d'EdLight News",
      body: "EdLight News est une plateforme éducative gratuite et non commerciale gérée par EdLight Initiative. Nous regroupons bourses, opportunités académiques et actualités pour aider les étudiants haïtiens et la diaspora à accéder à des informations qui peuvent changer leur vie.",
    },
    ht: {
      title: "Sou EdLight News",
      body: "EdLight News se yon platfòm edikasyon gratis e non-komèsyal ki jere pa EdLight Initiative. Nou rasanble bous, okazyon akademik ak nouvèl pou ede elèv ayisyen yo ak dyaspora a jwenn enfòmasyon ki ka chanje lavi yo.",
    },
  },
  {
    icon: "check",
    en: {
      title: "Acceptance of Terms",
      body: "By accessing EdLight News — on our website or any associated social media presence — you agree to these Terms of Service. If you do not agree, please discontinue use of our platform.",
    },
    fr: {
      title: "Acceptation des conditions",
      body: "En accédant à EdLight News — sur notre site web ou toute présence sur les réseaux sociaux associés — vous acceptez ces Conditions d'utilisation. Si vous n'êtes pas d'accord, veuillez cesser d'utiliser notre plateforme.",
    },
    ht: {
      title: "Akseptasyon kondisyon yo",
      body: "Lè ou aksede EdLight News — sou sit entènèt nou an oswa nenpòt prezans rezo sosyal ki asosye — ou dakò ak Kondisyon Itilizasyon sa yo. Si ou pa dakò, tanpri sispann itilize platfòm nou an.",
    },
  },
  {
    icon: "book",
    en: {
      title: "Content & Accuracy",
      body: "We curate and summarize publicly available information about scholarships and educational opportunities. While we strive for accuracy and timeliness, we recommend verifying all details directly with the issuing institution before taking any action. EdLight News is not responsible for changes made by third-party providers.",
    },
    fr: {
      title: "Contenu et exactitude",
      body: "Nous sélectionnons et résumons des informations publiquement disponibles sur les bourses et les opportunités éducatives. Bien que nous nous efforcions d'être précis et à jour, nous recommandons de vérifier tous les détails directement auprès de l'institution émettrice avant toute action. EdLight News n'est pas responsable des modifications apportées par des prestataires tiers.",
    },
    ht: {
      title: "Kontni ak egzaktitid",
      body: "Nou seleksyone e rezime enfòmasyon ki disponib piblikman sou bous ak okazyon edikasyon. Byenke nou fè efò pou nou egzak e ajou, nou rekòmande pou verifye tout detay dirèkteman ak enstitisyon ki bay yo anvan ou pran nenpòt aksyon. EdLight News pa responsab pou chanjman ke founisè tyès pati yo fè.",
    },
  },
  {
    icon: "copyright",
    en: {
      title: "Intellectual Property",
      body: "Original editorial content, visual identity, and branding created by EdLight Initiative are protected by applicable intellectual property laws. Scholarship and opportunity information is attributed to its respective sources. Reproduction of our original content for commercial purposes is not permitted without prior written consent.",
    },
    fr: {
      title: "Propriété intellectuelle",
      body: "Le contenu éditorial original, l'identité visuelle et la marque créés par EdLight Initiative sont protégés par les lois applicables en matière de propriété intellectuelle. Les informations sur les bourses et les opportunités sont attribuées à leurs sources respectives. La reproduction de notre contenu original à des fins commerciales n'est pas autorisée sans consentement écrit préalable.",
    },
    ht: {
      title: "Pwopriyete entelektyèl",
      body: "Kontni editoryal orijinal, idantite vizyèl ak mak ki kreye pa EdLight Initiative yo pwoteje pa lwa pwopriyete entelektyèl ki aplikab. Enfòmasyon sou bous ak okazyon atribiye a sous respektif yo. Repwodiksyon kontni orijinal nou pou rezon komèsyal pa otorize san konsantman ekri alavans.",
    },
  },
  {
    icon: "warning",
    en: {
      title: "Limitation of Liability",
      body: "EdLight News is provided 'as is' without warranties of any kind. EdLight Initiative shall not be liable for any direct, indirect, or consequential damages arising from the use of, or inability to use, information published on our platform. Your use of any information is entirely at your own discretion.",
    },
    fr: {
      title: "Limitation de responsabilité",
      body: "EdLight News est fourni « tel quel » sans aucune garantie. EdLight Initiative ne saurait être tenu responsable de tout dommage direct, indirect ou consécutif découlant de l'utilisation ou de l'impossibilité d'utiliser les informations publiées sur notre plateforme. L'utilisation de toute information relève entièrement de votre propre appréciation.",
    },
    ht: {
      title: "Limitasyon responsablite",
      body: "EdLight News se bay 'kòm sa ye' san okenn garanti. EdLight Initiative p ap responsab pou okenn domaj dirèk, endirèk oswa konsekatif ki soti nan itilizasyon, oswa enkapasite pou itilize, enfòmasyon ki pibliye sou platfòm nou an. Itilizasyon ou nenpòt enfòmasyon se antèman nan pwòp diskresyon ou.",
    },
  },
  {
    icon: "edit",
    en: {
      title: "Changes to Terms",
      body: "We reserve the right to update these terms at any time. The effective date at the top of this page will reflect the latest revision. Continued use of the platform after any change constitutes acceptance of the revised terms.",
    },
    fr: {
      title: "Modifications des conditions",
      body: "Nous nous réservons le droit de mettre à jour ces conditions à tout moment. La date en haut de cette page reflète la dernière révision. L'utilisation continue de la plateforme après toute modification constitue une acceptation des conditions révisées.",
    },
    ht: {
      title: "Chanjman nan kondisyon yo",
      body: "Nou rezève dwa pou mete ajou kondisyon sa yo nenpòt ki lè. Dat an wo paj sa a reflete dènye revizyon an. Kontinye itilize platfòm nan apre nenpòt chanjman konstitye akseptasyon kondisyon ki revize yo.",
    },
  },
];

const iconPaths: Record<string, string> = {
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  check:
    "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  book: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  copyright:
    "M11.88 9.14c.04-.3.06-.61.06-.94 0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c.33 0 .64-.02.94-.06.54 1.67 2.1 2.88 3.95 2.88 2.28 0 4.13-1.85 4.13-4.13 0-1.85-1.21-3.41-2.88-3.95zm-5-1.06c-.95 0-1.72.77-1.72 1.72s.77 1.72 1.72 1.72c.45 0 .85-.18 1.16-.46.1.27.17.56.17.86 0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5c.3 0 .58.07.84.17-.28.31-.46.72-.46 1.17l-.01-.68z",
  warning:
    "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-[#08142a] to-stone-950">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-5">
            <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              Conditions · Terms · Kondisyon
            </span>
          </div>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Conditions{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              d&rsquo;utilisation
            </span>
          </h1>
          <p className="mb-2 max-w-2xl text-lg leading-relaxed text-stone-300">
            Terms of Service · Kondisyon itilizasyon
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
            Questions about these terms? We&rsquo;re happy to clarify.
            <br />
            <span className="text-stone-400">
              Des questions ? N ap kontan klarifye.
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
