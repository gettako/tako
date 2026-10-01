import { describe, it, expect } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { FieldError, FieldLabel, FieldGroup } from "../field"

describe("Field components", () => {
  it("renders field label and error below field properly", () => {
    const html = renderToString(
      <FieldGroup>
        <FieldLabel required htmlFor="email">
          Email Address
        </FieldLabel>
        <FieldError message="Please enter a valid email address." />
      </FieldGroup>
    )

    expect(html).toContain("Email Address")
    expect(html).toContain("Please enter a valid email address.")
    expect(html).toContain("text-destructive")
    expect(html).toContain('role="alert"')
    expect(html).not.toContain("—")
  })

  it("does not render FieldError when message is null or empty", () => {
    const html = renderToString(
      <FieldGroup>
        <FieldError message="" />
        <FieldError message={null} />
      </FieldGroup>
    )

    expect(html).not.toContain('role="alert"')
  })
})
