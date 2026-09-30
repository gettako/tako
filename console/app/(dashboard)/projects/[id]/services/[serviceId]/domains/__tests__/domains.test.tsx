import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceDomainsPage from "../page"
import { AddDomainForm } from "@/components/services/add-domain-dialog"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient, type Domain } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod/domains",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceDomainsPage & AddDomainForm (M14-007 Advanced Ingress)", () => {
  it("renders ServiceDomainsPage layout cleanly without errors and zero em dashes", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceDomainsPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
  })

  it("renders AddDomainForm in add mode with advanced ingress fields and zero em dashes", () => {
    const html = renderToString(
      <AddDomainForm
        serviceId="srv_web_prod"
        projectId="prj_acme"
        defaultPort={3000}
        serverIp="192.168.1.100"
        onSuccess={() => {}}
        onCancel={() => {}}
      />
    )

    expect(html).toContain("Add Custom Domain")
    expect(html).toContain("Domain Name")
    expect(html).toContain("Container Port")
    expect(html).toContain("Path-Based Routing")
    expect(html).toContain("Strip Prefix")
    expect(html).toContain("Designate as Canonical Domain")
    expect(html).toContain("Automated 301 Redirects")
    expect(html).toContain("Enable Basic Auth Protection")
    expect(html).toContain("Advanced Ingress Options")
    expect(html).toContain("192.168.1.100")
    expect(html).not.toContain("—")
  })

  it("renders AddDomainForm in edit mode with initialData and zero em dashes", () => {
    const sampleDomain: Domain = {
      id: "dom_test",
      service_id: "srv_web_prod",
      service_name: "Web Frontend",
      domain: "api.example.com",
      port: 8080,
      path_prefix: "/v1",
      strip_prefix: true,
      is_canonical: true,
      redirect_mode: "www_to_non_www",
      auth_enabled: true,
      auth_user: "staging_user",
      entrypoints: "web,websecure",
      ssl_resolver: "letsencrypt",
      ssl_status: "active",
      created_at: "2026-09-29T10:00:00Z",
    }

    const html = renderToString(
      <AddDomainForm
        serviceId="srv_web_prod"
        projectId="prj_acme"
        defaultPort={3000}
        serverIp="192.168.1.100"
        initialData={sampleDomain}
        onSuccess={() => {}}
        onCancel={() => {}}
      />
    )

    expect(html).toContain("Edit Domain Routing")
    expect(html).toContain("api.example.com")
    expect(html).toContain("8080")
    expect(html).toContain("/v1")
    expect(html).toContain("Save Changes")
    expect(html).not.toContain("—")
  })

  it("fetches domains list from MockApiClient accurately", async () => {
    resetApiClient()

    const list = await api.services.listDomains("srv_web_prod")
    expect(list).toBeDefined()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    // Check that sample domains include new fields
    const first = list[0]
    expect(first.redirect_mode).toBeDefined()
    expect(typeof first.is_canonical).toBe("boolean")
    expect(typeof first.auth_enabled).toBe("boolean")
  })

  it("adds domain with advanced routing and handles canonical domain toggling in MockApiClient", async () => {
    resetApiClient()

    // 1. Add first canonical domain
    const dom1 = await api.services.addDomain("srv_web_prod", {
      domain: "app.acme.com",
      port: 3000,
      path_prefix: "",
      strip_prefix: false,
      is_canonical: true,
      redirect_mode: "www_to_non_www",
      auth_enabled: false,
      entrypoints: "web,websecure",
      ssl_resolver: "letsencrypt",
    })
    expect(dom1.domain).toBe("app.acme.com")
    expect(dom1.is_canonical).toBe(true)
    expect(dom1.redirect_mode).toBe("www_to_non_www")

    // 2. Add second domain with canonical=true -> should unset dom1 is_canonical
    const dom2 = await api.services.addDomain("srv_web_prod", {
      domain: "portal.acme.com",
      port: 3000,
      path_prefix: "/portal",
      strip_prefix: true,
      is_canonical: true,
      redirect_mode: "none",
      auth_enabled: true,
      auth_user: "staging_user",
      auth_password: "staging_password",
      entrypoints: "web,websecure",
      ssl_resolver: "letsencrypt",
    })
    expect(dom2.domain).toBe("portal.acme.com")
    expect(dom2.is_canonical).toBe(true)
    expect(dom2.path_prefix).toBe("/portal")
    expect(dom2.strip_prefix).toBe(true)
    expect(dom2.auth_enabled).toBe(true)
    expect(dom2.auth_user).toBe("staging_user")

    // Check that dom1 is no longer canonical
    const list = await api.services.listDomains("srv_web_prod")
    const refreshedDom1 = list.find((d) => d.domain === "app.acme.com")
    expect(refreshedDom1?.is_canonical).toBe(false)

    // 3. Update domain via updateDomain
    const updatedDom2 = await api.services.updateDomain(
      "srv_web_prod",
      "portal.acme.com",
      {
        port: 8080,
        path_prefix: "/v2",
        redirect_mode: "non_www_to_www",
      }
    )
    expect(updatedDom2.port).toBe(8080)
    expect(updatedDom2.path_prefix).toBe("/v2")
    expect(updatedDom2.redirect_mode).toBe("non_www_to_www")

    // 4. Check SSL
    const verified = await api.services.checkDomainSsl(
      "srv_web_prod",
      "portal.acme.com"
    )
    expect(verified.domain).toBe("portal.acme.com")
    expect(verified.ssl_status).toBe("active")

    // 5. Delete domain
    await api.services.deleteDomain("srv_web_prod", "portal.acme.com")
    const listAfter = await api.services.listDomains("srv_web_prod")
    expect(
      listAfter.find((d) => d.domain === "portal.acme.com")
    ).toBeUndefined()
  })
})
