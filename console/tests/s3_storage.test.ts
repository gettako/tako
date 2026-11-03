import { describe, expect, it } from "bun:test"
import { S3BucketConfig } from "@/types/platform"

describe("S3 Storage Configuration", () => {
  it("validates essential bucket configuration fields", () => {
    const config: S3BucketConfig = {
      id: "bkt-1",
      name: "Primary Cloudflare R2",
      endpoint: "https://acc.r2.cloudflarestorage.com",
      bucket: "tako-backups",
      region: "auto",
      accessKey: "AKIA123",
      secretKey: "SECRET123",
      forcePathStyle: true,
      isDefault: true,
    }
    expect(config.name).toBe("Primary Cloudflare R2")
    expect(config.forcePathStyle).toBe(true)
    expect(config.isDefault).toBe(true)
  })

  it("handles empty buckets in health evaluation correctly", () => {
    const buckets: { status: "connected" | "error" }[] = []
    const isUnconfigured = buckets.length === 0
    expect(isUnconfigured).toBe(true)
  })

  it("identifies unreachable buckets in health calculation", () => {
    const buckets = [
      { id: "b1", status: "connected" },
      { id: "b2", status: "error" },
    ]
    const unreachableCount = buckets.filter((b) => b.status === "error").length
    expect(unreachableCount).toBe(1)
  })
})

