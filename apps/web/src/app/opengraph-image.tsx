import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EdLight News — Actualités éducatives pour étudiants haïtiens";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)",
          fontFamily: "serif",
        }}
      >
        {/* Top rule */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 80,
            right: 80,
            height: 3,
            background: "#2563eb",
          }}
        />

        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-1px",
            }}
          >
            EdLight
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 300,
              color: "#2563eb",
              letterSpacing: "-1px",
            }}
          >
            News
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 24,
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#a8a29e",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Actualités éducatives
          </span>
          <span
            style={{
              fontSize: 18,
              color: "#78716c",
              letterSpacing: "2px",
            }}
          >
            Bourses · Opportunités · Carrières · Haïti
          </span>
        </div>

        {/* Bottom rule */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 80,
            right: 80,
            height: 1,
            background: "#44403c",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: 52,
            right: 80,
            fontSize: 14,
            color: "#57534e",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          EdLight News
        </span>
      </div>
    ),
    { ...size },
  );
}
