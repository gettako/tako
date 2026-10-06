---
version: alpha
name: Better Stack Dark
description: A high-contrast dark SaaS system with crisp blue-violet accents and enterprise-focused clarity.
colors:
  primary: "#5B63D3"
  primary-60: "#98A4F7"
  primary-70: "#7D87E8"
  secondary: "#939DB8"
  tertiary: "#FFFFFF"
  neutral: "#0B0C14"
  surface: "#131625"
  on-surface: "#FFFFFF"
  muted: "#939DB81A"
  border: "#FFFFFF24"
  accent-glow: "#FFFFFF40"
  error: "#FF5A6A"
typography:
  headline-display:
    fontFamily: "Helvetica Now Display"
    fontSize: "53px"
    fontWeight: 500
    lineHeight: 58.3px
    letterSpacing: "0px"
  headline-lg:
    fontFamily: "Helvetica Now Display"
    fontSize: "42px"
    fontWeight: 500
    lineHeight: 43.2px
    letterSpacing: "-0.4px"
  headline-md:
    fontFamily: "Helvetica Now Display"
    fontSize: "33px"
    fontWeight: 500
    lineHeight: 40px
    letterSpacing: "0px"
  headline-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 38.88px
    letterSpacing: "-0.36px"
  body-xl:
    fontFamily: "Helvetica Now Text"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 30px
    letterSpacing: "0px"
  body-lg:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: "0px"
  body-md:
    fontFamily: "Helvetica Now Text"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 21px
    letterSpacing: "0px"
  body-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: "0px"
  label-lg:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 24px
    letterSpacing: "0px"
  label-md:
    fontFamily: "Helvetica Now Text"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: "0px"
  label-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: "0px"
  nav-link:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: "0px"
  quote-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: "0px"
rounded:
  none: 0px
  sm: 4px
  md: 10px
  lg: 26px
  xl: 9999px
spacing:
  xs: 8px
  sm: 20px
  md: 36px
  lg: 44px
  xl: 160px
  gutter: 24px
  section: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 17px 24px
    height: 50px
  button-primary-hover:
    backgroundColor: "{colors.primary-70}"
    textColor: "{colors.tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 17px 24px
    height: 50px
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary-60}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.none}"
    padding: 0px
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: 16px 18px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 6px 10px
---

# Better Stack Dark

## Overview
Better Stack presents as a polished, enterprise-ready dark SaaS brand: technical, confident, and efficient without feeling cold. The visual tone is spacious and cinematic, with a strong hero hierarchy, restrained motion cues, and a single luminous accent color that keeps attention on conversion actions. It feels built for developers and infrastructure teams that want clarity, speed, and trust.

## Colors
- **Primary (#5B63D3):** A blue-violet action color used for the main CTA, subtle emphasis, and interactive highlights. It reads modern and trustworthy against the dark canvas.
- **Primary-60 (#98A4F7):** A lighter lavender-blue used for links and secondary emphasis where the interface needs softer contrast than the main button fill.
- **Primary-70 (#7D87E8):** A mid-luminosity variant useful for hover states and active emphasis on primary actions.
- **Secondary (#939DB8):** A muted slate-blue-gray used for supportive text, metadata, and lower-priority UI copy.
- **Tertiary (#FFFFFF):** Pure white for hero headlines, key controls, and maximal contrast in the dark theme.
- **Neutral (#0B0C14):** The near-black base background that creates the brand’s deep, immersive stage.
- **Surface (#131625):** A slightly lifted dark panel color for inputs, cards, and inset UI blocks.
- **On-surface (#FFFFFF):** The primary readable color on dark surfaces, especially for form text and labels.
- **Muted (#939DB81A):** A translucent border/fill tone used to separate sections and controls without harsh edges.
- **Border (#FFFFFF24):** A faint white border treatment that keeps outlines visible but understated.
- **Accent-glow (#FFFFFF40):** A light inset sheen that gives primary buttons a subtle premium finish.
- **Error (#FF5A6A):** A vivid alert color reserved for validation and destructive states.

## Typography
The system uses Helvetica Now Display for prominent headlines and Helvetica Now Text for everything else, preserving a clean Swiss-inspired feel with strong readability. Headlines are medium-weight rather than bold-heavy, which keeps the tone refined and product-led instead of overly promotional. Body text is comfortably sized and airy, especially in the hero and supporting copy, while labels and navigation use the same family at 500 weight for crisp clarity.

Use the larger display styles for marketing statements and section intros:
- `headline-display` and `headline-lg` for hero messaging and major page-level statements.
- `headline-md` and `headline-sm` for section headers and feature titles.
- `body-xl` for lead paragraphs in the hero area.
- `body-lg` and `body-md` for standard descriptive copy, nav, and utility text.
- `body-sm` for fine print and annotations.
- `label-lg`, `label-md`, and `label-sm` for buttons, form controls, and microcopy.

Letter spacing is mostly neutral, with only subtle tightening in larger headlines. The source does not rely on uppercase labeling, so the system should stay sentence case unless a specific component requires otherwise.

## Layout & Spacing
The layout is built around a wide, centered marketing container with a strong left-right split in the hero: text and form on the left, product visualization on the right. Vertical rhythm is generous, with large breathing room between the hero, logos, and the next section, reinforcing the premium and spacious feeling.

Spacing should follow the observed cadence in `spacing`: tight internal control spacing at `xs` and `sm`, then larger section and page separations at `md`, `lg`, and `xl`. Cards and inputs use compact internal padding, while page sections should prefer wide gutters and substantial top/bottom padding (`section` and `xl`) to preserve the cinematic dark composition. Forms and action clusters should remain aligned and tight, with the primary CTA visually adjacent to the input.

## Elevation & Depth
The UI is intentionally flat in terms of shadow depth; hierarchy comes from contrast, borders, and tonal layering rather than pronounced elevation. Panels and inputs use dark surface shifts, thin translucent borders, and subtle inset highlights to avoid looking heavy.

The primary button is the exception: it uses a gentle inner sheen (`accent-glow`) to feel tactile and premium without casting a large shadow. Subtle blur and low-opacity overlays in the hero imagery add depth, but the interface itself should remain restrained and clean.

## Shapes
The shape language is soft but controlled. Most interactive elements use a modest 10px radius, which is rounded enough to feel contemporary while still fitting an infrastructure/product context. Larger containers and cards can use the 26px radius to create a more deliberate, floating panel feel.

Pills and chips should use fully rounded corners, while secondary buttons may be slightly sharper with the 4px radius to distinguish hierarchy. Overall, avoid overly bubbly geometry; the brand is polished and architectural, not playful.

## Components
### Buttons
- `button-primary` is the main conversion CTA: solid blue-violet background, white text, 17px by 24px padding, 50px height, and 10px radius.
- `button-primary-hover` should brighten slightly to communicate interactivity without changing the button’s overall tone.
- `button-secondary` is transparent with a white outline and a slightly sharper 4px radius, suited for lower-emphasis actions.
- `button-link` is text-only and should appear in the lighter blue accent with no border or background.
Buttons should stay medium-weight, compact, and horizontally aligned with adjacent inputs.

### Inputs
Inputs are dark, surface-based fields with subtle borders and white placeholder/text treatment. They should match the primary button height in form rows so the hero signup cluster feels unified. Use the `input` token style for email capture and similar single-line fields; keep the border understated and avoid strong glows.

### Cards
Cards use the `card` token styling: dark background, 26px radius, thin translucent border, and minimal internal padding. They should feel like contained panels rather than floating shadows. Use cards for feature summaries, stats, and embedded content blocks.

### Chips and Pills
Chips should be compact, low-contrast, and rounded-full. They work best as status markers or category tags, with muted slate text and a surface fill rather than a strong accent fill.

### Navigation
Top navigation links are lightweight, evenly spaced, and quiet in tone, with small dropdown indicators where needed. The brand mark and nav should remain horizontally aligned and visually understated so the hero headline remains the focal point.

### Logo Row
Partner logos should sit on the dark background with low-opacity presentation. Treat them as trust signals, not primary content: minimal scale, soft contrast, and ample spacing around each mark.

## Do's and Don'ts
- Do keep the interface dark, spacious, and high-contrast, with white reserved for key headlines and controls.
- Do use the blue-violet primary color sparingly for conversion points and active emphasis.
- Do keep typography medium-weight and clean; let size and spacing create hierarchy instead of heavy font weights.
- Do favor thin borders and tonal surface changes over big shadows or glossy effects.
- Do preserve the generous hero layout and clear left-to-right reading flow.
- Don't introduce bright, saturated colors that compete with the primary accent.
- Don't use exaggerated corner radii or playful, cartoon-like component shapes.
- Don't rely on heavy drop shadows; this system should feel crisp, flat, and product-led.