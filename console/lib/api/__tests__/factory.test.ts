import { describe, it, expect, beforeEach, afterAll } from "bun:test"
import {
  getApiClient,
  resetApiClient,
  api,
  MockApiClient,
  LiveApiClient,
} from "../index"

describe("ApiClient Factory", () => {
  beforeEach(() => {
    resetApiClient()
  })

  afterAll(() => {
    resetApiClient()
  })

  it("returns MockApiClient when mode is unset or mock", () => {
    const client = getApiClient("mock")
    expect(client instanceof MockApiClient).toBe(true)
  })

  it("returns LiveApiClient when mode is live", () => {
    const client = getApiClient("live")
    expect(client instanceof LiveApiClient).toBe(true)
    resetApiClient()
  })

  it("has accessible methods on the exported api proxy", async () => {
    const projects = await api.projects.list()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBeGreaterThan(0)
  })
})
