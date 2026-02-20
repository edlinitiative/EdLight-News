import Link from "next/link";
import { contentVersionsRepo } from "@edlight-news/firebase";
import type { ContentVersion } from "@edlight-news/types";

function ArticleCard({ article }: { article: ContentVersion }) {
  return (
    <a
      href={"/news/" + article.id + "?lang=fr"}
      className="group block rounded-lg border p-5 transition hover:border-brand-300 hover:shadow-md"
    >
      {article.category && article.category !== "news" && (
        <span className="mb-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {article.category === "local_news"
            ? "Haïti"
            : article.category.charAt(0).toUpperCase() + article.category.slice(1)}
        </span>
      )}
      <h2 className="mb-2 text-base font-semibold leading-snug group-hover:text-brand-700">
        {article.title}
      </h2>
      <p className="line-clamp-2 text-sm text-gray-500">
        {article.summary || article.body.slice(0, 150)}
      </p>
      {article.citations.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          {article.citations[0]!.sourceName}
        </p>
      )}
    </a>
  );
}

export default async function HomePage() {
  const latest = await contentVersionsRepo.listPublishedForWeb("fr", 6);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Byenveni sou EdLight News
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-600">
          Nouvèl edikasyon, bous detid, ak opòtinite pou elèv ayisyen yo —
          an fransè ak kreyòl.
        </p>
        <Link
          href="/news"
          className="inline-block rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-700"
        >
          Wè tout nouvèl yo →
        </Link>
      </section>

      {/* Latest articles grid */}
      {latest.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Dènye nouvèl</h2>
            <Link
              href="/news"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Wè tout →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
