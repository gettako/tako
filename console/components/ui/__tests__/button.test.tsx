import { describe, test, expect, spyOn } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Link from "next/link"
import { Button } from "../button"

describe("Button Component (Base UI / shadcn base-vega)", () => {
  test("renders standard button as a native <button> tag", () => {
    const html = renderToStaticMarkup(<Button>Click me</Button>)
    expect(html).toContain("<button")
    expect(html).toContain('data-slot="button"')
    expect(html).toContain("Click me")
  })

  test("renders non-button element via render prop without error", () => {
    const html = renderToStaticMarkup(
      <Button render={<Link href="/servers" />}>Manage Servers</Button>
    )
    expect(html).toContain("<a")
    expect(html).toContain('href="/servers"')
    expect(html).toContain("Manage Servers")
  })

  test("renders anchor tag via render prop cleanly", () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" render={<a href="/external" />}>
        External Link
      </Button>
    )
    expect(html).toContain("<a")
    expect(html).toContain('href="/external"')
    expect(html).toContain("External Link")
  })

  test("does not log Base UI nativeButton console errors when rendering a non-button", () => {
    const consoleErrorSpy = spyOn(console, "error")
    renderToStaticMarkup(
      <Button render={<Link href="/projects" />}>All Projects</Button>
    )

    // Ensure no Base UI nativeButton warning was logged
    const baseUiWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) => typeof arg === "string" && arg.includes("nativeButton")
      )
    )
    expect(baseUiWarnings.length).toBe(0)
    consoleErrorSpy.mockRestore()
  })

  test("applies proportional size hierarchy classes across all button sizes", () => {
    const xs = renderToStaticMarkup(<Button size="xs">XS</Button>)
    expect(xs).toContain("h-6")
    expect(xs).toContain("px-2")
    expect(xs).toContain("text-xs")

    const sm = renderToStaticMarkup(<Button size="sm">SM</Button>)
    expect(sm).toContain("h-8")
    expect(sm).toContain("px-2.5")

    const def = renderToStaticMarkup(<Button>Default</Button>)
    expect(def).toContain("h-9")
    expect(def).toContain("px-2.5")

    const lg = renderToStaticMarkup(<Button size="lg">LG</Button>)
    expect(lg).toContain("h-10")
    expect(lg).toContain("px-2.5")

    const iconXs = renderToStaticMarkup(
      <Button size="icon-xs" aria-label="icon-xs" />
    )
    expect(iconXs).toContain("size-6")

    const iconSm = renderToStaticMarkup(
      <Button size="icon-sm" aria-label="icon-sm" />
    )
    expect(iconSm).toContain("size-8")

    const iconDef = renderToStaticMarkup(
      <Button size="icon" aria-label="icon-def" />
    )
    expect(iconDef).toContain("size-9")

    const iconLg = renderToStaticMarkup(
      <Button size="icon-lg" aria-label="icon-lg" />
    )
    expect(iconLg).toContain("size-10")
  })
})
