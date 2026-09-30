import { describe, it, expect } from "bun:test"
import { MockApiClient } from "../mock-client"

describe("MockApiClient - notifications", () => {
  it("lists initial notification channels", async () => {
    const client = new MockApiClient()
    const channels = await client.notifications.list()
    expect(channels.length).toBeGreaterThanOrEqual(2)
    expect(channels.some((c) => c.type === "discord")).toBe(true)
    expect(channels.some((c) => c.type === "telegram")).toBe(true)
  })

  it("creates, updates, tests, and deletes a channel", async () => {
    const client = new MockApiClient()
    const initial = await client.notifications.list()
    const countBefore = initial.length

    // Create
    const created = await client.notifications.create({
      type: "discord",
      name: "Discord Production Alerts",
      enabled: true,
      webhook_url: "https://discord.com/api/webhooks/999/test-token",
      on_deploy_success: true,
      on_deploy_failed: true,
      on_container_crashed: false,
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe("Discord Production Alerts")
    expect(created.on_container_crashed).toBe(false)

    const listAfterCreate = await client.notifications.list()
    expect(listAfterCreate.length).toBe(countBefore + 1)

    // Update
    const updated = await client.notifications.update(created.id, {
      name: "Discord Alerts (Updated)",
      on_container_crashed: true,
    })
    expect(updated.name).toBe("Discord Alerts (Updated)")
    expect(updated.on_container_crashed).toBe(true)

    // Test notification
    const testResult = await client.notifications.test(created.id)
    expect(testResult.success).toBe(true)

    // Delete
    const deleteResult = await client.notifications.delete(created.id)
    expect(deleteResult.success).toBe(true)

    const listAfterDelete = await client.notifications.list()
    expect(listAfterDelete.length).toBe(countBefore)
  })
})
