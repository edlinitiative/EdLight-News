import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  align?: "left" | "center";
  size?: "default" | "large";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  align = "left",
  size = "default",
  className = "",
}: SectionHeaderProps) {
  const isCenter = align === "center";
  const isLarge = size === "large";

  return (
    <div
      className={[
        "mb-8",
        isCenter ? "text-center" : "flex flex-wrap items-end justify-between gap-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={isCenter ? "mx-auto max-w-2xl" : "min-w-0 flex-1"}>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
            {eyebrow}
          </p>
        )}
        <h2
          className={[
            "font-bold tracking-tight text-stone-900 dark:text-white",
            isLarge ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
          ].join(" ")}
          style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className={[
              "mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-300",
              isCenter ? "mx-auto max-w-lg" : "max-w-xl",
            ].join(" ")}
          >
            {description}
          </p>
        )}
        {/* Decorative rule */}
        <div
          className={[
            "mt-4 h-[2px] rounded-full bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-700",
            isCenter ? "mx-auto w-16" : "w-12",
          ].join(" ")}
        />
      </div>

      {href && linkLabel && !isCenter && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
        >
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
