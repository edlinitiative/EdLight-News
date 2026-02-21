"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";

// ── Tab definitions ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/",             fr: "Accueil",       ht: "Akèy"    },
  { href: "/opportunites", fr: "Opportunités",  ht: "Okazyon" },
  { href: "/haiti",        fr: "Haïti",         ht: "Ayiti"   },
  { href: "/ressources",   fr: "Ressources",    ht: "Resous"  },
  { href: "/succes",       fr: "Succès",        ht: "Siksè"   },
  { href: "/news",         fr: "Fil",           ht: "Fil"     },
] as const;

// ── Inner component (needs useSearchParams → must be inside Suspense) ────────

function NavBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = (searchParams.get("lang") ?? "fr") as "fr" | "ht";
  const langSuffix = lang === "ht" ? "?lang=ht" : "";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        {/* Top row ── logo + lang toggle */}
        <div className="flex items-center justify-between py-2.5">
          <Link
            href={"/" + langSuffix}
            className="text-xl font-extrabold tracking-tight text-brand-700"
          >
            EdLight<span className="text-gray-400 font-light"> News</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={"/admin" + langSuffix}
              className="hidden text-xs text-gray-400 hover:text-gray-600 sm:block"
            >
              Admin
            </Link>
            <LanguageToggle />
          </div>
        </div>

        {/* Tab row ── scrolls horizontally on small screens */}
        <nav
          className="-mx-4 flex overflow-x-auto px-4 text-sm"
          aria-label="Navigation principale"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const label = lang === "ht" ? item.ht : item.fr;
            return (
              <Link
                key={item.href}
                href={item.href + langSuffix}
                aria-current={active ? "page" : undefined}
                className={[
                  "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-medium transition-colors",
                  active
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:text-gray-800",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function NavBar() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-50 h-[88px] border-b bg-white/95" />
      }
    >
      <NavBarInner />
    </Suspense>
  );
}
