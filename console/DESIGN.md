---
version: alpha
name: Tako
description: High-performance edge infrastructure, agent telemetry, and self-hosted control plane design system.
colors:
  primary: "#c53d20"
  on-primary: "#ffffff"
  primary-container: "#a83218"
  secondary: "#18181b"
  on-secondary: "#f4f4f5"
  tertiary: "#10b981"
  on-tertiary: "#ffffff"
  neutral: "#0b0c14"
  neutral-light: "#ffffff"
  surface: "#15161f"
  surface-muted: "#20212a"
  border: "#242633"
  destructive: "#b91c1c"
  on-destructive: "#ffffff"
typography:
  headline-display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  label-caps:
    fontFamily: Geist Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.08em
  telemetry-code:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 2px
  md: 4px
  lg: 6px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-destructive}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.sm}"
    padding: 10px
    height: 40px
  telemetry-badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.sm}"
    padding: 4px
  card-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.md}"
    padding: 24px
  card-ground-dark:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.md}"
    padding: 24px
  card-ground-light:
    backgroundColor: "{colors.neutral-light}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 24px
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
---

# Tako Design System

## Overview

Tako is a specialized self-hosted edge infrastructure and real-time agent telemetry platform. Designed for systems engineers, site reliability teams, and backend developers, the visual identity conveys high-precision engineering, calm operational focus, and uncompromised technical clarity.

The visual direction draws from the iconic Japanese Tako (octopus) vermilion coral signature, creating a distinctive, energetic identity that contrasts purposefully against dark carbon consoles and emerald telemetry streams. Both dark mode and light mode are first-class, fully supported environments built upon a unified OKLCH and semantic token foundation.

### Visual Dials (antislop calibration)

- **ENERGY (2/3):** Focused and intentional. The interface is clean, utilitarian, and composed without distracting glow effects, saturated full-page gradients, or trend-stacking decorations.
- **RHYTHM (2/3):** Structured geometric rhythm. Spatial relationships follow explicit 8px and 4px baseline increments, grouping telemetry maps, data grids, and control consoles into cohesive visual containers.
- **MOTION (1/3):** Restrained and purposeful. Animations are strictly reserved for state transitions, live telemetry pulse lines, and interactive modals. Floating background blobs and template bounce loops are omitted.

## Colors

The color palette is rooted in deep neutral carbon foundations, structured boundary accents, and an iconic Tako vermilion coral primary balanced by emerald status telemetry.

- **Primary (#c53d20):** Deep Tako Coral Vermilion (derived from `oklch(0.555 0.177 33.57)`). Represents the signature identity of Tako. Used for primary interactive controls, active navigation items, and focus indicators. Paired with crisp white text (`#ffffff`) for a certified 5.17:1 WCAG AA contrast ratio.
- **Secondary (#18181b):** Deep slate and zinc tone. Used for subtle panels, structural subheadings, secondary interactive surfaces, and utilitarian borders.
- **Tertiary (#10b981):** Pure emerald signal. Serves as the dedicated telemetry status driver for healthy nodes, active streams, and low-latency metrics.
- **Neutral (#0b0c14 & #ffffff):** Deep midnight obsidian carbon (`#0b0c14`) for dark mode foundations and crisp, balanced neutral white for light mode backgrounds.
- **Destructive (#b91c1c):** Deep crimson red for error states, offline edge nodes, and irreversible control plane operations.

All color pairings are tested and enforced to satisfy WCAG AA contrast ratios (4.5:1 minimum for regular text, 3:1 for large display elements).

## Typography

Typography prioritizes legibility, tabular data alignment, and clear visual hierarchy across dense dashboards and configuration panels.

- **Interface Sans (Inter):** Configured via Next.js Font Optimization as `--font-sans`. Used for high-level headlines, narrative copy, form labels, and interactive button text. Font weights are restricted to Regular (400), Medium (500), Semi-Bold (600), and Bold (700).
- **Telemetry Mono (Geist Mono):** Configured as `--font-mono`. Used for agent node IDs, latency readouts, timestamps, IP addresses, terminal logs, and system metrics. Tabular figures and fixed-pitch metrics ensure data tables remain aligned under dynamic updates.

## Layout

Layout architecture combines fluid-responsive containment with structured modular grids.

- **Breakpoint Grid:** Fluid container adaptation spanning mobile (320px+), tablet (768px+), desktop (1024px+), and wide console monitors (1440px+).
- **Spacing Scale:** Built on an 8px base rhythm with a 4px micro-step (`xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`, `2xl: 48px`, `3xl: 64px`).
- **Touch & Click Ergonomics:** All interactive buttons, inputs, and triggers satisfy the minimum 44px tap target on mobile and 40px standard target on desktop consoles.
- **Containment:** Telemetry nodes, topology graphs, and interactive forms reside in contained cards with consistent padding (16px to 24px) and subtle structural borders.

## Elevation & Depth

Elevation is established through clean tonal layering and 1px structural borders rather than heavy, floating drop shadows.

- **Ground Plane:** Clean neutral page background (`#0b0c14` in dark mode, `#ffffff` in light mode).
- **Layer 1 (Cards & Sidebars):** Slightly elevated surface (`#15161f` in dark mode, `#ffffff` card with `#f4f4f5` muted border in light mode).
- **Layer 2 (Overlays & Dialogs):** Modals, popovers, and floating dropdowns use distinct borders (`oklch(1 0 0 / 10%)` or `border-border`) paired with high-contrast backdrop scrims.
- **Borders & Dividers:** Crisp hairline dividers separate distinct information groups without heavy blur or layered glass effects.

## Shapes

Shapes communicate technical precision and architectural reliability.

- **Corner Radii:** In accordance with the shadcn base-vega configuration (`--radius: 0` base with micro-radii tokens), corners are sharp or subtly softened (`sm: 2px`, `md: 4px`, `lg: 6px`).
- **Forbidden Pill Default:** Pill shapes are reserved exclusively for compact status badges (`telemetry-badge` or live node indicators). Standard inputs, cards, dialogs, and action buttons maintain crisp, engineered rectangular geometries.

## Components

The system provides consistent token definitions for atomic UI primitives integrated with Tailwind CSS v4 and shadcn UI:

- **Button Primary (`button-primary`):** Tako coral vermilion background with high-contrast white text, 40px height, 12px horizontal padding, and subtle 2px corner radius.
- **Button Secondary (`button-secondary`):** Muted slate/surface background with neutral foreground, ideal for cancellation, secondary navigation, and filter toggles.
- **Button Destructive (`button-destructive`):** Deep crimson action surface for deleting nodes, dropping tokens, or terminating agent tunnels.
- **Input Field (`input-field`):** Dark/light adaptable surface with visible 1px borders, explicit focus rings (`outline-ring/50`), and consistent 40px height for keyboard navigation.
- **Telemetry Badge (`telemetry-badge`):** Compact status chip with emerald text for live heartbeat verification, latency reporting, and operational readiness.
- **Card Panel (`card-panel`):** Primary elevated container for metrics, geographic maps, and telemetry lists.
- **Divider (`divider`):** 1px structural boundary marker separating headers, rows, and navigation sections.

## Do's and Don'ts

### Do's

- Do use the Tako vermilion coral (`#c53d20`) for primary interactive controls and key action triggers.
- Do reserve emerald strictly for live telemetry health, active packet streams, and low-latency status.
- Do display real telemetry figures or explicit honest placeholders (`[LIVE METRIC]`, `[REAL DATA]`) rather than fabricated marketing statistics.
- Do ensure both light mode and dark mode are tested, fully readable, and verified for WCAG AA compliance.
- Do provide distinct empty, loading, and error states for all telemetry and data-driven views.
- Do keep copy concise, technical, and direct.

### Don'ts

- Don't use em dashes in UI text, headings, or error messages (use commas, colons, hyphens, or parentheses).
- Don't stack multiple decorative trends (avoid simultaneous glassmorphism, mesh gradients, glowing borders, and floating blur orbs).
- Don't create non-functional buttons or navigation links to unbuilt sections.
- Don't fabricate fake user testimonials, invented security badges, or unverified claims.
- Don't mix mismatched corner radiuses on adjacent components within the same card.
