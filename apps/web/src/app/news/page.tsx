import { contentVersionsRepo } from "@edlight-news/firebase";
import type { ContentVersion, ContentLanguage } from "@edlight-news/types";
import Link from "next/link";

type Category =
  | "all"
  | "news"
  | "local_news"
  | "scholarship"
  | "opportunity"
  | "event"
  | "resource";

const CATEGORY_LABELS: Record<Category, { fr: string; ht: string }> = {
  all:         { fr: "Tout",          ht: "Tout"      },
  news:        { fr: "Actualités",    ht: "Nouvèl"    },
  local_news:  { fr: "Haïti",         ht: "Ayiti"     },
  scholarship: { fr: "Bourses",       ht: "Bous"      },
  opportunity: { fr: "Opportunités",  ht: "Okazyon"   },
  event:       { fr: "Événements",    ht: "Evènman"   },
  resource:    { fr: "Ressources",    ht: "Resous"    },
};

function StatusBadge({ status }: { status: ContentVersion["status"] }) {
  const colors =
    status === "published"
      ? "bg-green-100 text-green-800"
      : status === "review"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {status}
    </span>
  );
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category || category === "news") return null;

  const colors: Record<string, string> = {
    local_news:  "bg-blue-50 text-blue-700",
    scholarship: "bg-purple-50 text-purple-700",
    opportunity: "bg-orange-50 text-orange-700",
    event:       "bg-teal-50 text-teal-700",
    resource:    "bg-green-50 text-green-700",
  };
  const labels: Record<string, string> = {
    local_news:  "Haïti",
    scholarship: "Bourse",
    opportunity: "Opòtinite",
    event:       "Evènman",
    resource:    "Resous",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[category] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {labels[category] ?? category}
    </span>
  );
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { lang?: string; category?: string };
}) {
  const language: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const activeCategory = (searchParams.category ?? "all") as Category;

  const all = await contentVersionsRepo.listWebVersions(language, 200);

  const articles =
    activeCategory === "all"
      ? all
      : all.filter((a) => a.category === activeCategory);

  const availableCategories: Category[] = [
    "all",
    ...(Array.from(
      new Set(
        all
          .map((a) => a.category)
          .filter((c): c is NonNullable<typeof c> => Boolean(c)),
      ),
    ) as Category[]),
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {language === "fr" ? "Actualités" : "Nouvèl"}
        </h1>
        <span className="text-sm text-gray-400">
          {articles.length}{" "}
          {language === "fr" ? "articles" : "atik"}
        </span>
      </div>

      {/* Category filter pills */}
      {availableCategories.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((cat) => {
            const label = CATEGORY_LABELS[cat]?.[language] ?? cat;
            const isActive = cat === activeCategory;
            const params = new URLSearchParams();
            if (language === "ht") params.set("lang", "ht");
            if (cat !== "all") params.set("category", cat);
            const qs = params.toString();
            const href = `/news${qs ? "?" + qs : ""}`;
            return (
              <Link
                key={cat}
                href={href}
                className={
                  "rounded-full px-3 py-1 text-sm font-medium transition " +
                  (isActive
                    ? "bg-brand-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {articles.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
          <p className="text-lg">
            {language === "fr"
              ? "Aucun article pour le moment."
              : "Pa gen atik pou kounye a."}
          </p>
          <p className="mt-2 text-sm">
            {language === "fr"
              ? "Déclenchez le pipeline avec POST /tick sur le worker."
              : "Lanse pipeline la ak POST /tick sou worker la."}
          </p>
        </div>
      )}

      {/* Article grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {articles.map((article) => (
          <a
            key={article.id}
            href={"/news/" + article.id + "?lang=" + language}
            className="group block rounded-lg border p-5 transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={article.status} />
              <CategoryBadge category={article.category} />
              {article.draftReason && (
                <span
                  className="text-xs text-gray-400"
                  title={article.draftReason}
                >
                  ⚠
                </span>
              )}
            </div>
            <h2 className="mb-2 text-lg font-semibold group-hover:text-brand-700">
              {article.title}
            </h2>
            <p className="line-clamp-3 text-sm text-gray-600">
              {article.summary || article.body.slice(0, 200)}
            </p>
            {article.citations.length > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                Source: {article.citations[0]!.sourceName}
              </p>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
