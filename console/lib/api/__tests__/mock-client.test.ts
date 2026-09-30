import { describe, it, expect } from "bun:test"
import { MockApiClient } from "../mock-client"

describe("MockApiClient", () => {
  it("mutates internal state on createProject", async () => {
    const client = new MockApiClient()
    const initialProjects = await client.projects.list()
    const countBefore = initialProjects.length

    const newProject = await client.projects.create({
      name: "New Test Project",
      description: "Testing mutation",
    })

    expect(newProject.name).toBe("New Test Project")

    const projectsAfter = await client.projects.list()
    expect(projectsAfter.length).toBe(countBefore + 1)
    expect(projectsAfter.some((p) => p.id === newProject.id)).toBe(true)
  })

  it("yields build log events sequentially from streamBuildLogs", async () => {
    const client = new MockApiClient()
    const events = []
    const startTime = Date.now()

    for await (const event of client.services.streamBuildLogs(
      "srv_web_prod",
      "dep_001"
    )) {
      events.push(event)
      if (events.length >= 3) break
    }

    const elapsed = Date.now() - startTime
    expect(events.length).toBe(3)
    expect(elapsed).toBeGreaterThanOrEqual(200) // 120ms * 2 delays at least
  })

  it("handles server mutations correctly", async () => {
    const client = new MockApiClient()
    const initial = await client.servers.list()
    const countBefore = initial.length

    const created = await client.servers.create({
      name: "Test Worker Node",
    })

    expect(created.server.name).toBe("Test Worker Node")
    expect(created.enrollment_token).toBeDefined()
    expect(created.compose_snippet).toContain("tako-agent")

    const afterList = await client.servers.list()
    expect(afterList.length).toBe(countBefore + 1)
  })
})
