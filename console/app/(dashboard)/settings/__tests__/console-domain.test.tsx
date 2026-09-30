import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { ConsoleDomainCard } from "@/components/settings/console-domain-card"
import { api } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("Console Domain & SSL Ingress Settings Card", () => {
  it("renders ConsoleDomainCard layout cleanly with zero em dashes", () => {
    const html = renderToString(<ConsoleDomainCard />)
    expect(html).not.toContain("—")
  })

  it("fetches default console domain from MockApiClient", async () => {
    const data = await api.system.getConsoleDomain()
    expect(data.domain).toBe("localhost")
    expect(data.ssl_provider).toBe("letsencrypt")
    expect(data.force_https).toBe(true)
    expect(data.ssl_status).toBe("active")
  })

  it("verifies matching and mismatching domain DNS resolution", async () => {
    const matchRes = await api.system.verifyConsoleDomainDNS({
      domain: "panel.gettako.dev",
    })
    expect(matchRes.matches).toBe(true)
    expect(matchRes.expected_ip).toBe("203.0.113.195")
    expect(matchRes.resolved_ips).toContain("203.0.113.195")

    const mismatchRes = await api.system.verifyConsoleDomainDNS({
      domain: "mismatch.gettako.dev",
    })
    expect(mismatchRes.matches).toBe(false)
    expect(mismatchRes.error_message).toContain("DNS mismatch")
  })

  it("updates console domain and persists SSL settings", async () => {
    const updated = await api.system.updateConsoleDomain({
      domain: "tako.octopy.dev",
      ssl_provider: "letsencrypt",
      force_https: true,
    })
    expect(updated.domain).toBe("tako.octopy.dev")
    expect(updated.ssl_provider).toBe("letsencrypt")
    expect(updated.force_https).toBe(true)
    expect(updated.ssl_status).toBe("active")

    // Fetch again to confirm persistence
    const fetched = await api.system.getConsoleDomain()
    expect(fetched.domain).toBe("tako.octopy.dev")

    // Restore to localhost
    await api.system.updateConsoleDomain({
      domain: "localhost",
      ssl_provider: "letsencrypt",
      force_https: true,
    })
  })

  it("rejects invalid domain names with whitespace or missing dots", async () => {
    await expect(
      api.system.updateConsoleDomain({
        domain: "invalid domain with spaces",
      })
    ).rejects.toThrow("Invalid domain name format")

    await expect(
      api.system.updateConsoleDomain({
        domain: "invaliddomainnodot",
      })
    ).rejects.toThrow(
      "Domain must contain a valid top-level domain or be localhost"
    )
  })
})
