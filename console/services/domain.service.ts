import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import type { ClusterDomainConfig } from "@/types/platform"

export interface TraefikConfigFileMeta {
  name: string
  path: string
  size: number
  updatedAt: string
  isCustom: boolean
  type: string
}

export interface TraefikConfigFileFull extends TraefikConfigFileMeta {
  content: string
}

export interface VerifyDomainResult {
  ok: boolean
  message: string
}

export const DEFAULT_TRAEFIK_STATIC_YAML = `global:
  checkNewVersion: false
  sendAnonymousUsage: false

api:
  dashboard: false

providers:
  docker:
    exposedByDefault: false
    network: tako-network
    watch: true
  file:
    directory: /etc/tako/traefik/dynamic
    watch: true

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: "admin@gettako.dev"
      storage: "/acme.json"
      httpChallenge:
        entryPoint: web
`

export const DEFAULT_TAKO_CONSOLE_YAML = `# Dynamic configuration for Tako Console reverse proxy
http:
  routers:
    tako-console-secure:
      rule: "Host(\`console.gettako.dev\`)"
      entryPoints:
        - websecure
      priority: 100
      tls:
        certResolver: letsencrypt
      service: tako-console-svc

    tako-console-redirect:
      rule: "Host(\`console.gettako.dev\`)"
      entryPoints:
        - web
      priority: 100
      middlewares:
        - tako-redirect-ssl
      service: tako-console-svc

  middlewares:
    tako-redirect-ssl:
      redirectScheme:
        scheme: https
        permanent: true

  services:
    tako-console-svc:
      loadBalancer:
        servers:
          - url: "http://tako-console:3000"
`

export const NEW_FILE_STARTER_TEMPLATE = `# Dynamic routing configuration for service
http:
  routers:
    my-service-router:
      rule: "Host(\`example.com\`)"
      entryPoints:
        - websecure
      priority: 100
      tls:
        certResolver: letsencrypt
      service: my-service-backend

  services:
    my-service-backend:
      loadBalancer:
        servers:
          - url: "http://tako-app-my-service:8080"
`

export async function getDomainConfig(): Promise<ClusterDomainConfig> {
  const raw = await apiGet<Record<string, unknown>>("/settings")
  const domain = (raw.domain_settings || {}) as Record<string, unknown>
  const stored =
    raw.platform_settings && typeof raw.platform_settings === "object"
      ? (raw.platform_settings as Record<string, unknown>)
      : {}

  return {
    domain: String(domain.domain || stored.clusterDomain || ""),
    sslActive: Boolean(domain.sslActive),
    sslAutoRenew:
      domain.sslAutoRenew !== undefined ? Boolean(domain.sslAutoRenew) : true,
    dnsProvider:
      (domain.dnsProvider as "http01" | "cloudflare") ||
      (stored.dnsProvider as "http01" | "cloudflare") ||
      "http01",
    cloudflareApiToken: String(domain.cloudflareApiToken || ""),
    customDnsIp: String(domain.customDnsIp || ""),
    sslStatus:
      (domain.sslStatus as ClusterDomainConfig["sslStatus"]) || "pending_dns",
    sslIssuer: domain.sslIssuer ? String(domain.sslIssuer) : undefined,
    sslExpiresAt: domain.sslExpiresAt
      ? String(domain.sslExpiresAt)
      : undefined,
    dnsVerified: Boolean(domain.dnsVerified),
  }
}

export async function updateDomainConfig(
  config: Partial<ClusterDomainConfig>
): Promise<void> {
  await apiPut("/settings/domain_settings", { value: config })
}

export async function verifyDomain(
  domain: string,
  ip?: string
): Promise<VerifyDomainResult> {
  try {
    const res = await apiPost<{ ok?: boolean; message?: string }>(
      "/settings/domain/verify",
      { domain, ip }
    )
    return {
      ok: res.ok ?? true,
      message: res.message || `DNS A-Record verified successfully for ${domain}`,
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Domain verification failed. Check DNS propagation.",
    }
  }
}

export async function reloadTraefik(nodeId?: string): Promise<{ ok: boolean }> {
  const endpoint = nodeId ? `/nodes/${nodeId}/traefik/reload` : "/traefik/reload"
  return apiPost<{ ok: boolean }>(endpoint, {})
}

export async function getNodeTraefikFiles(
  nodeId: string,
  isMaster = false
): Promise<TraefikConfigFileMeta[]> {
  try {
    const data = await apiGet<TraefikConfigFileMeta[]>(
      `/nodes/${nodeId}/traefik/files`
    )
    return isMaster ? data : data.filter((f) => f.name !== "tako.yml")
  } catch {
    const fallbackFiles: TraefikConfigFileMeta[] = [
      {
        name: "traefik.yml",
        path: "/etc/tako/traefik/traefik.yml",
        size: DEFAULT_TRAEFIK_STATIC_YAML.length,
        updatedAt: new Date().toISOString(),
        isCustom: false,
        type: "yaml",
      },
    ]
    if (isMaster) {
      fallbackFiles.push({
        name: "tako.yml",
        path: "/etc/tako/traefik/dynamic/tako.yml",
        size: DEFAULT_TAKO_CONSOLE_YAML.length,
        updatedAt: new Date().toISOString(),
        isCustom: false,
        type: "yaml",
      })
    }
    return fallbackFiles
  }
}

export async function getNodeTraefikFile(
  nodeId: string,
  fileName: string
): Promise<TraefikConfigFileFull> {
  try {
    return await apiGet<TraefikConfigFileFull>(
      `/nodes/${nodeId}/traefik/files/${encodeURIComponent(fileName)}`
    )
  } catch {
    let content = NEW_FILE_STARTER_TEMPLATE
    if (fileName === "traefik.yml") {
      content = DEFAULT_TRAEFIK_STATIC_YAML
    } else if (fileName === "tako.yml") {
      content = DEFAULT_TAKO_CONSOLE_YAML
    }
    return {
      name: fileName,
      path: `/etc/tako/traefik/${fileName}`,
      size: content.length,
      updatedAt: new Date().toISOString(),
      isCustom: fileName !== "traefik.yml" && fileName !== "tako.yml",
      type: "yaml",
      content,
    }
  }
}

export async function saveNodeTraefikFile(
  nodeId: string,
  fileName: string,
  content: string
): Promise<void> {
  await apiPut(
    `/nodes/${nodeId}/traefik/files/${encodeURIComponent(fileName)}`,
    { content }
  )
}

export async function deleteNodeTraefikFile(
  nodeId: string,
  fileName: string
): Promise<void> {
  await apiDelete(
    `/nodes/${nodeId}/traefik/files/${encodeURIComponent(fileName)}`
  )
}

export async function reloadNodeTraefik(nodeId: string): Promise<void> {
  await apiPost(`/nodes/${nodeId}/traefik/reload`, {})
}
