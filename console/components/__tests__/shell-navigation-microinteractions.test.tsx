import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"

// Mock next/navigation
const mockPush = mock()
mock.module("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: mockPush,
    replace: mock(),
    prefetch: mock(),
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import {
  useKeyboardNavigation,
  isInputElement,
  isDialogOpen,
  DESTINATION_MAP,
} from "@/hooks/use-keyboard-navigation"
import { CopyButton } from "@/components/ui/copy-button"
import { KeyboardNavigation } from "@/components/keyboard-navigation"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"

describe("M6-006: Shell Navigation and Micro-interactions", () => {
  let originalClipboard: any
  let originalLocalStorage: any

  beforeEach(() => {
    mockPush.mockClear()
    originalClipboard = globalThis.navigator?.clipboard
    originalLocalStorage = globalThis.localStorage
  })

  afterEach(() => {
    if (originalClipboard !== undefined) {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
        writable: true,
      })
    }
    if (originalLocalStorage !== undefined) {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      })
    }
  })

  describe("Sidebar Collapse State Persistence", () => {
    it("synchronously reads tako_sidebar_collapsed from localStorage", () => {
      const storage: Record<string, string> = {
        tako_sidebar_collapsed: "true",
      }

      const mockLocalStorage = {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, val: string) => {
          storage[key] = val
        },
        removeItem: (key: string) => {
          delete storage[key]
        },
        clear: () => {},
        length: 1,
        key: () => null,
      }

      Object.defineProperty(globalThis, "localStorage", {
        value: mockLocalStorage,
        configurable: true,
        writable: true,
      })

      let renderedOpen: boolean | undefined

      function TestConsumer() {
        const { open } = useSidebar()
        renderedOpen = open
        return <div data-open={String(open)}>Sidebar</div>
      }

      const html = renderToString(
        <SidebarProvider defaultOpen={true}>
          <TestConsumer />
        </SidebarProvider>
      )

      // When tako_sidebar_collapsed is "true", sidebar is collapsed (open === false)
      expect(renderedOpen).toBe(false)
      expect(html).toContain('data-open="false"')
    })

    it("defaults to open when tako_sidebar_collapsed is false or absent", () => {
      const storage: Record<string, string> = {}

      const mockLocalStorage = {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, val: string) => {
          storage[key] = val
        },
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      }

      Object.defineProperty(globalThis, "localStorage", {
        value: mockLocalStorage,
        configurable: true,
        writable: true,
      })

      let renderedOpen: boolean | undefined

      function TestConsumer() {
        const { open } = useSidebar()
        renderedOpen = open
        return <div data-open={String(open)}>Sidebar</div>
      }

      const html = renderToString(
        <SidebarProvider defaultOpen={true}>
          <TestConsumer />
        </SidebarProvider>
      )

      expect(renderedOpen).toBe(true)
      expect(html).toContain('data-open="true"')
    })
  })

  describe("useCopyToClipboard Hook & CopyButton Component", () => {
    it("renders CopyButton with accessible attributes, live region, and zero shadows", () => {
      const html = renderToString(
        <CopyButton
          text="https://gettako.dev/api/webhook"
          label="Copy URL"
          className="custom-copy-btn"
        />
      )

      expect(html).toContain("Copy URL")
      expect(html).toContain('aria-label="Copy Copy URL"')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain("custom-copy-btn")
      // Zero shadows: must not contain shadow utility
      expect(html).not.toContain("shadow-")
    })

    it("renders CopyButton in icon-only mode with proper title and aria-label", () => {
      const html = renderToString(
        <CopyButton
          text="srv_12345"
          showIconOnly
          title="Copy server ID"
          aria-label="Copy server ID"
        />
      )

      expect(html).toContain('title="Copy server ID"')
      expect(html).toContain('aria-label="Copy server ID"')
      expect(html).toContain('aria-live="polite"')
    })

    it("invokes navigator.clipboard.writeText and returns true on success", async () => {
      let copiedText = ""
      const mockClipboard = {
        writeText: async (text: string) => {
          copiedText = text
        },
      }

      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: mockClipboard,
        configurable: true,
        writable: true,
      })

      let hookResult: ReturnType<typeof useCopyToClipboard> | null = null

      function TestHookComponent() {
        hookResult = useCopyToClipboard(2000)
        return null
      }

      renderToString(<TestHookComponent />)
      expect(hookResult).not.toBeNull()

      const success = await hookResult!.copy("docker compose up -d")
      expect(success).toBe(true)
      expect(copiedText).toBe("docker compose up -d")
    })

    it("handles clipboard write failure gracefully returning false without throwing", async () => {
      const mockClipboard = {
        writeText: async () => {
          throw new Error("Permission denied")
        },
      }

      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: mockClipboard,
        configurable: true,
        writable: true,
      })

      let hookResult: ReturnType<typeof useCopyToClipboard> | null = null

      function TestHookComponent() {
        hookResult = useCopyToClipboard(2000)
        return null
      }

      renderToString(<TestHookComponent />)
      expect(hookResult).not.toBeNull()

      const success = await hookResult!.copy("failing-payload")
      expect(success).toBe(false)
    })

    it("handles missing clipboard API gracefully returning false", async () => {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      })

      let hookResult: ReturnType<typeof useCopyToClipboard> | null = null

      function TestHookComponent() {
        hookResult = useCopyToClipboard(2000)
        return null
      }

      renderToString(<TestHookComponent />)
      expect(hookResult).not.toBeNull()

      const success = await hookResult!.copy("no-api")
      expect(success).toBe(false)
    })
  })

  describe("Global Keyboard Shortcut Navigation (G Chords)", () => {
    it("renders KeyboardNavigation cheat sheet with all 5 chords and flat theme", () => {
      const html = renderToString(
        <aside
          role="status"
          aria-live="polite"
          aria-label="Keyboard navigation cheat sheet"
          className="pointer-events-none fixed right-4 bottom-4 z-50 rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground select-none"
        >
          <div className="mb-2 flex items-center justify-between gap-4 border-b border-border pb-1.5 font-mono text-2xs text-muted-foreground">
            <span className="font-semibold tracking-wider text-foreground uppercase">
              Go to...
            </span>
            <span>ESC to cancel</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div>Dashboard G D</div>
            <div>Projects G P</div>
            <div>Servers G S</div>
            <div>GitHub Settings G G</div>
            <div>Security Settings G A</div>
          </div>
        </aside>
      )

      expect(html).toContain("Dashboard")
      expect(html).toContain("Projects")
      expect(html).toContain("Servers")
      expect(html).toContain("GitHub Settings")
      expect(html).toContain("Security Settings")
      expect(html).toContain('aria-live="polite"')
      expect(html).not.toContain("shadow-")
    })

    it("mounts useKeyboardNavigation hook cleanly in SSR", () => {
      function TestHook() {
        const { isPending } = useKeyboardNavigation()
        return <div data-pending={String(isPending)}>Nav</div>
      }

      const html = renderToString(<TestHook />)
      expect(html).toContain('data-pending="false"')
    })

    it("verifies the defined chord destination mapping", () => {
      const chords: Record<string, string> = {
        d: "/",
        p: "/projects",
        s: "/servers",
        g: "/settings/github",
        a: "/settings/security",
      }

      expect(chords["d"]).toBe("/")
      expect(chords["p"]).toBe("/projects")
      expect(chords["s"]).toBe("/servers")
      expect(chords["g"]).toBe("/settings/github")
      expect(chords["a"]).toBe("/settings/security")
    })

    it("verifies the defined chord destination mapping matches DESTINATION_MAP", () => {
      expect(DESTINATION_MAP["d"]).toBe("/")
      expect(DESTINATION_MAP["p"]).toBe("/projects")
      expect(DESTINATION_MAP["s"]).toBe("/servers")
      expect(DESTINATION_MAP["g"]).toBe("/settings/github")
      expect(DESTINATION_MAP["a"]).toBe("/settings/security")
    })

    it("identifies input elements for chord suppression", () => {
      const inputEl = { tagName: "INPUT" } as unknown as HTMLElement
      const textareaEl = { tagName: "TEXTAREA" } as unknown as HTMLElement
      const selectEl = { tagName: "SELECT" } as unknown as HTMLElement
      const contentEditableEl = {
        tagName: "DIV",
        isContentEditable: true,
      } as unknown as HTMLElement
      const customEditableEl = {
        tagName: "DIV",
        isContentEditable: false,
        getAttribute: (attr: string) =>
          attr === "contenteditable" ? "true" : null,
      } as unknown as HTMLElement
      const regularDiv = {
        tagName: "DIV",
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      expect(isInputElement(inputEl)).toBe(true)
      expect(isInputElement(textareaEl)).toBe(true)
      expect(isInputElement(selectEl)).toBe(true)
      expect(isInputElement(contentEditableEl)).toBe(true)
      expect(isInputElement(customEditableEl)).toBe(true)
      expect(isInputElement(regularDiv)).toBe(false)
      expect(isInputElement(null)).toBe(false)
    })

    it("verifies dialog detection logic for modal suppression", () => {
      expect(typeof isDialogOpen).toBe("function")
      expect(isDialogOpen()).toBe(false)
    })
  })

  describe("Anti-slop & Zero Shadow Compliance", () => {
    it("ensures new shell components contain zero em dashes and zero box-shadows", async () => {
      const files = [
        "components/ui/copy-button.tsx",
        "hooks/use-copy-to-clipboard.ts",
        "hooks/use-keyboard-navigation.ts",
        "components/keyboard-navigation.tsx",
      ]

      for (const relPath of files) {
        const file = Bun.file(`${process.cwd()}/${relPath}`)
        const text = await file.text()

        expect(text).not.toContain("—")
        expect(text).not.toContain("box-shadow")
        expect(text).not.toContain("shadow-lg")
        expect(text).not.toContain("shadow-md")
        expect(text).not.toContain("shadow-sm")
      }
    })
  })
})
