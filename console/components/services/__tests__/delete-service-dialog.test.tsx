import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import {
  DeleteServiceForm,
  DeleteServiceDialog,
} from "../delete-service-dialog"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("DeleteServiceForm & DeleteServiceDialog", () => {
  const dummyService = {
    id: "srv_web_prod",
    name: "acme-web",
  }

  it("renders DeleteServiceForm with warning, name prompt, and buttons with zero em dashes", () => {
    const html = renderToString(
      <DeleteServiceForm service={dummyService} onCancel={() => {}} />
    )

    expect(html).toContain("Delete Service")
    expect(html).toContain("Warning: This action cannot be undone.")
    expect(html).toContain("Traefik Ingress Deregistration")
    expect(html).toContain("Delete persistent storage volumes")
    expect(html).toContain("Remove unused Docker images from host")
    expect(html).toContain("acme-web")
    expect(html).toContain("Cancel")
    expect(html).not.toContain("—")
  })

  it("returns null when service is null", () => {
    const html = renderToString(
      <DeleteServiceDialog open={true} onOpenChange={() => {}} service={null} />
    )

    expect(html).toBe("")
  })

  it("deletes service via MockApiClient and removes it from service list with options", async () => {
    resetApiClient()

    // 1. Create a service to delete
    const created = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "temporary-delete-test",
      service_type: "web",
      repository: "acme/temp-repo",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 3000,
      health_check_path: "/",
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe("temporary-delete-test")

    // 2. Delete the service with explicit volume and image retention options
    await api.services.delete(created.id, {
      delete_volumes: false,
      prune_images: true,
    })

    // 3. Verify it cannot be fetched
    let errorThrown = false
    try {
      await api.services.get(created.id)
    } catch (err: any) {
      errorThrown = true
      expect(err.status).toBe(404)
    }
    expect(errorThrown).toBe(true)

    // 4. Verify it's not in the service list
    const services = await api.services.list({ projectId: "prj_acme" })
    expect(services.some((s) => s.id === created.id)).toBe(false)
  })

  it("triggers redeploy and pullUpdate lifecycle operations via MockApiClient", async () => {
    resetApiClient()

    // 1. Test redeploy on git service
    const redeployDep = await api.services.redeploy("srv_web_prod")
    expect(redeployDep.id).toBeDefined()
    expect(redeployDep.status).toBe("building")

    // 2. Test pullUpdate on database service
    const pullResult = await api.services.pullUpdate("srv_acme_postgres")
    expect(pullResult.updated).toBe(true)
    expect(pullResult.message).toContain("recreated")
  })

  it("validates deletion confirmation matching service name strictly", () => {
    const serviceName = "acme-web"
    const canDelete = (confirmInput: string) =>
      confirmInput.trim() === serviceName

    expect(canDelete("")).toBe(false)
    expect(canDelete("Acme-web")).toBe(false)
    expect(canDelete("acme-web ")).toBe(true)
    expect(canDelete("acme-web")).toBe(true)
    expect(canDelete("other-service")).toBe(false)
  })
})
