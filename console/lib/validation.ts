export function isValidHostname(value: string): boolean {
  const hostname = value.trim().replace(/\.$/, "")
  if (!hostname || hostname.length > 253) return false

  return hostname.split(".").every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    )
  })
}

export function isValidIpv4(value: string): boolean {
  const octets = value.trim().split(".")
  if (octets.length !== 4) return false

  return octets.every((octet) => {
    if (!/^\d{1,3}$/.test(octet)) return false
    const number = Number(octet)
    return number >= 0 && number <= 255
  })
}

export function isValidCidr(value: string): boolean {
  const [address, prefix, extra] = value.trim().split("/")
  if (extra !== undefined) return false
  if (!isValidIpv4(address)) return false
  if (prefix === undefined) return true

  if (!/^\d{1,2}$/.test(prefix)) return false
  const number = Number(prefix)
  return number >= 0 && number <= 32
}

export function isValidIpAllowlist(value: string): boolean {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.length > 0 && entries.every(isValidCidr)
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function isValidTime(value: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) return false
  return true
}
