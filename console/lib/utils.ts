export { cn } from "cn"

/**
 * Returns a deterministic DiceBear big-smile avatar URL based on a consistent hash of the seed (e.g. email).
 */
export function getDiceBearAvatar(seed?: string): string {
  const normalized = (seed || "admin@tako.local").trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, "0")
  return `https://api.dicebear.com/10.x/big-smile/png?seed=${hashHex}`
}
