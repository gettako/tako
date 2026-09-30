import { describe, test, expect } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Checkbox } from "../checkbox"

describe("Checkbox Component (shadcn / base-vega)", () => {
  test("renders Checkbox without shadows and with proper accessible attributes", () => {
    const html = renderToStaticMarkup(
      <Checkbox id="test-checkbox" checked={true} aria-label="Trigger deploy" />
    )

    expect(html).toContain('data-slot="checkbox"')
    expect(html).toContain("data-checked")
    expect(html).not.toContain("shadow-")
    expect(html).not.toContain("—")
  })
})
