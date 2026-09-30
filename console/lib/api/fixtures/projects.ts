import type { Project } from "../client"

export const mockProjects: Project[] = [
  {
    id: "prj_acme",
    name: "Acme Platform",
    description:
      "Core production SaaS infrastructure and customer web interfaces.",
    services_count: 2,
    created_at: "2026-09-02T10:00:00Z",
    updated_at: "2026-09-28T16:20:00Z",
  },
  {
    id: "prj_ecommerce",
    name: "Global Hypermarket E-Commerce Enterprise Customer Portal Platform Edition",
    description:
      "Multi-tenant storefront services, shopping cart checkout system, and inventory webhooks.",
    services_count: 2,
    created_at: "2026-09-06T11:30:00Z",
    updated_at: "2026-09-29T01:10:00Z",
  },
  {
    id: "prj_blog",
    name: "Personal Notes & Portfolio",
    description:
      "Personal engineering blog built with Astro and static documentation pages.",
    services_count: 1,
    created_at: "2026-09-10T15:45:00Z",
    updated_at: "2026-09-25T09:12:00Z",
  },
  {
    id: "prj_tools",
    name: "Internal Tooling",
    description:
      "Team documentation wikis, queue monitoring workers, and testing sandboxes.",
    services_count: 2,
    created_at: "2026-09-15T08:20:00Z",
    updated_at: "2026-09-27T18:40:00Z",
  },
]
