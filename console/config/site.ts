export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Tako",
  description:
    "Tako - High-performance edge infrastructure and agent telemetry",
}

export type SiteConfig = typeof siteConfig
