"use client";

/**
 * IGSlidePreview — CSS-based visual preview of IG carousel slides.
 *
 * Faithfully reproduces the Playwright renderer's design system:
 *  - Cover slides: full-bleed background image + gradient overlay
 *  - Content slides: dark bg + accent left bar + em-dash bullets
 *  - Meme slides: 9 template layouts (drake, expanding-brain, etc.)
 */

import { useState } from "react";
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

const TONE_ACCENTS: Record<string, string> = {
  witty: "#facc15",
  wholesome: "#34d399",
  ironic: "#f472b6",
  hype: "#fb923c",
};

const TONE_BG: Record<string, string> = {
  witty: "#1a1a2e",
  wholesome: "#0f1f1a",
  ironic: "#1f0a1a",
  hype: "#1f1408",
};

const FONT =
  "Inter, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SlideData {
  heading: string;
  bullets: string[];
  footer?: string | null;
  backgroundImage?: string;
}

export interface MemePanel {
  text: string;
  emoji?: string;
}

export interface MemeSlideData {
  template: string;
  panels: MemePanel[];
  topicLine?: string;
  tone: string;
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
        width: "100%", aspectRatio: "1", fontFamily: FONT,
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
              fontSize: "clamp(8px, 1.4vw, 15px)", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "3.5px", opacity: 0.85, display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ width: 8, height: 8, background: accent, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
              {label}
            </span>
          )}
          <span style={{ fontSize: "clamp(8px, 1.3vw, 14px)", fontWeight: 500, opacity: 0.4, letterSpacing: "1px" }}>
            {slideIndex + 1} / {totalSlides}
          </span>
        </div>
        <div>
          <div style={{
            fontSize: "clamp(18px, 5vw, 54px)", fontWeight: 700, lineHeight: 1.1,
            letterSpacing: "-0.5px", textShadow: "0 2px 24px rgba(0,0,0,0.5)", marginBottom: "12px",
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
          }}>
            {slide.heading}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {slide.bullets.map((b, i) => (
              <li key={i} style={{
                fontSize: "clamp(10px, 1.94vw, 21px)", fontWeight: 400, lineHeight: 1.55,
                opacity: 0.7, marginBottom: 4, textShadow: "0 1px 10px rgba(0,0,0,0.4)",
              }}>{b}</li>
            ))}
          </ul>
          <div style={{ marginTop: "20px", fontSize: "clamp(9px, 1.48vw, 16px)", fontWeight: 700, opacity: 0.35, letterSpacing: "2px" }}>
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

  return (
    <div style={{
      width: "100%", aspectRatio: "1", fontFamily: FONT,
      background: dark, color: "#fff", overflow: "hidden", position: "relative", borderRadius: "8px",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: accent }} />
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "6.67% 7.4% 5.9% 8.5%",
      }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
            {label && (
              <span style={{
                fontSize: "clamp(8px, 1.2vw, 13px)", fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "3.5px", color: accent, opacity: 0.6,
              }}>{label}</span>
            )}
            <span style={{ fontSize: "clamp(8px, 1.3vw, 14px)", fontWeight: 500, opacity: 0.3, letterSpacing: "1px" }}>
              {slideIndex + 1} / {totalSlides}
            </span>
          </div>
          <div style={{
            fontSize: "clamp(16px, 3.89vw, 42px)", fontWeight: 700, lineHeight: 1.15,
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
                fontSize: "clamp(11px, 2.31vw, 25px)", lineHeight: 1.55, marginBottom: "16px",
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
          <span style={{ fontSize: "clamp(8px, 1.3vw, 14px)", opacity: 0.25, maxWidth: "65%", lineHeight: 1.4 }}>
            {slide.footer ?? ""}
          </span>
          <span style={{ fontSize: "clamp(9px, 1.48vw, 16px)", fontWeight: 700, opacity: 0.3, letterSpacing: "2px" }}>
            ED<span style={{ color: accent, fontWeight: 700 }}>LIGHT</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Meme base wrapper ────────────────────────────────────────────────────────

function MemeBase({ tone, topicLine, children }: { tone: string; topicLine?: string; children: React.ReactNode }) {
  const accent = TONE_ACCENTS[tone] ?? "#facc15";
  const bg = TONE_BG[tone] ?? "#1a1a2e";

  return (
    <div style={{
      width: "100%", aspectRatio: "1", fontFamily: FONT,
      background: bg, color: "#fff", overflow: "hidden", position: "relative", borderRadius: "8px",
    }}>
      {topicLine && (
        <div style={{
          position: "absolute", top: "4.4%", left: "6.67%", right: "6.67%",
          fontSize: "clamp(9px, 1.85vw, 20px)", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "3px", opacity: 0.5,
        }}>{topicLine}</div>
      )}
      {children}
      <div style={{
        position: "absolute", bottom: "3.7%", right: "6.67%",
        fontSize: "clamp(9px, 1.48vw, 16px)", fontWeight: 700, opacity: 0.25, letterSpacing: "2px",
      }}>
        ED<span style={{ color: accent, fontWeight: 700 }}>LIGHT</span>
      </div>
    </div>
  );
}

// ── Meme templates ───────────────────────────────────────────────────────────

function DrakeMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [reject, prefer] = meme.panels;
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 7.4%", gap: "3.7%", background: "rgba(255,50,50,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: "clamp(24px, 7.4vw, 80px)", flexShrink: 0 }}>{reject?.emoji ?? "🙅"}</span>
          <span style={{ fontSize: "clamp(14px, 3.33vw, 36px)", fontWeight: 600, lineHeight: 1.3, opacity: 0.5, textDecoration: "line-through" }}>{reject?.text}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 7.4%", gap: "3.7%", background: "rgba(50,255,100,0.08)" }}>
          <span style={{ fontSize: "clamp(24px, 7.4vw, 80px)", flexShrink: 0 }}>{prefer?.emoji ?? "😎"}</span>
          <span style={{ fontSize: "clamp(14px, 3.33vw, 36px)", fontWeight: 600, lineHeight: 1.3, color: accent }}>{prefer?.text}</span>
        </div>
      </div>
    </MemeBase>
  );
}

function ExpandingBrainMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const sizes = ["clamp(11px, 2.6vw, 28px)", "clamp(12px, 2.96vw, 32px)", "clamp(14px, 3.52vw, 38px)", "clamp(16px, 4.07vw, 44px)"];
  const opacities = [0.4, 0.6, 0.8, 1.0];
  const brainEmojis = ["🧠", "🧠✨", "🧠💫", "🧠🌌"];
  const margins = [0, 2.78, 5.56, 8.33];
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "9.3% 6.67% 7.4%", justifyContent: "space-around" }}>
        {meme.panels.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "2.96%", padding: "1.5% 2.2%", borderLeft: `3px solid ${accent}`, marginLeft: `${margins[i]}%`, opacity: opacities[i] }}>
            <span style={{ fontSize: "clamp(18px, 4.4vw, 48px)", flexShrink: 0 }}>{p.emoji ?? brainEmojis[i]}</span>
            <span style={{ fontSize: sizes[i], fontWeight: 600, lineHeight: 1.3 }}>{p.text}</span>
          </div>
        ))}
      </div>
    </MemeBase>
  );
}

function NobodyMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [nobody, reaction] = meme.panels;
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 7.4%", gap: "4.4%" }}>
        <div style={{ fontSize: "clamp(12px, 2.96vw, 32px)", fontWeight: 500, opacity: 0.35 }}>{nobody?.emoji ?? ""} {nobody?.text}</div>
        <div>
          <span style={{ fontSize: "clamp(24px, 6.67vw, 72px)", display: "block", marginBottom: "1.5%" }}>{reaction?.emoji ?? "😂"}</span>
          <div style={{ fontSize: "clamp(16px, 3.89vw, 42px)", fontWeight: 700, color: accent, lineHeight: 1.3 }}>{reaction?.text}</div>
        </div>
      </div>
    </MemeBase>
  );
}

function StarterPackMeme({ meme }: { meme: MemeSlideData }) {
  return (
    <MemeBase tone={meme.tone}>
      <div style={{ textAlign: "center", padding: "6.67% 7.4% 2.2%", fontSize: "clamp(14px, 3.33vw, 36px)", fontWeight: 700, color: TONE_ACCENTS[meme.tone] ?? "#facc15", letterSpacing: "-0.5px" }}>
        {meme.topicLine ?? "Starter Pack"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "2.2%", padding: "2.2% 7.4% 7.4%", height: "78%" }}>
        {meme.panels.map((p, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5%", padding: "2.2%" }}>
            <span style={{ fontSize: "clamp(20px, 5.19vw, 56px)" }}>{p.emoji ?? "📦"}</span>
            <span style={{ fontSize: "clamp(10px, 2.22vw, 24px)", fontWeight: 600, textAlign: "center", lineHeight: 1.3, opacity: 0.85 }}>{p.text}</span>
          </div>
        ))}
      </div>
    </MemeBase>
  );
}

function TwoButtonsMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [left, right] = meme.panels;
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "4.4%", padding: "9.3% 5.9% 7.4%" }}>
        <div style={{ fontSize: "clamp(32px, 8.89vw, 96px)" }}>😰</div>
        <div style={{ display: "flex", gap: "2.96%", width: "100%" }}>
          {[left, right].map((p, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `2px solid ${i === 1 ? accent : "rgba(255,255,255,0.1)"}`, borderRadius: "20px", padding: "4.4% 2.96%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5%" }}>
              <span style={{ fontSize: "clamp(20px, 5.19vw, 56px)" }}>{p?.emoji ?? (i === 0 ? "🅰️" : "🅱️")}</span>
              <span style={{ fontSize: "clamp(11px, 2.59vw, 28px)", fontWeight: 600, lineHeight: 1.3 }}>{p?.text}</span>
            </div>
          ))}
        </div>
      </div>
    </MemeBase>
  );
}

function TellMeMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [setup, punchline] = meme.panels;
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 7.4%", gap: "5.9%" }}>
        <div style={{ fontSize: "clamp(12px, 2.78vw, 30px)", fontWeight: 500, opacity: 0.5, lineHeight: 1.4, fontStyle: "italic" }}>{setup?.emoji ?? "🤔"} {setup?.text}</div>
        <div>
          <span style={{ fontSize: "clamp(22px, 5.93vw, 64px)", display: "block", marginBottom: "1.1%" }}>{punchline?.emoji ?? "💀"}</span>
          <div style={{ fontSize: "clamp(16px, 4.07vw, 44px)", fontWeight: 700, color: accent, lineHeight: 1.25 }}>{punchline?.text}</div>
        </div>
      </div>
    </MemeBase>
  );
}

function DistractedMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [focus, distraction, ignored] = meme.panels;
  const panels = [
    { label: "Ce que je devrais faire", data: focus, cls: "focus" as const },
    { label: "Ce que je fais", data: distraction, cls: "distract" as const },
    { label: "Ce que j\u2019ignore", data: ignored, cls: "ignored" as const },
  ];
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 6.67%", gap: "2.2%" }}>
        {panels.map((p, i) => (
          <div key={i}>
            <div style={{ fontSize: "clamp(8px, 1.3vw, 14px)", textTransform: "uppercase", letterSpacing: "2px", opacity: 0.3, marginBottom: "0.4%" }}>{p.label}</div>
            <div style={{
              display: "flex", alignItems: "center", gap: "2.59%", padding: "2.59% 2.96%", borderRadius: "16px",
              background: p.cls === "distract" ? "rgba(255,200,0,0.08)" : p.cls === "focus" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
              border: p.cls === "distract" ? `2px solid ${accent}` : "none",
              opacity: p.cls === "focus" ? 0.4 : p.cls === "ignored" ? 0.3 : 1,
            }}>
              <span style={{ fontSize: "clamp(20px, 5.19vw, 56px)", flexShrink: 0 }}>{p.data?.emoji ?? (i === 0 ? "📚" : i === 1 ? "👀" : "🫣")}</span>
              <span style={{
                fontSize: "clamp(12px, 2.78vw, 30px)", fontWeight: 600, lineHeight: 1.3,
                textDecoration: p.cls === "focus" ? "line-through" : "none",
                color: p.cls === "distract" ? accent : "inherit",
              }}>{p.data?.text}</span>
            </div>
          </div>
        ))}
      </div>
    </MemeBase>
  );
}

function ComparisonMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [left, right] = meme.panels;
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%" }}>
        {[{ data: left, label: "Attente", emoji: "🤞", isRight: false }, { data: right, label: "Réalité", emoji: "😅", isRight: true }].map((col, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "9.3% 4.4% 7.4%", gap: "2.2%", borderRight: i === 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
            <div style={{ fontSize: "clamp(9px, 1.48vw, 16px)", textTransform: "uppercase", letterSpacing: "3px", opacity: 0.35 }}>{col.label}</div>
            <span style={{ fontSize: "clamp(28px, 7.4vw, 80px)" }}>{col.data?.emoji ?? col.emoji}</span>
            <span style={{ fontSize: "clamp(11px, 2.59vw, 28px)", fontWeight: 600, textAlign: "center", lineHeight: 1.3, color: col.isRight ? accent : "inherit" }}>{col.data?.text}</span>
          </div>
        ))}
      </div>
    </MemeBase>
  );
}

function ReactionMeme({ meme }: { meme: MemeSlideData }) {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const [headline, reaction] = meme.panels;
  return (
    <MemeBase tone={meme.tone} topicLine={meme.topicLine}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "9.3% 7.4% 7.4%", gap: "5.2%", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(11px, 2.59vw, 28px)", fontWeight: 500, lineHeight: 1.4, opacity: 0.6, maxWidth: "74%" }}>{headline?.text}</div>
        <span style={{ fontSize: "clamp(40px, 11.1vw, 120px)" }}>{reaction?.emoji ?? "💀"}</span>
        <div style={{ fontSize: "clamp(14px, 3.52vw, 38px)", fontWeight: 700, color: accent, lineHeight: 1.25, maxWidth: "65%" }}>{reaction?.text}</div>
      </div>
    </MemeBase>
  );
}

// ── Meme dispatcher ──────────────────────────────────────────────────────────

function MemeSlide({ meme }: { meme: MemeSlideData }) {
  if (!meme?.template) return null;
  const renderers: Record<string, React.FC<{ meme: MemeSlideData }>> = {
    drake: DrakeMeme, "expanding-brain": ExpandingBrainMeme, nobody: NobodyMeme,
    "starter-pack": StarterPackMeme, "two-buttons": TwoButtonsMeme, "tell-me": TellMeMeme,
    distracted: DistractedMeme, comparison: ComparisonMeme, reaction: ReactionMeme,
  };
  const Renderer = renderers[meme.template] ?? ReactionMeme;
  return <Renderer meme={meme} />;
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
  memeSlide?: MemeSlideData | null;
  caption?: string | null;
}

export function IGPostPreview({ igType, slides, memeSlide, caption }: IGPostPreviewProps) {
  const totalSlides = slides.length + (memeSlide ? 1 : 0);
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(totalSlides - 1, c + 1));

  const isContentSlide = current < slides.length;

  // Nothing to render — show placeholder
  if (totalSlides === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-400 dark:bg-stone-800">
        No slides yet
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-lg">
        {isContentSlide ? (
          <SlidePreview slide={slides[current]!} igType={igType} slideIndex={current} totalSlides={totalSlides} />
        ) : memeSlide ? (
          <MemeSlide meme={memeSlide} />
        ) : null}
        {totalSlides > 1 && (
          <>
            {current > 0 && (
              <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 transition hover:bg-black/70 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {current < totalSlides - 1 && (
              <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 transition hover:bg-black/70 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
      {totalSlides > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: totalSlides }, (_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-stone-700 dark:bg-white" : "w-1.5 bg-stone-300 dark:bg-stone-600"}`} />
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
