"use client"

export interface GeoLocation {
  code: string
  country: string
  city: string
  flag: string
  lat?: number
  lng?: number
}

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AO: "Angola",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BH: "Bahrain",
  BD: "Bangladesh",
  BY: "Belarus",
  BE: "Belgium",
  BR: "Brazil",
  BG: "Bulgaria",
  CA: "Canada",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  EG: "Egypt",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  GE: "Georgia",
  DE: "Germany",
  GR: "Greece",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KR: "South Korea",
  KW: "Kuwait",
  LV: "Latvia",
  LB: "Lebanon",
  LT: "Lithuania",
  LU: "Luxembourg",
  MY: "Malaysia",
  MX: "Mexico",
  MC: "Monaco",
  MA: "Morocco",
  NL: "Netherlands",
  NZ: "New Zealand",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PA: "Panama",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russia",
  SA: "Saudi Arabia",
  RS: "Serbia",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  ZA: "South Africa",
  ES: "Spain",
  LK: "Sri Lanka",
  SE: "Sweden",
  CH: "Switzerland",
  TW: "Taiwan",
  TH: "Thailand",
  TR: "Turkey",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  UK: "United Kingdom",
  US: "United States",
  VN: "Vietnam",
}

const STORAGE_PREFIX = "tako_geoip_"
const memoryCache = new Map<string, GeoLocation>()
const inFlightRequests = new Map<string, Promise<GeoLocation>>()
const listeners = new Set<(ip: string, geo: GeoLocation) => void>()

// Load from localStorage into memory on startup
if (typeof window !== "undefined") {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const ip = key.slice(STORAGE_PREFIX.length)
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as GeoLocation
          memoryCache.set(ip, parsed)
        }
      }
    }
  } catch {
    // Ignore storage restriction
  }
}

export function isPrivateIp(ip?: string | null): boolean {
  if (!ip) return true
  const clean = ip.trim()
  if (
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "0.0.0.0"
  ) {
    return true
  }
  // 10.0.0.0/8
  if (/^10\./.test(clean)) return true
  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true
  // 192.168.0.0/16
  if (/^192\.168\./.test(clean)) return true
  // Carrier-grade NAT 100.64.0.0/10
  if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(clean)) return true
  // Link-local
  if (/^169\.254\./.test(clean)) return true

  return false
}

export function getGeoIpSync(ip?: string | null): GeoLocation | null {
  if (!ip) return null
  const clean = ip.trim()
  if (isPrivateIp(clean)) {
    return {
      code: "LOCAL",
      country: "Local Network",
      city: "Private VPC",
      flag: "/images/flags/UN.png",
    }
  }

  if (memoryCache.has(clean)) {
    return memoryCache.get(clean)!
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${clean}`)
      if (raw) {
        const parsed = JSON.parse(raw) as GeoLocation
        memoryCache.set(clean, parsed)
        return parsed
      }
    } catch {
      // Ignore storage errors
    }
  }

  return null
}

export function subscribeGeoIp(
  callback: (ip: string, geo: GeoLocation) => void
): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function notifyListeners(ip: string, geo: GeoLocation) {
  listeners.forEach((fn) => {
    try {
      fn(ip, geo)
    } catch {
      // Ignore listener error
    }
  })
}

export async function resolveGeoIp(ip?: string | null): Promise<GeoLocation> {
  if (!ip) {
    return {
      code: "LOCAL",
      country: "Local Network",
      city: "Private VPC",
      flag: "/images/flags/UN.png",
    }
  }

  const clean = ip.trim()
  if (isPrivateIp(clean)) {
    return {
      code: "LOCAL",
      country: "Local Network",
      city: "Private VPC",
      flag: "/images/flags/UN.png",
    }
  }

  const cached = getGeoIpSync(clean)
  if (cached) {
    return cached
  }

  // Deduplicate in-flight requests
  if (inFlightRequests.has(clean)) {
    return inFlightRequests.get(clean)!
  }

  const promise = (async () => {
    try {
      // Primary: ipwho.is (fast, includes city, country, coordinates)
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(clean)}`, {
        cache: "force-cache",
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          const code = String(data.country_code || "UN").toUpperCase()
          const country = String(
            data.country || COUNTRY_NAMES[code] || "Global"
          )
          const city = String(data.city || "")
          const result: GeoLocation = {
            code,
            country,
            city,
            flag: `/images/flags/${code}.png`,
            lat: typeof data.latitude === "number" ? data.latitude : undefined,
            lng:
              typeof data.longitude === "number" ? data.longitude : undefined,
          }

          memoryCache.set(clean, result)
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                `${STORAGE_PREFIX}${clean}`,
                JSON.stringify(result)
              )
            } catch {
              // Ignore storage errors
            }
          }
          notifyListeners(clean, result)
          return result
        }
      }
    } catch {
      // Fallback below
    }

    try {
      // Fallback: api.country.is
      const res = await fetch(
        `https://api.country.is/${encodeURIComponent(clean)}`,
        {
          cache: "force-cache",
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data && data.country) {
          const code = String(data.country).toUpperCase()
          const country = COUNTRY_NAMES[code] || code
          const result: GeoLocation = {
            code,
            country,
            city: country,
            flag: `/images/flags/${code}.png`,
          }

          memoryCache.set(clean, result)
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                `${STORAGE_PREFIX}${clean}`,
                JSON.stringify(result)
              )
            } catch {
              // Ignore storage errors
            }
          }
          notifyListeners(clean, result)
          return result
        }
      }
    } catch {
      // Fallback to unknown
    }

    const fallback: GeoLocation = {
      code: "GLOBAL",
      country: "Global Edge",
      city: "Edge Host",
      flag: "/images/flags/UN.png",
    }
    return fallback
  })()

  inFlightRequests.set(clean, promise)
  try {
    return await promise
  } finally {
    inFlightRequests.delete(clean)
  }
}
