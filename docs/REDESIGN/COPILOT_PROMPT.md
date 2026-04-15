You are a senior product designer and senior frontend engineer redesigning EdLight News into a premium, modern, editorial-grade platform for Haitian youth and students seeking news, scholarships, universities, deadlines, study-abroad guidance, resources, and inspiration.

Your job is to redesign the UI/UX system and implement the frontend so the product feels significantly more polished, premium, interactive, and trustworthy.

IMPORTANT:
- Do not give me a shallow redesign.
- Do not just reskin the existing UI.
- Do not make it look generic, cheap, overly startup-like, childish, or template-based.
- Do not flood the interface with bright random colors.
- Do not create text-heavy cards with long summaries.
- Do not make every page look the same.
- Think like a high-end editorial product mixed with a premium student guidance platform.
- The final result should feel like a blend of modern media product + premium education platform + lightweight productivity tool.

PRODUCT CONTEXT

EdLight News is a content and opportunity platform serving mainly Haitian youth. It covers:
- News
- Scholarships / bourses
- Universities
- Calendar / deadlines
- Study-abroad pathways
- Resources / guides
- Success stories
- History / “today in history”
- Verified and student-useful content

The platform must feel:
- trustworthy
- editorial
- premium
- student-friendly
- fast to scan
- visually clean
- structured for decision-making
- interactive without being overwhelming

PRIMARY GOAL

Redesign the entire interface so it feels:
- more premium
- more modern
- more polished
- more interactive
- more visually hierarchical
- more differentiated across page types

CORE UX PROBLEMS TO SOLVE

1. The current UI feels too flat and too text-heavy.
2. Too many pages feel visually similar.
3. Cards are too verbose and not premium enough.
4. Visual hierarchy is weak.
5. Filter and sort controls do not feel productized enough.
6. Deadline, urgency, trust, and saved states need stronger UI treatment.
7. The product needs clearer pacing, spacing, and page-specific identity.
8. The interface should feel more “curated editorial product” and less “stacked content blocks”.

DESIGN DIRECTION

Create a premium visual language with:
- strong typography hierarchy
- refined spacing
- elegant rounded corners
- soft shadows
- subtle borders
- clear card hierarchy
- page-specific personalities
- tasteful motion
- excellent hover / active / selected / saved states
- a disciplined color system

VISUAL STYLE

Use a polished design language with:
- premium white / off-white / soft neutral surfaces
- deep navy / ink tones for serious structure
- EdLight blue as primary brand anchor
- subtle accent colors by page/category
- clean modern typography
- editorial layout rhythm
- generous whitespace
- smooth interactions
- premium chips, tabs, and segmented controls

DO NOT:
- make it too playful
- make it too corporate and lifeless
- use giant gradients everywhere
- rely on dense paragraphs in cards
- use weak generic Tailwind-looking defaults without refinement

COLOR SYSTEM

Create a disciplined token-based color system:
- primary brand blue
- deep navy / ink
- soft page background
- white elevated cards
- muted border color
- muted text color
- category/status accents

Recommended semantic accents:
- News: blue
- Bourses: amber/gold
- Calendar / urgency: orange-red
- Universities: indigo/teal
- Resources: slate/violet
- Success: emerald/warm gold
- History: burgundy/antique gold

Use tinted backgrounds for statuses and chips rather than harsh saturated blocks.

TYPOGRAPHY

Build a proper type hierarchy:
- hero headlines
- section titles
- card titles
- short dek text
- metadata
- chip / badge labels

Rules:
- titles must be clear and premium
- metadata must be quieter than titles
- card summaries must be short
- never let feed cards become walls of text
- clamp text where needed

SPACING / SHAPE / DEPTH

Use:
- large radius on major cards
- medium radius on standard cards
- small radius on chips/controls
- subtle shadows
- thin clean borders
- stronger spacing between sections
- clean internal card padding

COMPONENT SYSTEM TO BUILD

Create and standardize these reusable components:

1. Hero module
- eyebrow
- title
- short dek
- CTA(s)
- optional image
- optional supporting links/cards

2. Featured editorial card
- image
- category chip
- headline
- short dek
- metadata
- save/share controls
- optional badge (verified / urgent)

3. Standard content card
- chip
- title
- short summary
- metadata
- optional tags
- action row

4. Compact list row
- for dense feeds without visual clutter

5. Deadline card
- title
- date
- countdown
- urgency state
- CTA
- source/trust indicator

6. Filter bar
- search
- segmented sort
- filter chips
- advanced filters
- result count
- reset option

7. Section header
- eyebrow
- title
- short supporting copy
- optional “view all”

8. Compare card / shortlist card
- especially for universities and scholarships

9. Trust badges
- verified
- official source
- recently updated
- deadline soon
- student-friendly
- scholarship available
- Haiti-friendly

10. Empty states / loading skeletons
- polished, not generic

MOTION RULES

Add subtle premium motion:
- hover lift on cards
- smooth tab / filter transitions
- bookmark/save animation
- expand/collapse transitions
- compare tray reveal
- timeline/date selection transitions

Avoid loud or distracting animations.

PAGE-SPECIFIC REDESIGN REQUIREMENTS

A. HOMEPAGE
Goal: make it feel like a premium editorial front page.

Redesign structure:
- hero with one flagship story and two supporting stories
- “today’s essentials” strip
- trending section
- opportunities section
- study abroad / universities spotlight
- success stories block
- newsletter / WhatsApp / Instagram join block

Requirements:
- create stronger pacing between sections
- vary layout density
- use alternating section treatments
- make homepage feel curated, not stacked

B. /NEWS
Goal: make it a true editorial feed.

Requirements:
- one lead story at the top
- 2 supporting feature cards
- sticky filter/sort bar
- mixed-density feed below
- use large cards sparingly
- use compact list rows where useful
- shorten previews dramatically
- add better category chip styling
- add save/share affordances
- make it fast to scan

C. ARTICLE DETAIL PAGE
Goal: premium reading experience.

Requirements:
- strong title zone
- category + trust badges
- clean metadata row
- better reading width
- sticky side rail on desktop
- modular content blocks such as:
  - summary
  - why it matters
  - eligibility
  - requirements
  - key dates
  - how to apply
  - official source
  - related content

D. /BOURSES
Goal: scholarship discovery product, not just a list.

Requirements:
- hero section
- urgent deadlines strip/carousel
- destination/country tiles
- refined filter controls
- scholarship cards with:
  - title
  - country
  - funding type
  - level
  - deadline
  - urgency
  - source / verification
  - save / compare / apply
- compare tray
- clear distinction between urgent and evergreen opportunities

E. /CALENDRIER
Goal: planning dashboard.

Requirements:
- stronger month / date navigation
- clearer calendar grid or timeline
- dual-panel style if appropriate
- better visual distinction across:
  - exams
  - admissions
  - scholarships
  - events
- strong urgency patterns
- “this week” / “upcoming” modules

F. /UNIVERSITES
Goal: premium compare-and-discover experience.

Requirements:
- country selector
- refined filters
- university cards with:
  - logo or image
  - university name
  - city/country
  - cost band
  - language
  - scholarship availability
  - Haiti-friendly indicator
  - save / compare
- shortlist / compare tray
- “best for” labels

This page should feel product-like and decision-friendly.

G. /RESSOURCES
Goal: knowledge library, not generic feed.

Requirements:
- hero
- starter kits
- topic collections
- better categorization
- resource cards and shelves
- “most useful this week”
- icon-backed collections

H. /PARCOURS
Goal: guided pathway experience.

Requirements:
- country tabs
- structured roadmap / stepper
- estimated timeline
- per-step requirements
- collapsible sections
- checklist behavior
- related resources

I. /SUCCES
Goal: human, warm, aspirational editorial section.

Requirements:
- image-led spotlight story
- portrait cards
- quote modules
- thematic groupings
- more breathing room
- softer, less database-like layout

J. /HISTOIRE
Goal: ceremonial and memorable.

Requirements:
- “today in history” hero
- date navigator
- archival feel
- timeline cues
- more immersive editorial treatment
- elegant transitions between dates/events

GLOBAL INTERACTION REQUIREMENTS

Every interactive element must have polished states:
- hover
- active
- focused
- selected
- disabled
- saved

Bookmarks/saved items should feel intentional and satisfying.

FILTERS / SORTING

The current filters should be upgraded into product-grade controls:
- segmented controls for primary sorting
- clean chips for categories
- advanced filter drawer/modal if needed
- sticky behavior where appropriate
- visible selected state
- easy reset

MOBILE EXPERIENCE

The redesign must also feel premium on mobile.
Requirements:
- stacked but elegant layouts
- chips that wrap nicely
- no cramped cards
- sticky controls only when useful
- filters in bottom sheet or modal where appropriate
- key information always above the fold

TRUST / CREDIBILITY

Trust is a major part of this product.
Make source credibility visible with badges and structured metadata.
Prioritize:
- verified status
- official source
- updated date
- deadline clarity
- student relevance

CONTENT RULES

- Keep card summaries short
- Prioritize scanability
- Use clearer visual distinction between title, summary, and metadata
- Use chips and tags intelligently
- Avoid repeated information inside cards
- Clamp titles/deks where needed

ENGINEERING REQUIREMENTS

- Refactor the UI into a coherent design system
- Reuse components wherever possible
- Use clean frontend architecture
- Improve consistency across pages
- Keep code maintainable and scalable
- Prefer elegant and modern implementation over hacks
- Ensure accessibility and responsiveness
- Use polished skeleton states
- Use smooth transitions
- Keep performance in mind

DELIVERABLES

I want you to:
1. audit the likely current structure
2. propose the redesign architecture
3. define the reusable component system
4. rewrite the layout structure page by page
5. implement the redesigned UI
6. improve spacing, hierarchy, interactions, and states
7. ensure the result feels premium and cohesive

OUTPUT FORMAT

Provide:
1. a short redesign strategy summary
2. the proposed component system
3. the page-by-page redesign plan
4. the implementation
5. any new tokens/theme config needed
6. any recommendations for follow-up improvements

FINAL STANDARD

The final result should feel like:
- a premium editorial platform
- a serious student opportunity product
- a polished modern digital brand

It must not feel like:
- a generic Tailwind template
- a rough MVP
- a crowded school portal
- a plain news blog
- a low-effort reskin

Push the design quality significantly higher.
Be opinionated, thoughtful, and systematic.