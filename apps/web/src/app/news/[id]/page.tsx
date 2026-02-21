import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { contentVersionsRepo, itemsRepo } from "@edlight-news/firebase";
import type { ContentVersion, ContentLanguage, Item } from "@edlight-news/types";
import {
  formatDate,
  categoryLabel,
  CATEGORY_COLORS,
  extractDomain,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

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

// ── Sub-components ──────────────────────────────────────────────────────────

function SourceLinks({ item }: { item: Item | null }) {
  if (!item?.source?.originalUrl && !item?.canonicalUrl) return null;

  const originalUrl = item.source?.originalUrl ?? item.canonicalUrl;
  const aggregatorUrl = item.source?.aggregatorUrl;
  const sourceName = item.source?.name ?? "Source";

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <a
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-100"
      >
        <span>Source officielle</span>
        <span className="text-xs text-gray-400">({extractDomain(originalUrl)})</span>
      </a>
      {aggregatorUrl && aggregatorUrl !== originalUrl && (
        <a
          href={aggregatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-3 py-1.5 text-gray-600 hover:bg-gray-100"
        >
          <span>Via agrégateur</span>
          <span className="text-xs text-gray-400">({extractDomain(aggregatorUrl)})</span>
        </a>
      )}
    </div>
  );
}

function BoursesFiche({ item, lang }: { item: Item; lang: ContentLanguage }) {
  const opp = item.opportunity;
  if (!opp) return null;

  const labels = {
    deadline:     lang === "fr" ? "Date limite"       : "Dat limit",
    eligibility:  lang === "fr" ? "Éligibilité"       : "Elijibilite",
    coverage:     lang === "fr" ? "Couverture"        : "Kouvèti",
    howToApply:   lang === "fr" ? "Comment postuler"  : "Kijan pou aplike",
    officialLink: lang === "fr" ? "Lien officiel"     : "Lyen ofisyèl",
  };

  const unknown = lang === "fr" ? "Information à confirmer" : "Enfòmasyon pou konfime";

  const rows: { label: string; value: React.ReactNode }[] = [];

  rows.push({
    label: labels.deadline,
    value: opp.deadline ? formatDate(opp.deadline, lang) : <span className="text-gray-400 italic">{unknown}</span>,
  });

  if (opp.eligibility?.length) {
    rows.push({
      label: labels.eligibility,
      value: (
        <ul className="list-disc pl-4 space-y-0.5">
          {opp.eligibility.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      ),
    });
  }

  if (opp.coverage) {
    rows.push({ label: labels.coverage, value: opp.coverage });
  }

  if (opp.howToApply) {
    rows.push({ label: labels.howToApply, value: opp.howToApply });
  }

  if (opp.officialLink) {
    rows.push({
      label: labels.officialLink,
      value: (
        <a href={opp.officialLink} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
          {extractDomain(opp.officialLink)}
        </a>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border bg-purple-50/50 p-5">
      <h2 className="mb-3 text-base font-semibold">
        {lang === "fr" ? "📋 Fiche Bourse" : "📋 Fich Bous"}
      </h2>
      <dl className="space-y-2">
        {rows.map(({ label, value }, i) => (
          <div key={i} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
            <dt className="font-medium text-gray-600">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RelatedUpdates({
  articles,
  currentId,
  lang,
}: {
  articles: ContentVersion[];
  currentId: string;
  lang: ContentLanguage;
}) {
  const others = articles.filter((a) => a.id !== currentId);
  if (others.length === 0) return null;

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-base font-semibold">
        {lang === "fr" ? "Mises à jour liées" : "Mizajou ki gen rapò"}
      </h2>
      <ul className="space-y-2">
        {others.map((a) => (
          <li key={a.id}>
            <a
              href={`/news/${a.id}?lang=${lang}`}
              className="text-sm text-brand-700 hover:underline"
            >
              {a.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

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

  // Get parent item for v2 fields
  const item = await itemsRepo.getItem(article.itemId);

  // Find sibling version in the other language
  const siblings = await contentVersionsRepo.listByItemId(article.itemId);
  const otherLang: ContentLanguage = article.language === "fr" ? "ht" : "fr";
  const siblingVersion = siblings.find(
    (s) => s.language === otherLang && s.channel === "web",
  );

  // Find related articles by dedupeGroupId (wrapped in try/catch —
  // the composite index may not yet exist in Firestore)
  let relatedArticles: ContentVersion[] = [];
  try {
    if (item?.dedupeGroupId) {
      const relatedItems = await itemsRepo.listByDedupeGroupId(item.dedupeGroupId, 5);
      const relatedItemIds = relatedItems
        .filter((ri) => ri.id !== item.id)
        .map((ri) => ri.id);

      if (relatedItemIds.length > 0) {
        const cvArrays = await Promise.allSettled(
          relatedItemIds.map((id) => contentVersionsRepo.listByItemId(id)),
        );
        relatedArticles = cvArrays
          .filter((r): r is PromiseFulfilledResult<ContentVersion[]> => r.status === "fulfilled")
          .flatMap((r) => r.value)
          .filter((cv) => cv.language === currentLang && cv.channel === "web");
      }
    }
  } catch (err) {
    // Firestore index may not exist yet — degrade gracefully
    console.warn("[news/[id]] Failed to fetch related articles:", err);
  }

  const isBourses =
    item?.category === "scholarship" || item?.category === "opportunity";

  const catColor = CATEGORY_COLORS[item?.category ?? ""] ?? "bg-gray-100 text-gray-600";

  // Timestamp to date
  const pubAt = item?.publishedAt as { seconds?: number; _seconds?: number } | null | undefined;
  const pubSecs = pubAt?.seconds ?? (pubAt as Record<string, number> | null)?._seconds;
  const pubDate = pubSecs ? formatDate({ seconds: pubSecs }, currentLang) : null;

  const createdAt = article.createdAt as { seconds?: number; _seconds?: number } | undefined;
  const createdSecs = createdAt?.seconds ?? (createdAt as Record<string, number> | undefined)?._seconds;
  const createdDate = createdSecs ? formatDate({ seconds: createdSecs }, currentLang) : null;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {/* Hero image — only show real publisher photos, not generated branded cards */}
      {item?.imageUrl && item?.imageSource !== "generated" && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          {item.imageSource === "publisher" && (
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white/70">
              {currentLang === "fr" ? "Image : source" : "Imaj : sous"}
            </span>
          )}
        </div>
      )}

      {/* Top meta */}
      <div className="flex flex-wrap items-center gap-3">
        {item?.category && (
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${catColor}`}>
            {categoryLabel(item.category, currentLang)}
          </span>
        )}
        {item?.geoTag === "HT" && (
          <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            🇭🇹 {currentLang === "fr" ? "Haïti" : "Ayiti"}
          </span>
        )}
        <span className="text-xs text-gray-400 uppercase">
          {article.language === "fr" ? "Français" : "Kreyòl Ayisyen"}
        </span>
      </div>

      {/* Published date */}
      {(pubDate || createdDate) && (
        <p className="text-sm text-gray-500">
          {currentLang === "fr" ? "Publié le" : "Pibliye"} {pubDate || createdDate}
        </p>
      )}

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>

      {/* Source links */}
      <SourceLinks item={item} />

      {/* Summary */}
      {article.summary && (
        <p className="text-lg text-gray-600 leading-relaxed">
          {article.summary}
        </p>
      )}

      {/* Bourses structured fiche */}
      {isBourses && item && <BoursesFiche item={item} lang={currentLang} />}

      {/* Body — rendered as markdown */}
      <div className="prose prose-lg prose-headings:font-bold prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline max-w-none">
        <ReactMarkdown>{article.body}</ReactMarkdown>
      </div>

      {/* Switch language link */}
      {siblingVersion && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
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

      {/* Related updates from same dedupeGroupId */}
      {relatedArticles.length > 0 && (
        <RelatedUpdates
          articles={relatedArticles}
          currentId={article.id}
          lang={currentLang}
        />
      )}

      {/* Legacy citations (for older items without source object) */}
      {!item?.source && article.citations.length > 0 && (
        <section className="border-t pt-4">
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

      {/* Subtle quality info for weak source / missing deadline */}
      {(item?.qualityFlags?.weakSource || item?.qualityFlags?.missingDeadline) && (
        <p className="text-xs text-gray-300 italic">
          {item.qualityFlags.weakSource &&
            (currentLang === "fr"
              ? "Source relayée via un agrégateur"
              : "Sous relaye atravè yon agregatè")}
          {item.qualityFlags.weakSource && item.qualityFlags.missingDeadline && " · "}
          {item.qualityFlags.missingDeadline &&
            (currentLang === "fr"
              ? "Date limite à confirmer"
              : "Dat limit pou konfime")}
        </p>
      )}

      {/* Back link */}
      <div className="pt-4">
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
