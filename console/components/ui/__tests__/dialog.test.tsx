import { describe, test, expect } from "bun:test"
import { dialogVariants } from "../dialog"

describe("Dialog Component Variants & Proportional Sizes", () => {
  test("generates correct responsive max-width classes for all modal sizes", () => {
    expect(dialogVariants({ size: "sm" })).toContain("sm:max-w-sm")
    expect(dialogVariants({ size: "md" })).toContain("sm:max-w-md")
    expect(dialogVariants({ size: "default" })).toContain("sm:max-w-lg")
    expect(dialogVariants({ size: "lg" })).toContain("sm:max-w-xl")
    expect(dialogVariants({ size: "xl" })).toContain("sm:max-w-2xl")
    expect(dialogVariants({ size: "2xl" })).toContain("sm:max-w-3xl")
    expect(dialogVariants({ size: "3xl" })).toContain("sm:max-w-4xl")
    expect(dialogVariants({ size: "4xl" })).toContain("sm:max-w-5xl")
    expect(dialogVariants({ size: "full" })).toContain(
      "sm:max-w-[calc(100%-3rem)]"
    )
  })

  test("includes positioning and proportional bounds for dialog card", () => {
    const defaultClasses = dialogVariants()
    expect(defaultClasses).toContain("relative")
    expect(defaultClasses).toContain("my-auto")
    expect(defaultClasses).toContain("sm:max-w-lg")
  })
})
