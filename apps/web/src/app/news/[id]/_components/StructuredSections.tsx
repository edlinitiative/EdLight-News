import type { ContentSection } from "@edlight-news/types";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import ReactMarkdown from "react-markdown";
import { Lightbulb, BookOpen } from "lucide-react";

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

export function StructuredSections({
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
                      <span className="ml-1 text-stone-400/70">— {section.imageCredit}</span>
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
