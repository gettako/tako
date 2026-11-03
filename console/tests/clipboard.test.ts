import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { copyToClipboard } from "@/lib/clipboard"

describe("copyToClipboard utility", () => {
  const originalNavigator = globalThis.navigator
  const originalDocument = globalThis.document
  const originalWindow = (globalThis as any).window

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Restore global state
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    })
  })

  it("copies successfully using modern navigator.clipboard.writeText", async () => {
    let written = ""
    const mockClipboard = {
      writeText: async (text: string) => {
        written = text
      },
    }

    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator, clipboard: mockClipboard },
      writable: true,
      configurable: true,
    })

    const result = await copyToClipboard("test-modern-copy")
    expect(result).toBe(true)
    expect(written).toBe("test-modern-copy")
  })

  it("falls back to document.execCommand when navigator.clipboard is undefined (e.g. HTTP non-secure context)", async () => {
    let execCommandCalledWith = ""
    let appendedValue = ""

    const mockDocument = {
      createElement: (tag: string) => {
        if (tag === "textarea") {
          const el = {
            value: "",
            style: {},
            setAttribute: () => {},
            focus: () => {},
            select: () => {},
          }
          return el
        }
        return {}
      },
      body: {
        appendChild: (el: any) => {
          appendedValue = el.value
        },
        removeChild: (_el: any) => {},
      },
      execCommand: (command: string) => {
        execCommandCalledWith = command
        return true
      },
    }

    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator, clipboard: undefined },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "document", {
      value: mockDocument,
      writable: true,
      configurable: true,
    })

    const result = await copyToClipboard("http-fallback-token")
    expect(result).toBe(true)
    expect(appendedValue).toBe("http-fallback-token")
    expect(execCommandCalledWith).toBe("copy")
  })

  it("falls back to document.execCommand when navigator.clipboard.writeText rejects", async () => {
    let execCommandCalledWith = ""

    const mockClipboard = {
      writeText: async () => {
        throw new Error("Permission denied or document not focused")
      },
    }

    const mockDocument = {
      createElement: () => ({
        value: "",
        style: {},
        setAttribute: () => {},
        focus: () => {},
        select: () => {},
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
      execCommand: (command: string) => {
        execCommandCalledWith = command
        return true
      },
    }

    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator, clipboard: mockClipboard },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "document", {
      value: mockDocument,
      writable: true,
      configurable: true,
    })

    const result = await copyToClipboard("retry-on-failure")
    expect(result).toBe(true)
    expect(execCommandCalledWith).toBe("copy")
  })

  it("returns false if both writeText and execCommand fail or throw", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator, clipboard: undefined },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "document", {
      value: {
        createElement: () => {
          throw new Error("DOM not supported")
        },
        body: { appendChild: () => {}, removeChild: () => {} },
      },
      writable: true,
      configurable: true,
    })

    const result = await copyToClipboard("fail-safe")
    expect(result).toBe(false)
  })

  it("returns false in SSR environment where window is undefined", async () => {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const result = await copyToClipboard("ssr-test")
    expect(result).toBe(false)
  })
})
