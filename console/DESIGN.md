---
version: alpha
name: Better Stack Dark
description: A high-contrast, enterprise SaaS system with a moody dark canvas, soft indigo accent, and restrained glassy depth.
colors:
  primary: "#5560D6"
  primary-60: "#7980E0"
  primary-70: "#8F95EA"
  secondary: "#98A4F7"
  tertiary: "#C7CBEF"
  neutral: "#0B0C14"
  surface: "#141622"
  surface-2: "#1A1D2C"
  on-surface: "#FFFFFF"
  on-surface-muted: "#939DB8"
  border: "#939DB81A"
  border-strong: "#FFFFFF24"
  overlay: "#00000066"
  error: "#E15B5B"
typography:
  headline-display:
    fontFamily: "Helvetica Now Display"
    fontSize: "53px"
    fontWeight: 500
    lineHeight: "58.3px"
    letterSpacing: "0px"
  headline-lg:
    fontFamily: "Helvetica Now Display"
    fontSize: "42px"
    fontWeight: 500
    lineHeight: "43.2px"
    letterSpacing: "-0.4px"
  headline-md:
    fontFamily: "Helvetica Now Display"
    fontSize: "33px"
    fontWeight: 500
    lineHeight: "40px"
    letterSpacing: "0px"
  headline-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: "38.88px"
    letterSpacing: "-0.36px"
  body-lg:
    fontFamily: "Helvetica Now Text"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "30px"
    letterSpacing: "0px"
  body-md:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0px"
  body-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0px"
  label-lg:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0px"
  label-md:
    fontFamily: "Helvetica Now Text"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0px"
  label-sm:
    fontFamily: "Helvetica Now Text"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.02em"
  nav-link:
    fontFamily: "Helvetica Now Text"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0px"
  caption:
    fontFamily: "Helvetica Now Text"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0px"
rounded:
  none: "0px"
  sm: "4px"
  md: "10px"
  lg: "16px"
  xl: "26px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "20px"
  md: "36px"
  lg: "44px"
  xl: "160px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "17px 24px"
    size: "147px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.primary-60}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.sm}"
    padding: "17px 24px"
    size: "147px"
    height: "50px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: "0px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
    height: "50px"
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.xl}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.nav-link}"
    padding: "0px"
  nav-link-active:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.nav-link}"
    padding: "0px"
---

# Better Stack Dark

## Overview

Better Stack presents as a confident, technical SaaS brand aimed at engineering teams that care about reliability, observability, and pricing clarity. The mood is dark, premium, and slightly cinematic, with a strong product-led feel rather than a marketing-heavy one. Spacing is generous and the hierarchy is sharp, so the interface reads as spacious despite the dense dashboard imagery.

## Colors

- **Primary (#5560D6):** The main indigo accent used for the key call to action, active emphasis, and subtle interactive highlights. It feels modern and trustworthy rather than loud.
- **Primary scale (#7980E0, #8F95EA):** Softer lifts of the accent for hover and glow states, keeping interaction feedback luminous but restrained.
- **Secondary (#98A4F7):** A lighter, cool-toned link color used for secondary emphasis and inline actions such as text links.
- **Tertiary (#C7CBEF):** A pale lavender support tone for quiet contrast and background-adjacent accents.
- **Neutral (#0B0C14):** The deep night canvas that establishes the brand’s dark-first character and makes white typography pop.
- **Surface (#141622) and Surface-2 (#1A1D2C):** Elevated dark panels for inputs, cards, and embedded product previews. These are only slightly lighter than the background to preserve a subtle, layered feel.
- **On-surface (#FFFFFF):** Primary text and icon color for maximum readability in the dark environment.
- **On-surface-muted (#939DB8):** Secondary copy, navigation, and supporting metadata; cool gray-blue to soften the hierarchy.
- **Border (#939DB81A) and Border-strong (#FFFFFF24):** Hairline separators and control outlines that define structure without interrupting the mood.
- **Overlay (#00000066):** Used to darken imagery and de-emphasize background content so the primary message remains dominant.
- **Error (#E15B5B):** Reserved for destructive or invalid states; it should stay rare and clearly noticeable.

## Typography

The system uses two Helvetica families: **Helvetica Now Display** for large headlines and **Helvetica Now Text** for body copy, labels, controls, and smaller headings. Display styles are medium weight and tightly tuned for clear, compact hero statements, while text styles are clean and highly readable for product explanations and UI controls.

Headlines lean large and confident: `headline-display` and `headline-lg` create the hero impact, `headline-md` supports section intros, and `headline-sm` bridges into smaller marketing or card titles. Body text is intentionally generous at `body-lg` and more restrained at `body-md` and `body-sm`, supporting the product’s explanatory tone. Labels and nav items use medium weight to improve scanability without feeling bold.

Letter spacing is mostly neutral, with only slight negative tracking on some display sizes to keep large headlines visually tight. Small labels may use a touch of positive spacing when needed for clarity, but the overall system avoids uppercase-heavy treatment and keeps the voice natural and contemporary.

## Layout

The page is built around a wide, centered desktop container with generous outer margins and a clear left-to-right hero composition. Primary content anchors on the left, while product imagery and dashboard previews occupy the right side, creating a classic SaaS landing-page balance.

Spacing follows a simple rhythm with `xs` at 8px and larger steps at 20px, 36px, 44px, and 160px for major section breaks. This creates a calm, readable vertical cadence: tight internal spacing for controls, medium spacing between content blocks, and very large spacing between major homepage sections. Cards and embedded modules rely on modest internal padding rather than expansive whitespace, which keeps the interface efficient without feeling crowded.

## Elevation & Depth

Depth is achieved mostly through contrast, layering, and transparency rather than shadow. The design is intentionally flat overall, with no dramatic drop shadows; instead, it uses slightly lighter surfaces, thin borders, and soft overlays to separate regions.

The primary CTA includes a subtle inner highlight, giving it a polished, glassy feel without looking glossy or skeuomorphic. Product screenshots are darkened and softened so they read as contextual proof rather than competing with the headline. This produces a premium, technical atmosphere that feels controlled and precise.

## Shapes

The shape language is soft but disciplined. Interactive controls use a modest `10px` radius, while secondary controls may tighten to `4px` for a more utilitarian edge. Larger cards move up to `26px`, giving the page a friendly, rounded container feel without becoming bubbly.

Overall, the geometry is modern and slightly pill-like in places, but never playful. Rounded corners are used to reduce harshness in the dark UI and to support the polished enterprise aesthetic.

## Components

**Buttons**

- `button-primary` is the dominant action: indigo fill, white text, `17px 24px` padding, `50px` height, and medium weight text. It should be the most visually prominent control on the page.
- `button-primary-hover` should brighten the fill to the lighter indigo scale, preserving the same radius and text color.
- `button-secondary` is transparent with a white outline and a tighter `4px` radius; use it for lower-priority actions that still need clear affordance.
- `button-tertiary` is link-like and borderless, used for inline calls to action such as “Book a consultation.”
- Button sizing should stay compact and balanced; avoid oversized padding that breaks the tight hero rhythm.

**Inputs**

- Inputs use a dark surface, `10px` rounding, and clear internal padding so they feel like part of the product rather than a separate form system.
- Borders should remain subtle and rely on contrast rather than strong outlines.
- Placeholder and entered text should stay readable but not overpower the CTA beside it.

**Cards**

- `card` containers use the deepest surface color, a `26px` radius, and a faint border. Keep them visually quiet so the content within remains the focus.
- Cards should not rely on shadows; use tone separation and spacing instead.
- Use card padding sparingly and consistently to preserve the dense-but-controlled feel.

**Navigation**

- Top-level nav links are lightweight, medium-sized, and muted by default.
- Active or hovered nav items should step up to `on-surface` while remaining text-only.
- Dropdown indicators and utility links should stay subtle and avoid extra visual weight.

**Chips and small badges**

- `chip` styling should be compact, pill-shaped, and muted, suited for filters, tags, or status markers.
- Keep their contrast lower than buttons so they do not compete with the primary action.

**Typography in components**

- Use `label-lg` for buttons and key controls.
- Use `body-md` for form fields and tertiary actions.
- Keep microcopy and captions subdued with `caption` or muted text tokens.

## Do's and Don'ts

- Do keep the interface dark-first, with bright text and a single strong indigo accent.
- Do use thin borders and tonal shifts to define structure instead of heavy shadows.
- Do preserve the generous hero spacing and the clear left-content/right-visual layout.
- Do keep buttons medium-sized and confident, with the primary CTA clearly dominant.
- Don't introduce saturated secondary colors that fight the indigo accent.
- Don't use stark white panels or bright backgrounds that break the night-mode atmosphere.
- Don't over-round every element; reserve the largest radii for cards and the softest containers.
- Don't make body copy too small or too light; the page relies on readable, high-contrast text.
