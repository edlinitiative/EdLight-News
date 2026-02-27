/**
 * CountryFlag — renders a flag icon using flag-icons CSS.
 *
 * Accepts a lowercase ISO 3166-1 alpha-2 country code (e.g. "fr", "us", "gb")
 * and renders a crisp, cross-platform SVG flag via the `flag-icons` package.
 *
 * Pass `size` to control the scale ("sm" = 1em inline, "lg" = 1.75em display).
 */

interface CountryFlagProps {
  /** Lowercase ISO 3166-1 alpha-2 code, e.g. "fr", "gb", "us" */
  code: string;
  /** "sm" (default) for inline text, "lg" for section headings */
  size?: "sm" | "lg";
  className?: string;
}

export function CountryFlag({ code, size = "sm", className = "" }: CountryFlagProps) {
  if (!code) return null;

  const sizeClass = size === "lg"
    ? "inline-block w-7 h-5 rounded-sm shadow-sm"
    : "inline-block w-5 h-3.5 rounded-[2px]";

  return (
    <span
      className={`fi fi-${code} ${sizeClass} ${className}`}
      role="img"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    />
  );
}
