import { describe, it, expect } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { toast, Toaster } from "../toast"

describe("Toast component and store", () => {
  it("renders toast messages without crashing and adheres to Precision Flat", () => {
    toast.success("Retention policy saved successfully.")
    toast.error("Failed to update domain.")

    const html = renderToString(<Toaster />)
    expect(html).toContain("Retention policy saved successfully.")
    expect(html).toContain("Failed to update domain.")
    expect(html).toContain("border border-border")
    expect(html).not.toContain("shadow-")
    expect(html).not.toContain("—")
  })
})
