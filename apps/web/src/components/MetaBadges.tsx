import type { ContentLanguage } from "@edlight-news/types";
import { CheckCircle, RefreshCw, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MetaBadgesProps {
  verifiedAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
  lang: ContentLanguage;
  variant?: "compact" | "full";
}

export function MetaBadges({
  verifiedAt,
  updatedAt,
  publishedAt,
  lang,
  variant = "compact",
}: MetaBadgesProps) {
  const fr = lang === "fr";
  const badges: { icon: React.ReactNode; label: string; style: string }[] = [];

  if (verifiedAt) {
    badges.push({
      icon: <CheckCircle className="h-3 w-3" />,
      label: variant === "full"
        ? `${fr ? "Vérifié" : "Verifye"} ${formatDate(verifiedAt, lang)}`
        : fr ? "Vérifié" : "Verifye",
      style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    });
  }

  if (updatedAt) {
    badges.push({
      icon: <RefreshCw className="h-3 w-3" />,
      label: variant === "full"
        ? `${fr ? "Mis à jour" : "Mizajou"} ${formatDate(updatedAt, lang)}`
        : fr ? "Mis à jour" : "Mizajou",
      style: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    });
  }

  if (publishedAt && variant === "full") {
    badges.push({
      icon: <Calendar className="h-3 w-3" />,
      label: `${fr ? "Publié" : "Pibliye"} ${formatDate(publishedAt, lang)}`,
      style: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((b, i) => (
        <span key={i} className={`badge ${b.style}`}>
          {b.icon}
          {b.label}
        </span>
      ))}
    </div>
  );
}
