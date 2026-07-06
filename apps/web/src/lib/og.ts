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
  const frUrl = `${BASE_URL}${path}`;
  const htUrl = `${BASE_URL}${path}?lang=ht`;
  const url = lang === "ht" ? htUrl : frUrl;
  const canonical = lang === "ht" ? htUrl : frUrl;
  const ogImage = image ?? `${BASE_URL}/opengraph-image`;

  return {
    alternates: {
      canonical,
      languages: { fr: frUrl, ht: htUrl, "x-default": frUrl },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: lang === "fr" ? "fr_FR" : "ht_HT",
      type,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
