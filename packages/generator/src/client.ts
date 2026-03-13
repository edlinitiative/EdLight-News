import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ── Provider-agnostic LLM interface ────────────────────────────────────────

export type LLMProvider = "gemini" | "openai" | "anthropic" | "groq";

export interface LLMOptions {
  /** Which provider to use. Defaults to LLM_PROVIDER env var, then "gemini". */
  provider?: LLMProvider;
  /** Model name override (e.g. "gpt-4o-mini", "claude-3-haiku"). */
  model?: string;
  /** Temperature override (0-1). Defaults to 0.3. */
  temperature?: number;
  /** Max output tokens. Defaults to 4096. */
  maxOutputTokens?: number;
  /** Whether to request JSON output. Defaults to true. */
  jsonMode?: boolean;
}

function resolveProvider(opts?: LLMOptions): LLMProvider {
  return opts?.provider ?? (process.env.LLM_PROVIDER as LLMProvider) ?? "gemini";
}

/**
 * Provider-agnostic LLM call. Defaults to Gemini, but supports plugging
 * in other providers via LLM_PROVIDER env var or explicit option.
 * This abstraction lets you swap to free-tier LLMs for specific tasks
 * (e.g. the reviewer pass) without changing call sites.
 */
export async function callLLM(prompt: string, opts?: LLMOptions): Promise<string> {
  const provider = resolveProvider(opts);

  switch (provider) {
    case "gemini":
      return callGeminiInternal(prompt, opts);
    case "openai":
      return callOpenAIInternal(prompt, opts);
    case "anthropic":
      return callAnthropicInternal(prompt, opts);
    case "groq":
      return callGroqInternal(prompt, opts);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/** Backward-compatible alias — calls Gemini specifically. */
export async function callGemini(prompt: string): Promise<string> {
  return callGeminiInternal(prompt);
}

// ── Gemini (default) ───────────────────────────────────────────────────────

async function callGeminiInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({
    model: opts?.model ?? "gemini-2.0-flash",
    generationConfig: {
      temperature: opts?.temperature ?? 0.3,
      maxOutputTokens: opts?.maxOutputTokens ?? 4096,
      ...(opts?.jsonMode !== false ? { responseMimeType: "application/json" } : {}),
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

// ── OpenAI (pluggable) ─────────────────────────────────────────────────────

async function callOpenAIInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY environment variable.");

  const body: Record<string, unknown> = {
    model: opts?.model ?? "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxOutputTokens ?? 4096,
  };
  if (opts?.jsonMode !== false) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}

// ── Anthropic (pluggable) ──────────────────────────────────────────────────

async function callAnthropicInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY environment variable.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts?.model ?? "claude-3-haiku-20240307",
      max_tokens: opts?.maxOutputTokens ?? 4096,
      temperature: opts?.temperature ?? 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const json = await res.json() as { content: { text: string }[] };
  return json.content[0]?.text ?? "";
}

// ── Groq (pluggable) ──────────────────────────────────────────────────────

async function callGroqInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable.");

  const body: Record<string, unknown> = {
    model: opts?.model ?? "llama-3.1-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxOutputTokens ?? 4096,
  };
  if (opts?.jsonMode !== false) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}
