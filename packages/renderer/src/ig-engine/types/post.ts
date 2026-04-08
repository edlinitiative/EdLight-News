/**
 * @edlight-news/renderer – IG Engine types
 *
 * Core data model for the template-based Instagram post rendering engine.
 * Implements the pipeline defined in docs/IG_COPILOT.md.
 *
 * Pipeline:
 *   intake → structure → selectTemplate → validateCopyLimits
 *   → measureText → rewriteCopy → buildSlides → renderSlides
 *   → exportSlides → QA
 */

// ── Template IDs ─────────────────────────────────────────────────────────────

export type TemplateId =
  | "breaking-news-single"
  | "news-carousel"
  | "opportunity-carousel"
  | "explainer-carousel"
  | "quote-stat-card"
  | "weekly-recap-carousel";

// ── Language & Status ─────────────────────────────────────────────────────────

export type PostLanguage = "fr" | "ht" | "en";
export type PostStatus = "draft" | "validated" | "exported" | "failed";

// ── Layout zone types ─────────────────────────────────────────────────────────

/** Maximum character/word constraints for a single text field. */
export interface FieldLimits {
  maxWords?: number;
  minWords?: number;
  maxChars?: number;
  maxLines?: number;
}

/** Rectangular region in canvas coordinates (pixels). */
export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Defines a single named text zone within a template slide. */
export interface TemplateZone {
  box: TextBox;
  /** Default font size in px */
  fontSize: number;
  /** Minimum readable font size — rewrite triggers before shrinking below this */
  minFontSize: number;
  fontFamily: "DM Sans" | "Inter";
  lineHeight: number;
  limits: FieldLimits;
}

/** Full configuration for a named template variant. */
export interface TemplateConfig {
  id: TemplateId;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  safeMargin: { top: number; side: number; bottom: number };
  /** Maximum carousel slides this template supports */
  maxSlides: number;
  zones: {
    categoryLabel: TemplateZone;
    headline: TemplateZone;
    body?: TemplateZone;
    supportLine?: TemplateZone;
    sourceLine: TemplateZone;
    statValue?: TemplateZone;
    statDescription?: TemplateZone;
    deadline?: TemplateZone;
  };
}

// ── Slide content ─────────────────────────────────────────────────────────────

/** Content for a single slide — before validation. */
export interface SlideContent {
  slideNumber: number;
  /** Category pill label override */
  label?: string;
  headline: string;
  body?: string;
  sourceLine?: string;
  supportLine?: string;
  statValue?: string;
  statDescription?: string;
  deadline?: string;
  /** Natural-language visual direction for image selection */
  visualDirection?: string;
  /** Background image URL */
  imageUrl?: string;
  /** Renderer layout hint */
  layoutVariant?: "cover" | "detail" | "data" | "cta";
}

// ── Fit & validation ──────────────────────────────────────────────────────────

/** Result of measuring a single text field against its layout box. */
export interface FitResult {
  field: string;
  fits: boolean;
  linesUsed: number;
  maxLines: number;
  overflowPx: number;
  recommendedAdjustment?: string;
}

/** Result of validating all text fields across a slide set. */
export interface ValidationResult {
  passed: boolean;
  fitResults: FitResult[];
  rewriteCount: number;
  warnings: string[];
}

/** Per-slide fit metadata attached after the validation pass. */
export interface SlideValidationMeta {
  fitPassed: boolean;
  rewriteCount: number;
  measuredLineCount: Record<string, number>;
  overflowRisk: boolean;
  fontSizeUsed: Record<string, number>;
}

/** Slide that has been validated and is ready to render. */
export interface ValidatedSlide extends SlideContent {
  validation: SlideValidationMeta;
}

// ── Caption ───────────────────────────────────────────────────────────────────

/** Structured caption output — always separate from slide copy. */
export interface PostCaption {
  text: string;
  hashtags: string[];
  cta?: string;
}

// ── Intake ────────────────────────────────────────────────────────────────────

/** Raw content handed to the engine before any processing. */
export interface ContentIntakeInput {
  contentTypeHint?: TemplateId;
  topic: string;
  sourceSummary: string;
  keyFacts?: string[];
  category: string;
  date?: string;
  preferredLanguage: PostLanguage;
  ctaType?: string;
  deadline?: string;
  urgencyLevel?: "breaking" | "high" | "normal" | "low";
  headlineOptions?: string[];
  subheadline?: string;
  sourceNote?: string;
}

// ── Post ──────────────────────────────────────────────────────────────────────

/** Fully built and validated IG engine post. */
export interface IGEnginePost {
  id: string;
  contentType: string;
  category: string;
  topic: string;
  language: PostLanguage;
  templateId: TemplateId;
  slides: ValidatedSlide[];
  caption: PostCaption;
  hashtags: string[];
  sourceNote?: string;
  cta?: string;
  status: PostStatus;
  createdAt: string;
}

// ── Export ────────────────────────────────────────────────────────────────────

/** Result of the export phase. */
export interface ExportResult {
  postId: string;
  templateId: TemplateId;
  date: string;
  slideFiles: string[];
  captionFile: string;
  metadataFile: string;
  previewFile?: string;
  success: boolean;
  errors: string[];
}

// ── Measurement input/output ──────────────────────────────────────────────────

/** Input to the text measurement engine for a single field. */
export interface MeasureTextInput {
  text: string;
  fontSize: number;
  fontFamily: string;
  boxWidth: number;
  boxHeight: number;
  lineHeight: number;
  lineClamp?: number;
}

/** Output from the text measurement engine. */
export interface MeasureTextResult {
  fits: boolean;
  linesUsed: number;
  maxLines: number;
  overflowPx: number;
}
