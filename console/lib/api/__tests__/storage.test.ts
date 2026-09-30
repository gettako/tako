import { describe, it, expect, beforeEach } from "bun:test"
import { MockApiClient } from "../mock-client"

describe("StorageApiClient", () => {
  let client: MockApiClient

  beforeEach(() => {
    client = new MockApiClient()
  })

  it("lists default configured S3 destinations", async () => {
    const list = await client.storage.listS3Destinations()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].is_default).toBe(true)
  })

  it("creates a new S3 destination and verifies single default constraint", async () => {
    const newDest = await client.storage.createS3Destination({
      name: "Wasabi EU Central",
      endpoint: "https://s3.eu-central-1.wasabisys.com",
      region: "eu-central-1",
      bucket_name: "eu-backups",
      access_key_id: "WASABI_KEY_123",
      secret_access_key: "WASABI_SECRET_456",
      use_path_style: false,
      is_default: true,
    })

    expect(newDest.id).toBeDefined()
    expect(newDest.name).toBe("Wasabi EU Central")
    expect(newDest.is_default).toBe(true)

    // Verify all other destinations are no longer default
    const all = await client.storage.listS3Destinations()
    const defaultDests = all.filter((d) => d.is_default)
    expect(defaultDests.length).toBe(1)
    expect(defaultDests[0].id).toBe(newDest.id)
  })

  it("updates an S3 destination", async () => {
    const list = await client.storage.listS3Destinations()
    const target = list[0]

    const updated = await client.storage.updateS3Destination(target.id, {
      name: "Renamed Storage Destination",
    })
    expect(updated.name).toBe("Renamed Storage Destination")
  })

  it("deletes an S3 destination", async () => {
    const list = await client.storage.listS3Destinations()
    const target = list[0]

    const res = await client.storage.deleteS3Destination(target.id)
    expect(res.success).toBe(true)

    const updatedList = await client.storage.listS3Destinations()
    expect(updatedList.some((d) => d.id === target.id)).toBe(false)
  })

  it("tests S3 destination connection", async () => {
    const list = await client.storage.listS3Destinations()
    const target = list[0]

    const res = await client.storage.testS3Destination(target.id)
    expect(res.success).toBe(true)
  })

  it("tests raw S3 credentials", async () => {
    const res = await client.storage.testS3Raw({
      bucket_name: "test-bucket",
      access_key_id: "AKIA123",
      secret_access_key: "SECRET123",
      use_path_style: false,
    })
    expect(res.success).toBe(true)
  })
})
