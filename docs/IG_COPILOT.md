# EdLight News Instagram Rendering Architecture Spec + Copilot Build Prompt

## Purpose

This document defines the technical architecture for generating high-quality EdLight News Instagram posts without truncation, broken layouts, or inconsistent formatting.

It is designed to solve the recurring issue where AI-generated posts sometimes look strong but often fail due to:

* text overflow
* awkward line breaks
* tiny unreadable text
* inconsistent hierarchy
* cluttered layouts
* poor distinction between slide copy and caption copy
* unpredictable design output

This architecture replaces a vague “generate the post” approach with a controlled system based on templates, field limits, measurement, rewriting, and deterministic rendering.

---

# 1. Product Goal

Build a reusable Instagram post generation engine for EdLight News that:

* produces premium editorial social graphics
* supports carousels and single posts
* prevents truncation before export
* keeps layouts visually consistent
* separates text generation from layout rendering
* allows AI assistance without letting AI freestyle the design

---

# 2. Core Product Principle

The system must never go directly from raw article text to final image.

Instead, every post must follow this pipeline:

1. classify the content type
2. choose a fixed template
3. generate structured text fields
4. validate text length against field limits
5. measure text in actual layout boxes
6. rewrite if overflow exists
7. render deterministically
8. export final assets

This is the central architecture decision.

---

# 3. Recommended Technical Stack

## Core Stack

### 3.1 Satori

Use Satori for deterministic layout rendering based on JSX-like templates.

Why:

* allows template-based rendering
* handles structured layout more predictably than freeform AI-generated design
* fits well with Node workflows
* makes it easier to define reusable templates for social graphics

Role in system:

* render Instagram post layout to SVG
* define slide templates in code
* maintain fixed zones for headline, body, source, branding, and visuals

### 3.2 resvg-js

Use resvg-js to convert SVG output into PNG.

Why:

* fast and reliable rendering pipeline
* high-quality export path
* works well with Satori output

Role in system:

* convert final validated SVG into Instagram-ready PNG files
* optionally generate preview images for QA

### 3.3 Pretext

Use Pretext for text measurement and layout validation.

Why:

* actual text fitting is the real bottleneck in your current system
* helps detect whether multiline text fits in designated regions before export
* gives more confidence than guessing from prompt length alone

Role in system:

* measure headline, body, and other text blocks within fixed boxes
* determine overflow before rendering/export
* drive rewrite or fallback logic

---

## Secondary / Optional Tools

### 3.4 Polotno Node Exporter (Optional)

Can be used as inspiration or fallback for overflow behaviors.

Useful for:

* overflow modes
* design export workflows
* editable graphic composition if needed later

Use case:

* optional future fallback if you want more design editor-like behavior

### 3.5 node-canvas-text (Fallback Only)

May be used as a lightweight helper if a simple rectangle fit utility is needed.

Not recommended as core system.

### 3.6 Figma / Canva Templates (Optional Sync Layer)

Can be used later for visual parity and marketing team handoff, but the rendering source of truth should remain code-based templates for consistency.

---

# 4. System Architecture Overview

## High-Level Modules

The system should be split into the following modules:

1. Content Intake Layer
2. Content Structuring Layer
3. Template Selection Engine
4. Copy Limit Validator
5. Text Measurement Engine
6. Rewrite / Compression Engine
7. Layout Renderer
8. Export Engine
9. QA Preview Layer

---

# 5. Module Specifications

## 5.1 Content Intake Layer

### Purpose

Accept raw content input from a news source, human editor, or AI summary pipeline.

### Inputs

* article title
* source summary
* key facts
* category
* urgency level
* deadline if opportunity post
* language
* desired post type if specified

### Output

A normalized content object for generation.

### Example Input Object

* contentTypeHint
* topic
* sourceSummary
* keyFacts
* category
* date
* preferredLanguage
* CTAType

---

## 5.2 Content Structuring Layer

### Purpose

Turn raw content into structured fields suitable for Instagram.

### Required Behavior

* summarize and compress information
* separate slide copy from caption copy
* identify the main angle of the story
* define one key idea per slide

### Output Structure

* headline options
* subheadline/supporting line
* slide bodies
* source line
* caption draft
* hashtags

### Important Rule

This layer must not decide layout. It only structures content.

---

## 5.3 Template Selection Engine

### Purpose

Choose the correct visual template family.

### Supported Templates for MVP

1. Breaking News Single
2. Headline + Context Single
3. News Carousel
4. Opportunity Carousel
5. Explainer Carousel
6. Quote / Stat Card
7. Weekly Recap Carousel

### Selection Logic

The system should select templates based on:

* content type
* complexity of the story
* number of key facts
* whether there is a deadline
* whether educational explanation is needed

### Rule

The engine should select from a fixed template library only. No freestyle layout generation.

---

## 5.4 Copy Limit Validator

### Purpose

Apply strict max lengths to each text field before rendering.

### Example Limits

These should be configurable per template.

#### Breaking News Template

* headline: 8 to 12 words preferred, hard max 16
* support line: hard max 20 words
* source line: hard max 8 words

#### Carousel Template

* slide headline: hard max 12 words
* slide body: hard max 40 words
* source line: very short only

#### Opportunity Template

* title: hard max 10 words preferred
* eligibility summary: hard max 30 words
* deadline line: very short and prominent

### Rule

If content exceeds these limits, do not render yet. Pass it to the rewrite/compression engine.

---

## 5.5 Text Measurement Engine

### Purpose

Measure whether the text actually fits within the real design box.

### Inputs

* template ID
* text field
* font size
* font family
* box width
* box height
* line-height
* line clamp preference

### Required Output

* fits: true/false
* number of lines used
* overflow amount
* recommended adjustment

### Why This Matters

Word count alone is not enough. Different words, languages, and fonts render differently. Actual measurement is required.

### Rule

Every user-visible text box must be measured before final export.

---

## 5.6 Rewrite / Compression Engine

### Purpose

Shorten text intelligently when limits or measurement checks fail.

### Rewriting Order

1. remove filler words
2. shorten headline phrasing
3. simplify body sentences
4. move secondary details to caption
5. split content into extra slide if still needed

### Hard Rule

Never respond to overflow by endlessly shrinking font size.

### Minimum Font Thresholds

Each template should define minimum readable font sizes. If text still does not fit at the minimum threshold, rewrite or restructure.

### Example Fallback Logic

* if headline overflows: shorten headline
* if body overflows: compress body
* if still overflows: move one fact to next slide
* if carousel already at max slides: drop least important detail to caption

---

## 5.7 Layout Renderer

### Purpose

Render the visual slide using a fixed code template.

### Template Definition Should Include

* canvas size: 1080x1350
* safe margins
* background/image region
* category label region
* headline box
* body box
* source/footer box
* brand mark position
* image overlay settings

### Rules

* no text should be allowed outside safe zones
* all templates should have consistent spacing logic
* each template should have desktop preview and actual mobile-oriented visual behavior in mind

### Recommended Template Files

* BreakingNewsTemplate.tsx
* NewsCarouselTemplate.tsx
* OpportunityTemplate.tsx
* ExplainerTemplate.tsx
* QuoteStatTemplate.tsx
* WeeklyRecapTemplate.tsx

---

## 5.8 Export Engine

### Purpose

Generate final assets after validation passes.

### Outputs

* PNG image per slide
* optional low-res preview
* optional JSON metadata for archive/logging
* caption text file or structured caption output

### Rules

* no export if overflow check fails
* export naming should be consistent
* carousel order must be preserved

### Suggested Output Naming

* edlight-news-[template]-[date]-slide-1.png
* edlight-news-[template]-[date]-slide-2.png

---

## 5.9 QA Preview Layer

### Purpose

Make it easy to review posts before publishing.

### Recommended Features

* generate preview contact sheet of all slides in a carousel
* show fit-check status per field
* show whether any text is near limits
* show which fields were rewritten automatically

### Benefit

This helps editors catch weak outputs even when overflow technically passes.

---

# 6. Data Model

## Core Post Object

The generation system should work from a structured post schema.

### Suggested Fields

* id
* contentType
* category
* topic
* language
* templateId
* slides[]
* caption
* hashtags[]
* sourceNote
* CTA
* status

## Slide Object

Each slide should include:

* slideNumber
* label
* headline
* body
* sourceLine
* visualDirection
* imagePrompt or imageReference
* layoutVariant

## Validation Metadata

* fitPassed
* rewriteCount
* measuredLineCount
* overflowRisk
* fontSizeUsed

---

# 7. Template Rules for MVP

## Breaking News Single

### Use For

* urgent updates
* quick story announcements

### Required Fields

* category label
* headline
* support line optional
* source/date
* image/background

### Layout Rule

Text should occupy limited portion of the frame. Visual should remain strong.

---

## News Carousel

### Use For

* big developments that need context

### Default Slide Sequence

1. headline
2. what happened
3. why it matters
4. key number/quote
5. what comes next

---

## Opportunity Template

### Use For

* scholarships
* internships
* grants
* fellowships
* competitions

### Key Rule

Deadline and eligibility must be highly scannable.

---

## Explainer Template

### Use For

* policy
* economics
* technology
* science
* civic education

### Key Rule

Each slide must simplify one concept only.

---

## Quote / Stat Card

### Use For

* one memorable data point or statement

### Key Rule

Typography must do the heavy lifting.

---

## Weekly Recap

### Use For

* roundups
* top stories of the week

### Key Rule

Each story card inside the recap should be visually parallel.

---

# 8. Text Fitting Policy

## Non-Negotiable Rules

* no truncation
* no clipping
* no hidden overflow
* no unreadably small text
* no text touching the edges
* no paragraph blocks that feel article-like

## Priority Order for Handling Overflow

1. shorten headline
2. shorten body
3. move extra detail to caption
4. split into more slides
5. reject export if unresolved

## What Not To Do

* do not let AI invent a random new layout to fit text
* do not keep shrinking fonts below readability
* do not allow support text to become denser than the design system permits

---

# 9. Visual Design Policy

## Visual Principles

* premium editorial look
* strong hierarchy
* clean typography
* minimal clutter
* consistent category labels
* clear contrast
* image relevance matters

## Avoid

* generic stock imagery
* overdesigned gradients
* random icons used as decoration
* overfilled layouts
* inconsistent branding across templates

## Brand System

Use:

* EdLight blue as foundation
* white and dark neutrals for clarity
* limited accent colors for categories or stats

---

# 10. Language and Localization Policy

## Supported Languages

* English
* French
* Haitian Creole

### Important Note

Text measurement must happen after final language generation because text length patterns differ by language.

### Localization Rule

Do not assume a copy that fits in English will also fit in French or Creole.

---

# 11. Suggested Folder Structure

## Example Structure

/src
/templates
BreakingNewsTemplate.tsx
NewsCarouselTemplate.tsx
OpportunityTemplate.tsx
ExplainerTemplate.tsx
QuoteStatTemplate.tsx
WeeklyRecapTemplate.tsx
/engine
selectTemplate.ts
validateCopyLimits.ts
measureText.ts
rewriteCopy.ts
buildSlides.ts
renderSlides.ts
exportSlides.ts
/types
post.ts
template.ts
/config
templateLimits.ts
fonts.ts
brand.ts
/qa
generatePreviewSheet.ts
fitReport.ts

---

# 12. Implementation Phases

## Phase 1: Reliable MVP

Build:

* 3 to 5 templates
* field limits
* text measurement
* rewrite logic
* final export
* preview sheet

## Phase 2: Smarter Intelligence

Add:

* better headline alternatives
* smarter language-aware compression
* image recommendations
* more refined QA scoring

## Phase 3: Editorial Workflow Layer

Add:

* review dashboard
* post history
* template analytics
* editor overrides
* A/B headline testing if desired

---

# 13. Acceptance Criteria

The system is successful only if:

* posts export with zero truncation
* all templates remain visually consistent
* mobile readability is strong
* slide copy is concise
* caption is separate and useful
* multi-language posts fit correctly
* manual cleanup time drops significantly

---

# 14. Copilot Master Build Prompt

Use the prompt below to ask Copilot to implement the system.

## COPILOT BUILD PROMPT

Build a production-ready **Instagram post rendering engine** for **EdLight News** using a deterministic, template-based architecture.

### Product Context

EdLight News publishes Instagram news graphics and carousels. The current issue is that AI-generated content sometimes causes truncation, overflow, weak formatting, and inconsistent layouts. The new system must prevent those problems by separating content generation from layout rendering.

### Technical Requirements

Use the following stack:

* Satori for template-based SVG rendering
* resvg-js for converting SVG to PNG
* Pretext or equivalent text measurement logic for multiline fit validation
* TypeScript
* modular architecture

### Core Architecture Rules

The engine must follow this workflow:

1. accept structured content input
2. select a fixed template from a predefined library
3. generate structured text fields
4. validate copy limits by field
5. measure text against real layout boxes
6. rewrite or compress copy if overflow occurs
7. render validated slides only
8. export PNG files
9. optionally generate a QA preview sheet

### Non-Negotiable Rules

* do not let AI generate freestyle layouts
* all posts must use predefined templates
* no truncation allowed
* no clipping allowed
* no hidden overflow allowed
* do not solve overflow by shrinking fonts indefinitely
* enforce minimum font size thresholds
* if text does not fit, rewrite it shorter
* if still too long, split content into more slides or move details to caption
* no export if unresolved overflow remains

### Required Templates

Implement the following templates:

1. Breaking News Single
2. News Carousel
3. Opportunity Carousel
4. Explainer Carousel
5. Quote / Stat Card
6. Weekly Recap Carousel

### Template Requirements

Each template must define:

* canvas size 1080x1350
* safe margins
* headline box
* body box
* category label area
* source/footer area
* brand mark area
* image/background region
* min/max font sizes
* max allowed lines per field

### Required Modules

Create these modules:

* selectTemplate.ts
* validateCopyLimits.ts
* measureText.ts
* rewriteCopy.ts
* buildSlides.ts
* renderSlides.ts
* exportSlides.ts
* generatePreviewSheet.ts
* fitReport.ts

### Data Model

Create strong TypeScript types for:

* Post
* Slide
* TemplateConfig
* ValidationResult
* FitResult

### Functional Requirements

* support single-slide and multi-slide carousels
* support English, French, and Haitian Creole
* ensure measurement happens after final language text is generated
* return structured metadata about fit checks and rewrites
* support caption generation as a separate output from slide text
* preserve carousel ordering in export

### Output Requirements

The engine should output:

* one PNG file per slide
* one caption text output
* one JSON metadata file containing fit status, rewrite count, and template info
* one optional preview sheet image for QA

### Quality Expectations

The result should feel like a premium editorial social graphics engine, not a generic meme generator or a one-off script.
The code should be clean, modular, typed, and easy to extend.
Use sensible comments and organize the code so more templates can be added later.

### Implementation Preference

Start with a reliable MVP that prioritizes:

* deterministic rendering
* overflow prevention
* template consistency
* mobile readability

Do not overcomplicate the first version with a visual editor UI.

---

# 15. Final Recommendation

For EdLight News, this rendering engine should become the source of truth for Instagram posts. AI can help write and summarize the content, but rendering, fitting, and export should be controlled by deterministic code.

That is the most reliable way to end the truncation problem rather than just trying stronger prompts.
