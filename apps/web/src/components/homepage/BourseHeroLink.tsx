"use client";

/**
 * BourseHeroLink — client wrapper around <Link> that fires the
 * `hero_bourse_click` analytics event before navigation.
 */

import Link from "next/link";
import { track } from "@/lib/analytics";

interface Props {
  href: string;
  bourseId: string;
  bourseName: string;
  position: number;
  className?: string;
  children: React.ReactNode;
}

export function BourseHeroLink({
  href,
  bourseId,
  bourseName,
  position,
  className,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        track("hero_bourse_click", {
          bourseId,
          bourseName,
          position,
        })
      }
    >
      {children}
    </Link>
  );
}
