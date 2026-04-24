import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Globe, School, CalendarDays } from "lucide-react";
import { fetchAllScholarships } from "@/lib/datasets";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "UWC Haïti · Guide programme · EdLight News",
  description:
    "Guide UWC Haïti: programme IB (16–19 ans), étapes de candidature, dates-clés et options en Amérique latine.",
  ...buildOgMetadata({
    title: "UWC Haïti · Guide programme · EdLight News",
    description:
      "Guide UWC Haïti: programme IB (16–19 ans), étapes de candidature, dates-clés et options en Amérique latine.",
    path: "/uwc-haiti",
    lang: "fr",
  }),
};

export default async function UwcHaitiPage() {
  const all = await fetchAllScholarships();
  const uwc = all.find((s) => /united world colleges|\buwc\b/i.test(s.name));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/bourses"
        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux bourses
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          UWC Haïti — Étudier au secondaire à l'international
        </h1>
        <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
          UWC (United World Colleges) est un réseau mondial d'écoles pré-universitaires
          (16–19 ans) qui délivrent l'IB (International Baccalaureate). Cette page résume
          la voie haïtienne, les options en Amérique latine, et les étapes clés pour candidater.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 dark:border-stone-700">
          <p className="text-xs uppercase tracking-wider text-stone-500">Niveau</p>
          <p className="mt-1 font-semibold inline-flex items-center gap-1">
            <School className="h-4 w-4 text-indigo-600" /> Secondaire supérieur (16–19 ans)
          </p>
        </div>
        <div className="rounded-lg border p-4 dark:border-stone-700">
          <p className="text-xs uppercase tracking-wider text-stone-500">Financement</p>
          <p className="mt-1 font-semibold">Bourses complètes ou partielles selon besoin</p>
        </div>
        <div className="rounded-lg border p-4 dark:border-stone-700">
          <p className="text-xs uppercase tracking-wider text-stone-500">Processus</p>
          <p className="mt-1 font-semibold inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-amber-600" /> Appels annuels (sept.–jan.)
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Comment postuler depuis Haïti</h2>
        <ol className="list-decimal list-inside space-y-2 text-stone-700 dark:text-stone-300">
          <li>Suivre l'ouverture de l'appel du Comité National UWC Haïti.</li>
          <li>Préparer le dossier scolaire, la motivation et l'engagement communautaire.</li>
          <li>Passer les entretiens/tests de sélection nationaux.</li>
          <li>En cas d'admission, être placé dans un campus UWC (ex: Costa Rica, etc.).</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Options en Amérique latine (exemples)</h2>
        <ul className="list-disc list-inside space-y-1 text-stone-700 dark:text-stone-300">
          <li>UWC Costa Rica</li>
          <li>Programmes partenaires régionaux selon cycle</li>
        </ul>
        <p className="text-sm text-stone-500">
          Les campus exacts et quotas changent selon l'année; vérifiez toujours l'appel officiel.
        </p>
      </section>

      <section className="rounded-lg border p-4 dark:border-stone-700 space-y-2">
        <h2 className="text-lg font-bold inline-flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-600" /> Liens officiels
        </h2>
        <a
          href={uwc?.officialUrl ?? "https://www.uwc.org/"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
        >
          Site UWC <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <br />
        <a
          href={uwc?.howToApplyUrl ?? "https://www.uwc.org/apply"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
        >
          Page de candidature <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>
    </div>
  );
}
