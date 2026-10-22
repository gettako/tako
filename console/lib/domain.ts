import type { ServiceDomain } from "@/types/platform"

export function normalizePath(path?: string): string {
  const value = (path || "").trim()
  if (!value || value === "/") return "/"
  return `/${value.replace(/^\/+|\/+$/g, "")}`
}

export function normalizeHost(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ""

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`

  try {
    return new URL(candidate).host
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  }
}

export function domainUrl(
  domain: Pick<ServiceDomain, "domain" | "path" | "https">
): string {
  const secure = domain.https ?? true
  const path = normalizePath(domain.path)
  return `${secure ? "https" : "http"}://${domain.domain}${path === "/" ? "" : path}`
}

export function domainInternalPath(
  domain: Pick<ServiceDomain, "internalPath">
): string {
  return normalizePath(domain.internalPath)
}

export function domainEntryPoint(
  domain: Pick<ServiceDomain, "entryPoint">
): string {
  return domain.entryPoint?.trim() || "unset"
}
