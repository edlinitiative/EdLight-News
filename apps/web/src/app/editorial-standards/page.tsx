import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { getLangFromSearchParams } from "@/lib/content";
import { withLangParam } from "@/lib/utils";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr
      ? "Standards éditoriaux · EdLight News"
      : "Estanda editoryal · EdLight News",
    description: fr
      ? "Les principes éditoriaux d'EdLight News : exactitude, clarté, équité et utilité."
      : "Prensip editoryal EdLight News : egzaktitid, klète, ekite ak itilite.",
  };
}

export default function EditorialStandardsPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const lq = (path: string) => withLangParam(path, lang);
  const fr = lang === "fr";
  return (
    <>
      {/* ── Full-bleed hero ─────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-[#08142a] to-stone-950">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {/* Eyebrow */}
          <div className="mb-5">
            <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              {fr ? "Standards éditoriaux" : "Estanda editoryal"}
            </span>
          </div>

          {/* Display headline */}
          <h1
            className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
          >
            {fr ? "La qualité," : "Kalite,"}
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              {fr ? "sans compromis." : "san konpwomi."}
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-stone-300">
            {fr
              ? "EdLight News est engagée envers une information rigoureuse, utile et honnête. Exactitude, clarté, équité — voici comment nous travaillons."
              : "EdLight News angaje pou bay enfòmasyon ki serye, itil e onèt. Egzaktitid, klète, ekite — se konsa nou travay."}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Principles ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Nos principes éditoriaux" : "Prensip editoryal nou yo"}
        </h2>
        <div className="space-y-4">
          {[
            {
              title: fr ? "Exactitude" : "Egzaktitid",
              desc: fr
                ? "Nous ne publions que des informations que nous pouvons vérifier ou qui proviennent de sources identifiables. En cas de doute, nous signalons l'incertitude."
                : "Nou pibliye sèlman enfòmasyon nou ka verifye oswa ki soti nan sous nou ka idantifye. Lè gen dout, nou sinyale ensètitid la.",
            },
            {
              title: fr ? "Clarté" : "Klète",
              desc: fr
                ? "Nous rédigeons pour être compris. Nos articles, explainers et synthèses visent une lisibilité maximale, sans jargon inutile."
                : "Nou ekri pou moun konprann. Atik nou yo, eksplikasyon ak sentèz vize yon lizibilite maksimòm, san jagon initil.",
            },
            {
              title: fr ? "Équité" : "Ekite",
              desc: fr
                ? "Nous couvrons les événements et enjeux sans parti pris déclaré. Quand nous offrons une perspective éditoriale, nous l'identifions clairement."
                : "Nou kouvri evènman ak enjè san pati pri. Lè nou ofri yon pèspektiv editoryal, nou idantifye l klèman.",
            },
            {
              title: fr ? "Utilité" : "Itilite",
              desc: fr
                ? "Chaque article, explainer ou fiche d'opportunité doit apporter une valeur concrète au lecteur. Nous n'ajoutons pas de contenu pour le volume."
                : "Chak atik, eksplikasyon oswa fich okazyon dwe pote yon valè konkrè pou lektè a. Nou pa ajoute kontni pou volim.",
            },
            {
              title: fr ? "Responsabilité" : "Responsablite",
              desc: fr
                ? "Nous corrigeons les erreurs rapidement et de manière transparente. Nous ne supprimons pas les articles, nous les amendons avec une note de correction."
                : "Nou korije erè rapidman epi avèk transparans. Nou pa efase atik yo, nou amande yo avèk yon nòt koreksyon.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="mb-1 text-base font-bold text-stone-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Content standards ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Standards de contenu" : "Estanda kontni"}
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              {fr ? "Sélection des articles" : "Seleksyon atik yo"}
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              {fr
                ? "Nous sélectionnons les articles en fonction de leur pertinence pour notre lectorat (jeunes haïtiens, étudiants, diaspora) et de leur valeur informationnelle. Nous privilégions les sujets liés à Haïti, à l'éducation, aux opportunités, à l'économie et à la technologie."
                : "Nou chwazi atik yo selon pètinans yo pou lektè nou yo (jèn ayisyen, etidyan, dyaspora) ak valè enfòmasyon yo. Nou bay priyorite a sijè ki gen rapò ak Ayiti, edikasyon, okazyon, ekonomi ak teknoloji."}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              {fr ? "Sélection des opportunités" : "Seleksyon okazyon yo"}
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              {fr
                ? "Les opportunités publiées (bourses, stages, concours, fellowships) doivent avoir une source officielle identifiable. Nous indiquons la date limite et recommandons toujours de vérifier les informations sur le site officiel avant de postuler."
                : "Okazyon ki pibliye (bous, estaj, konkou, fellowship) dwe gen yon sous ofisyèl idantifyab. Nou endike dat limit la epi nou toujou rekòmande pou verifye enfòmasyon yo sou sit ofisyèl la anvan ou aplike."}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              {fr ? "Ton et présentation" : "Ton ak prezantasyon"}
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              {fr
                ? "Notre ton est direct, clair et respectueux. Nous évitons le sensationnalisme, les titres trompeurs et les formulations alarmistes non justifiées. Nous n'utilisons jamais de clickbait."
                : "Ton nou dirèk, klè epi respektye. Nou evite sansasyonalis, tit ki twonpe ak fòmilasyon alamis ki pa jistifye. Nou pa janm itilize clickbait."}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              {fr ? "Corrections et mises à jour" : "Koreksyon ak mizajou"}
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              {fr
                ? "Toute erreur signalée est évaluée dans les 24 heures. Si une correction s'impose, elle est publiée avec une note visible en tête d'article. Les articles ne sont jamais supprimés, sauf cas exceptionnels de contenu manifestement erroné et potentiellement nuisible."
                : "Tout erè ki sinyale evalye nan 24 èdtan. Si yon koreksyon nesesè, li pibliye avèk yon nòt vizib nan tèt atik la. Atik yo pa janm efase, sof ka eksepsyonèl kote kontni a klèman gen erè epi potansyèlman danjere."}
            </p>
          </div>
        </div>
      </section>

      {/* ── Contact for corrections ──────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-stone-50 p-6 dark:border-stone-800 dark:bg-stone-900/50">
        <h2 className="mb-2 text-lg font-bold text-stone-900 dark:text-white">
          {fr ? "Signaler une erreur ou nous contacter" : "Sinyale yon erè oswa kontakte nou"}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {fr
            ? <>Vous avez repéré une inexactitude, une information obsolète ou un problème éditorial ? Écrivez-nous à{" "}<a href="mailto:contact@edlightinitiative.org" className="font-semibold text-blue-700 hover:underline dark:text-blue-400">contact@edlightinitiative.org</a>. Nous lisons tous les messages.</>
            : <>Ou jwenn yon erè, yon enfòmasyon ki pa ajou oswa yon pwoblèm editoryal ? Ekri nou nan{" "}<a href="mailto:contact@edlightinitiative.org" className="font-semibold text-blue-700 hover:underline dark:text-blue-400">contact@edlightinitiative.org</a>. Nou li tout mesaj yo.</>}
        </p>
        <Link
          href={lq("/contact")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          {fr ? "Page de contact" : "Paj kontakt"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </main>
    </>
  );
}
