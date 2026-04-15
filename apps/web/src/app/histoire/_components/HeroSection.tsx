"use client";

/**
 * HeroSection — cinematic editorial hero for /histoire.
 *
 * Full-width image with gradient overlay, burgundy/gold accent palette,
 * serif headline, and "En savoir plus" CTA that opens the detail panel.
 */

import Image from "next/image";
import { ArrowRight, BookOpen } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

interface HeroSectionProps {
  lang: ContentLanguage;
  heroEntry: SerializableAlmanacEntry | null;
  todayLabel: string;
  totalEvents: number;
  onReadMore?: () => void;
}

export function HeroSection({
  lang,
  heroEntry,
  todayLabel,
  totalEvents,
  onReadMore,
}: HeroSectionProps) {
  const fr = lang === "fr";

  const { url: wikiUrl } = useWikiImage(
    heroEntry?.title_fr ?? null,
    heroEntry?.year ?? null,
  );

  const imageUrl =
    heroEntry?.illustration?.imageUrl &&
    (heroEntry.illustration.confidence ?? 0) >= 0.55
      ? heroEntry.illustration.imageUrl
      : wikiUrl;

  return (
    <section className="relative min-h-[560px] overflow-hidden rounded-b-[2rem] md:min-h-[640px]">
      {/* ── Background image or gradient ────────────────── */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          className="object-cover transition-transform duration-[2s] hover:scale-[1.02]"
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0e08] via-[#2d1a12] to-[#1a0e2a]" />
      )}

      {/* ── Gradient overlays ───────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0e08]/95 via-[#1a0e08]/55 to-[#1a0e08]/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a0e08]/40 to-transparent" />

      {/* ── Content ─────────────────────────────────────── */}
      <div className="relative z-10 flex h-full min-h-[560px] flex-col justify-end p-8 md:min-h-[640px] md:p-12 lg:p-16">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="mb-6 flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-[#e8d39b]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e8d39b]">
              {fr ? "Éphéméride haïtienne" : "Efemerid ayisyen"}
            </span>
            <span className="h-px w-16 bg-[#e8d39b]/30" aria-hidden="true" />
          </div>

          {/* Date & stats pill */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-[#e8d39b]" />
            <span className="text-sm font-medium tracking-wide text-white/90">
              {todayLabel}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-sm text-white/60">
              {totalEvents} {fr ? "repères ce mois" : "repè mwa sa a"}
            </span>
          </div>

          {heroEntry ? (
            <>
              {heroEntry.year && (
                <span className="mb-3 inline-block rounded-lg bg-[#6f2438] px-3 py-1 text-sm font-bold text-white shadow-md">
                  {heroEntry.year}
                </span>
              )}

              <h1 className="mb-5 font-serif text-4xl leading-[1.05] text-white md:text-5xl lg:text-6xl">
                {fr
                  ? heroEntry.title_fr
                  : (heroEntry.title_ht ?? heroEntry.title_fr)}
              </h1>

              <p className="mb-8 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                {fr
                  ? heroEntry.summary_fr
                  : (heroEntry.summary_ht ?? heroEntry.summary_fr)}
              </p>

              {onReadMore && (
                <button
                  onClick={onReadMore}
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-[#1a0e08] transition-all hover:bg-[#e8d39b] hover:shadow-lg"
                >
                  {fr ? "En savoir plus" : "Aprann plis"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              )}
            </>
          ) : (
            <>
              <h1 className="mb-5 font-serif text-5xl leading-[1.05] text-white md:text-6xl lg:text-7xl">
                {fr ? "La mémoire" : "Memwa"}
                <br />
                <span className="italic text-[#e8d39b]">
                  {fr ? "vivante" : "vivan"}
                </span>{" "}
                {fr ? "d'Haïti." : "Ayiti."}
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-white/65">
                {fr
                  ? "Chaque jour porte une page de l'histoire d'Haïti."
                  : "Chak jou pote yon paj nan istwa Ayiti."}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
