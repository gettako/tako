import { describe, it, expect } from "bun:test"

// WCAG relative luminance calculation
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "")
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return [r, g, b]
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getContrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  const l1 = getLuminance(r1, g1, b1)
  const l2 = getLuminance(r2, g2, b2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe("WCAG AA Color Contrast and Dual-Theme Audit (M6-003)", () => {
  describe("Light Mode Theme Contrast", () => {
    it("primary body text against background exceeds 4.5:1 (WCAG AA)", () => {
      const ratio = getContrastRatio("#09090B", "#FFFFFF")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(ratio).toBeGreaterThan(15) // High contrast
    })

    it("muted metadata text against background exceeds 4.5:1 (WCAG AA)", () => {
      const ratio = getContrastRatio("#71717A", "#FFFFFF")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it("all Light Mode status badge text against status badge background exceed 4.5:1", () => {
      const lightStatuses = [
        { name: "healthy", text: "#15803D", bg: "#F0FDF4" },
        { name: "building", text: "#2563EB", bg: "#EFF6FF" },
        { name: "failed", text: "#B91C1C", bg: "#FEF2F2" },
        { name: "stopped", text: "#52525B", bg: "#F4F4F5" },
        { name: "queued", text: "#B45309", bg: "#FFFBEB" },
      ]

      for (const s of lightStatuses) {
        const ratio = getContrastRatio(s.text, s.bg)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  describe("Dark Mode Theme Contrast", () => {
    it("primary body text against background exceeds 4.5:1 (WCAG AA)", () => {
      const ratio = getContrastRatio("#F4F4F5", "#0B0C14")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(ratio).toBeGreaterThan(15)
    })

    it("muted metadata text against background exceeds 4.5:1 (WCAG AA)", () => {
      const ratio = getContrastRatio("#8E95A5", "#0B0C14")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it("all Dark Mode status badge text against status badge background exceed 4.5:1", () => {
      const darkStatuses = [
        { name: "healthy", text: "#4ADE80", bg: "#052E16" },
        { name: "building", text: "#60A5FA", bg: "#172554" },
        { name: "failed", text: "#F87171", bg: "#450A0A" },
        { name: "stopped", text: "#A1A1AA", bg: "#18181B" },
        { name: "queued", text: "#FBBF24", bg: "#451A03" },
      ]

      for (const s of darkStatuses) {
        const ratio = getContrastRatio(s.text, s.bg)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  describe("Log Viewer Canvas Contrast", () => {
    it("stdout stream text against #090A0F exceeds 4.5:1", () => {
      const ratio = getContrastRatio("#E4E4E7", "#090A0F")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(ratio).toBeGreaterThan(15)
    })

    it("stderr stream text against #090A0F exceeds 4.5:1", () => {
      const ratio = getContrastRatio("#F87171", "#090A0F")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(ratio).toBeGreaterThan(7)
    })

    it("step header stream text against #090A0F exceeds 4.5:1", () => {
      const ratio = getContrastRatio("#38BDF8", "#090A0F")
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(ratio).toBeGreaterThan(9)
    })
  })
})
