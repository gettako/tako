import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { LiveApiClient } from "../live-client"
import { ApiError } from "../client"

describe("LiveApiClient", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("makes fetch requests with credentials include and application/json", async () => {
    let capturedUrl = ""
    let capturedOptions: RequestInit | undefined

    globalThis.fetch = mock(
      async (url: string | URL | Request, options?: RequestInit) => {
        capturedUrl = url.toString()
        capturedOptions = options
        return new Response(JSON.stringify([{ id: "proj-1", name: "Acme" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    ) as unknown as typeof globalThis.fetch

    const client = new LiveApiClient()
    const projects = await client.projects.list()

    expect(capturedUrl).toBe("/api/projects")
    expect(capturedOptions?.credentials).toBe("include")
    expect(projects).toEqual([{ id: "proj-1", name: "Acme" } as any])
  })

  it("translates non-2xx responses into typed ApiError instances", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          code: "NOT_FOUND",
          message: "Project not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof globalThis.fetch

    const client = new LiveApiClient()
    try {
      await client.projects.get("proj-999")
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err instanceof ApiError).toBe(true)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(404)
      expect(apiErr.code).toBe("NOT_FOUND")
      expect(apiErr.message).toBe("Project not found")
    }
  })

  it("parses SSE event streams into AsyncIterable chunks", async () => {
    const ssePayload =
      'data: {"line":"Step 1/5 : FROM alpine","stream":"stdout","timestamp":1700000000}\n\ndata: {"line":"Build complete","stream":"stdout","timestamp":1700000001}\n\n'

    globalThis.fetch = mock(
      async (url: string | URL | Request, options?: RequestInit) => {
        const headers = new Headers(options?.headers)
        expect(headers.get("Accept")).toBe("text/event-stream")
        expect(options?.credentials).toBe("include")

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(ssePayload))
            controller.close()
          },
        })

        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      }
    ) as unknown as typeof globalThis.fetch

    const client = new LiveApiClient()
    const events: any[] = []

    for await (const chunk of client.services.streamBuildLogs(
      "svc-1",
      "dep-1"
    )) {
      events.push(chunk)
    }

    expect(events.length).toBe(2)
    expect(events[0].line).toBe("Step 1/5 : FROM alpine")
    expect(events[1].line).toBe("Build complete")
  })
})
