import { ImageResponse } from "next/og";

export const runtime = "edge";

// Per Google's publisher logo guidelines:
//   https://developers.google.com/search/docs/appearance/structured-data/article#logo-guidelines
// - Raster image (PNG/JPG/WebP), not SVG
// - Width ≤ 600 px and height ≤ 60 px
// - Should "fit in a 60×600 pixel rectangle"
const WIDTH = 600;
const HEIGHT = 60;

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
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontSize: 40,
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
              fontSize: 40,
              fontWeight: 300,
              color: "#2563eb",
              letterSpacing: "-1px",
              lineHeight: 1,
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
