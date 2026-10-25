import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  env: {
    NEXT_PUBLIC_TAKO_SERVER_URL:
      process.env.NEXT_PUBLIC_TAKO_SERVER_URL ||
      process.env.TAKO_SERVER_URL ||
      "",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://api.dicebear.com https://avatars.githubusercontent.com; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;",
          },
        ],
      },
    ]
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
