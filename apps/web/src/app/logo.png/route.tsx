import { ImageResponse } from "next/og";

export const runtime = "edge";

// Per Google's publisher logo guidelines:
//   https://developers.google.com/search/docs/appearance/structured-data/article#logo-guidelines
// - Raster image (PNG/JPG/WebP), not SVG
// - Must fit in a 600 (w) x 60 (h) pixel rectangle
const WIDTH = 600;
const HEIGHT = 60;

// Same artwork as /apps/web/src/app/icon.svg (the favicon), inlined so we can
// embed it as a data URI inside the rasterized logo.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <clipPath id="bg"><rect width="32" height="32" rx="7"/></clipPath>
    <radialGradient id="glow" cx="0.2" cy="0.85" r="0.9">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#1e3a8a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="#1e3a8a"/>
  <rect width="32" height="32" rx="7" fill="url(#glow)"/>
  <g clip-path="url(#bg)">
    <circle cx="6" cy="26" r="24" fill="none" stroke="#93c5fd" stroke-width="2.8" stroke-opacity="0.45"
            stroke-dasharray="37.7 150" stroke-linecap="round"/>
    <circle cx="6" cy="26" r="17" fill="none" stroke="#bfdbfe" stroke-width="2.8" stroke-opacity="0.7"
            stroke-dasharray="26.7 150" stroke-linecap="round"/>
    <circle cx="6" cy="26" r="10" fill="none" stroke="#ffffff" stroke-width="2.8"
            stroke-dasharray="15.7 150" stroke-linecap="round"/>
    <circle cx="6" cy="26" r="3.2" fill="#f97316"/>
    <circle cx="6" cy="26" r="1.6" fill="#fde68a"/>
  </g>
</svg>`;

const FAVICON_DATA_URL =
  "data:image/svg+xml;base64," +
  Buffer.from(FAVICON_SVG).toString("base64");

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          fontFamily: "serif",
          gap: 14,
          padding: "0 16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FAVICON_DATA_URL} width={48} height={48} alt="" />
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: "#1c1917",
              letterSpacing: "-1px",
              lineHeight: 1,
            }}
          >
            EdLight
          </span>
          <span
            style={{
              fontSize: 38,
              fontWeight: 300,
              color: "#2563eb",
              letterSpacing: "-1px",
              lineHeight: 1,
              marginLeft: 6,
            }}
          >
            News
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    },
  );
}
