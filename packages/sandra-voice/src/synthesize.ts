import { SANDRA_VOICE, type SandraVoiceConfig } from "./config.js";

export interface SpeakOptions {
  /** Override Sandra's default voice for this single call (rarely needed). */
  voiceOverride?: Partial<SandraVoiceConfig>;
  /**
   * Optional API key override. Falls back (in order) to:
   *   GOOGLE_TTS_API_KEY → GOOGLE_API_KEY → GOOGLE_VISION_API_KEY
   * The last one is reused because it's the same Google Cloud project /
   * same billing — explicit GOOGLE_TTS_API_KEY is preferred in production
   * for least-privilege.
   */
  apiKey?: string;
}

const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

function resolveApiKey(override?: string): string | undefined {
  return (
    override ??
    process.env.GOOGLE_TTS_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_VISION_API_KEY
  );
}

/**
 * Synthesize speech using Sandra's configured voice via Google Cloud
 * Text-to-Speech REST API.
 *
 * Returns the raw audio buffer (MP3 by default). Throws on missing API
 * key or non-2xx response from Google.
 *
 * Implementation uses raw `fetch` (no SDK dependency) to match house
 * style and keep the package's install footprint at zero deps.
 */
export async function speakAsSandra(
  text: string,
  opts: SpeakOptions = {},
): Promise<Buffer> {
  const cfg: SandraVoiceConfig = { ...SANDRA_VOICE, ...(opts.voiceOverride ?? {}) };
  const apiKey = resolveApiKey(opts.apiKey);
  if (!apiKey) {
    throw new Error(
      "speakAsSandra: no Google TTS API key found. Set GOOGLE_TTS_API_KEY (or GOOGLE_API_KEY).",
    );
  }
  if (!text.trim()) {
    throw new Error("speakAsSandra: empty text input.");
  }

  const url = `${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: cfg.languageCode,
        name: cfg.voice,
      },
      audioConfig: {
        audioEncoding: cfg.audioEncoding,
        speakingRate: cfg.speakingRate,
        pitch: cfg.pitch,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "<no-body>");
    throw new Error(
      `speakAsSandra: Google TTS failed ${res.status}: ${errBody.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) {
    throw new Error("speakAsSandra: Google TTS returned no audioContent.");
  }

  // Google returns base64-encoded audio.
  return Buffer.from(data.audioContent, "base64");
}
