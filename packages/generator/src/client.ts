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

export type LLMProvider = "gemini" | "openai" | "anthropic" | "groq" | "mistral" | "openrouter";

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

/** Ordered fallback chain — tried in this order after the primary provider fails. */
const FALLBACK_CHAIN: LLMProvider[] = ["gemini", "mistral", "groq", "openrouter"];

/** Returns true when the provider's API key is present in the environment. */
function hasApiKey(provider: LLMProvider): boolean {
  switch (provider) {
    case "gemini":     return !!process.env.GEMINI_API_KEY;
    case "openai":     return !!process.env.OPENAI_API_KEY;
    case "anthropic":  return !!process.env.ANTHROPIC_API_KEY;
    case "groq":       return !!process.env.GROQ_API_KEY;
    case "mistral":    return !!process.env.MISTRAL_API_KEY;
    case "openrouter": return !!process.env.OPENROUTER_API_KEY;
    default:           return false;
  }
}

/** Dispatch to a single provider's implementation. */
async function callProvider(provider: LLMProvider, prompt: string, opts?: LLMOptions): Promise<string> {
  switch (provider) {
    case "gemini":     return callGeminiInternal(prompt, opts);
    case "openai":     return callOpenAIInternal(prompt, opts);
    case "anthropic":  return callAnthropicInternal(prompt, opts);
    case "groq":       return callGroqInternal(prompt, opts);
    case "mistral":    return callMistralInternal(prompt, opts);
    case "openrouter": return callOpenRouterInternal(prompt, opts);
    default:           throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Provider-agnostic LLM call with automatic fallback chain.
 *
 * Primary provider: opts.provider → LLM_PROVIDER env var → "gemini".
 * On failure, cascades through FALLBACK_CHAIN (skipping the primary and any
 * provider whose API key is not configured). Throws only when all available
 * providers have been exhausted.
 */
export async function callLLM(prompt: string, opts?: LLMOptions): Promise<string> {
  const primary = resolveProvider(opts);
  // Build chain: primary first, then fallbacks (no duplicates)
  const chain = [primary, ...FALLBACK_CHAIN.filter(p => p !== primary)];
  // Skip providers with no API key — no point attempting them
  const available = chain.filter(hasApiKey);
  if (available.length === 0) {
    throw new Error("No LLM providers have API keys configured. Set at least GEMINI_API_KEY.");
  }

  let lastError: Error | undefined;
  for (const provider of available) {
    try {
      return await callProvider(provider, prompt, opts);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[callLLM] provider=${provider} failed: ${lastError.message} — trying next`);
    }
  }
  throw lastError ?? new Error("All LLM providers failed.");
}

/** Backward-compatible alias — routes through callLLM to benefit from the fallback chain. */
export async function callGemini(prompt: string): Promise<string> {
  return callLLM(prompt);
}

// ── Gemini (default) ───────────────────────────────────────────────────────

async function callGeminiInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({
    // gemini-2.0-flash is DEPRECATED (shutdown 2026-06-01) and Google silently
    // routes it through Pro-tier backends, billing at 20-30× the flash price.
    // gemini-2.5-flash-lite is the cheapest non-deprecated model ($0.10/$0.40 per 1M).
    model: opts?.model ?? "gemini-2.5-flash-lite",
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
    model: opts?.model ?? "llama-3.3-70b-versatile",
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

// ── Mistral AI (pluggable — excellent for French) ──────────────────────────

async function callMistralInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing MISTRAL_API_KEY environment variable.");

  const body: Record<string, unknown> = {
    model: opts?.model ?? "mistral-small-latest",
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxOutputTokens ?? 4096,
  };
  if (opts?.jsonMode !== false) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Mistral API error: ${res.status} ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}

// ── OpenRouter (pluggable — aggregator with free model variants) ───────────

async function callOpenRouterInternal(prompt: string, opts?: LLMOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY environment variable.");

  const body: Record<string, unknown> = {
    // Default to a free model; caller can override via opts.model.
    // Append ":free" to any model slug for the zero-cost variant.
    model: opts?.model ?? "qwen/qwen3.6-plus-preview:free",
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxOutputTokens ?? 4096,
  };
  if (opts?.jsonMode !== false) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://edlight.news",
      "X-Title": "EdLight News",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}
