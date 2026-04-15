# Design System: High-End Editorial & The Digital Curator
 
## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Curator."** 
 
Moving away from the cluttered, "tabloid-style" layout of traditional news sites, this system treats information as a premium asset. It prioritizes clarity, intellectual breathing room, and a sophisticated hierarchy. We break the "template" look by utilizing **intentional asymmetry** and **tonal layering**. The goal is a digital experience that feels like reading a high-end financial journal or an exclusive luxury lookbook—where the "silence" of whitespace is as communicative as the text itself.
 
## 2. Colors & Tonal Depth
 
Our palette moves beyond simple black and white. It utilizes a sophisticated range of "warmed" neutrals and deep intellectual blues to create an environment that feels established and authoritative.
 
### The Color Tokens
*   **Primary Architecture:** `primary` (#3525cd) and `primary_container` (#4f46e5). Use these for key brand moments and navigational anchors.
*   **The Accents:** `secondary` (#0051d5) provides a corporate reliability, while the `tertiary` (#474948) series provides the "muted" silver/slate tones requested for a polished finish.
*   **The Canvas:** `surface` (#fff8f5) is a warm, gallery-white that prevents the clinical feel of pure hex #FFFFFF.
 
### Key Styling Rules
*   **The "No-Line" Rule:** We do not use 1px solid borders to separate sections. Sectioning must be achieved through background shifts. Place a `surface_container_low` section against a `surface` background to define boundaries.
*   **Surface Hierarchy & Nesting:** Treat the UI as physical layers of fine paper. An article card (`surface_container_lowest`) should sit upon a category section (`surface_container_low`), which sits upon the main site background (`surface`). This creates "soft" depth without visual noise.
*   **The "Glass & Gradient" Rule:** For floating navigation or "Breaking News" overlays, use Glassmorphism. Apply `surface` with 80% opacity and a `backdrop-filter: blur(12px)`. 
*   **Signature Textures:** For high-impact CTAs or Hero backgrounds, use a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle. This adds a "silk-finish" shimmer that flat colors cannot replicate.
 
## 3. Typography: The Editorial Voice
 
We utilize a pairing of **Manrope** for authoritative headlines and **Inter** for high-legibility body copy.
 
*   **Display & Headlines (Manrope):** These are our "Brand Signatures." Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for lead editorials. The bold, geometric nature of Manrope conveys modern corporate strength.
*   **Body & Titles (Inter):** Inter provides a neutral, high-performance engine for long-form reading. 
    *   `title-lg` (1.375rem) is reserved for article sub-headers.
    *   `body-md` (0.875rem) is our workhorse for news snippets, optimized with a generous line-height (1.6) to ensure the "sophisticated whitespace" feel persists within the text itself.
*   **Hierarchy Note:** Always contrast a large `headline-lg` with a significantly smaller `label-md` for categories. The "gap" in scale creates the high-end editorial feel.
 
## 4. Elevation & Depth
 
We reject traditional, heavy drop shadows in favor of **Tonal Layering**.
 
*   **The Layering Principle:** Depth is "stacked." 
    *   Level 0: `surface_dim` (Background)
    *   Level 1: `surface` (Main Content Area)
    *   Level 2: `surface_container_lowest` (Cards/Modules)
*   **Ambient Shadows:** If an element must float (e.g., a dropdown or modal), use a "Soft Ambient" shadow: `box-shadow: 0 20px 40px rgba(29, 27, 26, 0.05)`. The color is a 5% opacity version of our `on_surface` token, not grey.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.
 
## 5. Components
 
### Buttons
*   **Primary:** Solid `primary` fill with `on_primary` text. Border radius set to `md` (0.375rem). No shadow.
*   **Secondary:** `surface_container_high` background with `primary` text. This creates a "recessed" look rather than a traditional ghost button.
*   **Tertiary:** Text-only using `primary` color, with an understated underline that appears only on hover.
 
### Cards & News Feed
*   **Rule:** **No Divider Lines.** 
*   Separate news items using vertical whitespace (48px or 64px) or by alternating background tones (`surface` vs `surface_container_low`).
*   Images should use the `lg` (0.5rem) roundedness to soften the corporate edge.
 
### Chips (Categories)
*   Used for tags like "Economy" or "Policy." 
*   Style: `surface_container_highest` background with `on_surface_variant` text. 
*   Shape: `full` (pill-shaped) to contrast against the structured, rectangular grid of the news articles.
 
### Input Fields
*   Background: `surface_container_low`.
*   Border: None, except for a 2px bottom-border in `outline_variant` that transitions to `primary` on focus. This mimics high-end stationery.
 
### Editorial Special: The "Lead Quote"
*   A custom component for EdLight News. 
*   Large `headline-sm` text, left-aligned, with a 4px vertical accent bar in `secondary_container` (#316bf3) to the left. No containing box; let the typography breathe.
 
## 6. Do’s and Don’ts
 
### Do
*   **Do** use asymmetrical margins. For example, a wider left margin for a headline and a narrower right margin for the body copy creates a "custom" look.
*   **Do** use `surface_bright` for areas meant to draw the eye without using high-contrast colors.
*   **Do** ensure that 60% of every screen is "negative space."
 
### Don't
*   **Don't** use 1px solid #CCCCCC borders. They are the enemy of a premium feel.
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#1d1b1a) to maintain the "ink on paper" softness.
*   **Don't** cram multiple stories into a tight grid. If a story is important, let it span the full width of the container.
*   **Don't** use standard "Material Design" blue for links. Use the `primary` (#3525cd) or `secondary` (#0051d5) tokens provided in this system.