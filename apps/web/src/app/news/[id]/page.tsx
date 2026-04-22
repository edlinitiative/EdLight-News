import { notFound } from "next/navigation";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { ClipboardList, Calendar, Newspaper, Paperclip, RefreshCw, MapPin, CheckCircle, XCircle, Lightbulb, BookOpen, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
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
import { ShareButtons } from "@/components/ShareButtons";
import { BrandedHero } from "@/components/BrandedHero";
import { classifyOpportunity, contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { SUBCAT_COLORS, SUBCAT_LABELS, type OpportunitySubCat } from "@/lib/opportunities";
import { buildOgMetadata } from "@/lib/og";
import { PageLanguageSync } from "@/components/PageLanguageSync";
import { ViewTracker } from "@/components/ViewTracker";
import { BookmarkButton } from "@/components/BookmarkButton";
import { OpinionHeader } from "@/components/OpinionHeader";
import { AuthorBlock } from "@/components/AuthorBlock";
import { fetchEnrichedFeed } from "@/lib/content";
import type { FeedItem } from "@/components/news-feed";
import { ArticleSideRail } from "./_components/ArticleSideRail";
import { RelatedArticles } from "./_components/RelatedArticles";
import { MobileProgressBar } from "./_components/MobileProgressBar";

export const revalidate = 60;
const BASE_URL = "https://news.edlight.org";

function selectPreferredWebVersion(
  versions: ContentVersion[],
  preferredLang: ContentLanguage = "fr",
): ContentVersion | null {
  const publishedWeb = versions.filter((v) => v.channel === "web" && v.status === "published");
  if (publishedWeb.length === 0) return null;

  return (
    publishedWeb.find((v) => v.language === preferredLang) ??
    publishedWeb.find((v) => v.language === "fr") ??
    publishedWeb[0] ??
    null
  );
}

async function getArticle(
  id: string,
  preferredLang: ContentLanguage = "fr",
): Promise<ContentVersion | null> {
  const byVersionId = await contentVersionsRepo.getContentVersion(id);
  if (byVersionId) return byVersionId;

  // Backward-compat: some shared links still use itemId (/news/:itemId).
  try {
    const versions = await contentVersionsRepo.listByItemId(id);
    return selectPreferredWebVersion(versions, preferredLang);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const article = await getArticle(params.id, "fr");
  if (!article) return { title: "Not found" };

  // Fetch item image for OG metadata (lightweight)
  let ogImage: string | undefined;
  try {
    const item = await itemsRepo.getItem(article.itemId);
    if (item?.imageUrl && item.imageSource !== "branded" && item.imageSource !== "screenshot") {
      ogImage = item.imageUrl;
    }
  } catch { /* ignore — OG will use default */ }

  let siblings: Awaited<ReturnType<typeof contentVersionsRepo.listByItemId>> = [];
  try {
    siblings = await contentVersionsRepo.listByItemId(article.itemId);
  } catch {
    // fallback to current article only
  }

  const articleLang: ContentLanguage = article.language === "ht" ? "ht" : "fr";
  const webSiblings = siblings.filter((s) => s.channel === "web");
  const frVersion = articleLang === "fr"
    ? article
    : webSiblings.find((s) => s.language === "fr");
  const htVersion = articleLang === "ht"
    ? article
    : webSiblings.find((s) => s.language === "ht");

  const title = `${article.title} — EdLight News`;
  const description = article.summary || article.body?.slice(0, 160) || "";
  const metadata = buildOgMetadata({
    title,
    description,
    path: `/news/${params.id}`,
    lang: articleLang,
    type: "article",
    image: ogImage,
  });

  return {
    title,
    description,
    ...metadata,
    alternates: {
      canonical: `${BASE_URL}/news/${params.id}`,
      languages: {
        ...(frVersion ? { fr: `${BASE_URL}/news/${frVersion.id}` } : {}),
        ...(htVersion ? { ht: `${BASE_URL}/news/${htVersion.id}?lang=ht` } : {}),
      },
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Headings that the AI sometimes embeds in the body / sections. We strip
 *  them because the page already renders dedicated source components.        */
const SOURCE_HEADING_RE =
  /^(sources?( consultées| utilisées| citées| konsilte( yo)?)?|sous( konsilte( yo)?)?|références?( consultées)?)$/i;

/** Remove trailing source-like sections from a Markdown body string. */
function stripMarkdownSourceSections(md: string | undefined | null): string {
  if (!md) return "";
  const lines = md.split("\n");
  let cutIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^##\s+(.+)/);
    if (m) {
      if (SOURCE_HEADING_RE.test(m[1].trim())) {
        cutIndex = i;
      } else {
        break;
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

function SourceLinks({ item, lang }: { item: Item | null; lang: ContentLanguage }) {
  if (!item?.source?.originalUrl && !item?.canonicalUrl) return null;
  const fr = lang === "fr";

  const originalUrl = item.source?.originalUrl ?? item.canonicalUrl;
  const aggregatorUrl = item.source?.aggregatorUrl;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <a
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 font-medium text-blue-700 ring-1 ring-inset ring-blue-100 transition-all hover:bg-blue-100 hover:shadow-sm dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800/40 dark:hover:bg-blue-800"
      >
        <span>{fr ? "Source officielle" : "Sous ofisyèl"}</span>
        <span className="text-xs text-blue-400 dark:text-blue-500">({extractDomain(originalUrl)})</span>
      </a>
      {aggregatorUrl && aggregatorUrl !== originalUrl && (
        <a
          href={aggregatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-50 px-4 py-2 text-stone-600 ring-1 ring-inset ring-stone-200/60 transition-all hover:bg-stone-100 hover:shadow-sm dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-700"
        >
          <span>{fr ? "Via agrégateur" : "Via agregatè"}</span>
          <span className="text-xs text-stone-400 dark:text-stone-500">({extractDomain(aggregatorUrl)})</span>
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
    value: opp.deadline ? formatDate(opp.deadline, lang) : <span className="text-stone-400 dark:text-stone-500 italic">{unknown}</span>,
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
        <a href={opp.officialLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline dark:text-blue-400">
          {extractDomain(opp.officialLink)}
        </a>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-6 dark:border-stone-700 dark:bg-purple-900/20">
      <h2 className="mb-4 text-title-sm dark:text-white">
        <ClipboardList className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Fiche Bourse" : "Fich Bous"}
      </h2>
      <dl className="space-y-3">
        {rows.map(({ label, value }, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,100px)_1fr] sm:grid-cols-[140px_1fr] gap-2 text-sm">
            <dt className="font-medium text-stone-600 dark:text-stone-400">{label}</dt>
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
    <section className="rounded-2xl border border-stone-200/80 p-5 dark:border-stone-700">
      <h2 className="mb-3 text-title-sm dark:text-white">
        {lang === "fr" ? "Mises à jour liées" : "Mizajou ki gen rapò"}
      </h2>
      <ul className="space-y-2">
        {others.map((a) => (
          <li key={a.id}>
            <Link
              href={`/news/${a.id}?lang=${lang}`}
              className="text-sm text-blue-700 hover:underline dark:text-blue-400"
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
  isHistory,
}: {
  sections: ContentSection[];
  isHistory?: boolean;
}) {
  if (!sections || sections.length === 0) return null;

  return (
    <div className={isHistory ? "space-y-10" : "space-y-6"}>
      {sections.map((section, i) => {
        const { mainContent, takeaway, sourceLine } = isHistory
          ? extractHistoryParts(section.content)
          : { mainContent: section.content, takeaway: null, sourceLine: null };

        return (
          <section
            key={i}
            className={
              isHistory
                ? "relative rounded-2xl border border-stone-200 bg-white p-6 shadow-premium dark:border-stone-700 dark:bg-stone-800 dark:shadow-premium-dark"
                : ""
            }
          >
            <h2
              className={
                isHistory
                  ? "mb-4 text-xl font-bold leading-snug text-stone-900 dark:text-white"
                  : "mb-2 text-xl font-bold dark:text-white"
              }
            >
              {section.heading}
            </h2>

            {section.imageUrl && (
              <figure className="mb-4 overflow-hidden rounded-xl">
                <div className="relative aspect-[2/1] w-full bg-stone-100 dark:bg-stone-700">
                  <ImageWithFallback
                    src={section.imageUrl}
                    alt={section.imageCaption || section.heading}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className={`h-full w-full object-cover${isHistory ? " object-top" : ""}`}
                    fallback={
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-600">
                        <span className="text-xs font-bold tracking-wide text-stone-400 dark:text-stone-500">
                          ED<span className="text-stone-300 dark:text-stone-600">LIGHT</span>
                        </span>
                      </div>
                    }
                  />
                </div>
                {(section.imageCaption || section.imageCredit) && (
                  <figcaption className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                    {section.imageCaption}
                    {section.imageCredit && (
                      <span className="ml-1 text-stone-400/70 dark:text-stone-500/70">— {section.imageCredit}</span>
                    )}
                  </figcaption>
                )}
              </figure>
            )}

            <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-blue-700 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline max-w-none prose-p:leading-relaxed">
              <ReactMarkdown>{mainContent}</ReactMarkdown>
            </div>

            {takeaway && (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                <div className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
                  <span className="font-semibold">{takeaway.label}</span>{" "}
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <span>{children}</span>,
                    }}
                  >
                    {takeaway.text}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {sourceLine && (
              <div className="mt-3 flex items-start gap-2 text-sm text-stone-500 dark:text-stone-400">
                <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-stone-400 dark:text-stone-500" />
                <div className="prose-sm prose dark:prose-invert prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline prose-a:decoration-blue-300 dark:prose-a:decoration-blue-700 prose-a:underline-offset-2">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <span>{children}</span>,
                    }}
                  >
                    {sourceLine}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {isHistory && i < sections.length - 1 && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                <div className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Extract student takeaway (💡) and source (📚) lines from section content. */
function extractHistoryParts(content: string): {
  mainContent: string;
  takeaway: { label: string; text: string } | null;
  sourceLine: string | null;
} {
  const lines = content.split("\n");
  const mainLines: string[] = [];
  let takeaway: { label: string; text: string } | null = null;
  let sourceLine: string | null = null;

  for (const line of lines) {
    const takeawayMatch = line.match(
      /^\s*💡\s*\*\*(.+?)\s*[:\u00a0]\*\*\s*(.+)/,
    );
    if (takeawayMatch) {
      takeaway = { label: takeawayMatch[1]!.trim(), text: takeawayMatch[2]!.trim() };
      continue;
    }
    const sourceMatch = line.match(/^\s*📚\s*(.+)/);
    if (sourceMatch) {
      sourceLine = sourceMatch[1]!.trim();
      continue;
    }
    mainLines.push(line);
  }

  return {
    mainContent: mainLines.join("\n").trim(),
    takeaway,
    sourceLine,
  };
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
    <section className="rounded-2xl border border-stone-200/80 bg-stone-50 p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="mb-3 text-title-sm dark:text-white">
        <Newspaper className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr"
          ? `Sources (${sourceList.length})`
          : `Sous (${sourceList.length})`}
      </h2>
      <ul className="space-y-2">
        {sourceList.map((src, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex-shrink-0 text-stone-400 dark:text-stone-500">•</span>
            <div>
              <span className="font-medium">{src.sourceName}</span>
              <span className="text-stone-400 dark:text-stone-500"> — </span>
              <span className="text-stone-600 dark:text-stone-300">{src.title}</span>
              {src.publishedAt && (
                <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">
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
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6 dark:border-stone-700 dark:bg-violet-900/20">
      <h2 className="mb-4 text-title-sm dark:text-white">
        <ClipboardList className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Informations clés" : "Enfòmasyon kle"}
      </h2>
      <dl className="space-y-3">
        {facts.deadlines && facts.deadlines.length > 0 && (
          <div>
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
              {lang === "fr" ? "Dates limites" : "Dat limit yo"}
            </dt>
            <dd className="mt-1">
              <ul className="space-y-1">
                {facts.deadlines.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                    <span>
                      {d.label}
                      {d.dateISO ? (
                        <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">{d.dateISO}</span>
                      ) : (
                        <span className="ml-1 italic text-stone-400 dark:text-stone-500">
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
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
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
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
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
            <dt className="font-medium text-stone-600 dark:text-stone-400 text-sm">
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
    <section className="rounded-2xl border border-stone-200/80 bg-stone-50 p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="mb-3 text-title-sm dark:text-white">
        <Paperclip className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Sources consultées" : "Sous konsilte"}
      </h2>
      <ul className="space-y-2">
        {cites.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex-shrink-0 text-stone-400 dark:text-stone-500">•</span>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline dark:text-blue-400"
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
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20">
      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
        <RefreshCw className="mr-1.5 inline-block h-4 w-4" />
        {lang === "fr" ? "Dernière mise à jour :" : "Dènye mizajou :"}
      </p>
      <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">{whatChanged}</p>
    </div>
  );
}

function estimateReadingTime(body: string | null | undefined, sections: ContentSection[] | null | undefined): number {
  let text = body ?? "";
  if (sections?.length) {
    text += " " + sections.map((s) => s.heading + " " + s.content).join(" ");
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function EdLightAttribution({ lang }: { lang: ContentLanguage }) {
  const fr = lang === "fr";
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-stone-200/80 bg-gradient-to-br from-stone-50 to-white p-5 dark:border-stone-700 dark:from-stone-900 dark:to-stone-800">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-silk text-white font-black text-sm tracking-tight select-none shadow-sm dark:shadow-none">
        EL
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-title-sm text-stone-900 dark:text-white">EdLight News</p>
        <p className="mt-1 text-body-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {fr
            ? "Plateforme d\u2019information et d\u2019opportunit\u00e9s pour la jeunesse ha\u00eftienne et la diaspora. Synth\u00e8ses v\u00e9rifi\u00e9es, actualit\u00e9s et ressources publi\u00e9es quotidiennement."
            : "Platf\u00f2m enf\u00f2masyon ak okazyon pou j\u00e8n ayisyen yo ak dyaspora a. Sent\u00e8z verifye, nouv\u00e8l ak resous pibliye chak jou."}
        </p>
        <Link
          href={`/about?lang=${lang}`}
          className="mt-2 inline-block text-body-sm font-semibold text-primary hover:underline dark:text-blue-400"
        >
          {fr ? "En savoir plus \u2192" : "Aprann plis \u2192"}
        </Link>
      </div>
    </div>
  );
}

function NextPrevNav({
  prev,
  next,
  lang,
}: {
  prev: FeedItem | null;
  next: FeedItem | null;
  lang: ContentLanguage;
}) {
  if (!prev && !next) return null;
  const fr = lang === "fr";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        {prev && (
          <Link
            href={`/news/${prev.id}?lang=${lang}`}
            className="group flex h-full flex-col gap-1.5 rounded-2xl border border-stone-200/80 bg-white p-4 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 dark:border-stone-700/60 dark:bg-stone-900 dark:hover:shadow-card-dark-hover"
          >
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              <ChevronLeft className="h-3 w-3" />
              {fr ? "Pr\u00e9c\u00e9dent" : "Anvan"}
            </span>
            <span className="line-clamp-2 text-sm font-semibold leading-snug text-stone-800 transition-colors group-hover:text-primary dark:text-stone-100 dark:group-hover:text-blue-400">
              {prev.title}
            </span>
          </Link>
        )}
      </div>
      <div className="flex flex-col items-end">
        {next && (
          <Link
            href={`/news/${next.id}?lang=${lang}`}
            className="group flex h-full w-full flex-col items-end gap-1.5 rounded-2xl border border-stone-200/80 bg-white p-4 text-right transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 dark:border-stone-700/60 dark:bg-stone-900 dark:hover:shadow-card-dark-hover"
          >
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              {fr ? "Suivant" : "Apre"}
              <ChevronRight className="h-3 w-3" />
            </span>
            <span className="line-clamp-2 text-sm font-semibold leading-snug text-stone-800 transition-colors group-hover:text-primary dark:text-stone-100 dark:group-hover:text-blue-400">
              {next.title}
            </span>
          </Link>
        )}
      </div>
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
  const preferredLang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const article = await getArticle(params.id, preferredLang);
  if (!article) notFound();

  const currentLang: ContentLanguage =
    searchParams.lang === "ht" || article.language === "ht" ? "ht" : "fr";
  const shareUrl = `${BASE_URL}/news/${article.id}${currentLang === "ht" ? "?lang=ht" : ""}`;

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

  // Find related articles by dedupeGroupId
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
    console.warn("[news/[id]] Failed to fetch related articles:", err);
  }

  // Next/prev articles + feed for "related by category"
  let prevArticle: FeedItem | null = null;
  let nextArticle: FeedItem | null = null;
  let recentFeed: FeedItem[] = [];
  try {
    recentFeed = await fetchEnrichedFeed(currentLang, 40);
    const idx = recentFeed.findIndex((a) => a.itemId === article.itemId || a.id === article.id || a.id === article.itemId);
    if (idx !== -1) {
      prevArticle = recentFeed[idx - 1] ?? null;
      nextArticle = recentFeed[idx + 1] ?? null;
    } else {
      nextArticle = recentFeed[0] ?? null;
      prevArticle = recentFeed[1] ?? null;
    }
  } catch {
    // non-critical — degrade silently
  }

  // Build "related by category" recommendations from the feed
  const categoryRelated = recentFeed
    .filter((a) =>
      a.id !== article.id &&
      a.itemId !== article.itemId &&
      (a.category === (item?.category ?? "") || a.geoTag === item?.geoTag) &&
      a.id !== prevArticle?.id &&
      a.id !== nextArticle?.id
    )
    .slice(0, 3);

  // ── Pick best image across dedup group ────────────────────────────────
  const IMAGE_RANK: Record<string, number> = {
    gemini_ai: 5,
    publisher: 4,
    wikidata: 3,
    branded: 2,
    screenshot: 1,
  };
  let heroImageUrl = item?.imageUrl ?? null;
  let heroImageSource = item?.imageSource ?? null;
  let heroImageAttribution = item?.imageAttribution ?? null;
  let heroImageMeta = item?.imageMeta ?? null;
  if (dedupeGroupItems.length > 0) {
    let bestScore = -1;
    for (const sibling of dedupeGroupItems) {
      if (!sibling.imageUrl) continue;
      const score = IMAGE_RANK[sibling.imageSource ?? ""] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        heroImageUrl = sibling.imageUrl;
        heroImageSource = sibling.imageSource ?? null;
        heroImageAttribution = sibling.imageAttribution ?? null;
        heroImageMeta = sibling.imageMeta ?? null;
      }
    }
  }

  const isSynthesis = item?.itemType === "synthesis";
  const isUtility = item?.itemType === "utility";
  const isOpinion = item?.itemType === "opinion";
  const isHistory = isUtility && item?.utilityMeta?.utilityType === "history";

  // Derive subcategory
  const OPPORTUNITY_CATEGORIES = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  const passesSmellTest =
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

  const rawCat = item?.category ?? "";
  const isUtilityDailyFact = rawCat === "resource" && item?.itemType === "utility" && item?.utilityMeta?.utilityType === "daily_fact";
  const fallbackCat = isUtilityDailyFact
    ? (item?.geoTag === "HT" ? "local_news" : "news")
    : OPPORTUNITY_CATEGORIES.has(rawCat)
      ? (item?.geoTag === "HT" || item?.vertical === "haiti" ? "local_news" : "news")
      : rawCat;
  const catColor = derivedSubCat
    ? SUBCAT_COLORS[derivedSubCat]
    : (CATEGORY_COLORS[fallbackCat] ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300");
  const catLabel = derivedSubCat
    ? SUBCAT_LABELS[derivedSubCat][currentLang]
    : categoryLabel(fallbackCat, currentLang);

  // Dates
  const pubAt = item?.publishedAt as { seconds?: number; _seconds?: number } | null | undefined;
  const pubSecs = pubAt?.seconds ?? (pubAt as Record<string, number> | null)?._seconds;
  const pubDate = pubSecs ? formatDate({ seconds: pubSecs }, currentLang) : null;

  const createdAt = article.createdAt as { seconds?: number; _seconds?: number } | undefined;
  const createdSecs = createdAt?.seconds ?? (createdAt as Record<string, number> | undefined)?._seconds;
  const createdDate = createdSecs ? formatDate({ seconds: createdSecs }, currentLang) : null;

  const lmuAt = item?.lastMajorUpdateAt as { seconds?: number; _seconds?: number } | null | undefined;
  const lmuSecs = lmuAt?.seconds ?? (lmuAt as Record<string, number> | null)?._seconds;
  const lastUpdateDate = lmuSecs ? formatDate({ seconds: lmuSecs }, currentLang) : null;

  const readingTime = estimateReadingTime(article.body, article.sections);

  // Source URL for side rail
  const sourceUrl = item?.source?.originalUrl ?? item?.canonicalUrl ?? null;
  const sourceDomain = sourceUrl ? extractDomain(sourceUrl) : null;

  // JSON-LD
  const publishedISO = pubSecs ? new Date(pubSecs * 1000).toISOString() : null;
  const createdISO = createdSecs ? new Date(createdSecs * 1000).toISOString() : null;
  const modifiedISO = lmuSecs
    ? new Date(lmuSecs * 1000).toISOString()
    : (publishedISO ?? createdISO ?? undefined);
  const articleUrl = `https://news.edlight.org/news/${article.id}`;
  const sourceName = item?.source?.name;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isOpinion ? "OpinionNewsArticle" : "NewsArticle",
    headline: (article.title ?? "").slice(0, 110),
    description: article.summary || article.body?.slice(0, 160) || "",
    ...(heroImageUrl ? { image: [heroImageUrl] } : {}),
    datePublished: publishedISO ?? createdISO ?? undefined,
    dateModified: modifiedISO,
    author: [
      {
        "@type": sourceName ? "Organization" : "Organization",
        name: sourceName ?? "EdLight News",
        ...(sourceUrl ? { url: sourceUrl } : {}),
      },
    ],
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "EdLight News",
      url: "https://news.edlight.org",
      logo: {
        "@type": "ImageObject",
        url: "https://news.edlight.org/logo.png",
        width: 600,
        height: 60,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    url: articleUrl,
    inLanguage: article.language === "fr" ? "fr" : "ht",
    isAccessibleForFree: true,
    ...(catLabel ? { articleSection: catLabel } : {}),
  };

  // BreadcrumbList — its own rich result type
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "EdLight News",
        item: "https://news.edlight.org",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: catLabel ?? "Actualités",
        item: `https://news.edlight.org/news`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <>
      <PageLanguageSync lang={currentLang} />
      <ViewTracker itemId={article.itemId} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* ── Mobile reading progress bar (below xl) ──────────────────── */}
      <MobileProgressBar />

      {/* ═══════════════════════════════════════════════════════════════════
          TWO-COLUMN LAYOUT: Side rail (xl+) + Main article column
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative mx-auto max-w-4xl xl:flex xl:gap-10">

        {/* ── Sticky side rail (xl+ only) ───────────────────────────────── */}
        <ArticleSideRail
          articleId={article.id}
          shareUrl={shareUrl}
          shareTitle={article.title}
          sourceUrl={sourceUrl}
          sourceDomain={sourceDomain}
          lang={currentLang}
        />

        {/* ── Main article column ───────────────────────────────────────── */}
        <article className="min-w-0 flex-1 animate-fade-in">

          {/* ── Breadcrumb ─────────────────────────────────────────────── */}
          <nav aria-label="Fil d'Ariane" className="mb-8 flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-300">
            <Link href={`/?lang=${currentLang}`} className="hover:text-stone-700 dark:hover:text-stone-300 transition-colors">
              {currentLang === "fr" ? "Accueil" : "Akèy"}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            {isOpinion ? (
              <Link href={`/opinion?lang=${currentLang}`} className="hover:text-stone-700 dark:hover:text-stone-300 transition-colors">
                {currentLang === "fr" ? "Opinion" : "Opinyon"}
              </Link>
            ) : (
              <Link href={`/news?lang=${currentLang}`} className="hover:text-stone-700 dark:hover:text-stone-300 transition-colors">
                {currentLang === "fr" ? "Actualités" : "Nouvèl"}
              </Link>
            )}
            {catLabel && !isOpinion && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="text-stone-500 dark:text-stone-300 font-medium">{catLabel}</span>
              </>
            )}
          </nav>

          {/* ── Hero image ─────────────────────────────────────────────── */}
          {heroImageUrl && !(isUtility && heroImageSource === "branded") ? (
            heroImageSource === "branded" ? (
              <BrandedHero
                title={article.title}
                category={fallbackCat}
                sourceName={item?.source?.name}
                className={`mb-10 ${isHistory ? "aspect-[2.4/1]" : isUtility ? "aspect-[2/1]" : "aspect-video"}`}
              />
            ) : (() => {
              // Portrait-image branch: don't crop, render a centred card whose
              // box matches the image's natural aspect ratio.
              const w = heroImageMeta?.width;
              const h = heroImageMeta?.height;
              const naturalRatio = w && h ? w / h : null;
              const isPortraitImage =
                naturalRatio !== null && naturalRatio < 0.95;

              if (isPortraitImage) {
                return (
                  <figure className="mb-10">
                    <div
                      className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-stone-100 shadow-premium dark:bg-stone-800 dark:shadow-premium-dark"
                      style={{ aspectRatio: `${naturalRatio}` }}
                    >
                      <ImageWithFallback
                        src={heroImageUrl}
                        alt={article.title}
                        fill
                        sizes="(max-width: 640px) 90vw, 384px"
                        className="object-cover"
                        fallback={
                          <BrandedHero
                            title={article.title}
                            category={fallbackCat}
                            sourceName={item?.source?.name}
                            className="h-full w-full"
                          />
                        }
                      />
                      {heroImageSource === "publisher" && (
                        <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                          {currentLang === "fr" ? "Image : source" : "Imaj : sous"}
                        </span>
                      )}
                      {heroImageSource === "wikidata" && (
                        <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                          {heroImageAttribution?.name
                            ? `Photo : ${heroImageAttribution.name}`
                            : "Wikimedia Commons"}
                          {heroImageAttribution?.license
                            ? ` (${heroImageAttribution.license})`
                            : ""}
                        </span>
                      )}
                      {heroImageSource === "screenshot" && (
                        <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                          {currentLang === "fr" ? "Capture : source" : "Kapta : sous"}
                        </span>
                      )}
                    </div>
                  </figure>
                );
              }

              // Default landscape branch (unchanged behaviour).
              return (
                <div className={`relative mb-10 w-full overflow-hidden rounded-2xl bg-stone-100 shadow-premium dark:bg-stone-800 dark:shadow-premium-dark ${
                  isHistory ? "aspect-[2.4/1]" : isUtility ? "aspect-[2/1]" : "aspect-video"
                }`}>
                  <ImageWithFallback
                    src={heroImageUrl}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className={`h-full w-full object-cover${isHistory ? " object-top" : ""}`}
                    fallback={
                      <BrandedHero
                        title={article.title}
                        category={fallbackCat}
                        sourceName={item?.source?.name}
                        className="h-full w-full"
                      />
                    }
                  />
                  {isHistory && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  )}
                  {heroImageSource === "publisher" && (
                    <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                      {currentLang === "fr" ? "Image : source" : "Imaj : sous"}
                    </span>
                  )}
                  {heroImageSource === "wikidata" && (
                    <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                      {heroImageAttribution?.name
                        ? `Photo : ${heroImageAttribution.name}`
                        : "Wikimedia Commons"}
                      {heroImageAttribution?.license
                        ? ` (${heroImageAttribution.license})`
                        : ""}
                    </span>
                  )}
                  {heroImageSource === "screenshot" && (
                    <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                      {currentLang === "fr" ? "Capture : source" : "Kapta : sous"}
                    </span>
                  )}
                </div>
              );
            })()
          ) : !heroImageUrl && !isUtility ? (
            <BrandedHero
              title={article.title}
              category={fallbackCat}
              sourceName={item?.source?.name}
              className="mb-10 aspect-video"
            />
          ) : null}

          {/* ══════════════════════════════════════════════════════════════
              PREMIUM TITLE ZONE
              ══════════════════════════════════════════════════════════════ */}
          {isOpinion ? (
            <div className="mb-10">
              <OpinionHeader
                title={article.title}
                summary={article.summary}
                item={item}
                lang={currentLang}
                publishedDate={pubDate || createdDate}
                readingTime={readingTime}
              />
            </div>
          ) : (
            <header className="mb-10 space-y-5">
              {/* Eyebrow: category + type badges */}
              <div className="flex flex-wrap items-center gap-2">
                {(derivedSubCat || item?.category) && (
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${catColor}`}>
                    {catLabel}
                  </span>
                )}
                {isSynthesis && item && <SynthesisBadge item={item} lang={currentLang} />}
                {isUtility && item && <UtilityBadge item={item} lang={currentLang} />}
                {item?.geoTag === "HT" && fallbackCat !== "local_news" && (
                  <span className="inline-block rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                    <MapPin className="mr-0.5 inline-block h-3 w-3" />{currentLang === "fr" ? "Haïti" : "Ayiti"}
                  </span>
                )}
              </div>

              {/* Title — large editorial headline */}
              <h1 className={`font-display font-bold leading-[1.15] tracking-tight text-on-surface ${
                isHistory ? "text-headline-lg" : "text-headline-lg sm:text-display-md"
              }`}>
                {article.title}
              </h1>

              {/* Meta row — date, language, reading time */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-stone-400 dark:text-stone-300">
                <span className="uppercase tracking-wide text-label-sm">
                  {article.language === "fr" ? "Français" : "Kreyòl Ayisyen"}
                </span>
                {(pubDate || createdDate) && (
                  <>
                    <span className="text-stone-300 dark:text-stone-500">·</span>
                    <time>{pubDate || createdDate}</time>
                  </>
                )}
                <span className="text-stone-300 dark:text-stone-500">·</span>
                <span>{currentLang === "fr" ? `${readingTime} min de lecture` : `${readingTime} min li`}</span>
              </div>

              {/* ── Trust badges — on ALL article types ──────────────── */}
              <MetaBadges
                verifiedAt={item?.updatedAt}
                updatedAt={item?.lastMajorUpdateAt}
                publishedAt={item?.publishedAt ?? article.createdAt}
                lang={currentLang}
                variant="full"
              />

              {/* Synthesis update date */}
              {isSynthesis && lastUpdateDate && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {currentLang === "fr" ? "Mis à jour le" : "Mizajou"} {lastUpdateDate}
                </p>
              )}
            </header>
          )}

          {/* ── Source links (non-synthesis, non-history) ───────────────── */}
          {!isSynthesis && !isHistory && (
            <div className="mb-8">
              <SourceLinks item={item} lang={currentLang} />
            </div>
          )}

          {/* ── Summary / lede ──────────────────────────────────────────── */}
          {article.summary && (
            <p className={`mb-8 leading-relaxed ${
              isHistory
                ? "text-body-lg text-stone-600 dark:text-stone-300 border-l-4 border-amber-400 pl-5 italic"
                : "text-lg text-stone-600 dark:text-stone-300 border-l-4 border-primary/30 dark:border-primary/50 pl-5"
            }`}>
              {article.summary}
            </p>
          )}

          {/* ── Share buttons + Bookmark (mobile/tablet — hidden on xl+) ─ */}
          <div className="mb-8 flex items-center gap-3 xl:hidden">
            <ShareButtons
              url={shareUrl}
              title={article.title}
              lang={currentLang}
            />
            <BookmarkButton articleId={article.id} lang={currentLang} variant="button" />
          </div>

          {/* Author byline */}
          {item?.authorSlug && (
            <div className="mb-8">
              <AuthorBlock
                name={item.source?.name ?? "EdLight News"}
                slug={item.authorSlug}
                lang={currentLang}
                variant="full"
              />
            </div>
          )}

          {/* What changed note (synthesis) */}
          {isSynthesis && (
            <div className="mb-8">
              <WhatChangedNote
                whatChanged={article.whatChanged}
                lang={currentLang}
              />
            </div>
          )}

          {/* Bourses structured fiche */}
          {isBourses && !isUtility && item && (
            <div className="mb-8"><BoursesFiche item={item} lang={currentLang} /></div>
          )}

          {/* Utility facts fiche */}
          {isUtility && item && (
            <div className="mb-8"><UtilityFactsFiche item={item} lang={currentLang} /></div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ARTICLE BODY
              ══════════════════════════════════════════════════════════════ */}
          <div id="article-body" className="border-t border-stone-200/80 pt-10 dark:border-stone-800">
            {article.sections && article.sections.length > 0 ? (
              <StructuredSections sections={stripStructuredSourceSections(article.sections)} isHistory={isHistory} />
            ) : (
              <div className="prose prose-lg dark:prose-invert prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-a:text-blue-700 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline max-w-none prose-p:leading-[1.8] prose-p:text-stone-700 dark:prose-p:text-stone-200 prose-li:text-stone-700 dark:prose-li:text-stone-200">
                <ReactMarkdown>{stripMarkdownSourceSections(article.body)}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* ── Post-body sections ─────────────────────────────────────── */}
          <div className="mt-12 space-y-8">

            {/* Utility source citations */}
            {isUtility && (
              <UtilitySourceCitations article={article} lang={currentLang} />
            )}

            {/* Synthesis sources list */}
            {isSynthesis && item && (
              <SynthesisSourcesList item={item} lang={currentLang} />
            )}

            {/* Language switch CTA */}
            {siblingVersion && (
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400">
                    {article.language === "fr" ? "Disponible en Kreyòl" : "Disponib an Fransè"}
                  </p>
                  <Link
                    href={`/news/${siblingVersion.id}?lang=${otherLang}`}
                    className="mt-1 block text-sm font-medium text-stone-700 underline-offset-2 hover:underline dark:text-stone-200"
                  >
                    {siblingVersion.title}
                  </Link>
                </div>
                <Link
                  href={`/news/${siblingVersion.id}?lang=${otherLang}`}
                  className="shrink-0 rounded-xl bg-silk px-4 py-2 text-xs font-semibold text-white shadow-sm dark:shadow-none transition hover:bg-silk-hover hover:shadow-md"
                >
                  {article.language === "fr" ? "Lire →" : "Li →"}
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

            {/* Legacy citations */}
            {!isSynthesis && !isUtility && !item?.source && (article.citations?.length ?? 0) > 0 && (
              <section className="border-t border-stone-200/60 pt-5 dark:border-stone-700">
                <h2 className="text-title-sm dark:text-white">Sources</h2>
                <ul className="mt-2 space-y-1">
                  {(article.citations ?? []).map((c, i) => (
                    <li key={i}>
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {c.sourceName}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Quality flags */}
            {(item?.qualityFlags?.weakSource || item?.qualityFlags?.missingDeadline) && (
              <p className="text-xs text-stone-400 dark:text-stone-300 italic">
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
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RELATED ARTICLES — thematic recommendations
              ══════════════════════════════════════════════════════════════ */}
          {categoryRelated.length > 0 && (
            <div className="mt-14">
              <RelatedArticles articles={categoryRelated} lang={currentLang} />
            </div>
          )}

          {/* ── Footer zone ───────────────────────────────────────────── */}
          <div className="mt-14 space-y-8">
            {/* EdLight attribution */}
            <EdLightAttribution lang={currentLang} />

            {/* Previous / Next navigation */}
            <NextPrevNav prev={prevArticle} next={nextArticle} lang={currentLang} />

            {/* Report issue */}
            <div className="border-t border-stone-200/60 pt-5 dark:border-stone-700">
              <ReportIssueButton
                itemId={article.itemId || article.id}
                lang={currentLang}
              />
            </div>

            {/* Bottom back-link */}
            <div className="flex items-center justify-between border-t border-stone-200/60 pt-6 pb-4 dark:border-stone-800">
              <Link
                href={`/news?lang=${currentLang}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {currentLang === "fr" ? "Retour aux actualités" : "Retounen nan nouvèl yo"}
              </Link>
              <Link
                href={`/?lang=${currentLang}`}
                className="text-xs text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
              >
                EdLight News
              </Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
