import type { GitHubConnection } from "../client"

export const mockGitHubConnections: GitHubConnection[] = [
  {
    id: "ghc_acme_work",
    name: "Acme Corp (Work)",
    auth_type: "app",
    account_name: "acme-corp",
    avatar_url: "https://avatars.githubusercontent.com/u/583231",
    app_id: "ghapp_99182",
    installation_id: "inst_12345",
    service_count: 2,
    created_at: "2026-09-10T10:00:00Z",
    updated_at: "2026-09-10T10:00:00Z",
  },
  {
    id: "ghc_personal_pat",
    name: "Personal Projects",
    auth_type: "pat",
    account_name: "octocat",
    avatar_url: "https://avatars.githubusercontent.com/u/583231",
    app_id: null,
    installation_id: null,
    service_count: 0,
    created_at: "2026-09-15T12:00:00Z",
    updated_at: "2026-09-15T12:00:00Z",
  },
]
