import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_TAKO_SERVER_URL:
      process.env.NEXT_PUBLIC_TAKO_SERVER_URL ||
      process.env.TAKO_SERVER_URL ||
      "",
  },
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
