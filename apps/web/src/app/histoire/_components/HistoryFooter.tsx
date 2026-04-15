/**
 * HistoryFooter — editorial footer for the /histoire page.
 *
 * Features:
 * - Brand name + tagline
 * - Navigation and resource link columns from data
 * - Edition copyright
 *
 * Note: This is specific to /histoire. The main site footer
 * (apps/web/src/components/Footer.tsx) remains unchanged.
 */

interface FooterSection {
  readonly title: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}

interface HistoryFooterProps {
  sections: readonly FooterSection[];
}

export function HistoryFooter({ sections }: HistoryFooterProps) {
  return (
    <footer className="mt-20 border-t border-black/[0.08] bg-[#fff8f5] dark:border-stone-700/40 dark:bg-stone-950">
      <div className="py-14">
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          {/* Brand */}
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight text-[#1d1b1a] dark:text-white">
              EdLight News
            </p>
            <p className="mt-3 max-w-sm text-sm leading-7 text-[#464555] dark:text-stone-400">
              Série curatoriale dédiée à la préservation et à la mise en récit
              élégante de la mémoire historique haïtienne.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3">
            {sections.map((section) => (
              <div key={section.title} className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#464555]/70 dark:text-stone-500">
                  {section.title}
                </p>
                {section.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block text-[#464555] transition-colors hover:text-[#3525cd] dark:text-stone-400 dark:hover:text-indigo-400"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ))}

            {/* Edition column */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#464555]/70 dark:text-stone-500">
                Édition
              </p>
              <p className="text-[#464555] dark:text-stone-400">
                © {new Date().getFullYear()} EdLight News
              </p>
              <p className="text-[#464555] dark:text-stone-400">
                Port-au-Prince, Haïti
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
