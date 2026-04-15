/**
 * SectionHeader — reusable editorial section heading for /histoire.
 *
 * Renders a structured heading block with:
 * - uppercase tracking eyebrow text (burgundy)
 * - serif display heading
 * - optional description
 * - optional right-aligned link
 */

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  linkText?: string;
  linkHref?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  linkText,
  linkHref,
  align = "left",
}: SectionHeaderProps) {
  const isCenter = align === "center";

  return (
    <div
      className={`flex flex-col gap-4 ${
        isCenter
          ? "items-center text-center"
          : "md:flex-row md:items-end md:justify-between"
      }`}
    >
      <div className={isCenter ? "max-w-3xl" : ""}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6f2438] dark:text-rose-400 mb-3">
          {eyebrow}
        </p>
        <h2 className="font-serif text-4xl font-bold italic leading-[1.02] text-[#1d1b1a] dark:text-white md:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#464555] dark:text-stone-400">
            {description}
          </p>
        )}
      </div>

      {linkText && linkHref && !isCenter && (
        <a
          href={linkHref}
          className="group inline-flex shrink-0 items-center gap-2 font-semibold text-[#3525cd] transition-all hover:gap-3 dark:text-indigo-400"
        >
          {linkText}
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
      )}
    </div>
  );
}
