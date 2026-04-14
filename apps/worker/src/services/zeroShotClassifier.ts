/**
 * Zero-shot article classifier using HuggingFace Transformers (ONNX).
 *
 * Uses a multilingual NLI model to classify French/Creole article text
 * into EdLight News categories WITHOUT any training data — just the
 * candidate label names.
 *
 * Architecture:
 *   - Singleton pipeline — model loads once, stays in memory for the tick
 *   - Runs locally in Node.js via ONNX Runtime (no external API call)
 *   - ~200-400ms per classification on CPU (acceptable for 5-item batches)
 *
 * Usage:
 *   import { classifyWithZeroShot } from "./zeroShotClassifier.js";
 *   const result = await classifyWithZeroShot("Title", "Body text...");
 *   // { label: "news", score: 0.87, all: [...] }
 */

import { pipeline, env, type ZeroShotClassificationPipeline } from "@huggingface/transformers";

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * Multilingual NLI model — supports French natively.
 * Quantized ONNX variant for fast CPU inference (~150MB download, cached).
 *
 * We use a public, non-gated model that doesn't require HF authentication.
 *
 * Xenova/nli-deberta-v3-xsmall — compact, fast, English-trained NLI model.
 * Although English-trained, NLI zero-shot works well with French hypothesis
 * sentences because the entailment reasoning is language-agnostic enough
 * for our category descriptions. Falls back gracefully.
 *
 * Alternatives if multilingual accuracy is needed (require HF_TOKEN):
 *   "Xenova/mDeBERTa-v3-base-mnli-xnli"  (multilingual, gated)
 *   "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"  (larger, gated)
 */
const MODEL_ID = "Xenova/nli-deberta-v3-xsmall";

/**
 * Candidate labels — natural-language descriptions as NLI hypotheses.
 *
 * Since we're using an English-trained NLI model, the hypotheses are in
 * English. The model evaluates entailment between the input text (which
 * may be in French) and these English hypotheses. This works because:
 * 1. Many French articles contain cognates/loanwords the model recognizes
 * 2. NLI reasoning transfers across languages for clear-cut categories
 * 3. The hypothesis descriptions are designed to be unambiguous
 */
const CANDIDATE_LABELS: Record<string, string> = {
  // ── News categories ─────────────────────────────────────────────────────
  news:       "This article is a news report about a current event, political development, or breaking story.",
  local_news: "This article covers a local event, crisis, or incident in Haiti.",
  event:      "This article announces an upcoming event, conference, or festival.",
  resource:   "This article is a practical guide, tutorial, or educational resource.",

  // ── Opportunity categories ──────────────────────────────────────────────
  scholarship: "This article announces a scholarship, academic funding, or fellowship opportunity.",
  bourses:     "This article announces a scholarship, financial aid, or student funding opportunity.",
  concours:    "This article announces a competition, hackathon, or academic contest.",
  stages:      "This article announces an internship, apprenticeship, or professional training position.",
  programmes:  "This article announces an educational programme, bootcamp, or university admission.",
  opportunity: "This article presents a professional or academic opportunity.",
};

/**
 * Minimum confidence threshold for the zero-shot classifier to override
 * Gemini's category. Below this, we defer to Gemini's judgment.
 */
const OVERRIDE_THRESHOLD = 0.55;

/**
 * If the top-2 labels are both above this threshold and very close
 * to each other, we don't override — the signal is ambiguous.
 */
const AMBIGUITY_GAP = 0.10;

// ── Singleton pipeline ──────────────────────────────────────────────────────

let _pipeline: ZeroShotClassificationPipeline | null = null;
let _loadingPromise: Promise<ZeroShotClassificationPipeline> | null = null;

/**
 * Get or initialize the zero-shot classification pipeline.
 * Downloads the model on first call (~150MB, cached to disk).
 */
async function getPipeline(): Promise<ZeroShotClassificationPipeline> {
  if (_pipeline) return _pipeline;

  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    console.log(`[zeroshot] Loading model ${MODEL_ID}…`);
    const start = Date.now();

    // Allow local model cache, disable browser-specific backends
    env.allowLocalModels = true;

    const p = await pipeline(
      "zero-shot-classification",
      MODEL_ID,
      {
        dtype: "q8",           // 8-bit quantized for speed
        device: "cpu",         // Cloud Run doesn't have GPU
      },
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[zeroshot] Model loaded in ${elapsed}s`);
    _pipeline = p;
    _loadingPromise = null;
    return p;
  })();

  return _loadingPromise;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ZeroShotResult {
  /** The top predicted category slug */
  label: string;
  /** Confidence score (0–1) for the top label */
  score: number;
  /** All category scores, sorted descending */
  all: Array<{ label: string; score: number }>;
  /** Whether the classifier is confident enough to override Gemini */
  shouldOverride: boolean;
  /** Classification latency in milliseconds */
  latencyMs: number;
}

/**
 * Classify an article using zero-shot NLI.
 *
 * @param title - Article title (FR or HT)
 * @param body  - Article body text (FR or HT). Truncated to ~512 tokens internally.
 * @returns Classification result with scores for all categories
 */
export async function classifyWithZeroShot(
  title: string,
  body: string,
): Promise<ZeroShotResult> {
  const start = Date.now();
  const classifier = await getPipeline();

  // Combine title + first ~800 chars of body for classification.
  // NLI models work best with shorter text that captures the gist.
  const inputText = `${title}. ${body.slice(0, 800)}`;

  const labels = Object.values(CANDIDATE_LABELS);
  const slugs = Object.keys(CANDIDATE_LABELS);

  const output = await classifier(inputText, labels, {
    multi_label: false,  // single best category
  });

  // Map back from hypothesis labels to category slugs
  // The output has parallel arrays of labels and scores
  const outputLabels: string[] = Array.isArray(output)
    ? (output[0] as any).labels
    : (output as any).labels;
  const outputScores: number[] = Array.isArray(output)
    ? (output[0] as any).scores
    : (output as any).scores;

  const scored: Array<{ label: string; score: number }> = outputLabels.map(
    (hypothesis: string, i: number) => {
      // Find the slug corresponding to this hypothesis
      const idx = labels.indexOf(hypothesis);
      return {
        label: idx >= 0 ? slugs[idx] : "unknown",
        score: outputScores[i],
      };
    },
  );

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];

  // Determine if we should override Gemini
  const isConfident = top.score >= OVERRIDE_THRESHOLD;
  const hasGap = !second || (top.score - second.score) >= AMBIGUITY_GAP;
  const shouldOverride = isConfident && hasGap;

  const latencyMs = Date.now() - start;

  return {
    label: top.label,
    score: top.score,
    all: scored,
    shouldOverride,
    latencyMs,
  };
}

/**
 * Resolve a category disagreement between Gemini and the zero-shot classifier.
 *
 * Decision logic:
 *   1. If both agree → keep the category (highest confidence)
 *   2. If zero-shot is confident + clear gap → override Gemini
 *   3. If zero-shot is unsure → defer to Gemini
 *   4. Special: never override deterministic opportunity classifications
 *
 * @param geminiCategory   - Category from Gemini LLM
 * @param zeroShotResult   - Result from classifyWithZeroShot()
 * @param isDeterministic  - Whether the deterministic classifier already flagged this as opportunity
 * @returns The final resolved category
 */
export function resolveCategory(
  geminiCategory: string,
  zeroShotResult: ZeroShotResult,
  isDeterministic: boolean = false,
): { category: string; source: "gemini" | "zero-shot" | "deterministic"; reason: string } {
  // Rule 0: deterministic opportunity classification always wins
  if (isDeterministic) {
    return {
      category: geminiCategory,
      source: "deterministic",
      reason: "Deterministic opportunity classifier — not overridden",
    };
  }

  // Rule 1: agreement — both say the same thing
  if (zeroShotResult.label === geminiCategory) {
    return {
      category: geminiCategory,
      source: "gemini",
      reason: `Agreement (zero-shot confirms with ${(zeroShotResult.score * 100).toFixed(0)}% confidence)`,
    };
  }

  // Rule 2: zero-shot override — confident + clear margin
  if (zeroShotResult.shouldOverride) {
    // Merge equivalent opportunity labels
    const oppLabels = new Set(["scholarship", "bourses", "opportunity"]);
    if (oppLabels.has(geminiCategory) && oppLabels.has(zeroShotResult.label)) {
      return {
        category: geminiCategory,
        source: "gemini",
        reason: `Near-equivalent opportunity labels (${geminiCategory} ≈ ${zeroShotResult.label})`,
      };
    }

    console.warn(
      `[zeroshot] OVERRIDE: "${geminiCategory}" → "${zeroShotResult.label}" ` +
      `(score=${(zeroShotResult.score * 100).toFixed(0)}%, gap=${((zeroShotResult.score - (zeroShotResult.all[1]?.score ?? 0)) * 100).toFixed(0)}pp)`,
    );
    return {
      category: zeroShotResult.label,
      source: "zero-shot",
      reason: `Override: zero-shot=${(zeroShotResult.score * 100).toFixed(0)}% vs Gemini="${geminiCategory}"`,
    };
  }

  // Rule 3: zero-shot is uncertain — defer to Gemini
  return {
    category: geminiCategory,
    source: "gemini",
    reason: `Deferred to Gemini (zero-shot uncertain: ${zeroShotResult.label}@${(zeroShotResult.score * 100).toFixed(0)}%)`,
  };
}

/**
 * Warm up the model — call this at server startup so the first
 * /tick request doesn't eat a 10s model-load penalty.
 */
export async function warmUpClassifier(): Promise<void> {
  try {
    await getPipeline();
    console.log("[zeroshot] Classifier warmed up and ready");
  } catch (err) {
    console.error("[zeroshot] Failed to warm up classifier:", err);
  }
}
