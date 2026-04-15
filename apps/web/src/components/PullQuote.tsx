interface PullQuoteProps {
  quote: string;
  attribution?: string;
  /** Accent bar color class (default: blue-600) */
  accentColor?: string;
}

/**
 * PullQuote — editorial voice component.
 * Vertical accent bar + italic serif quote + attribution.
 */
export function PullQuote({
  quote,
  attribution,
  accentColor = "bg-blue-600 dark:bg-blue-400",
}: PullQuoteProps) {
  return (
    <div className="flex gap-4 py-6">
      <div className={`w-1 shrink-0 rounded-full ${accentColor}`} />
      <div>
        <p
          className="text-xl font-light italic leading-relaxed text-stone-700 dark:text-stone-300 md:text-2xl"
          style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
        >
          {quote}
        </p>
        {attribution && (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            — {attribution}
          </p>
        )}
      </div>
    </div>
  );
}
