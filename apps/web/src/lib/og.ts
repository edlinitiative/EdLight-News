/**
 * Shared Open Graph metadata helpers.
 * Centralises OG / Twitter card generation for all pages.
 */

import type { Metadata } from "next";

const SITE_NAME = "EdLight News";
const BASE_URL = "https://news.edlight.org";

export interface OgParams {
  title: string;
  description: string;
  path: string;
  lang?: string;
  image?: string;
  type?: "website" | "article";
}

/** Build Open Graph + Twitter card metadata fields. */
export function buildOgMetadata({
  title,
  description,
  path,
  lang = "fr",
  image,
  type = "website",
}: OgParams): Partial<Metadata> {
  const url = `${BASE_URL}${path}${lang === "ht" ? "?lang=ht" : ""}`;
  const ogImage = image ?? `${BASE_URL}/icon.svg`;

  return {
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: { fr: `${BASE_URL}${path}`, ht: `${BASE_URL}${path}?lang=ht` },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: lang === "fr" ? "fr_FR" : "ht_HT",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
