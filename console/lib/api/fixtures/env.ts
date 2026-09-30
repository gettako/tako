import type { ServiceEnv } from "../client"

export const mockServiceEnvs: Record<string, ServiceEnv> = {
  srv_web_prod: {
    env_vars: [
      { key: "NODE_ENV", value: "production", is_secret: false },
      { key: "PORT", value: "3000", is_secret: false },
      {
        key: "NEXT_PUBLIC_APP_URL",
        value: "https://acme.example.com",
        is_secret: false,
      },
      {
        key: "SESSION_SECRET",
        value: "s3cr3t_sess_key_a89f92...",
        is_secret: true,
      },
      {
        key: "DATABASE_URL",
        value: "postgres://acme_user:p4ssw0rd@10.0.0.5:5432/acme_prod",
        is_secret: true,
      },
    ],
    build_args: [
      { key: "NEXT_TELEMETRY_DISABLED", value: "1", is_secret: false },
      { key: "APP_VERSION", value: "v2.4.1", is_secret: false },
    ],
  },
  srv_api_prod: {
    env_vars: [
      { key: "GIN_MODE", value: "release", is_secret: false },
      { key: "PORT", value: "8080", is_secret: false },
      { key: "REDIS_ADDR", value: "10.0.0.6:6379", is_secret: false },
      {
        key: "API_SECRET_KEY",
        value: "tok_prod_sec_9918237192...",
        is_secret: true,
      },
    ],
    build_args: [{ key: "GO_VERSION", value: "1.24", is_secret: false }],
  },
  srv_storefront: {
    env_vars: [
      { key: "NODE_ENV", value: "production", is_secret: false },
      {
        key: "STRIPE_SECRET_KEY",
        value: "sk_live_51Mz99281...",
        is_secret: true,
      },
      {
        key: "INVENTORY_API_URL",
        value: "https://inventory.internal",
        is_secret: false,
      },
    ],
    build_args: [],
  },
  srv_blog: {
    env_vars: [
      { key: "ASTRO_TELEMETRY_DISABLED", value: "1", is_secret: false },
    ],
    build_args: [],
  },
}
