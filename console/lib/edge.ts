export interface EdgeEntryPoint {
  name: string
  tls: boolean
  description: string
}

export const EDGE_ENTRYPOINTS: EdgeEntryPoint[] = [
  {
    name: "websecure",
    tls: true,
    description: "Public HTTPS edge with automatic TLS termination",
  },
  {
    name: "web",
    tls: false,
    description: "Public HTTP edge, usually redirected to HTTPS",
  },
  {
    name: "grpc",
    tls: true,
    description: "gRPC edge with TLS termination",
  },
  {
    name: "internal",
    tls: false,
    description: "Cluster-internal traffic, not exposed publicly",
  },
]

export function getEdgeEntryPoint(name?: string): EdgeEntryPoint | undefined {
  return EDGE_ENTRYPOINTS.find((entryPoint) => entryPoint.name === name)
}
