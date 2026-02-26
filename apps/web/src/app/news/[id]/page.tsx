import { notFound } from "next/navigation";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { ClipboardList, Calendar, Newspaper, Paperclip, RefreshCw, MapPin, CheckCircle, XCircle } from "lucide-react";
import { contentVersionsRepo, itemsRepo } from "@edlight-news/firebase";
import type { ContentVersion, ContentLanguage, Item, ContentSection } from "@edlight-news/types";
import {
  formatDate,
  categoryLabel,
  CATEGORY_COLORS,
  extractDomain,
} from "@/lib/utils";
import { MetaBadges } from "@/components/MetaBadges";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { classifyOpportunity, contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { SUBCAT_COLORS, SUBCAT_LABELS, type OpportunitySubCat } from "@/lib/opportunities";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateStaticParams() {
  const articles = await contentVersionsRepo.listPublishedForWeb("fr", 100);
  return articles.map((a: { id: string }) => ({ id: a.id }));
}

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
  const title = `${article.title} — EdLight News`;
  const description = article.summary || article.body?.slice(0, 160) || "";
  return {
    title,
    description,
    ...buildOgMetadata({
      title,
      description,
      path: `/news/${params.id}`,
      type: "article",
    }),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Headings that the AI sometimes embeds in the body / sections. We strip
 *  them because the page already renders dedicated source components.        */
const SOURCE_HEADING_RE = /^sources?( consultées| konsilte)?$/i;

/** Remove trailing source-like sections from a Markdown body string. */
function stripMarkdownSourceSections(md: string | undefined | null): string {
  if (!md) return "";
  // Split on ## headings – keep everything before the first source heading
  // that is *not* followed by a non-source heading (i.e. strip trailing
  // source sections only, so body content that merely mentions "source" in
  // a mid-article heading is preserved).
  const lines = md.split("\n");
  let cutIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^##\s+(.+)/);
    if (m) {
      if (SOURCE_HEADING_RE.test(m[1].trim())) {
        cutIndex = i; // keep searching upward for consecutive source sections
      } else {
        break; // hit a non-source heading, stop
      }
    }
  }
  if (cutIndex === -1) return md;
  return lines.slice(0, cutIndex).join("\n").trimEnd();
}

/** Filter source-like sections out of structured ContentSection arrays. */
function stripStructuredSourceSections(
  sections: ContentSection[] | undefined,
): ContentSection[] {
  if (!sections) return [];
  return sections.filter((s) => !SOURCE_HEADING_RE.test(s.heading.trim()));
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
        className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-800"
      >
        <span>Source officielle</span>
        <span className="text-xs text-gray-400 dark:text-slate-500">({extractDomain(originalUrl)})</span>
      </a>
      {aggregatorUrl && aggregatorUrl !== originalUrl && (
        <a
          href={aggregatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-3 py-1.5 text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <span>Via agrégateur</span>
          <span className="text-xs text-gray-400 dark:text-slate-500">({extractDomain(aggregatorUrl)})</span>
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
    value: opp.deadline ? formatDate(opp.deadline, lang) : <span className="text-gray-400 dark:text-slate-500 italic">{unknown}</span>,
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
        <a href={opp.officialLink} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline dark:text-brand-400">
          {extractDomain(opp.officialLink)}
        </a>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border bg-purple-50/50 p-5 dark:border-slate-700 dark:bg-purple-900/20">
      <h2 className="mb-3 text-base font-semibold dark:text-white">
        <ClipboardList className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Fiche Bourse" : "Fich Bous"}
      </h2>
      <dl className="space-y-2">
        {rows.map(({ label, value }, i) => (
          <div key={i} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
            <dt className="font-medium text-gray-600 dark:text-slate-400">{label}</dt>
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
    <section className="rounded-lg border p-4 dark:border-slate-700">
      <h2 className="mb-3 text-base font-semibold dark:text-white">
        {lang === "fr" ? "Mises à jour liées" : "Mizajou ki gen rapò"}
      </h2>
      <ul className="space-y-2">
        {others.map((a) => (
          <li key={a.id}>
            <Link
              href={`/news/${a.id}?lang=${lang}`}
              className="text-sm text-brand-700 hover:underline dark:text-brand-400"
            >
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Synthesis-specific components ───────────────────────────────────────────

function SynthesisBadge({
  item,
  lang,
}: {
  item: Item;
  lang: ContentLanguage;
}) {
  if (item.itemType !== "synthesis") return null;
  const sourceCount = item.synthesisMeta?.sourceCount ?? 0;
  const cvTags = item.sourceList; // placeholder, tags come from CV not item

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
        {lang === "fr" ? "Synthèse" : "Sentèz"} · {sourceCount}{" "}
        {lang === "fr" ? "sources" : "sous"}
      </span>
    </div>
  );
}

function StructuredSections({
  sections,
}: {
  sections: ContentSection[];
}) {
  if (!sections || sections.length === 0) return null;
  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <section key={i}>
          <h2 className="mb-2 text-xl font-bold dark:text-white">{section.heading}</h2>
          <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline max-w-none">
            <ReactMarkdown>{section.content}</ReactMarkdown>
          </div>
        </section>
      ))}
    </div>
  );
}

function SynthesisSourcesList({
  item,
  lang,
}: {
  item: Item;
  lang: ContentLanguage;
}) {
  const sourceList = item.sourceList;
  if (!sourceList || sourceList.length === 0) return null;

  return (
    <section className="rounded-lg border bg-gray-50/50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
      <h2 className="mb-3 text-base font-semibold dark:text-white">
        <Newspaper className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr"
          ? `Sources (${sourceList.length})`
          : `Sous (${sourceList.length})`}
      </h2>
      <ul className="space-y-2">
        {sourceList.map((src, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-slate-500">•</span>
            <div>
              <span className="font-medium">{src.sourceName}</span>
              <span className="text-gray-400 dark:text-slate-500"> — </span>
              <span className="text-gray-600 dark:text-slate-300">{src.title}</span>
              {src.publishedAt && (
                <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">
                  ({formatDate(src.publishedAt, lang)})
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Utility-specific components ─────────────────────────────────────────────

function UtilityBadge({
  item,
  lang,
}: {
  item: Item;
  lang: ContentLanguage;
}) {
  if (item.itemType !== "utility") return null;
  const typeLabels: Record<string, { fr: string; ht: string }> = {
    deadline: { fr: "Date limite", ht: "Dat limit" },
    exam: { fr: "Examen / Concours", ht: "Egzamen / Konkou" },
    admissions: { fr: "Admissions", ht: "Admisyon" },
    scholarship: { fr: "Bourse", ht: "Bous" },
    internship: { fr: "Stage / Emploi", ht: "Estaj / Travay" },
    guide: { fr: "Guide pratique", ht: "Gid pratik" },
  };
  const ut = item.utilityMeta?.utilityType ?? "guide";
  const label = typeLabels[ut]?.[lang] ?? ut;
  return (
    <span className="inline-block rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
      <ClipboardList className="mr-1 inline-block h-3 w-3" />{label}
    </span>
  );
}

function UtilityFactsFiche({
  item,
  lang,
}: {
  item: Item;
  lang: ContentLanguage;
}) {
  const meta = item.utilityMeta;
  if (!meta?.extractedFacts) return null;
  const facts = meta.extractedFacts;
  const hasContent =
    (facts.deadlines?.length ?? 0) > 0 ||
    (facts.requirements?.length ?? 0) > 0 ||
    (facts.steps?.length ?? 0) > 0 ||
    (facts.eligibility?.length ?? 0) > 0;
  if (!hasContent) return null;

  return (
    <div className="rounded-lg border bg-violet-50/50 p-5 dark:border-slate-700 dark:bg-violet-900/20">
      <h2 className="mb-3 text-base font-semibold dark:text-white">
        <ClipboardList className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Informations clés" : "Enfòmasyon kle"}
      </h2>
      <dl className="space-y-3">
        {facts.deadlines && facts.deadlines.length > 0 && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-slate-400 text-sm">
              {lang === "fr" ? "Dates limites" : "Dat limit yo"}
            </dt>
            <dd className="mt-1">
              <ul className="space-y-1">
                {facts.deadlines.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500 dark:text-brand-400" />
                    <span>
                      {d.label}
                      {d.dateISO ? (
                        <span className="ml-1 font-semibold text-brand-600 dark:text-brand-400">{d.dateISO}</span>
                      ) : (
                        <span className="ml-1 italic text-gray-400 dark:text-slate-500">
                          {lang === "fr" ? "(à confirmer)" : "(pou konfime)"}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {facts.eligibility && facts.eligibility.length > 0 && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-slate-400 text-sm">
              {lang === "fr" ? "Éligibilité" : "Elijibilite"}
            </dt>
            <dd className="mt-1">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {facts.eligibility.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </dd>
          </div>
        )}
        {facts.requirements && facts.requirements.length > 0 && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-slate-400 text-sm">
              {lang === "fr" ? "Exigences" : "Egzijans yo"}
            </dt>
            <dd className="mt-1">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {facts.requirements.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </dd>
          </div>
        )}
        {facts.steps && facts.steps.length > 0 && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-slate-400 text-sm">
              {lang === "fr" ? "Étapes" : "Etap yo"}
            </dt>
            <dd className="mt-1">
              <ol className="list-decimal pl-4 space-y-0.5 text-sm">
                {facts.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function UtilitySourceCitations({
  article,
  lang,
}: {
  article: ContentVersion;
  lang: ContentLanguage;
}) {
  const cites = (article as any).sourceCitations as { name: string; url: string }[] | undefined;
  if (!cites || cites.length === 0) return null;
  return (
    <section className="rounded-lg border bg-gray-50/50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
      <h2 className="mb-3 text-base font-semibold dark:text-white">
        <Paperclip className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Sources consultées" : "Sous konsilte"}
      </h2>
      <ul className="space-y-2">
        {cites.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-slate-500">•</span>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 hover:underline dark:text-brand-400"
            >
              {c.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WhatChangedNote({
  whatChanged,
  lang,
}: {
  whatChanged: string | null | undefined;
  lang: ContentLanguage;
}) {
  if (!whatChanged) return null;
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
      <p className="text-sm font-medium text-brand-800 dark:text-brand-300">
        <RefreshCw className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Dernière mise à jour :" : "Dènye mizajou :"}
      </p>
      <p className="mt-1 text-sm text-brand-700 dark:text-brand-300">{whatChanged}</p>
    </div>
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
  let item: Awaited<ReturnType<typeof itemsRepo.getItem>> = null;
  try {
    item = await itemsRepo.getItem(article.itemId);
  } catch (err) {
    console.error("[EdLight] news/[id] item fetch failed:", err);
  }

  // Find sibling version in the other language
  let siblings: Awaited<ReturnType<typeof contentVersionsRepo.listByItemId>> = [];
  try {
    siblings = await contentVersionsRepo.listByItemId(article.itemId);
  } catch (err) {
    console.error("[EdLight] news/[id] siblings fetch failed:", err);
  }
  const otherLang: ContentLanguage = article.language === "fr" ? "ht" : "fr";
  const siblingVersion = siblings.find(
    (s) => s.language === otherLang && s.channel === "web",
  );

  // Find related articles by dedupeGroupId (wrapped in try/catch —
  // the composite index may not yet exist in Firestore)
  let relatedArticles: ContentVersion[] = [];
  let dedupeGroupItems: Item[] = [];
  try {
    if (item?.dedupeGroupId) {
      const relatedItems = await itemsRepo.listByDedupeGroupId(item.dedupeGroupId, 5);
      dedupeGroupItems = relatedItems;
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

  // ── Pick best image across dedup group (same logic as ranking.ts) ──────
  // The card feed runs mergeGroup() which selects the highest-quality image
  // across all duplicates.  The detail page must do the same so the hero
  // matches what the user saw on the card.
  const IMAGE_RANK: Record<string, number> = {
    publisher: 4,
    wikidata: 3,
    branded: 2,
    screenshot: 1,
  };
  let heroImageUrl = item?.imageUrl ?? null;
  let heroImageSource = item?.imageSource ?? null;
  let heroImageAttribution = item?.imageAttribution ?? null;
  if (dedupeGroupItems.length > 0) {
    let bestScore = IMAGE_RANK[item?.imageSource ?? ""] ?? (item?.imageUrl ? 0 : -1);
    for (const sibling of dedupeGroupItems) {
      if (!sibling.imageUrl) continue;
      const score = IMAGE_RANK[sibling.imageSource ?? ""] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        heroImageUrl = sibling.imageUrl;
        heroImageSource = sibling.imageSource ?? null;
        heroImageAttribution = sibling.imageAttribution ?? null;
      }
    }
  }

  const isSynthesis = item?.itemType === "synthesis";
  const isUtility = item?.itemType === "utility";

  // Derive subcategory using the classifier for opportunity items
  const OPPORTUNITY_CATEGORIES = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  // Smell test: only apply classifier when content actually looks like an
  // opportunity — prevents general news articles with stale opp-adjacent
  // categories (e.g. crime news with category "concours") from mis-labelling.
  const passesSmellTest =
    item?.itemType === "utility" ||
    contentLooksLikeOpportunity(article.title ?? "", article.summary);

  const isOpportunity =
    (item?.vertical === "opportunites" ||
     OPPORTUNITY_CATEGORIES.has(item?.category ?? "")) &&
    passesSmellTest;

  let derivedSubCat: OpportunitySubCat | null = null;
  if (isOpportunity) {
    const result = classifyOpportunity({
      title: article.title ?? "",
      summary: article.summary,
      body: article.body,
      category: item?.category,
      publisher: item?.source?.name,
      url: item?.source?.originalUrl ?? item?.canonicalUrl,
    });
    const map: Record<string, OpportunitySubCat> = {
      Bourses: "bourses", Programmes: "programmes", Stages: "stages",
      Concours: "concours", Ressources: "ressources", Autre: "autre",
    };
    derivedSubCat = map[result.subcategory] ?? null;
  }

  const isBourses = derivedSubCat === "bourses" || (!derivedSubCat &&
    (item?.category === "scholarship" || item?.category === "opportunity"));

  // Use derived subcategory colour for opportunity items, fall back to legacy.
  // When an opp-adjacent category failed the smell test, remap to avoid
  // misleading "Concours"/"Stages" labels on general news articles.
  const rawCat = item?.category ?? "";
  const fallbackCat = OPPORTUNITY_CATEGORIES.has(rawCat)
    ? (item?.geoTag === "HT" || item?.vertical === "haiti" ? "local_news" : "news")
    : rawCat;
  const catColor = derivedSubCat
    ? SUBCAT_COLORS[derivedSubCat]
    : (CATEGORY_COLORS[fallbackCat] ?? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300");
  const catLabel = derivedSubCat
    ? SUBCAT_LABELS[derivedSubCat][currentLang]
    : categoryLabel(fallbackCat, currentLang);

  // Timestamp to date
  const pubAt = item?.publishedAt as { seconds?: number; _seconds?: number } | null | undefined;
  const pubSecs = pubAt?.seconds ?? (pubAt as Record<string, number> | null)?._seconds;
  const pubDate = pubSecs ? formatDate({ seconds: pubSecs }, currentLang) : null;

  const createdAt = article.createdAt as { seconds?: number; _seconds?: number } | undefined;
  const createdSecs = createdAt?.seconds ?? (createdAt as Record<string, number> | undefined)?._seconds;
  const createdDate = createdSecs ? formatDate({ seconds: createdSecs }, currentLang) : null;

  // Last major update date (synthesis only)
  const lmuAt = item?.lastMajorUpdateAt as { seconds?: number; _seconds?: number } | null | undefined;
  const lmuSecs = lmuAt?.seconds ?? (lmuAt as Record<string, number> | null)?._seconds;
  const lastUpdateDate = lmuSecs ? formatDate({ seconds: lmuSecs }, currentLang) : null;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {/* Hero image — best image from dedup group (mirrors card logic) */}
      {heroImageUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-800">
          <ImageWithFallback
            src={heroImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          {/* Image credit label */}
          {heroImageSource === "publisher" && (
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white/70">
              {currentLang === "fr" ? "Image : source" : "Imaj : sous"}
            </span>
          )}
          {heroImageSource === "wikidata" && (
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white/70">
              {heroImageAttribution?.name
                ? `Photo : ${heroImageAttribution.name}`
                : "Wikimedia Commons"}
              {heroImageAttribution?.license
                ? ` (${heroImageAttribution.license})`
                : ""}
            </span>
          )}
          {heroImageSource === "screenshot" && (
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white/70">
              {currentLang === "fr" ? "Capture : source" : "Kapta : sous"}
            </span>
          )}
        </div>
      )}

      {/* Top meta */}
      <div className="flex flex-wrap items-center gap-3">
        {(derivedSubCat || item?.category) && (
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${catColor}`}>
            {catLabel}
          </span>
        )}
        {isSynthesis && item && <SynthesisBadge item={item} lang={currentLang} />}
        {isUtility && item && <UtilityBadge item={item} lang={currentLang} />}
        {item?.geoTag === "HT" && (
          <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
            <MapPin className="mr-0.5 inline-block h-3 w-3" />{currentLang === "fr" ? "Haïti" : "Ayiti"}
          </span>
        )}
        <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
          {article.language === "fr" ? "Français" : "Kreyòl Ayisyen"}
        </span>
      </div>

      {/* Published date */}
      {(pubDate || createdDate) && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {currentLang === "fr" ? "Publié le" : "Pibliye"} {pubDate || createdDate}
          {isSynthesis && lastUpdateDate && (
            <span className="ml-2 text-emerald-600">
              · {currentLang === "fr" ? "Mis à jour le" : "Mizajou"} {lastUpdateDate}
            </span>
          )}
        </p>
      )}

      {/* Trust badges */}
      {isUtility && item && (
        <MetaBadges
          verifiedAt={item.updatedAt}
          updatedAt={item.lastMajorUpdateAt}
          publishedAt={item.publishedAt ?? article.createdAt}
          lang={currentLang}
          variant="full"
        />
      )}

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight dark:text-white">{article.title}</h1>

      {/* Source links (non-synthesis only) */}
      {!isSynthesis && <SourceLinks item={item} />}

      {/* Summary */}
      {article.summary && (
        <p className="text-lg text-gray-600 leading-relaxed dark:text-slate-300">
          {article.summary}
        </p>
      )}

      {/* What changed note (synthesis living updates) */}
      {isSynthesis && (
        <WhatChangedNote
          whatChanged={article.whatChanged}
          lang={currentLang}
        />
      )}

      {/* Bourses structured fiche */}
      {isBourses && !isUtility && item && <BoursesFiche item={item} lang={currentLang} />}

      {/* Utility facts fiche */}
      {isUtility && item && <UtilityFactsFiche item={item} lang={currentLang} />}

      {/* Body: structured sections for synthesis/utility, markdown for regular */}
      {(isSynthesis || isUtility) && article.sections && article.sections.length > 0 ? (
        <StructuredSections sections={stripStructuredSourceSections(article.sections)} />
      ) : (
        <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline max-w-none">
          <ReactMarkdown>{stripMarkdownSourceSections(article.body)}</ReactMarkdown>
        </div>
      )}

      {/* Utility source citations */}
      {isUtility && (
        <UtilitySourceCitations article={article} lang={currentLang} />
      )}

      {/* Synthesis sources list */}
      {isSynthesis && item && (
        <SynthesisSourcesList item={item} lang={currentLang} />
      )}

      {/* Switch language link */}
      {siblingVersion && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {article.language === "fr"
              ? "Lire cet article en Kreyòl Ayisyen:"
              : "Li atik sa a an Fransè:"}
          </p>
          <Link
            href={`/news/${siblingVersion.id}?lang=${otherLang}`}
            className="mt-1 inline-block font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            {siblingVersion.title} →
          </Link>
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
      {!item?.source && (article.citations?.length ?? 0) > 0 && (
        <section className="border-t pt-4 dark:border-slate-700">
          <h2 className="text-base font-semibold dark:text-white">Sources</h2>
          <ul className="mt-2 space-y-1">
            {(article.citations ?? []).map((c, i) => (
              <li key={i}>
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline dark:text-brand-400"
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
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">
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

      {/* Report issue button */}
      <div className="border-t pt-4 dark:border-slate-700">
        <ReportIssueButton
          itemId={article.itemId || article.id}
          lang={currentLang}
        />
      </div>

      {/* Back link */}
      <div className="pt-4">
        <Link
          href={`/news?lang=${currentLang}`}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← {currentLang === "fr" ? "Retour aux actualités" : "Retounen nan nouvèl yo"}
        </Link>
      </div>
    </article>
  );
}
