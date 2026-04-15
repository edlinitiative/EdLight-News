Absolutely — here is a component-level redesign spec for news.edlight.org, focused on making the product feel more premium, polished, and interactive.

⸻

Component-Level Redesign Spec

Product: EdLight News
Goal: Elevate the interface from functional/informational to premium/editorial/product-grade
Design priorities: hierarchy, consistency, interactivity, clarity, trust, visual identity

⸻

1. Global design system

Before redesigning page by page, the site needs a stronger shared system.

1.1 Color system

The current experience would benefit from a more disciplined palette.

Recommended structure
	•	Primary brand color: EdLight blue
	•	Deep navy / ink: for premium headers, section anchors, dark text
	•	Soft neutral background: warm white or slightly cool gray
	•	Elevated card background: pure white
	•	Subtle tinted surfaces: light blue, light gold, light red, light green for status contexts
	•	Accent colors by content type
	•	News: blue
	•	Bourses: gold or amber
	•	Calendrier: red/orange for urgency
	•	Universités: teal or indigo
	•	Ressources: violet or slate
	•	Succès: emerald or warm gold
	•	Histoire: burgundy or antique gold

What to avoid
	•	Too many equally saturated colors
	•	Bright “startup” gradients everywhere
	•	Random chip colors with no logic

1.2 Typography

Typography should do much more of the hierarchy work.

Recommended type scale
	•	Hero headline: large, editorial, high contrast
	•	Section title: strong but compact
	•	Card title: medium-large, bold
	•	Body: highly readable, not cramped
	•	Meta text: smaller, muted
	•	Badge text: small, structured, uppercase or semi-uppercase

Rules
	•	Limit long paragraphs on cards
	•	Use tighter title line lengths
	•	Make metadata quieter than titles
	•	Add more vertical spacing between title, dek, and meta

1.3 Corners, borders, shadows

Premium feel often comes from restraint.

Recommended
	•	Larger radius on major cards: 18–24px
	•	Medium radius on secondary cards: 14–18px
	•	Small radius on chips and controls: 10–14px
	•	Very soft shadows
	•	Thin, elegant borders for low-elevation cards

Avoid
	•	Heavy shadows
	•	Sharp rectangles everywhere
	•	Too many border styles

1.4 Motion

Motion should feel intentional, not decorative.

Use motion for
	•	Hover lift on cards
	•	Tab/filter transitions
	•	Save/bookmark feedback
	•	Expand/collapse sections
	•	Calendar date selection
	•	Compare drawer opening
	•	Section reveal on load

Avoid
	•	Bounce animations
	•	Constant movement
	•	Too many animated badges

⸻

2. Global reusable components

2.1 Hero module

Used on homepage and major section pages.

Structure
	•	Eyebrow label
	•	Large headline
	•	One-line or two-line dek
	•	Primary CTA
	•	Secondary CTA
	•	Large image or illustration
	•	Optional side metrics or quick links

Behavior
	•	Desktop: 2-column layout
	•	Mobile: stacked with title first
	•	Optional mini supporting cards below

Use on
	•	Homepage
	•	Bourses
	•	Universités
	•	Histoire
	•	Succès

⸻

2.2 Featured editorial card

For major stories.

Contents
	•	Thumbnail or image
	•	Category badge
	•	Title
	•	Short dek
	•	Metadata row
	•	Save / share action
	•	Optional “verified” or “urgent” state

Variants
	•	Large horizontal
	•	Large vertical
	•	Full-width lead card

Rules
	•	Max 2 lines for title on feed
	•	Max 2 lines for dek
	•	Never allow giant text blocks

⸻

2.3 Standard content card

Default for articles/resources.

Contents
	•	Category chip
	•	Title
	•	Short summary
	•	Source/date
	•	Optional tags
	•	Optional action row

Variants
	•	Feed card
	•	Compact card
	•	Dense list card

⸻

2.4 Deadline card

For scholarships, deadlines, admissions, applications.

Contents
	•	Label
	•	Opportunity title
	•	Date
	•	Countdown
	•	Type
	•	Destination or region
	•	CTA

Visual logic
	•	0–7 days: high urgency
	•	8–21 days: medium urgency
	•	22+ days: low urgency

Important
Urgency should be visible through color tint, not aggressive red everywhere.

⸻

2.5 Filter bar

Needs a real product treatment.

Structure
	•	Search field
	•	Segmented sort control
	•	Filter chips
	•	Advanced filter button
	•	Result count
	•	Reset control

Behavior
	•	Sticky on desktop when useful
	•	Collapsible on mobile
	•	Selected filters clearly visible
	•	Better spacing between chips

⸻

2.6 Section header

Each section needs a consistent header block.

Structure
	•	Eyebrow
	•	Section title
	•	Short description
	•	“View all” link or CTA
	•	Optional stat chip

This alone would make the site feel much cleaner.

⸻

2.7 Compare card / shortlist item

Especially for universities and scholarships.

Contents
	•	Name
	•	Key attributes
	•	Save toggle
	•	Compare checkbox
	•	Short summary
	•	CTA

Behavior
	•	Add to compare tray
	•	Show compare tray fixed at bottom on desktop/mobile
	•	Allow removal without friction

⸻

2.8 Trust badge system

Critical for EdLight News.

Core badges
	•	Verified
	•	Official source
	•	Recently updated
	•	Deadline soon
	•	Student-friendly
	•	Haiti-friendly
	•	Scholarship available

Rule
Badges must have consistent visual semantics across the site.

⸻

3. Page-by-page redesign spec

⸻

3.1 Homepage

Current problem

It has many useful blocks, but not enough pacing or distinction.

New structure
	1.	Top hero
	•	One flagship story
	•	Two supporting stories
	•	Quick utility links
	2.	Today’s essentials strip
	•	BRH rates
	•	Key deadline
	•	New scholarship
	•	Important announcement
	3.	Trending now
	•	4–6 premium cards
	4.	Opportunities
	•	Scholarships / internships / calls
	5.	Study abroad / universities spotlight
	•	Featured destinations or schools
	6.	Success and inspiration
	•	Human-centered stories
	7.	Newsletter / WhatsApp / Instagram join block

Specific upgrades
	•	Make the homepage more curated, less stacked
	•	Use alternating section backgrounds
	•	Introduce more visual rhythm
	•	Reduce the number of equally-sized modules

⸻

3.2 /news

Goal

Turn it into a true editorial feed.

New layout
	•	Lead story at top
	•	2 secondary feature cards
	•	Filter/sort sticky row
	•	Feed below in mixed density
	•	Large card every 5–6 items
	•	Standard cards in between
	•	Compact list for secondary items

Components to use
	•	Hero story card
	•	Standard article card
	•	Compact headline row
	•	Category chip system
	•	Save/share actions
	•	Related topics rail

Interaction upgrades
	•	Hover reveal on article cards
	•	Quick bookmark
	•	“Read summary” expansion
	•	Better active state for sort options

What to remove
	•	Excessively long preview text
	•	Too many equal-weight cards in sequence

⸻

3.3 Article detail page

Goal

Create a premium reading experience.

New layout

Desktop
	•	Main reading column
	•	Sticky side rail

Main column
	•	Category + trust badges
	•	Headline
	•	Dek
	•	Meta row
	•	Hero image if relevant
	•	Structured content sections

Side rail
	•	Save
	•	Share
	•	Official source
	•	Deadline
	•	Related links
	•	Similar articles

Structured content blocks
	•	Summary
	•	Why it matters
	•	Eligibility
	•	Requirements
	•	Key dates
	•	How to apply
	•	Official source
	•	Notes / warnings

Improvements
	•	Better spacing
	•	Cleaner bullets
	•	Stronger section dividers
	•	End-of-article next-step recommendations

⸻

3.4 /bourses

Goal

Make it feel like a scholarship discovery product, not just a list.

Layout
	1.	Hero with featured deadline
	2.	Urgent deadlines carousel or strip
	3.	Destination tiles
	4.	Filter control bar
	5.	Scholarship results grid/list
	6.	Saved/compare tray

Components
	•	Deadline card
	•	Destination tile
	•	Scholarship result card
	•	Advanced filters drawer
	•	Save/compare system

Scholarship card structure
	•	Name
	•	Country
	•	Funding type
	•	Degree level
	•	Deadline
	•	Verified/source
	•	Save / compare / apply

Premium additions
	•	Countdown indicator
	•	“Best for” tags
	•	Funding clarity badges
	•	Quick compare

⸻

3.5 /calendrier

Goal

Make it feel like a planning dashboard.

Layout
	•	Header with month and filters
	•	Split view:
	•	calendar/timeline left
	•	event list right

Components
	•	Monthly calendar grid
	•	Upcoming deadline cards
	•	Category filter tabs
	•	Sticky date selector
	•	Mini urgency legend

Enhancements
	•	Better selected date state
	•	Richer event hover cards
	•	“This week” module
	•	Exam/admission/scholarship visual differentiation

⸻

3.6 /universites

Goal

Make it feel like a premium compare-and-discover tool.

Layout
	1.	Hero
	2.	Country selector
	3.	Filter bar
	4.	University card grid
	5.	Compare tray
	6.	Featured school collections

University card structure
	•	Logo or image
	•	University name
	•	City / country
	•	Cost band
	•	Language
	•	Haiti-friendly status
	•	Admissions available
	•	Scholarships available
	•	Save / compare

Additions
	•	“Best for” labels
	•	Compare drawer
	•	Shortlist page
	•	Recommended schools by profile

Visual upgrade

This page should feel cleaner and more product-like than editorial.

⸻

3.7 /ressources

Goal

Turn it into a true knowledge library.

Layout
	•	Hero
	•	Starter kits
	•	Topic collections
	•	Search/filter bar
	•	Resource cards
	•	Popular this week / editor picks

Components
	•	Collection card
	•	Guide card
	•	Tool/resource row
	•	Topic chips

Suggested collection examples
	•	Applying abroad
	•	Scholarships 101
	•	Visa preparation
	•	Tests and exams
	•	Budgeting and documents
	•	Student life abroad

Premium feel

Use iconography, collections, and shelf-like grouping instead of a flat feed.

⸻

3.8 /parcours

Goal

Make it a guided journey.

Layout
	•	Country tabs
	•	Summary hero per destination
	•	Step-by-step roadmap
	•	Timeline estimate
	•	Checklist
	•	Related resources

Components
	•	Stepper
	•	Milestone card
	•	Requirement tag
	•	Download checklist CTA

Per-step data
	•	What to do
	•	Estimated time
	•	Documents needed
	•	Tests needed
	•	Cost implications
	•	Important deadlines

Interaction
	•	Expand/collapse steps
	•	Save progress
	•	Mark complete

⸻

3.9 /succes

Goal

Make it emotional, human, and aspirational.

Layout
	•	Hero portrait/story
	•	Spotlight stories
	•	Quote band
	•	Thematic clusters
	•	Featured journeys
	•	Related inspiration

Components
	•	Portrait card
	•	Quote card
	•	Story card
	•	Milestone badge
	•	Category clusters

Visual direction
	•	More image-led
	•	Softer layout
	•	More breathing room
	•	Less “database”
	•	More “editorial magazine”

⸻

3.10 /histoire

Goal

Make it feel ceremonial and memorable.

Layout
	•	“Today in history” hero
	•	Date navigator
	•	Monthly archive strip
	•	Related events
	•	Historical explainers

Components
	•	Historical event card
	•	Timeline row
	•	Archive month selector
	•	Commemoration badge

Premium additions
	•	Larger imagery
	•	Better chronology cues
	•	Softer archival tone
	•	Animated date transitions

⸻

4. Interaction rules

4.1 Hover states

Every clickable card should have:
	•	slight elevation
	•	subtle border accent
	•	title color shift or underline cue
	•	optional image scale

4.2 Active states

Filters, tabs, and segmented controls should have:
	•	filled or tinted selected state
	•	clear contrast
	•	not just a faint border change

4.3 Saved states

Bookmarks should feel meaningful:
	•	icon fill animation
	•	saved confirmation
	•	ability to view saved items later

4.4 Loading states

Use polished skeletons:
	•	card skeletons
	•	title bars
	•	chip placeholders

Avoid ugly spinners as the default.

⸻

5. Spacing rules

A lot of polish will come from spacing discipline.

Section spacing
	•	Larger spacing between page sections
	•	Tighter spacing within card internals
	•	More whitespace around heroes and filters

Card spacing
	•	Clean padding inside every card
	•	Consistent gap between chip, title, dek, and meta
	•	Avoid cramped metadata rows

⸻

6. Copy/UI content rules

Titles
	•	Strong and short
	•	Avoid overflow
	•	Clamp to 2–3 lines

Summaries
	•	One short dek on feed
	•	Full detail only on article page

Metadata
	•	Quiet and structured
	•	Keep date/source/deadline aligned consistently

Badges
	•	Short words only
	•	Never overly verbose

⸻

7. Design implementation priority

Phase 1 — biggest visual lift
	•	Redesign global card system
	•	Redesign homepage hero and feed
	•	Redesign /news
	•	Improve typography and spacing

Phase 2 — product polish
	•	Rebuild /bourses
	•	Rebuild /universites
	•	Rebuild /calendrier

Phase 3 — brand depth
	•	Rebuild /ressources
	•	Rebuild /parcours
	•	Rebuild /succes
	•	Rebuild /histoire

⸻

8. Fastest wins for immediate improvement

If you want quick wins before a full redesign, do these first:
	1.	Shorten all article previews
	2.	Create better category chips
	3.	Add stronger card hierarchy
	4.	Improve spacing and title styles
	5.	Redesign filter bars
	6.	Add hover and saved states
	7.	Give each major page a hero section

⸻

9. Final recommendation

If this were my roadmap, I would start by building a single premium design system in Figma/code with:
	•	typography scale
	•	color tokens
	•	card variants
	•	filter bar
	•	badges
	•	deadline states
	•	compare tray
	•	hero modules

Then I would apply it first to:
homepage → news → bourses → universités

That would create the fastest jump in perceived quality.