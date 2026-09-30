import { describe, it, expect, mock, beforeEach } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import SettingsStoragePage, { STORAGE_PRESETS, getProviderBadge } from "../page"
import {
  api,
  resetApiClient,
  ApiError,
  type S3Destination,
  type CreateS3DestinationRequest,
} from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings/storage",
  useSearchParams: () => new URLSearchParams(),
}))

describe("SettingsStoragePage (M15-002 Multi-S3 Storage Destinations)", () => {
  beforeEach(() => {
    resetApiClient()
  })

  it("renders SettingsStoragePage layout cleanly without errors and with zero em dashes", () => {
    const html = renderToString(<SettingsStoragePage />)

    expect(html).toContain("Storage Destinations")
    expect(html).toContain(
      "Centralized management for multiple S3-compatible endpoints"
    )
    expect(html).toContain("Add S3 Destination")
    expect(html).toContain("General")
    expect(html).toContain("Users")
    expect(html).toContain("GitHub Integration")
    expect(html).toContain("Storage")
    expect(html).toContain("Backups")
    expect(html).toContain("Notifications")

    // Anti-slop check: zero em dashes
    expect(html).not.toContain("—")
  })

  it("provides comprehensive preset configurations for major S3 providers", () => {
    expect(STORAGE_PRESETS.r2.label).toBe("Cloudflare R2")
    expect(STORAGE_PRESETS.r2.defaultRegion).toBe("auto")
    expect(STORAGE_PRESETS.r2.usePathStyle).toBe(false)

    expect(STORAGE_PRESETS.aws.label).toBe("AWS S3")
    expect(STORAGE_PRESETS.aws.defaultRegion).toBe("us-east-1")
    expect(STORAGE_PRESETS.aws.usePathStyle).toBe(false)

    expect(STORAGE_PRESETS.minio.label).toBe("MinIO")
    expect(STORAGE_PRESETS.minio.usePathStyle).toBe(true)

    expect(STORAGE_PRESETS.wasabi.label).toBe("Wasabi")
    expect(STORAGE_PRESETS.wasabi.usePathStyle).toBe(false)

    expect(STORAGE_PRESETS.b2.label).toBe("Backblaze B2")
    expect(STORAGE_PRESETS.b2.defaultRegion).toBe("us-west-002")

    expect(STORAGE_PRESETS.custom.label).toBe("Custom S3")
  })

  it("detects provider badge correctly from endpoint URL or name", () => {
    // Cloudflare R2
    const r2Badge = getProviderBadge(
      "https://abc123.r2.cloudflarestorage.com",
      "Production R2"
    )
    expect(r2Badge.label).toBe("Cloudflare R2")

    // AWS S3
    const awsBadge = getProviderBadge(
      "https://s3.us-west-2.amazonaws.com",
      "AWS Backups"
    )
    expect(awsBadge.label).toBe("AWS S3")

    // MinIO
    const minioBadge = getProviderBadge("http://minio:9000", "Local MinIO")
    expect(minioBadge.label).toBe("MinIO")

    // Wasabi
    const wasabiBadge = getProviderBadge(
      "https://s3.wasabisys.com",
      "Wasabi Cold Storage"
    )
    expect(wasabiBadge.label).toBe("Wasabi")

    // Backblaze B2
    const b2Badge = getProviderBadge(
      "https://s3.us-west-002.backblazeb2.com",
      "B2 Bucket"
    )
    expect(b2Badge.label).toBe("Backblaze B2")

    // Fallback Custom S3
    const customBadge = getProviderBadge(
      "https://storage.mycompany.internal",
      "Internal Storage"
    )
    expect(customBadge.label).toBe("S3 Compatible")
  })

  it("fetches S3 destinations from MockApiClient accurately", async () => {
    const destinations = await api.storage.listS3Destinations()

    expect(Array.isArray(destinations)).toBe(true)
    expect(destinations.length).toBeGreaterThanOrEqual(2)

    // First destination is default Cloudflare R2
    const defaultDest = destinations.find((d) => d.is_default)
    expect(defaultDest).toBeDefined()
    expect(defaultDest?.name).toContain("Cloudflare R2")
    expect(defaultDest?.is_default).toBe(true)

    // AWS S3 destination exists
    const awsDest = destinations.find((d) =>
      d.endpoint.includes("amazonaws.com")
    )
    expect(awsDest).toBeDefined()
    expect(awsDest?.region).toBe("us-east-1")
  })

  it("creates a new S3 storage destination and enforces single-default constraint", async () => {
    const newDestReq: CreateS3DestinationRequest = {
      name: "MinIO Local Cluster",
      endpoint: "http://minio.local:9000",
      region: "us-east-1",
      bucket_name: "local-backups",
      access_key_id: "minioadmin",
      secret_access_key: "minioadmin123",
      use_path_style: true,
      is_default: true, // Marked as default
    }

    const created = await api.storage.createS3Destination(newDestReq)
    expect(created.id).toBeDefined()
    expect(created.name).toBe("MinIO Local Cluster")
    expect(created.use_path_style).toBe(true)
    expect(created.is_default).toBe(true)

    // Verify that other destinations are no longer default
    const all = await api.storage.listS3Destinations()
    const defaultDests = all.filter((d) => d.is_default)
    expect(defaultDests.length).toBe(1)
    expect(defaultDests[0].id).toBe(created.id)
  })

  it("updates an existing S3 destination and toggles default destination", async () => {
    const list = await api.storage.listS3Destinations()
    const nonDefault = list.find((d) => !d.is_default)
    expect(nonDefault).toBeDefined()

    if (nonDefault) {
      const updated = await api.storage.updateS3Destination(nonDefault.id, {
        name: `${nonDefault.name} (Updated)`,
        is_default: true,
      })

      expect(updated.name).toContain("(Updated)")
      expect(updated.is_default).toBe(true)

      // Ensure single-default rule holds
      const afterUpdate = await api.storage.listS3Destinations()
      const defaults = afterUpdate.filter((d) => d.is_default)
      expect(defaults.length).toBe(1)
      expect(defaults[0].id).toBe(nonDefault.id)
    }
  })

  it("executes raw and destination-bound S3 connection tests successfully", async () => {
    // Raw test with full credentials
    const rawRes = await api.storage.testS3Raw({
      endpoint: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      bucket_name: "test-bucket",
      access_key_id: "AKIA_TEST",
      secret_access_key: "SECRET_TEST",
      use_path_style: false,
    })
    expect(rawRes.success).toBe(true)
    expect(rawRes.message?.toLowerCase()).toContain("successful")

    // Destination-bound test by ID
    const list = await api.storage.listS3Destinations()
    const dest = list[0]
    const destRes = await api.storage.testS3Destination(dest.id)
    expect(destRes.success).toBe(true)
    expect(destRes.message?.toLowerCase()).toContain("successful")
  })

  it("deletes an S3 destination cleanly", async () => {
    const initialList = await api.storage.listS3Destinations()
    const destToDelete = initialList[initialList.length - 1]

    await api.storage.deleteS3Destination(destToDelete.id)

    const updatedList = await api.storage.listS3Destinations()
    expect(updatedList.some((d) => d.id === destToDelete.id)).toBe(false)
  })
})
