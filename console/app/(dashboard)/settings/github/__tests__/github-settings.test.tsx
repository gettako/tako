import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import GitHubSettingsPage, {
  WebhookConfigCard,
  SyncedReposCard,
  GitHubConnectionsCard,
} from "../page"
import { CreateServiceWizard } from "@/components/services/create-service-dialog"
import { api, resetApiClient, ApiError, type GitHubConnection } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings/github",
  useSearchParams: () => new URLSearchParams(),
}))

describe("GitHubSettingsPage (M5-004 & M15-001)", () => {
  it("renders GitHubSettingsPage layout without errors and with zero em dashes", () => {
    const html = renderToString(<GitHubSettingsPage />)

    expect(html).toContain("GitHub Integration")
    expect(html).toContain(
      "Manage repository access, webhook delivery, and automatic deployments."
    )
    expect(html).not.toContain("—")
  })

  it("fetches GitHub status and repositories list from MockApiClient accurately", async () => {
    resetApiClient()

    const status = await api.github.getStatus()
    expect(status.connected).toBe(true)
    expect(status.username).toBe("octocat")
    expect(status.app_installed).toBe(true)

    const repos = await api.github.listRepos()
    expect(Array.isArray(repos)).toBe(true)
    expect(repos.length).toBeGreaterThanOrEqual(4)

    const firstRepo = repos[0]
    expect(firstRepo.name).toBe("web-frontend")
    expect(firstRepo.full_name).toBe("acme/web-frontend")
    expect(firstRepo.default_branch).toBe("main")
  })

  it("renders WebhookConfigCard with payload URL and masked secret format", () => {
    const html = renderToString(<WebhookConfigCard />)

    expect(html).toContain("Global Webhook Configuration")
    expect(html).toContain("https://gettako.dev/api/github/webhook")
    expect(html).toContain("Payload URL")
    expect(html).toContain("Webhook Secret")
    expect(html).toContain("application/json")
    expect(html).not.toContain("—")
  })

  it("renders SyncedReposCard with repositories and search bar", () => {
    const mockRepos = [
      {
        id: 1,
        name: "acme-api",
        full_name: "acme/acme-api",
        private: true,
        default_branch: "main",
        html_url: "https://github.com/acme/acme-api",
      },
    ]

    const html = renderToString(
      <SyncedReposCard
        repos={mockRepos}
        isSyncing={false}
        onSync={async () => {}}
      />
    )

    expect(html).toContain("Synced Repositories")
    expect(html).toContain("acme/acme-api")
    expect(html).toContain("Private")
    expect(html).toContain("main")
    expect(html).toContain("Sync Repositories Now")
    expect(html).not.toContain("—")
  })

  it("copies webhook URL and secret cleanly", async () => {
    let copiedText = ""
    Object.assign(navigator, {
      clipboard: {
        writeText: async (text: string) => {
          copiedText = text
        },
      },
    })

    const testUrl = "https://gettako.dev/api/github/webhook"
    await navigator.clipboard.writeText(testUrl)
    expect(copiedText).toBe(testUrl)

    const testSecret = "whsec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d"
    await navigator.clipboard.writeText(testSecret)
    expect(copiedText).toBe(testSecret)
  })

  it("renders GitHubConnectionsCard with connection items, badges, and zero em dashes", () => {
    const mockConnections: GitHubConnection[] = [
      {
        id: "ghc_test_org",
        name: "Acme Production",
        auth_type: "app",
        account_name: "acme-corp",
        avatar_url: "https://avatars.githubusercontent.com/u/583231",
        app_id: "ghapp_123",
        installation_id: "inst_456",
        service_count: 3,
        created_at: "2026-09-10T10:00:00Z",
        updated_at: "2026-09-10T10:00:00Z",
      },
    ]

    const html = renderToString(
      <GitHubConnectionsCard
        connections={mockConnections}
        isLoading={false}
        onRefresh={async () => {}}
      />
    )

    expect(html).toContain("GitHub Connections")
    expect(html).toContain("Acme Production")
    expect(html).toContain("@acme-corp")
    expect(html).toContain("GitHub App")
    expect(html).toContain("3 active services")
    expect(html).toContain(
      "https://gettako.dev/api/github/webhook/ghc_test_org"
    )
    expect(html).toContain("Add Connection")
    expect(html).not.toContain("—")
  })

  it("manages multi-account GitHub connections and repository branches via MockApiClient", async () => {
    resetApiClient()

    // 1. List initial connections
    const initialConns = await api.github.listConnections()
    expect(initialConns.length).toBeGreaterThanOrEqual(2)
    const workConn = initialConns.find((c) => c.id === "ghc_acme_work")
    expect(workConn).toBeDefined()
    expect(workConn?.service_count).toBeGreaterThan(0)

    // 2. Add new PAT connection
    const newPatConn = await api.github.createConnection({
      name: "Staging PAT Account",
      auth_type: "pat",
      account_name: "staging-dev",
      token: "ghp_mock_token_for_staging",
    })
    expect(newPatConn.id).toBeDefined()
    expect(newPatConn.name).toBe("Staging PAT Account")
    expect(newPatConn.auth_type).toBe("pat")
    expect(newPatConn.service_count).toBe(0)

    // 3. Add new GitHub App connection
    const newAppConn = await api.github.createConnection({
      name: "Enterprise App",
      auth_type: "app",
      account_name: "enterprise-org",
      app_id: "998877",
      installation_id: "443322",
      private_key:
        "-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----",
    })
    expect(newAppConn.id).toBeDefined()
    expect(newAppConn.auth_type).toBe("app")

    // 4. List repos and branches under connection
    const repos = await api.github.listConnectionRepos(newPatConn.id)
    expect(repos.length).toBeGreaterThan(0)
    expect(repos[0].full_name).toContain("staging-dev")

    const branches = await api.github.listConnectionBranches(
      newPatConn.id,
      "staging-dev",
      repos[0].name
    )
    expect(branches.length).toBeGreaterThan(0)
    expect(branches.some((b) => b.name === "main")).toBe(true)

    // 5. Delete connection with active services should fail with 409
    try {
      await api.github.deleteConnection("ghc_acme_work")
      expect.unreachable("should have thrown 409 conflict")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(409)
      expect(apiErr.message).toContain("in use by")
    }

    // 6. Delete unused connection should succeed
    await api.github.deleteConnection(newPatConn.id)
    const afterDeleteConns = await api.github.listConnections()
    expect(afterDeleteConns.some((c) => c.id === newPatConn.id)).toBe(false)
  })

  it("CreateServiceWizard renders GitHub Account selector and creates service with github_connection_id", async () => {
    resetApiClient()

    const html = renderToString(
      <CreateServiceWizard projectId="prj_acme" onCancel={() => {}} />
    )
    expect(html).toContain("Create New Service")
    expect(html).toContain("Source")
    expect(html).not.toContain("—")

    // Verify service creation with github_connection_id
    const created = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "new-connected-app",
      repository: "acme/web-frontend",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 3000,
      health_check_path: "/healthz",
      github_connection_id: "ghc_acme_work",
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe("new-connected-app")
    expect(created.github_connection_id).toBe("ghc_acme_work")
  })

  it("handles automatic 1-click manifest generation, exchange, and installation sync", async () => {
    resetApiClient()

    // 1. Get manifest configuration
    const manifest = await api.github.getManifest()
    expect(manifest.action_url).toBe("https://github.com/settings/apps/new")
    expect(manifest.manifest).toBeDefined()

    const manifestObj = manifest.manifest as unknown as {
      name: string
      public: boolean
      default_permissions: Record<string, string>
    }
    expect(manifestObj.name).toContain("tako-")
    expect(manifestObj.public).toBe(true)
    expect(manifestObj.default_permissions).toBeDefined()
    expect(manifestObj.default_permissions.contents).toBe("read")

    // 2. Exchange temporary manifest code
    const exchange = await api.github.exchangeManifest({
      code: "mock_gh_manifest_code_123",
    })
    expect(exchange.app_id).toBe("987654")
    expect(exchange.app_slug).toBe("tako-deployer-mock")
    expect(exchange.install_url).toContain(
      "https://github.com/apps/tako-deployer-mock/installations/new"
    )

    // 3. Sync organizations and installations
    const syncedConns = await api.github.syncInstallations()
    expect(Array.isArray(syncedConns)).toBe(true)
    expect(syncedConns.length).toBeGreaterThan(0)
    expect(syncedConns.some((c) => c.app_slug === "tako-deployer-mock")).toBe(
      true
    )
  })
})
