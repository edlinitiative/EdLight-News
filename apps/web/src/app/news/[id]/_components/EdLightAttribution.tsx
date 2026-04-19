import type { ContentLanguage } from "@edlight-news/types";
import Link from "next/link";

export function EdLightAttribution({ lang }: { lang: ContentLanguage }) {
  const fr = lang === "fr";
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-gradient-to-br from-stone-50 to-white p-5 dark:border-stone-700 dark:from-stone-900 dark:to-stone-800">
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
