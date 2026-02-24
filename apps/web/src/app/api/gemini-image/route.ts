import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ── Simple in-memory cache (survives across requests in a long-running server) ─
const imageCache = new Map<string, { data: string; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const { prompt, theme } = (await req.json()) as {
      prompt?: string;
      theme?: string;
    };

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // Check cache
    const cacheKey = `${prompt}::${theme ?? "light"}`;
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ image: cached.data });
    }

    // Build the full prompt — instruct for premium edu-tech visuals
    const fullPrompt = [
      `Generate a photorealistic, ultra-premium hero image.`,
      prompt,
      `Style: cinematic, editorial-quality, shallow depth of field, natural lighting, 16:9 aspect ratio.`,
      theme === "dark"
        ? "Moody lighting with rich deep blues and navy tones, subtle warm highlights."
        : "Bright natural daylight, soft warm tones with airy atmosphere.",
      `This is for a premium education technology platform. The image must look like a high-end stock photo. Only include text if explicitly requested in the prompt, otherwise no text at all.`,
    ].join(" ");

    // Try Gemini 2.0 Flash with image generation
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Gemini] API error:", res.status, errText);
      return NextResponse.json({ error: "Gemini API error" }, { status: 502 });
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData,
    );

    if (imagePart?.inlineData) {
      const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      imageCache.set(cacheKey, { data: dataUrl, ts: Date.now() });
      return NextResponse.json({ image: dataUrl });
    }

    // No image in response — return graceful fallback signal
    return NextResponse.json({ error: "No image generated" }, { status: 204 });
  } catch (err) {
    console.error("[Gemini] Image generation failed:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
