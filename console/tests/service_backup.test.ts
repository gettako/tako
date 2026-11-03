import { describe, expect, test } from "bun:test"
import type { ServiceBackupConfig } from "../types/platform"

describe("Service Backup & S3 Storage Configuration", () => {
  test("defines ServiceBackupConfig interface attributes properly", () => {
    const config: ServiceBackupConfig = {
      enabled: true,
      cronSchedule: "0 2 * * *",
      targetContainer: "tako-app-web-postgres",
      databaseType: "postgres",
      databaseName: "prod_db",
      databaseUser: "postgres",
      retentionDays: 14,
      destinationBucketId: "s3-bucket-123",
      prefix: "services/test-srv/backups/",
    }

    expect(config.enabled).toBe(true)
    expect(config.cronSchedule).toBe("0 2 * * *")
    expect(config.targetContainer).toBe("tako-app-web-postgres")
    expect(config.databaseType).toBe("postgres")
    expect(config.destinationBucketId).toBe("s3-bucket-123")
    expect(config.retentionDays).toBe(14)
    expect(config.prefix).toBe("services/test-srv/backups/")
  })

  test("generates expected S3 target URI format", () => {
    const bucket = "prod-backups"
    const prefix = "services/web-api/backups/"
    const filename = "web-api_20261103_020000.tar.gz"

    const cleanPrefix = prefix.startsWith("/") ? prefix.slice(1) : prefix
    const uri = `s3://${bucket}/${cleanPrefix}${filename}`

    expect(uri).toBe("s3://prod-backups/services/web-api/backups/web-api_20261103_020000.tar.gz")
  })
})

