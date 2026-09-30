import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  compress: false,
  async rewrites() {
    const backendUrl =
      process.env.TAKO_BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "http://server:8080"
        : "http://127.0.0.1:8080")
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
