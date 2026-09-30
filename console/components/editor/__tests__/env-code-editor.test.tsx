import { describe, test, expect } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EnvCodeEditor } from "../env-code-editor"

describe("EnvCodeEditor Component", () => {
  test("renders syntax-highlighted tokens for .env variables", () => {
    const envContent = `DATABASE_URL="postgres://user:secret@localhost:5432/db"
# Secret signing key
JWT_SECRET=supersecret123
IS_ACTIVE=true
PORT=3000`

    const html = renderToStaticMarkup(
      <EnvCodeEditor
        value={envContent}
        onChange={() => {}}
        placeholder="KEY=VALUE"
      />
    )

    // Verify container and editor elements
    expect(html).toContain(".env syntax")
    expect(html).toContain("5 lines")
    expect(html).toContain("<textarea")
    expect(html).toContain("<pre")
    expect(html).toContain("<code")

    // Verify Prism tokenization classes are applied
    expect(html).toContain("token variable")
    expect(html).toContain("token operator")
    expect(html).toContain("token string")
    expect(html).toContain("token comment")
    expect(html).toContain("token boolean")
    expect(html).toContain("token number")

    // Antislop check: zero em dashes
    expect(html).not.toContain("—")
  })
})
