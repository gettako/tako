declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_MODE?: "mock" | "live"
  }
}
