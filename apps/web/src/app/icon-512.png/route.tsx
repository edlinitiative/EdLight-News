import { ImageResponse } from "next/og";

export const runtime = "edge";

// Square 512x512 PNG version of the favicon artwork, suitable for use as a
// social profile picture (Facebook, Instagram, LinkedIn, etc.) which require
// raster (PNG/JPG) square images of at least 320x320.
//
// Source artwork is the same as /apps/web/src/app/icon.svg.
const SIZE = 512;

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
          background: "#1e3a8a",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FAVICON_DATA_URL} width={SIZE} height={SIZE} alt="" />
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    },
  );
}
