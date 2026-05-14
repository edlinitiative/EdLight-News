import { SANDRA_VOICE, type SandraVoiceConfig } from "./config.js";

export interface SpeakOptions {
  /** Override Sandra's default voice for this single call (rarely needed). */
  voiceOverride?: Partial<SandraVoiceConfig>;
  /** Optional API key override (falls back to OPENAI_API_KEY). */
  apiKey?: string;
}

/**
 * Synthesize speech using Sandra's configured voice.
 *
 * Returns the raw audio buffer in Sandra's configured format (default mp3).
 * Throws on missing API key or non-2xx response from OpenAI.
 *
 * The implementation uses raw `fetch` (no SDK dependency) to match the
 * house style and keep the package's install footprint at zero deps.
 */
export async function speakAsSandra(
  text: string,
  opts: SpeakOptions = {},
): Promise<Buffer> {
  const cfg: SandraVoiceConfig = { ...SANDRA_VOICE, ...(opts.voiceOverride ?? {}) };
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "speakAsSandra: OPENAI_API_KEY not set. Sandra cannot synthesize.",
    );
  }
  if (!text.trim()) {
    throw new Error("speakAsSandra: empty text input.");
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      voice: cfg.voice,
      input: text,
      speed: cfg.speed,
      response_format: cfg.format,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "<no-body>");
    throw new Error(
      `speakAsSandra: OpenAI TTS failed ${res.status}: ${errBody.slice(0, 200)}`,
    );
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}
