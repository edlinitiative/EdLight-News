/**
 * IG Formatter – News carousel
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText } from "./helpers.js";

export function buildNewsCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];

  // Slide 1: Cover
  const meta: string[] = [];
  if (item.geoTag) {
    meta.push(item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International");
  }
  meta.push(shortenText(item.summary, 180));
  slides.push({
    heading: shortenText(item.title, 80),
    bullets: meta,
    backgroundImage: item.imageUrl ?? undefined,
  });

  // Slide 2: Key points
  if (item.extractedText) {
    const keyPoints = item.extractedText
      .split(/[.!?]\s+/)
      .filter((s) => s.trim().length > 20 && s.trim().length < 120)
      .slice(0, 4)
      .map((s) => s.trim());

    if (keyPoints.length >= 2) {
      slides.push({ heading: "Points clés", bullets: keyPoints });
    }
  }

  if (slides.length > 0) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const parts: string[] = [
    item.title,
    "",
    shortenText(item.summary, 400),
    "",
    buildCTA(),
    "",
    buildSourceLine(item),
  ];

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
