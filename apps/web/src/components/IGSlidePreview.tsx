"use client";

/**
 * IGSlidePreview — CSS-based visual preview of IG carousel slides.
 *
 * Faithfully reproduces the Playwright renderer's design system:
 *  - Cover slides: full-bleed background image + gradient overlay
 *  - Content slides: dark bg + accent left bar + em-dash bullets
 *
 * IGSlideFrame — pixel-perfect iframe preview using the actual renderer.
 * Used in the modal for exact fidelity with the final Instagram output.
 */

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ── Design tokens (mirroring packages/renderer/src/ig-carousel.ts) ──────────

const TYPE_ACCENTS: Record<string, string> = {
  scholarship: "#3b82f6",
  opportunity: "#8b5cf6",
  news: "#14b8a6",
  histoire: "#d97706",
  utility: "#10b981",
};

const TYPE_DARKS: Record<string, string> = {
  scholarship: "#060d1f",
  opportunity: "#0b0814",
  news: "#061014",
  histoire: "#120b06",
  utility: "#060f0b",
};

const TYPE_LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news: "ACTUALITÉ",
  histoire: "HISTOIRE",
  utility: "GUIDE",
};

const FONT =
  "Inter, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SlideData {
  heading: string;
  bullets: string[];
  footer?: string | null;
  backgroundImage?: string | null;
  layout?: string | null;
  meta?: string[] | null;
}

// ── Cover slide ──────────────────────────────────────────────────────────────

function CoverSlide({
  slide, igType, slideIndex, totalSlides,
}: {
  slide: SlideData; igType: string; slideIndex: number; totalSlides: number;
}) {
  const accent = TYPE_ACCENTS[igType] ?? "#3b82f6";
  const dark = TYPE_DARKS[igType] ?? "#060d1f";
  const label = TYPE_LABELS[igType] ?? "";

  return (
    <div
      style={{
        width: "100%", aspectRatio: "4/5", fontFamily: FONT,
        background: `${dark} url('${slide.backgroundImage}') center/cover no-repeat`,
        color: "#fff", overflow: "hidden", position: "relative", borderRadius: "8px",
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.30) 35%, rgba(0,0,0,0.78) 100%)",
      }} />
      <div style={{
        position: "relative", zIndex: 1, height: "100%", display: "flex",
        flexDirection: "column", justifyContent: "space-between", padding: "6.67% 7.4%",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {label && (
            <span style={{
              fontSize: "clamp(8px, 1.4cqw, 15px)", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "3.5px", opacity: 0.85, display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ width: 8, height: 8, background: accent, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
              {label}
            </span>
          )}
          <span style={{ fontSize: "clamp(8px, 1.3cqw, 14px)", fontWeight: 500, opacity: 0.4, letterSpacing: "1px" }}>
            {slideIndex + 1} / {totalSlides}
          </span>
        </div>
        <div>
          <div style={{
            fontSize: "clamp(18px, 5cqw, 54px)", fontWeight: 700, lineHeight: 1.1,
            letterSpacing: "-0.5px", textShadow: "0 2px 24px rgba(0,0,0,0.5)", marginBottom: "12px",
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
          }}>
            {slide.heading}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {slide.bullets.map((b, i) => (
              <li key={i} style={{
                fontSize: "clamp(10px, 1.94cqw, 21px)", fontWeight: 400, lineHeight: 1.55,
                opacity: 0.7, marginBottom: 4, textShadow: "0 1px 10px rgba(0,0,0,0.4)",
              }}>{b}</li>
            ))}
          </ul>
          <div style={{ marginTop: "20px", fontSize: "clamp(9px, 1.48cqw, 16px)", fontWeight: 700, opacity: 0.35, letterSpacing: "2px" }}>
            ED<span style={{ color: accent, fontWeight: 700 }}>LIGHT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Content slide ────────────────────────────────────────────────────────────

function ContentSlide({
  slide, igType, slideIndex, totalSlides,
}: {
  slide: SlideData; igType: string; slideIndex: number; totalSlides: number;
}) {
  const accent = TYPE_ACCENTS[igType] ?? "#3b82f6";
  const dark = TYPE_DARKS[igType] ?? "#060d1f";
  const label = TYPE_LABELS[igType] ?? "";

  // For opportunity/scholarship/news/etc. add a subtle ambient glow in bottom-right
  const glowStyle = {
    position: "absolute" as const,
    top: "-30%", right: "-20%",
    width: "70%", height: "70%",
    background: `radial-gradient(circle, ${accent}14 0%, transparent 70%)`,
    pointerEvents: "none" as const,
  };

  return (
    <div style={{
      width: "100%", aspectRatio: "4/5", fontFamily: FONT,
      background: dark, color: "#fff", overflow: "hidden", position: "relative", borderRadius: "8px",
    }}>
      <div style={glowStyle} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: accent }} />
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "6.67% 7.4% 5.9% 8.5%",
      }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
            {label && (
              <span style={{
                fontSize: "clamp(8px, 1.2cqw, 13px)", fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "3.5px", color: accent, opacity: 0.6,
              }}>{label}</span>
            )}
            <span style={{ fontSize: "clamp(8px, 1.3cqw, 14px)", fontWeight: 500, opacity: 0.3, letterSpacing: "1px" }}>
              {slideIndex + 1} / {totalSlides}
            </span>
          </div>
          <div style={{
            fontSize: "clamp(16px, 3.89cqw, 42px)", fontWeight: 700, lineHeight: 1.15,
            letterSpacing: "-0.3px", overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          }}>
            {slide.heading}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {slide.bullets.map((b, i) => (
              <li key={i} style={{
                fontSize: "clamp(11px, 2.31cqw, 25px)", lineHeight: 1.55, marginBottom: "16px",
                opacity: 0.82, paddingLeft: "24px", position: "relative",
              }}>
                <span style={{ position: "absolute", left: 0, color: accent, opacity: 0.5 }}>—</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px",
        }}>
          <span style={{ fontSize: "clamp(8px, 1.3cqw, 14px)", opacity: 0.25, maxWidth: "65%", lineHeight: 1.4 }}>
            {slide.footer ?? ""}
          </span>
          <span style={{ fontSize: "clamp(9px, 1.48cqw, 16px)", fontWeight: 700, opacity: 0.3, letterSpacing: "2px" }}>
            ED<span style={{ color: accent, fontWeight: 700 }}>LIGHT</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Single slide dispatcher ──────────────────────────────────────────────────

function SlidePreview({ slide, igType, slideIndex, totalSlides }: {
  slide: SlideData; igType: string; slideIndex: number; totalSlides: number;
}) {
  if (slide.backgroundImage) {
    return <CoverSlide slide={slide} igType={igType} slideIndex={slideIndex} totalSlides={totalSlides} />;
  }
  return <ContentSlide slide={slide} igType={igType} slideIndex={slideIndex} totalSlides={totalSlides} />;
}

// ── Carousel with navigation ─────────────────────────────────────────────────

export interface IGPostPreviewProps {
  igType: string;
  slides: SlideData[];
  caption?: string | null;
}

export function IGPostPreview({ igType, slides, caption }: IGPostPreviewProps) {
  const totalSlides = slides.length;
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(totalSlides - 1, c + 1));

  // Nothing to render — show placeholder
  if (totalSlides === 0) {
    return (
      <div className="flex w-full items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-400 dark:bg-stone-800" style={{ aspectRatio: "4/5" }}>
        No slides yet
      </div>
    );
  }

  return (
    <div className="w-full" style={{ containerType: "inline-size" }}>
      <div className="relative overflow-hidden rounded-lg">
        <SlidePreview slide={slides[current]!} igType={igType} slideIndex={current} totalSlides={totalSlides} />
        {totalSlides > 1 && (
          <>
            {current > 0 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 transition hover:bg-black/70 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {current < totalSlides - 1 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 transition hover:bg-black/70 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
      {totalSlides > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: totalSlides }, (_, i) => (
            <button type="button" key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }} className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-stone-700 dark:bg-white" : "w-1.5 bg-stone-300 dark:bg-stone-600"}`} />
          ))}
        </div>
      )}
      {caption && (
        <div className="mt-3 px-1">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-600 dark:text-stone-400">
            {caption.length > 200 ? caption.slice(0, 200) + "\u2026" : caption}
          </pre>
        </div>
      )}
    </div>
  );
}

export default IGPostPreview;

// ── IGSlideFrame: pixel-perfect iframe preview using the actual renderer ──────
//
// Calls /api/admin/ig-slide-html (server-side buildSlideHTML) and renders the
// result in a sandboxed iframe scaled to fit its container. Gives 100% fidelity
// with the final Instagram output — same fonts, layout templates, overlays, etc.

export interface IGSlideFrameProps {
  igType: string;
  slides: SlideData[];
}

export function IGSlideFrame({ igType, slides }: IGSlideFrameProps) {
  const [htmls, setHtmls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Fetch all slide HTMLs from the real renderer
  useEffect(() => {
    if (!slides.length) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch("/api/admin/ig-slide-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ igType, slides, totalSlides: slides.length }),
    })
      .then((r) => r.json())
      .then((data: { htmls?: string[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setHtmls(data.htmls ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Render failed"))
      .finally(() => setLoading(false));
  }, [igType, slides]);

  // Compute scale: iframe is 1080px wide, container is dynamic
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / 1080);
    });
    obs.observe(el);
    // Set immediately
    const w = el.clientWidth;
    if (w > 0) setScale(w / 1080);
    return () => obs.disconnect();
  }, []);

  const totalSlides = slides.length;
  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(totalSlides - 1, c + 1));

  // Container maintains 4:5 aspect ratio (1080×1350 = 4:5)
  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    paddingTop: "125%", // 1350/1080 = 1.25
    overflow: "hidden",
    borderRadius: "8px",
    background: "#111",
  };

  const iframeStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: 1080,
    height: 1350,
    border: "none",
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      </div>
    );
  }

  if (error || !htmls.length) {
    // Fallback to CSS preview on error
    return <IGPostPreview igType={igType} slides={slides} />;
  }

  return (
    <div>
      <div ref={containerRef} style={containerStyle}>
        <iframe
          key={current}
          srcDoc={htmls[current]}
          style={iframeStyle}
          sandbox="allow-same-origin"
          title={`Slide ${current + 1}`}
        />
        {/* Navigation arrows */}
        {totalSlides > 1 && (
          <>
            {current > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
                className="rounded-full bg-black/50 p-2 text-white/90 transition hover:bg-black/75"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {current < totalSlides - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
                className="rounded-full bg-black/50 p-2 text-white/90 transition hover:bg-black/75"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>
      {/* Dot pagination */}
      {totalSlides > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: totalSlides }, (_, i) => (
            <button
              type="button"
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-4 bg-white" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
