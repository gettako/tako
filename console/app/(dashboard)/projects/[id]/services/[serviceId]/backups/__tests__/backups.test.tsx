import { describe, it, expect, mock, beforeEach } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceBackupsPage from "../page"
import SettingsBackupsPage from "@/app/(dashboard)/settings/backups/page"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_db_prod/backups",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceBackupsPage & S3 Backups (M14-003)", () => {
  beforeEach(() => {
    resetApiClient()
  })

  it("renders ServiceBackupsPage without crashing, with zero em dashes and zero shadows", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_db_prod" projectId="prj_acme">
        <ServiceBackupsPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
    expect(html).not.toContain("&mdash;")
    expect(html).not.toContain("shadow-")
  })

  it("renders SettingsBackupsPage without crashing, with zero em dashes and zero shadows", () => {
    const html = renderToString(<SettingsBackupsPage />)

    expect(html).toBeDefined()
    expect(html).toContain("Automated Control Plane Backups")
    expect(html).toContain("Storage Destination")
    expect(html).toContain("Manage in Storage")
    expect(html).toContain("Control Plane Database (SQLite)")
    expect(html).not.toContain("Access Key ID")
    expect(html).not.toContain("Secret Access Key")
    expect(html).not.toContain("—")
    expect(html).not.toContain("&mdash;")
    expect(html).not.toContain("shadow-")
  })

  it("fetches and updates global S3 backup configuration with destination selection via api.backups", async () => {
    const initialConfig = await api.backups.getConfig()
    expect(initialConfig).toBeDefined()
    expect(initialConfig.s3_destination_id).toBe("s3d_r2_primary")
    expect(initialConfig.bucket).toBe("tako-production-backups")
    expect(initialConfig.has_secret_key).toBe(true)

    const updated = await api.backups.updateConfig({
      s3_destination_id: "s3d_aws_cold",
      endpoint_url: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      bucket: "tako-cold-archive",
      retention_count: 14,
    })

    expect(updated.s3_destination_id).toBe("s3d_aws_cold")
    expect(updated.bucket).toBe("tako-cold-archive")
    expect(updated.retention_count).toBe(14)

    const refetched = await api.backups.getConfig()
    expect(refetched.s3_destination_id).toBe("s3d_aws_cold")
    expect(refetched.bucket).toBe("tako-cold-archive")
    expect(refetched.retention_count).toBe(14)
  })

  it("tests S3 connection using api.backups.testStorage", async () => {
    const testResult = await api.backups.testStorage({
      endpoint_url: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      bucket: "test-bucket",
      access_key: "AKIAEXAMPLE",
      secret_key: "SECRETEXAMPLE",
    })

    expect(testResult.success).toBe(true)
    expect(testResult.message).toContain("successfully")
  })

  it("manages control plane backups via api.backups", async () => {
    const initialBackups = await api.backups.listControlPlaneBackups()
    expect(Array.isArray(initialBackups)).toBe(true)
    expect(initialBackups.length).toBeGreaterThan(0)

    const triggered = await api.backups.triggerControlPlaneBackup()
    expect(triggered.id).toBeDefined()
    expect(triggered.backup_type).toBe("control_plane")
    expect(triggered.status).toBe("completed")

    const downloadUrl = await api.backups.downloadControlPlaneBackup(
      triggered.id
    )
    expect(downloadUrl.download_url).toBeDefined()
    expect(downloadUrl.download_url).toContain("https://")

    await api.backups.deleteControlPlaneBackup(triggered.id)
    const afterDelete = await api.backups.listControlPlaneBackups()
    expect(afterDelete.find((b) => b.id === triggered.id)).toBeUndefined()
  })

  it("manages service database and volume backups with target S3 destination selection (M15-003)", async () => {
    const serviceId = "srv_db_prod"
    const initialBackups = await api.backups.listServiceBackups(serviceId)
    expect(Array.isArray(initialBackups)).toBe(true)
    expect(initialBackups.length).toBeGreaterThan(0)
    expect(initialBackups[0].s3_destination_name).toBeDefined()

    // Trigger backup with explicit S3 destination
    const triggeredCustom = await api.backups.triggerServiceBackup(serviceId, {
      backup_type: "database",
      s3_destination_id: "s3d_aws_cold",
    })
    expect(triggeredCustom.id).toBeDefined()
    expect(triggeredCustom.s3_destination_id).toBe("s3d_aws_cold")
    expect(triggeredCustom.s3_destination_name).toBe("AWS S3 Glacier Archival")

    // Trigger backup with default fallback
    const triggeredDefault = await api.backups.triggerServiceBackup(serviceId, {
      backup_type: "volume",
    })
    expect(triggeredDefault.id).toBeDefined()
    expect(triggeredDefault.s3_destination_id).toBeDefined()
    expect(triggeredDefault.s3_destination_name).toBeDefined()

    const downloadUrl = await api.backups.downloadServiceBackup(
      serviceId,
      triggeredCustom.id
    )
    expect(downloadUrl.download_url).toBeDefined()

    const restoreRes = await api.backups.restoreServiceBackup(
      serviceId,
      triggeredCustom.id
    )
    expect(restoreRes.success).toBe(true)

    await api.backups.deleteServiceBackup(serviceId, triggeredDefault.id)
    const remaining = await api.backups.listServiceBackups(serviceId)
    expect(remaining.find((b) => b.id === triggeredDefault.id)).toBeUndefined()
  })

  it("configures and retrieves service automated backup schedule (M15-003)", async () => {
    const serviceId = "srv_db_prod"

    const initialSched = await api.backups.getServiceBackupSchedule(serviceId)
    expect(initialSched).toBeDefined()
    expect(initialSched.service_id).toBe(serviceId)
    expect(initialSched.cron_expression).toBe("0 2 * * *")
    expect(initialSched.retention_count).toBe(7)

    const updatedSched = await api.backups.updateServiceBackupSchedule(
      serviceId,
      {
        enabled: true,
        s3_destination_id: "s3d_aws_cold",
        cron_expression: "0 4 * * *",
        retention_count: 14,
      }
    )
    expect(updatedSched.enabled).toBe(true)
    expect(updatedSched.s3_destination_id).toBe("s3d_aws_cold")
    expect(updatedSched.s3_destination_name).toBe("AWS S3 Glacier Archival")
    expect(updatedSched.cron_expression).toBe("0 4 * * *")
    expect(updatedSched.retention_count).toBe(14)

    const refetched = await api.backups.getServiceBackupSchedule(serviceId)
    expect(refetched.enabled).toBe(true)
    expect(refetched.s3_destination_id).toBe("s3d_aws_cold")
    expect(refetched.retention_count).toBe(14)
  })

  it("renders ServiceBackupsPage schedule card and destination elements cleanly", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_db_prod" projectId="prj_acme">
        <ServiceBackupsPage />
      </ServiceProvider>
    )

    expect(html).toContain("Automated Backup Schedule")
    expect(html).toContain("Configure Schedule")
    expect(html).not.toContain("—")
    expect(html).not.toContain("&mdash;")
    expect(html).not.toContain("shadow-")
  })
})
