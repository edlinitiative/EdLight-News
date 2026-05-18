/**
 * SourceChip — small corner attribution rendered on body scenes (v1.6).
 *
 * Purpose
 * ───────
 * For credibility-sensitive content (scholarships, opportunities, news)
 * the viewer needs to see WHERE the information came from. Before v1.6,
 * the source domain only appeared once in the spoken voiceover (~0.5s)
 * and never on-screen — there was no visual trust signal.
 *
 *   ┌─────────────────┐
 *   │ 🔗 royal…org   │  ← top-right corner, palette-aware
 *   └─────────────────┘
 *
 * Behaviour
 * ─────────
 * - Hidden when `domain` is empty (graceful degrade).
 * - Position absolute — caller decides corner via `placement`.
 * - Renders on either `light` (paper) or `dark` (primary) backgrounds.
 * - Truncates to 22 chars so it never wraps.
 */

import React from "react";
import { TYPE, getPalette } from "../../brand.js";
import type { ReelTopic } from "../../types.js";

export interface SourceChipProps {
  topic: ReelTopic;
  domain?: string;
  /** Background contrast — picks chip + text colour. */
  surface?: "dark" | "light";
  /** Which corner to anchor to. */
  placement?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

const POS: Record<NonNullable<SourceChipProps["placement"]>, React.CSSProperties> = {
  "top-left":     { top: 36, left: 36 },
  "top-right":    { top: 36, right: 36 },
  "bottom-left":  { bottom: 36, left: 36 },
  "bottom-right": { bottom: 36, right: 36 },
};

export const SourceChip: React.FC<SourceChipProps> = ({
  topic,
  domain,
  surface = "dark",
  placement = "top-right",
}) => {
  if (!domain) return null;
  const palette = getPalette(topic);
  const isDark = surface === "dark";
  // 22-char truncation keeps the chip <= ~280 px so it never collides with
  // a 1080-wide headline.
  const display = domain.length > 22 ? `${domain.slice(0, 21)}…` : domain;
  const bg = isDark ? `${palette.accent}26` : `${palette.ink}14`;
  const border = isDark ? `${palette.accent}40` : `${palette.ink}28`;
  const fg = isDark ? palette.accent : palette.ink;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        ...POS[placement],
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: "blur(6px)",
        fontFamily: TYPE.body,
        fontWeight: TYPE.weights.semibold,
        fontSize: 22,
        color: fg,
        letterSpacing: "0.06em",
        textTransform: "lowercase",
        opacity: 0.92,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {/* Inline link glyph — no external font needed */}
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <path
          d="M10 14a4 4 0 0 1 0-5.66l3-3a4 4 0 0 1 5.66 5.66l-1.5 1.5M14 10a4 4 0 0 1 0 5.66l-3 3a4 4 0 1 1-5.66-5.66l1.5-1.5"
          stroke={fg}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{display}</span>
    </div>
  );
};
