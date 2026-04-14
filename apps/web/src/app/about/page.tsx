import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Newspaper, BookOpen, Globe, Instagram } from "lucide-react";
import { withLangParam } from "@/lib/utils";

export const metadata: Metadata = {
  title: "À propos / Sou nou · EdLight News",
  description:
    "EdLight News est une plateforme d'information et d'opportunités pour les jeunes haïtiens et la diaspora.",
};

export default function AboutPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = searchParams.lang === "ht" ? "ht" : "fr";
  const fr = lang === "fr";

  const ABOUT_STATS = [
    { value: "30 000+", label: fr ? "lecteurs actifs" : "lektè aktif" },
    { value: "2",       label: fr ? "langues de publication" : "lang piblikasyon" },
    { value: "100 %",   label: fr ? "indépendant" : "endepandan" },
  ] as const;
  return (
    <>
      {/* ── Full-bleed hero ─────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-[#08142a] to-stone-950">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {/* Eyebrow */}
          <div className="mb-5">
            <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              {fr ? "À propos" : "Sou nou"}
            </span>
          </div>

          {/* Display headline */}
          <h1
            className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
          >
            {fr ? "Informer." : "Enfòme."}
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              {fr ? "Ouvrir des portes." : "Ouvri pòt."}
            </span>
          </h1>

          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-stone-300 sm:text-xl">
            {fr
              ? "Servir la jeunesse haïtienne — une information utile, fiable et accessible pour les étudiants, les jeunes professionnels et la diaspora mondiale."
              : "Sèvi jèn ayisyen yo — yon enfòmasyon itil, fyab e aksesib pou elèv, jèn pwofesyonèl ak dyaspora mondyal la."}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href={withLangParam("/news", lang)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <Newspaper className="h-4 w-4" />
              {fr ? "Lire les actualités" : "Li nouvèl yo"}
            </Link>
            <a
              href="https://www.instagram.com/edlightnews"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-700 px-5 py-2.5 text-sm font-semibold text-stone-200 transition-colors hover:border-stone-500 hover:bg-stone-800"
            >
              <Instagram className="h-4 w-4" />
              @edlightnews
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-stone-800/80 bg-stone-900/40">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <dl className="grid grid-cols-3 gap-6 text-center">
              {ABOUT_STATS.map((s) => (
                <div key={s.label}>
                  <dt
                    className="text-3xl font-extrabold text-white sm:text-4xl"
                    style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                  >
                    {s.value}
                  </dt>
                  <dd className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Why it exists ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Pourquoi EdLight News existe" : "Poukisa EdLight News egziste"}
        </h2>
        <p className="mb-4 text-base leading-relaxed text-stone-600 dark:text-stone-400">
          {fr
            ? <>Trop souvent, les jeunes haïtiens et la diaspora n{"'"}ont pas accès à une source d{"'"}information structurée, visuellement soignée et réellement utile à leur quotidien. Les grandes plateformes médiatiques ne couvrent pas ce qui compte pour eux&nbsp;: les bourses, les concours, les opportunités de carrière, les enjeux locaux en Haïti et les tendances globales en éducation.</>
            : "Twò souvan, jèn ayisyen yo ak dyaspora a pa gen aksè a yon sous enfòmasyon ki byen òganize, ki bèl vizyèlman e ki vrèman itil nan lavi yo chak jou. Gwo platfòm medya yo pa kouvri sa ki enpòtan pou yo : bous, konkou, opòtinite karyè, pwoblèm lokal ann Ayiti ak tandans mondyal nan edikasyon."}
        </p>
        <p className="text-base leading-relaxed text-stone-600 dark:text-stone-400">
          {fr
            ? "EdLight News comble ce vide. Nous publions des synthèses journalières, des reportages expliqués, des calendriers de bourses et des ressources pratiques — tout ce qu'un étudiant ou un jeune professionnel haïtien a besoin de savoir pour avancer."
            : "EdLight News ranpli vid sa a. Nou pibliye rezime chak jou, repòtaj eksplike, kalandriye bous ak resous pratik — tout sa yon etidyan oswa yon jèn pwofesyonèl ayisyen bezwen konnen pou l avanse."}
        </p>
      </section>

      {/* ── What we cover ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-5 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Ce que vous trouverez ici" : "Sa ou ap jwenn isit la"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: <Newspaper className="h-5 w-5" />,
              title: fr ? "Actualités & Analyses" : "Nouvèl & Analiz",
              desc: fr
                ? "Haïti, monde, éducation, business, technologie — couverture quotidienne structurée."
                : "Ayiti, mond, edikasyon, biznis, teknoloji — kouvèti chak jou ki byen òganize.",
            },
            {
              icon: <BookOpen className="h-5 w-5" />,
              title: fr ? "Explainers" : "Eksplikasyon",
              desc: fr
                ? "Des dossiers clairs sur les enjeux complexes : politique, science, économie, droits."
                : "Dosye klè sou sijè konplèks : politik, syans, ekonomi, dwa.",
            },
            {
              icon: <Globe className="h-5 w-5" />,
              title: fr ? "Opportunités" : "Okazyon",
              desc: fr
                ? "Bourses, stages, concours, programmes et fellowships avec deadlines visibles."
                : "Bous, estaj, konkou, pwogram ak fellowships ak dat limit ki vizib.",
            },
            {
              icon: <ArrowRight className="h-5 w-5" />,
              title: fr ? "Ressources pratiques" : "Resous pratik",
              desc: fr
                ? "Guides, calendriers académiques, ressources utiles pour l'orientation et la carrière."
                : "Gid, kalandriye akademik, resous itil pou oryantasyon ak karyè.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {item.icon}
              </div>
              <h3 className="mb-1 text-sm font-bold text-stone-900 dark:text-white">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── EdLight ecosystem ───────────────────────────────────── */}
      <section className="mb-10 rounded-xl border border-blue-100 bg-blue-50/60 p-6 dark:border-blue-900/30 dark:bg-blue-950/20">
        <h2 className="mb-3 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Partie de l'écosystème EdLight" : "Pati nan ekosistèm EdLight"}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {fr ? (
            <>EdLight News est la branche éditoriale de{" "}
            <a
              href="https://edlight.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              EdLight Initiative
            </a>
            , une organisation dédiée à l{"'"}accès à l{"'"}éducation et aux opportunités pour
            les jeunes haïtiens. Si EdLight News est une publication indépendante sur le
            plan éditorial, elle partage la même mission fondamentale : informer, outiller
            et inspirer la jeunesse haïtienne.</>
          ) : (
            <>EdLight News se branch editoryal{" "}
            <a
              href="https://edlight.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              EdLight Initiative
            </a>
            , yon òganizasyon ki dedye a aksè nan edikasyon ak opòtinite pou jèn ayisyen yo.
            Menm si EdLight News se yon piblikasyon endepandan nan nivo editoryal, li pataje
            menm misyon fondamantal la : enfòme, ekipe ak enspire jèn ayisyen yo.</>
          )}
        </p>
        <a
          href="https://edlight.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          {fr ? "Découvrir EdLight" : "Dekouvri EdLight"} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </section>

      {/* ── CTAs ────────────────────────────────────────────────── */}
      <section className="mb-4">
        <h2 className="mb-5 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Rejoignez la communauté" : "Rejwenn kominote a"}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={withLangParam("/news", lang)}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
          >
            <Newspaper className="h-4 w-4" />
            {fr ? "Lire les actualités" : "Li nouvèl yo"}
          </Link>
          <Link
            href={withLangParam("/opportunites", lang)}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {fr ? "Parcourir les opportunités" : "Wè okazyon yo"}
          </Link>
          <a
            href="https://www.instagram.com/edlightnews"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <Instagram className="h-4 w-4" />
            {fr ? "Suivre sur Instagram" : "Swiv sou Instagram"}
          </a>
        </div>
      </section>
    </main>
    </>
  );
}
