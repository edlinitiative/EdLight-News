# Copilot prompt — port + extend the EdLight News renderer

> **How to use this prompt**
> 1. In the new platform's repo, create a folder `docs/` and save this whole file as `docs/RENDERER_PORT_PROMPT.md`.
> 2. Open VS Code → GitHub Copilot Chat → switch to **Agent mode** with a strong model (Claude Sonnet/Opus or GPT-4-class).
> 3. Attach this file (or paste it) and send: *"Execute this plan end-to-end. Stop only to ask if a decision is irreversible."*
> 4. Also give Copilot access to the EdLight-News source. Easiest way:
>    ```bash
>    git clone --depth=1 https://github.com/edlinitiative/EdLight-News /tmp/edlight-source
>    ```
>    Then tell Copilot: "The reference source is at `/tmp/edlight-source/packages/renderer` and `/tmp/edlight-source/packages/types/src`."

---

## 0. Context for Copilot

You are porting a Playwright-based social-media post renderer from the EdLight-News monorepo into **THIS** repo (a different news platform), and **extending** it from Instagram-only to a multi-platform renderer.

**Source of truth:** `<ABSOLUTE_PATH_TO_EDLIGHT_NEWS>/packages/renderer/` and `<ABSOLUTE_PATH_TO_EDLIGHT_NEWS>/packages/types/src/` (the IG-related types: `IGSlide`, `IGFormattedPayload`, `IGQueueItem`, `IGPostType`, `IGStorySlide`, `IGStoryPayload`, `IGStoryQueueItem`, `IGMemeSlide`, `IGMemePanel`, `IGMemeTemplate`).

**Target platform name:** `<NEW_BRAND_NAME>` (ask the user once at the start; e.g. `friend-news`). Use it for the npm scope `@<NEW_BRAND_SCOPE>/...` and for brand strings.

**Tech baseline (must match):**
- pnpm workspaces + Turborepo
- TypeScript 5.x, ESM (`"type": "module"`, NodeNext resolution)
- `playwright-core` only (not full `playwright`); Chromium binary supplied at runtime via `PLAYWRIGHT_CHROMIUM_PATH` env var or system `/usr/bin/chromium*`
- Node ≥ 20

---

## 1. High-level goals

1. **Reproduce** the IG Engine renderer architecture exactly (templates → pipeline → export), but renamed and rebrandable.
2. **Generalize** the canvas system so the same template DSL can render to multiple social platforms by swapping a `PlatformSpec` (canvas size, safe margins, file naming, caption rules).
3. **Add platform adapters** for: Instagram (feed 1080×1350, story 1080×1920, reel cover 1080×1920), Facebook (feed 1200×1500 + link 1200×630), X/Twitter (1600×900 single + 1080×1350 portrait), WhatsApp (status 1080×1920, sticker 512×512 transparent WebP), TikTok (1080×1920), LinkedIn (1200×1500 + 1200×627), Threads (1080×1350), YouTube Shorts cover (1080×1920).
4. **Stay headless-Chromium based.** No Canvas/SVG handcrafted libs. Each template is a function `(slide, brand, platform) => HTML+CSS string`.
5. **Brand is data, not code.** A consumer changes one `brand.config.ts` file (colors, wordmark, fonts, IG handle, FB page, X handle, WhatsApp number, footer text) and gets a fully re-skinned renderer.

---

## 2. Steps Copilot must perform (in order)

### Step 1 — Bootstrap workspace (skip whatever already exists)

- Ensure `pnpm-workspace.yaml` lists `packages/*` and `apps/*`.
- Ensure root `package.json` has `"packageManager": "pnpm@<latest>"` and a `turbo.json` with `build`, `typecheck`, `test` pipelines.
- Ensure root `tsconfig.base.json` with `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"strict": true`, `"declaration": true`, `"declarationMap": true`, `"sourceMap": true`.

### Step 2 — Create `packages/types`

- Copy ONLY the IG-related types from `<ABSOLUTE_PATH_TO_EDLIGHT_NEWS>/packages/types/src/` listed in §0.
- Generalize them: rename the `IG*` prefix to `Social*` where the type is platform-agnostic (e.g. `IGSlide` → `SocialSlide`, `IGFormattedPayload` → `SocialFormattedPayload`). Keep IG-specific fields (`igHandle`, `caption`) but move them under a `platforms.instagram` sub-object so other platforms can add their own.
- Add a new union:
  ```ts
  export type PlatformId =
    | "instagram-feed" | "instagram-story" | "instagram-reel-cover"
    | "facebook-feed" | "facebook-link"
    | "x-landscape" | "x-portrait"
    | "whatsapp-status" | "whatsapp-sticker"
    | "tiktok"
    | "linkedin-feed" | "linkedin-link"
    | "threads"
    | "youtube-short-cover";
  ```
- Export from `packages/types/src/index.ts`.
- `package.json` name: `@<NEW_BRAND_SCOPE>/types`.

### Step 3 — Create `packages/renderer`

Mirror this structure (file-for-file from the source, but renamed + generalized):

```
packages/renderer/
├── package.json              # name: @<NEW_BRAND_SCOPE>/renderer, deps: playwright-core, @<scope>/types
├── tsconfig.json
└── src/
    ├── index.ts                          # public API barrel
    ├── browser.ts                        # extracted getBrowser() with PLAYWRIGHT_CHROMIUM_PATH probing
    ├── platforms/                        # NEW — platform specs (replaces hardcoded 1080×1350)
    │   ├── index.ts
    │   ├── types.ts                      # PlatformSpec interface
    │   ├── instagram.ts                  # feed/story/reel-cover specs
    │   ├── facebook.ts
    │   ├── x.ts
    │   ├── whatsapp.ts
    │   ├── tiktok.ts
    │   ├── linkedin.ts
    │   ├── threads.ts
    │   └── youtube.ts
    └── engine/                           # ports ig-engine/ but platform-agnostic
        ├── index.ts
        ├── config/
        │   ├── brand.ts                  # BRAND object — only file consumers usually edit
        │   ├── fonts.ts                  # SupportedFontFamily, FONTS, GOOGLE_FONTS_URL, getFontCoefficients
        │   └── templateLimits.ts         # font sizes, clamps, zones — derived from PlatformSpec
        ├── types/
        │   └── post.ts                   # EnginePost, SlideContent, ValidatedSlide, TemplateConfig, FitResult, ...
        ├── templates/
        │   ├── index.ts
        │   ├── BreakingNewsTemplate.ts
        │   ├── NewsCarouselTemplate.ts
        │   ├── OpportunityTemplate.ts
        │   ├── ExplainerTemplate.ts
        │   ├── QuoteStatTemplate.ts
        │   ├── WeeklyRecapTemplate.ts
        │   └── DataCardTemplate.ts       # was TauxCarouselTemplate; rename to a generic "data card"
        ├── engine/
        │   ├── selectTemplate.ts
        │   ├── validateCopyLimits.ts
        │   ├── measureText.ts
        │   ├── rewriteCopy.ts
        │   ├── buildSlides.ts
        │   ├── renderSlides.ts           # accepts platform: PlatformId
        │   ├── exportSlides.ts           # filenames & metadata per platform
        │   ├── adaptLegacyPayload.ts
        │   └── renderWithEngine.ts       # was renderWithIgEngine.ts
        ├── adapters/                     # NEW — per-platform post processing
        │   ├── instagram.ts              # caption + first-comment hashtags
        │   ├── facebook.ts               # link card OG image variant
        │   ├── x.ts                      # 280-char tweet, thread splitter
        │   ├── whatsapp.ts               # status caption (no hashtags), sticker WebP export
        │   ├── tiktok.ts                 # cover + first-frame
        │   ├── linkedin.ts               # 3000-char post body
        │   ├── threads.ts                # 500-char chunks
        │   └── youtube.ts                # short cover + title/description
        └── qa/
            └── generatePreviewSheet.ts   # 1920×1080 contact sheet across ALL platforms in one PNG
```

### Step 4 — `PlatformSpec` design (this is the key generalization)

Create `packages/renderer/src/platforms/types.ts` with:

```ts
export interface PlatformSpec {
  id: PlatformId;
  label: string;                       // "Instagram Feed (4:5)"
  canvas: { width: number; height: number };
  aspect: string;                      // "4:5", "9:16", "16:9", "1:1", "1.91:1"
  safeArea: { top: number; right: number; bottom: number; left: number };
  background: "solid" | "transparent"; // WhatsApp sticker = transparent
  exportFormat: "png" | "webp" | "jpeg";
  exportQuality?: number;              // for jpeg/webp
  caption: {
    maxChars: number;                  // 2200 IG, 63206 FB, 280 X, 700 WA, 3000 LI, 500 Threads
    allowHashtags: boolean;
    allowEmoji: boolean;
    splitIntoThread?: boolean;         // X
  };
  carousel: { min: number; max: number } | null; // null = single image only
  fileNamePrefix: string;              // "ig-feed", "fb-link", ...
}
```

Each template's HTML must be parameterized by `PlatformSpec` instead of hardcoded `1080×1350`. Replace every literal `1080`, `1350`, `90`, `120`, `100` in `templateLimits.ts` and template HTML with values derived from `spec.canvas` and `spec.safeArea`.

### Step 5 — Brand abstraction

Port `ig-engine/config/brand.ts` with these changes:

- `BRAND` becomes the **default** export, but everything reads it via `getBrand()` so consumers can `setBrand(partial)` at runtime.
- Add fields: `socials.instagram`, `socials.facebook`, `socials.x`, `socials.threads`, `socials.tiktok`, `socials.linkedin`, `socials.youtube`, `socials.whatsappNumber`, `website`.
- Footer bar HTML (`footerBarHtml`) accepts a `PlatformSpec` and renders the correct handle (e.g. show `@handle` on IG, `fb.com/page` on FB, website only on WhatsApp sticker).

### Step 6 — Render pipeline

Port these functions 1:1, but every public function gains a `platform: PlatformId` parameter:

- `selectTemplate(intake, platform)` — some templates only apply to certain platforms (e.g. carousel templates are skipped for X-landscape).
- `validateAllSlides(slides, templateId, platform)`
- `measureSlide(slide, templateId, platform)`
- `rewriteSlideCopy(slide, templateId, platform)` — uses platform caption limits.
- `buildPost({ intake, rawSlides, caption, platform })` → `{ post, overflowWarnings }`
- `renderPost(post, contentType, platform)` → `RenderedSlide[]` (PNG/WebP buffers at platform canvas size)
- `exportPost(post, rendered, { outputDir, platform })` writes:
  - `<prefix>-slide-01.<ext>`, …
  - `caption.txt` (formatted per platform adapter)
  - `meta.json` (post + platform + brand snapshot)

### Step 7 — Multi-platform convenience API

Add to `packages/renderer/src/index.ts`:

```ts
export async function renderForAllPlatforms(
  intake: ContentIntakeInput,
  options: { platforms: PlatformId[]; outputDir: string }
): Promise<Record<PlatformId, ExportResult>>;
```

It loops over `options.platforms`, calls `buildPost → renderPost → exportPost` per platform (sharing the single Chromium instance from `browser.ts`), and returns a map. WhatsApp sticker output must be transparent WebP ≤ 100 KB (use `quality: 80` and crop to 512×512 — fail loudly if size exceeds).

### Step 8 — Tests

Port the existing tests and add:

- `platforms/*.test.ts` — assert each `PlatformSpec` is internally consistent (canvas matches aspect, safe area fits inside canvas).
- `engine/renderSlides.test.ts` — render one of each template for `["instagram-feed", "facebook-feed", "x-portrait", "whatsapp-status"]` and assert PNG dimensions match spec.
- All tests use Node's built-in `node --test` runner (matches source repo's pattern).

### Step 9 — Docs

Create `packages/renderer/README.md` covering: install, env vars (`PLAYWRIGHT_CHROMIUM_PATH`), brand customization, adding a new platform spec ("create a `PlatformSpec`, add it to the union, optionally write an adapter"), adding a new template.

### Step 10 — Sanity check

Run, in order:

```bash
pnpm install
pnpm --filter @<scope>/types build
pnpm --filter @<scope>/renderer build
pnpm --filter @<scope>/renderer test
```

Then run a smoke script `packages/renderer/src/scripts/smoke.ts` that renders one demo post for every `PlatformId` into `./out/` and prints the resulting file paths.

---

## 3. Things Copilot must NOT do

- Do **not** copy the legacy renderers (`ig-carousel.ts`, `ig-story.ts`, `ig-meme.ts`, or the gradient/screenshot helpers in the old `index.ts`) unless the user explicitly asks. The IG Engine in `ig-engine/` supersedes them.
- Do **not** import from `@edlight-news/*`. Rewrite every import to `@<NEW_BRAND_SCOPE>/*`.
- Do **not** hardcode `1080`, `1350`, brand colors, the EdLight wordmark, French category labels (`Bourse`, `Opportunité`, …), or the `@edlightnews` IG handle anywhere. All of these come from `BRAND` or `PlatformSpec`.
- Do **not** add `playwright` (full); only `playwright-core`.
- Do **not** depend on any other package from the EdLight-News monorepo (no `@edlight-news/firebase`, `generator`, `publisher`, `scraper`, etc.). The renderer must be standalone.

---

## 4. Acceptance criteria

When done, the user must be able to:

```ts
import {
  buildPost,
  renderForAllPlatforms,
  setBrand,
} from "@<scope>/renderer";

setBrand({
  name: "Friend News",
  wordmark: { left: "FRIEND", right: "NEWS" },
  socials: { instagram: "@friendnews", whatsappNumber: "+509...", x: "@friendnews" },
  colors: { primary: "#0ea5e9", /* ... */ },
});

const result = await renderForAllPlatforms(
  { headline: "...", body: "...", category: "news", source: "AP" },
  {
    platforms: [
      "instagram-feed", "instagram-story",
      "facebook-feed", "facebook-link",
      "x-portrait", "x-landscape",
      "whatsapp-status", "whatsapp-sticker",
      "tiktok", "linkedin-feed", "threads", "youtube-short-cover",
    ],
    outputDir: "./out",
  },
);
```

…and get one folder per platform with correctly sized images, a `caption.txt` formatted per platform, and a `meta.json`. The QA preview sheet shows all of them on one 1920×1080 PNG.

---

## 5. Ask the user once, up front

Before writing code, ask:

1. **Brand scope name?** (e.g. `friend-news` → `@friend-news/renderer`)
2. **Brand display name + wordmark split?** (e.g. "Friend News" → `FRIEND` / `NEWS`)
3. **Primary brand color (hex) and dark background (hex)?**
4. **Social handles** for IG / FB / X / Threads / TikTok / LinkedIn / YouTube + WhatsApp number + website URL.
5. **Default language** (for caption defaults and category labels).
6. **Absolute path** to a local clone of the EdLight-News repo (so you can read the source files).

Then proceed through Steps 1–10 without further confirmation unless something is destructive (overwriting an existing `packages/renderer`).

---

### Tip for the user

If you don't want to keep a long-term clone of EdLight-News, do this first in a throwaway folder so Copilot can read the source:

```bash
git clone --depth=1 https://github.com/edlinitiative/EdLight-News /tmp/edlight-source
```

…and answer question 6 with `/tmp/edlight-source`.
