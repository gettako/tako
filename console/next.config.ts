import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/logs",
        destination: "/audit-logs",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
