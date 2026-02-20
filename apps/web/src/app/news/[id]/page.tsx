import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { contentVersionsRepo } from "@edlight-news/firebase";
import type { ContentVersion, ContentLanguage } from "@edlight-news/types";

async function getArticle(id: string): Promise<ContentVersion | null> {
  return contentVersionsRepo.getContentVersion(id);
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const article = await getArticle(params.id);
  if (!article) return { title: "Not found" };
  return {
    title: `${article.title} — EdLight News`,
    description: article.summary || article.body.slice(0, 160),
  };
}

function StatusBadge({ status }: { status: ContentVersion["status"] }) {
  const colors =
    status === "published"
      ? "bg-green-100 text-green-800"
      : status === "review"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { lang?: string };
}) {
  const article = await getArticle(params.id);
  if (!article) notFound();

  const currentLang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";

  // Find the sibling version in the other language
  const siblings = await contentVersionsRepo.listByItemId(article.itemId);
  const otherLang: ContentLanguage = article.language === "fr" ? "ht" : "fr";
  const siblingVersion = siblings.find(
    (s) => s.language === otherLang && s.channel === "web",
  );

  return (
    <article className="mx-auto max-w-3xl">
      {/* Status + language info */}
      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={article.status} />
        <span className="text-xs text-gray-400 uppercase">
          {article.language === "fr" ? "Français" : "Kreyòl Ayisyen"}
        </span>
        {article.draftReason && (
          <span className="text-xs text-amber-600">⚠ {article.draftReason}</span>
        )}
      </div>

      {/* Title */}
      <h1 className="mb-4 text-3xl font-bold leading-tight">{article.title}</h1>

      {/* Summary */}
      {article.summary && (
        <p className="mb-6 text-lg text-gray-600 leading-relaxed">
          {article.summary}
        </p>
      )}

      {/* Body — rendered as markdown */}
      <div className="prose prose-lg prose-headings:font-bold prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline max-w-none">
        <ReactMarkdown>{article.body}</ReactMarkdown>
      </div>

      {/* Switch language link */}
      {siblingVersion && (
        <div className="mt-8 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-gray-600">
            {article.language === "fr"
              ? "Lire cet article en Kreyòl Ayisyen:"
              : "Li atik sa a an Fransè:"}
          </p>
          <a
            href={`/news/${siblingVersion.id}?lang=${otherLang}`}
            className="mt-1 inline-block font-medium text-brand-700 hover:underline"
          >
            {siblingVersion.title} →
          </a>
        </div>
      )}

      {/* Citations */}
      {article.citations.length > 0 && (
        <section className="mt-8 border-t pt-4">
          <h2 className="text-base font-semibold">Sources</h2>
          <ul className="mt-2 space-y-1">
            {article.citations.map((c, i) => (
              <li key={i}>
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {c.sourceName}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Back link */}
      <div className="mt-8">
        <a
          href={`/news?lang=${currentLang}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {currentLang === "fr" ? "Retour aux actualités" : "Retounen nan nouvèl yo"}
        </a>
      </div>
    </article>
  );
}
