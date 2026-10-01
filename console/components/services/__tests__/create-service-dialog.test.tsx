import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { CreateServiceWizard } from "../create-service-dialog"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("CreateServiceWizard & CreateServiceDialog", () => {
  it("renders wizard step 1 with source selection and search input", () => {
    const html = renderToString(
      <CreateServiceWizard projectId="prj_acme" onCancel={() => {}} />
    )

    expect(html).toContain("Create New Service")
    expect(html).toContain("1.")
    expect(html).toContain("Source")
    expect(html).toContain("2.")
    expect(html).toContain("Build")
    expect(html).toContain("3.")
    expect(html).toContain("Details")
    expect(html).toContain("4.")
    expect(html).toContain("Server")
    expect(html).toContain("Filter repositories...")
    expect(html).toContain("Continue")
    expect(html).not.toContain("—")
  })

  it("fetches repos, branches, and servers from MockApiClient", async () => {
    resetApiClient()

    // 1. Repos
    const repos = await api.github.listRepos()
    expect(Array.isArray(repos)).toBe(true)
    expect(repos.length).toBeGreaterThanOrEqual(1)
    const firstRepo = repos[0]
    expect(firstRepo.name).toBeDefined()
    expect(firstRepo.full_name).toBeDefined()

    // 2. Branches for repo
    const [owner, name] = firstRepo.full_name.split("/")
    const branches = await api.github.listBranches(owner, name)
    expect(Array.isArray(branches)).toBe(true)
    expect(branches.length).toBeGreaterThanOrEqual(1)
    expect(branches[0].name).toBeDefined()

    // 3. Online servers
    const servers = await api.servers.list()
    expect(servers.length).toBeGreaterThanOrEqual(1)
    const onlineServers = servers.filter((s) => s.status === "online")
    expect(onlineServers.length).toBeGreaterThanOrEqual(1)
    expect(onlineServers[0].host).toBeDefined()
  })

  it("dispatches service creation and triggers initial deployment via MockApiClient", async () => {
    resetApiClient()

    // Create service
    const createdService = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "wizard-created-api",
      repository: "acme/api-core",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 8080,
      health_check_path: "/healthz",
    })

    expect(createdService.id).toBeDefined()
    expect(createdService.name).toBe("wizard-created-api")
    expect(createdService.project_id).toBe("prj_acme")
    expect(createdService.internal_port).toBe(8080)

    // Trigger initial deployment
    const initialDep = await api.services.createDeployment(createdService.id, {
      branch: "main",
    })

    expect(initialDep.id).toBeDefined()
    expect(initialDep.service_id).toBe(createdService.id)
    expect(initialDep.branch).toBe("main")
  })

  it("renders wizard with database template tab and engine options", () => {
    const html = renderToString(
      <CreateServiceWizard
        projectId="prj_acme"
        initialTab="database"
        onCancel={() => {}}
      />
    )

    expect(html).toContain("Database Template")
    expect(html).toContain("PostgreSQL")
    expect(html).toContain("MySQL")
    expect(html).toContain("Redis")
    expect(html).toContain("Auto-Generated Credentials")
    expect(html).toContain("Docker Volume:")
    expect(html).toContain("Mount Path:")
    expect(html).toContain("Provision Database")
    expect(html).not.toContain("—")
  })

  it("provisions a database service and injects connection string via MockApiClient", async () => {
    resetApiClient()

    // 1. Provision PostgreSQL database service
    const dbService = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "acme-postgres",
      service_type: "database",
      database_engine: "postgres",
      database_version: "16-alpine",
      database_name: "acme_db",
      database_user: "postgres",
      database_password: "supersecretpassword",
      volume_name: "tako_vol_acme_postgres_data",
      volume_mount_path: "/var/lib/postgresql/data",
      internal_port: 5432,
      dockerfile_path: "",
      health_check_path: "",
    })

    expect(dbService.id).toBeDefined()
    expect(dbService.service_type).toBe("database")
    expect(dbService.database_engine).toBe("postgres")
    expect(dbService.volume_name).toBe("tako_vol_acme_postgres_data")
    expect(dbService.connection_uri).toBeDefined()
    expect(dbService.connection_uri).toContain("postgres://")

    // 2. Inject connection string into web service (srv_web_prod)
    const injectRes = await api.services.injectConnectionString(dbService.id, {
      target_service_id: "srv_web_prod",
      env_key: "DATABASE_URL",
    })

    expect(injectRes.success).toBe(true)
    expect(injectRes.env_key).toBe("DATABASE_URL")
    expect(injectRes.target_service_id).toBe("srv_web_prod")

    // 3. Verify target service environment variables contain DATABASE_URL
    const targetEnv = await api.services.getEnv("srv_web_prod")
    const injectedVar = targetEnv.env_vars.find((v) => v.key === "DATABASE_URL")
    expect(injectedVar).toBeDefined()
    expect(injectedVar?.value).toBe(dbService.connection_uri!)
  })

  it("renders wizard with docker compose tab and yaml configuration options", () => {
    const html = renderToString(
      <CreateServiceWizard
        projectId="prj_acme"
        initialTab="compose"
        onCancel={() => {}}
      />
    )

    expect(html).toContain("Docker Compose")
    expect(html).toContain("Stack Name")
    expect(html).toContain("Inline Compose YAML")
    expect(html).toContain("Git Repository")
    expect(html).toContain("Validate Schema")
    expect(html).toContain("Deploy Compose Stack")
    expect(html).not.toContain("Select Curated Database Engine")
    expect(html).not.toContain("Provision Database")
    expect(html).not.toContain("—")
  })

  it("renders wizard with database tab without rendering compose or app steps", () => {
    const html = renderToString(
      <CreateServiceWizard
        projectId="prj_acme"
        initialTab="database"
        onCancel={() => {}}
      />
    )

    expect(html).toContain("Select Curated Database Engine")
    expect(html).toContain("Provision Database")
    expect(html).not.toContain("Inline Compose YAML")
    expect(html).not.toContain("Filter repositories...")
    expect(html).not.toContain("—")
  })

  it("validates compose YAML and provisions compose stack via MockApiClient", async () => {
    resetApiClient()

    // 1. Validate Compose YAML
    const valRes = await api.services.validateCompose({
      compose_content:
        "version: '3.8'\nservices:\n  web:\n    image: nginx:alpine",
    })
    expect(valRes.valid).toBe(true)
    expect(valRes.services?.length).toBeGreaterThanOrEqual(1)

    // 2. Create Compose Service
    const composeService = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "acme-stack",
      service_type: "compose",
      compose_file_content:
        "version: '3.8'\nservices:\n  web:\n    image: nginx:alpine",
      dockerfile_path: "Dockerfile",
      health_check_path: "/healthz",
      internal_port: 80,
    })

    expect(composeService.id).toBeDefined()
    expect(composeService.service_type).toBe("compose")

    // 3. Retrieve Compose Stack Overview
    const stackOverview = await api.services.getStackOverview(composeService.id)
    expect(stackOverview.service_id).toBe(composeService.id)
    expect(stackOverview.network_name).toContain("tako_compose_")
    expect(stackOverview.sub_services.length).toBeGreaterThanOrEqual(1)
    expect(stackOverview.sub_services[0].name).toBeDefined()
    expect(stackOverview.sub_services[0].status).toBe("running")
  })
})
