interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeaderProps) {
  const isCenter = align === "center";

  return (
    <div className={isCenter ? "text-center" : "text-left"}>
      {/* Eyebrow */}
      <div
        className={`flex items-center gap-3 mb-4 ${isCenter ? "justify-center" : ""}`}
      >
        <span className="block h-px w-8 bg-[#722F37]" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest text-[#722F37]">
          {eyebrow}
        </span>
      </div>

      {/* Title */}
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
        {title}
      </h2>

      {/* Description */}
      {description && (
        <p className="mt-3 max-w-2xl text-base text-stone-500 leading-relaxed mx-auto">
          {description}
        </p>
      )}
    </div>
  );
}
