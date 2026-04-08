# Product Requirements Document (PRD)

## EdLight News Instagram Post System

### Document Purpose

Define exactly how EdLight News Instagram posts should be generated so output is consistent, polished, readable, non-truncated, visually strong, and suitable for Haitian youth and a broader international audience.

---

## 1. Product Summary

EdLight News needs a repeatable Instagram content system that produces high-quality visual news posts and carousels. The goal is to make every post feel premium, informative, trustworthy, and native to Instagram, while avoiding common failure modes such as:

* text being cut off
* captions being too long or weak
* slides feeling cluttered
* inconsistent branding
* visuals looking generic or low quality
* headlines being vague or sensational
* layouts varying too much from post to post
* posts not being understandable without the caption

The system should generate posts that can be published with minimal manual cleanup.

---

## 2. Goals

### Primary Goals

* Make Instagram posts visually consistent and premium
* Ensure every post is fully readable on mobile
* Ensure posts never appear truncated, cramped, or unfinished
* Make posts understandable even if users do not read the caption
* Improve trust and perceived quality of EdLight News
* Reduce manual editing time after generation

### Secondary Goals

* Increase saves, shares, and profile visits
* Build a recognizable EdLight News visual identity
* Support both breaking news and evergreen educational/news explainer content
* Create templates that can scale through automation

### Non-Goals

* This PRD does not define video/Reel production in full detail
* This PRD does not cover the full publishing pipeline or scheduling system
* This PRD does not define website article formatting

---

## 3. Core User Problem

The current AI-generated output is inconsistent. Sometimes posts are strong, but often they have one or more of the following issues:

* headline too long
* body text too dense
* important text cut off or too close to edges
* poor hierarchy between title, source, date, and key facts
* weak image choice
* poor formatting for carousels
* output that looks like an AI draft rather than a publication-ready asset

The system needs clear rules so Copilot or any generation workflow produces structured, publishable content every time.

---

## 4. Target Audience

### Primary Audience

* Haitian youth
* students
* young professionals
* EdLight community members
* social-media-first readers who consume news visually

### Secondary Audience

* diaspora audiences
* educators
* mentors
* partners and sponsors
* people interested in Haiti, education, technology, leadership, and opportunities

### Audience Needs

* fast understanding
* credibility
* attractive visuals
* concise summaries
* mobile-first readability
* posts that feel modern and relevant

---

## 5. Product Principles

Every EdLight News post must follow these principles:

### 5.1 Mobile First

Posts must be designed for phone viewing first, not desktop.

### 5.2 Understandable Without Caption

A viewer should understand the key story from the slides alone.

### 5.3 Less Text, Better Hierarchy

Do not overload slides. Prioritize clarity over completeness.

### 5.4 Premium Editorial Look

Posts should feel closer to Bloomberg, a modern media brand, or a polished youth-focused publication than to a school flyer.

### 5.5 Consistency Over Random Creativity

Templates may vary slightly by content type, but core spacing, fonts, tone, and structure must remain consistent.

### 5.6 Truth and Precision

No sensationalism, no misleading phrasing, no uncertain claims presented as fact.

---

## 6. Content Types

The system should support the following post types:

### 6.1 Breaking News Single Post

Use for quick announcements or urgent updates.

**Format:** 1 slide
**Goal:** communicate one key fact fast

### 6.2 News Carousel

Use for important stories requiring context.

**Format:** 4 to 6 slides
**Goal:** summarize what happened, why it matters, and what comes next

### 6.3 Opportunity Post

Use for scholarships, applications, fellowships, internships, competitions.

**Format:** 1 to 4 slides
**Goal:** explain what it is, who it is for, and deadline/action

### 6.4 Explainer Post

Use for policy, economics, science, civic issues, technology, exams, or educational topics.

**Format:** 4 to 7 slides
**Goal:** simplify a complex topic visually

### 6.5 Quote / Stat Card

Use for one strong data point, quote, or key takeaway.

**Format:** 1 slide
**Goal:** maximize shareability

### 6.6 Recap Post

Use for event summaries, week-in-review, top stories.

**Format:** 5 to 8 slides
**Goal:** deliver a clean digest

---

## 7. Standard Post Structure

## 7.1 Single-Slide Structure

Every single-slide post should include:

* category label
* strong headline
* visual or background image
* short supporting line if needed
* source/date line when relevant
* EdLight News branding

### Rules

* headline max: 8 to 12 words preferred
* supporting line max: 12 to 20 words
* never more than 3 text blocks on one slide
* text must not touch the edges
* all text must remain within safe margins

## 7.2 Carousel Structure

Recommended default structure:

**Slide 1:** Main headline + strongest image + topic label
**Slide 2:** What happened
**Slide 3:** Why it matters
**Slide 4:** Key fact / quote / number
**Slide 5:** What happens next or what to watch
**Slide 6 (optional):** Call to follow/share/save or source recap

### Carousel Rules

* each slide must communicate one idea only
* no paragraph should exceed 35 to 45 words
* no slide should feel like a screenshot of an article
* slides must work in sequence and independently

---

## 8. Design Requirements

### 8.1 Canvas Size

* portrait Instagram format
* default size: 1080 x 1350
* all templates must be optimized for this size

### 8.2 Safe Margins

* maintain generous padding on all sides
* no text within unsafe edge zones
* all important content should remain well inside crop-safe area

### 8.3 Typography

Use a clean, modern, editorial font system.

**Rules:**

* maximum 2 font families
* use clear hierarchy: label, headline, body, footer
* headlines should be bold and highly legible
* body text should remain large enough to read on a phone
* avoid thin fonts for important text
* avoid decorative fonts

### 8.4 Text Limits

Per slide:

* headline: ideally 1 to 2 lines
* body copy: ideally 20 to 40 words
* total text should rarely exceed 50 words on a slide

### 8.5 Color System

Use EdLight brand colors as base.

**Recommended system:**

* primary: EdLight blue
* secondary: white
* neutral: dark gray / near-black
* accent: muted highlight color for categories or stats

**Rules:**

* maintain high contrast
* avoid overusing bright colors
* do not make every post a different palette
* use color intentionally to signal category or emphasis

### 8.6 Imagery

Image quality is critical.

**Rules:**

* use sharp, editorial-looking images
* avoid cheesy stock photos
* avoid irrelevant images
* when possible, use image overlays to improve text readability
* crop images intentionally around the subject
* never allow faces or key objects to be awkwardly cut off

### 8.7 Branding

Each post should include subtle but visible EdLight News branding.

**Examples:**

* small logo mark
* “EdLight News” footer mark
* consistent category label design

Branding should not dominate the slide.

---

## 9. Editorial Requirements

### 9.1 Tone

The tone should be:

* clear
* modern
* credible
* concise
* intelligent
* youth-friendly but not childish

### 9.2 Headline Rules

Headlines must be:

* factual
* direct
* short
* compelling without being clickbait

**Good:**

* Haiti Launches New Digital Education Initiative
* Canada Tightens Student Visa Rules
* New Scholarship Opens for Caribbean Students

**Bad:**

* Huge Shock as Major News Breaks
* You Won’t Believe What Happened
* This Changes Everything Forever

### 9.3 Copy Rules

* write in short sentences
* avoid jargon unless explained
* prioritize clarity over sounding “smart”
* avoid repetition
* avoid filler phrases
* avoid AI-sounding generic wording
* avoid unsupported claims

### 9.4 Caption Rules

Captions should complement the slide, not repeat it word for word.

**Caption structure:**

1. one-sentence hook or summary
2. 2 to 4 short lines of context
3. source / credit if needed
4. CTA if relevant
5. hashtags limited and relevant

**Rules:**

* keep captions concise
* avoid walls of text
* no more than one clear CTA
* do not overload hashtags

---

## 10. Template System

To reduce bad output, all posts should be generated from a controlled template set.

### Required Template Families

1. Breaking news template
2. Headline + image template
3. Multi-slide explainer template
4. Opportunity template
5. Quote/stat template
6. Weekly recap template

### Template Requirements

Each template must define:

* exact layout zones
* max text lengths per field
* image position rules
* font size rules
* category label position
* footer/source position
* fallback behavior when text is too long

### Critical Requirement

The generator must never improvise a layout from scratch unless explicitly requested.
It should select a template first, then fill it.

---

## 11. Truncation Prevention Requirements

This is one of the most important sections.

### The system must prevent:

* text running off the slide
* text hidden behind images or overlays
* font shrinking until unreadable
* awkward line breaks
* inconsistent spacing between slides

### Hard Rules

* each field must have a character or word limit
* auto-resize must have minimum font thresholds
* if copy exceeds limit, rewrite shorter instead of shrinking forever
* text boxes must be locked within safe layout zones
* every generated post must pass an overflow check before export

### Fallback Behavior

If content is too long:

1. shorten headline
2. shorten body copy
3. split into more slides if needed
4. never force oversized text into one frame

---

## 12. Quality Bar / Acceptance Criteria

A generated post is acceptable only if all of the following are true:

### Visual Quality

* no truncation
* no overlap
* no cramped spacing
* consistent brand styling
* text readable on mobile
* image looks intentional and relevant

### Editorial Quality

* headline is clear and factual
* grammar is clean
* no awkward AI wording
* no unsupported claim
* story is understandable without caption

### Layout Quality

* strong visual hierarchy
* one main idea per slide
* appropriate use of whitespace
* no slide feels overloaded

### Output Quality

* correct aspect ratio
* export-ready image(s)
* caption delivered separately
* source attribution available where relevant

---

## 13. Functional Requirements for the Generator

The generation workflow should take structured inputs rather than a vague one-shot prompt.

### Required Inputs

* content type
* topic/category
* headline
* source summary
* key facts
* date / deadline if applicable
* preferred language
* CTA type
* template choice or auto-template selection
* number of slides

### Required Outputs

* final slide copy per slide
* design-ready layout instructions
* image guidance
* caption
* hashtags
* source note

### Optional Inputs

* urgency level
* audience type
* brand emphasis level
* whether post is informational, promotional, or explanatory

---

## 14. Recommended Generation Workflow

### Step 1: Classify content

Determine whether it is breaking news, explainer, opportunity, recap, etc.

### Step 2: Select template

Use the correct template family.

### Step 3: Draft slide-by-slide copy

Write concise copy within strict limits.

### Step 4: Validate length

Check all text against layout limits.

### Step 5: Assign image direction

Specify the type of image/background needed.

### Step 6: Generate caption

Create a caption that adds value but stays concise.

### Step 7: Final QA pass

Check readability, truncation, hierarchy, and consistency.

---

## 15. QA Checklist

Before a post is approved, verify:

* Is the headline short enough?
* Is every slide readable on a phone?
* Is any text too close to the edges?
* Is any section visually overloaded?
* Is the story understandable without the caption?
* Does the caption add value rather than repeat?
* Does the image match the topic?
* Does the post look like EdLight News?
* Would a real media brand publish this design?

If the answer to any of the above is no, revise before publishing.

---

## 16. Failure Cases to Explicitly Avoid

* giant blocks of text
* weak generic icons instead of real imagery
* random font mixing
* overdesigned gradients and effects
* clickbait tone
* text cropped by Instagram preview
* copy that sounds robotic
* captions that are longer than the actual value of the post
* carousels where slide 1 is strong and slides 2 to 5 feel lazy
* posts that feel like school presentations instead of media assets

---

## 17. Metrics for Success

Track the following after rollout:

* reduction in manual edits per post
* percent of posts requiring redesign
* save rate
* share rate
* completion rate on carousels
* profile visits from posts
* engagement rate by template type

---

## 18. Implementation Recommendation for Copilot / AI Prompting

The best output will come from a structured prompt system, not a generic request like “make an Instagram post.”

The system should always provide:

* content type
* exact template
* max word count per field
* slide-by-slide structure
* tone rules
* design rules
* overflow prevention rules
* final QA checklist

This should be built as a reusable master prompt plus template-specific prompts.

---

## 19. Master Prompt Requirements for Generation

Any generation prompt should instruct the model to:

* act like a premium editorial social designer
* optimize for Instagram mobile readability
* keep text concise
* never truncate text
* rewrite copy if too long
* prioritize whitespace and hierarchy
* keep visuals premium and relevant
* deliver output in structured fields, not messy prose

---

## 20. Open Questions / Next Phase

Future decisions to define:

* language strategy: English only vs French/Creole variants
* source attribution style on-slide vs caption-only
* whether to use one design system for Haiti news and global news
* whether AI should also select imagery automatically
* whether Canva templates should be hard-coded and filled dynamically
* whether there should be separate systems for feed posts and story posts

---

## 21. Recommended Next Deliverables

After this PRD, the next documents to create are:

1. template library specification
2. copy limits table by template
3. master generation prompt for Copilot
4. QA checklist for human reviewer
5. sample posts for each template type

---

## 22. Final Product Requirement Statement

The EdLight News Instagram post system must produce publication-ready, mobile-first, premium editorial assets with strong hierarchy, strict text limits, consistent branding, and zero truncation. Every post should be understandable without relying on the caption and should require little to no manual cleanup before publishing.