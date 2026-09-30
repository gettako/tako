import { describe, it, expect, mock, beforeEach } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceAuxiliaryPage from "../page"
import { ServiceProvider } from "@/components/services/service-context"
import {
  AddAuxiliaryDialog,
  AddAuxiliaryForm,
} from "@/components/services/add-auxiliary-dialog"
import {
  AuxiliaryLogModal,
  AuxiliaryLogPanel,
} from "@/components/services/auxiliary-log-modal"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_api_prod/auxiliary",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceAuxiliaryPage & Auxiliary Services (M14-001)", () => {
  beforeEach(() => {
    resetApiClient()
  })

  it("renders ServiceAuxiliaryPage without crashing and contains zero em dashes", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_api_prod" projectId="prj_acme">
        <ServiceAuxiliaryPage />
      </ServiceProvider>
    )

    expect(html).toContain("Auxiliary Services")
    // Antislop check: Zero em dashes in rendered markup
    expect(html).not.toContain("—")
    expect(html).not.toContain("&mdash;")
  })

  it("fetches auxiliary services for parent service from MockApiClient", async () => {
    const auxServices = await api.services.list({
      parentServiceId: "srv_api_prod",
    })
    expect(auxServices.length).toBeGreaterThanOrEqual(2)

    const worker = auxServices.find((s) => s.service_type === "worker")
    expect(worker).toBeDefined()
    expect(worker?.parent_service_id).toBe("srv_api_prod")
    expect(worker?.command).toContain("php artisan queue:work")

    const cron = auxServices.find((s) => s.service_type === "cron")
    expect(cron).toBeDefined()
    expect(cron?.parent_service_id).toBe("srv_api_prod")
    expect(cron?.cron_expression).toBe("* * * * *")
  })

  it("creates a new worker service linked to parent service via api.services.create", async () => {
    const newWorker = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "acme-image-resizer",
      service_type: "worker",
      parent_service_id: "srv_api_prod",
      command: "node worker.js",
      repository: "acme/api-core",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 0,
      health_check_path: "",
    })

    expect(newWorker.id).toBeDefined()
    expect(newWorker.name).toBe("acme-image-resizer")
    expect(newWorker.service_type).toBe("worker")
    expect(newWorker.parent_service_id).toBe("srv_api_prod")
    expect(newWorker.status).toBe("running")

    const updatedList = await api.services.list({
      parentServiceId: "srv_api_prod",
    })
    expect(updatedList.some((s) => s.id === newWorker.id)).toBe(true)
  })

  it("creates a new cron service linked to parent service via api.services.create", async () => {
    const newCron = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "acme-daily-invoice",
      service_type: "cron",
      parent_service_id: "srv_api_prod",
      command: "php artisan invoices:send",
      cron_expression: "0 0 * * *",
      repository: "acme/api-core",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 0,
      health_check_path: "",
    })

    expect(newCron.id).toBeDefined()
    expect(newCron.name).toBe("acme-daily-invoice")
    expect(newCron.service_type).toBe("cron")
    expect(newCron.parent_service_id).toBe("srv_api_prod")
    expect(newCron.cron_expression).toBe("0 0 * * *")
  })

  it("renders AddAuxiliaryForm with form inputs and zero em dashes", async () => {
    const parent = await api.services.get("srv_api_prod")
    const html = renderToString(
      <AddAuxiliaryForm
        parentService={parent}
        onCancel={() => {}}
        onSuccess={() => {}}
      />
    )

    expect(html).toContain("Add Auxiliary Service")
    expect(html).toContain("Service Type")
    expect(html).toContain("Background Worker")
    expect(html).toContain("Scheduled Cron")
    expect(html).toContain("Container Command")
    // Antislop check
    expect(html).not.toContain("—")
  })

  it("renders AuxiliaryLogPanel with service details and zero em dashes", async () => {
    const auxServices = await api.services.list({
      parentServiceId: "srv_api_prod",
    })
    const worker = auxServices.find((s) => s.service_type === "worker")!

    const html = renderToString(
      <AuxiliaryLogPanel service={worker} onClose={() => {}} />
    )

    expect(html).toContain(worker.name)
    expect(html).toContain("Worker Process")
    expect(html).toContain("Container Output")
    // Antislop check
    expect(html).not.toContain("—")
  })
})
