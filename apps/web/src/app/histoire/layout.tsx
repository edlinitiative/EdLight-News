/**
 * /histoire layout — adds Playfair Display serif font
 * and paper-grain texture for the editorial archive experience.
 *
 * This layout adds the `--font-serif` CSS variable and extends
 * the root layout without replacing the site-wide navigation.
 */

import { Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";

const serif = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export default function HistoireLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${serif.variable} paper-grain relative`}>
      {children}
    </div>
  );
}
