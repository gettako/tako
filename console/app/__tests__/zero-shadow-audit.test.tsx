import { describe, it, expect } from "bun:test"
import * as fs from "fs"
import * as path from "path"

function getFilesRecursively(dir: string, extensions: string[]): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "__tests__") {
        results = results.concat(getFilesRecursively(filePath, extensions))
      }
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(filePath)
      }
    }
  }
  return results
}

describe("Flat Theme Zero-Shadow Audit (M6-004)", () => {
  it("verifies globals.css enforces global flat override with !important reset", () => {
    const cssPath = path.resolve(import.meta.dir, "../globals.css")
    const cssContent = fs.readFileSync(cssPath, "utf-8")

    expect(cssContent).toContain("--tw-shadow: 0 0 #0000 !important")
    expect(cssContent).toContain("--tw-shadow-colored: 0 0 #0000 !important")
    expect(cssContent).toContain("box-shadow: 0 0 #0000 !important")
  })

  it("verifies zero functional drop shadow classes in components and pages", () => {
    const appDir = path.resolve(import.meta.dir, "..")
    const componentsDir = path.resolve(import.meta.dir, "../../components")

    const files = [
      ...getFilesRecursively(appDir, [".tsx", ".ts"]),
      ...getFilesRecursively(componentsDir, [".tsx", ".ts"]),
    ]

    const forbiddenShadowPatterns = [
      /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/,
      /\bdrop-shadow-(?:sm|md|lg|xl|2xl)\b/,
    ]

    const violations: { file: string; match: string }[] = []

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8")
      for (const pattern of forbiddenShadowPatterns) {
        const match = content.match(pattern)
        if (match) {
          violations.push({ file, match: match[0] })
        }
      }
    }

    expect(violations).toEqual([])
  })
})
