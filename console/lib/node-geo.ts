import DottedMap from "dotted-map"
import { ClusterNode } from "@/types/platform"

export interface NodeGeo {
  lat: number
  lng: number
  city: string
  country: string
  flag: string
  percentX: number
  percentY: number
  pinX: number
  pinY: number
}

// Single instance of DottedMap matching the 100-height diagonal grid
const dottedMapProjection = new DottedMap({ height: 100, grid: "diagonal" })
const MAP_WIDTH = 198
const MAP_HEIGHT = 100

export function projectCoordinatesToPercent(lat: number, lng: number) {
  const pin = dottedMapProjection.getPin({ lat, lng })
  if (pin) {
    const percentX = (pin.x / MAP_WIDTH) * 100
    const percentY = (pin.y / MAP_HEIGHT) * 100
    return {
      percentX: Math.max(2, Math.min(98, percentX)),
      percentY: Math.max(4, Math.min(96, percentY)),
      pinX: pin.x,
      pinY: pin.y,
    }
  }

  // Fallback: Mercator approximation if pin outside standard bounds
  const radLat = (lat * Math.PI) / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + radLat / 2))
  const normY = (1 - mercN / Math.PI) / 2
  const normX = (lng + 180) / 360

  const percentX = Math.max(2, Math.min(98, normX * 100))
  const percentY = Math.max(4, Math.min(96, normY * 100))

  return {
    percentX,
    percentY,
    pinX: (percentX / 100) * MAP_WIDTH,
    pinY: (percentY / 100) * MAP_HEIGHT,
  }
}

const KNOWN_LOCATIONS: Record<
  string,
  { lat: number; lng: number; city: string; country: string; flag: string }
> = {
  SG: {
    lat: 1.3521,
    lng: 103.8198,
    city: "Singapore",
    country: "Singapore",
    flag: "/images/flags/SG.png",
  },
  JP: {
    lat: 35.6762,
    lng: 139.6503,
    city: "Tokyo",
    country: "Japan",
    flag: "/images/flags/JP.png",
  },
  AU: {
    lat: -33.8688,
    lng: 151.2093,
    city: "Sydney",
    country: "Australia",
    flag: "/images/flags/AU.png",
  },
  US: {
    lat: 37.7749,
    lng: -122.4194,
    city: "San Francisco",
    country: "United States",
    flag: "/images/flags/US.png",
  },
  DE: {
    lat: 50.1109,
    lng: 8.6821,
    city: "Frankfurt",
    country: "Germany",
    flag: "/images/flags/DE.png",
  },
  GB: {
    lat: 51.5074,
    lng: -0.1278,
    city: "London",
    country: "United Kingdom",
    flag: "/images/flags/GB.png",
  },
  UK: {
    lat: 51.5074,
    lng: -0.1278,
    city: "London",
    country: "United Kingdom",
    flag: "/images/flags/GB.png",
  },
  NL: {
    lat: 52.3676,
    lng: 4.9041,
    city: "Amsterdam",
    country: "Netherlands",
    flag: "/images/flags/NL.png",
  },
  ID: {
    lat: -6.2088,
    lng: 106.8456,
    city: "Jakarta",
    country: "Indonesia",
    flag: "/images/flags/ID.png",
  },
  IN: {
    lat: 19.076,
    lng: 72.8777,
    city: "Mumbai",
    country: "India",
    flag: "/images/flags/IN.png",
  },
  CA: {
    lat: 43.6532,
    lng: -79.3832,
    city: "Toronto",
    country: "Canada",
    flag: "/images/flags/CA.png",
  },
  FR: {
    lat: 48.8566,
    lng: 2.3522,
    city: "Paris",
    country: "France",
    flag: "/images/flags/FR.png",
  },
  BR: {
    lat: -23.5505,
    lng: -46.6333,
    city: "Sao Paulo",
    country: "Brazil",
    flag: "/images/flags/BR.png",
  },
  KR: {
    lat: 37.5665,
    lng: 126.978,
    city: "Seoul",
    country: "South Korea",
    flag: "/images/flags/KR.png",
  },
  HK: {
    lat: 22.3193,
    lng: 114.1694,
    city: "Hong Kong",
    country: "Hong Kong",
    flag: "/images/flags/HK.png",
  },
  SE: {
    lat: 59.3293,
    lng: 18.0686,
    city: "Stockholm",
    country: "Sweden",
    flag: "/images/flags/SE.png",
  },
  ZA: {
    lat: -33.9249,
    lng: 18.4241,
    city: "Cape Town",
    country: "South Africa",
    flag: "/images/flags/ZA.png",
  },
}

export function getNodeGeo(node: ClusterNode): NodeGeo {
  const code = (node.location?.code || "").toUpperCase()
  if (KNOWN_LOCATIONS[code]) {
    const loc = KNOWN_LOCATIONS[code]
    const { percentX, percentY, pinX, pinY } = projectCoordinatesToPercent(
      loc.lat,
      loc.lng
    )
    return {
      lat: loc.lat,
      lng: loc.lng,
      city: loc.city,
      country: loc.country,
      flag: node.location.flag || loc.flag,
      percentX,
      percentY,
      pinX,
      pinY,
    }
  }

  // Fallback: derive coordinate deterministically from IP octets
  const octets = (node.ipAddress || "127.0.0.1")
    .split(".")
    .map((o) => parseInt(o, 10) || 0)
  const seed =
    (octets[0] * 73 + octets[1] * 37 + octets[2] * 19 + (octets[3] || 1)) % 1000

  // Constrain inside visible inhabited landmass range
  const derivedLat = -25 + (seed % 75)
  const derivedLng = -110 + ((seed * 13) % 240)

  const { percentX, percentY, pinX, pinY } = projectCoordinatesToPercent(
    derivedLat,
    derivedLng
  )

  return {
    lat: derivedLat,
    lng: derivedLng,
    city: node.location?.name || "Edge Host",
    country: node.location?.code || "Global",
    flag: node.location?.flag || "/images/flags/UN.png",
    percentX,
    percentY,
    pinX,
    pinY,
  }
}
