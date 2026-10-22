import type { ClusterNode } from "@/types/platform"
import { cn } from "@/lib/utils"

export function NodeRoleBadge({ role }: { role: ClusterNode["role"] }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase",
        role === "master"
          ? "border border-primary/20 bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {role}
    </span>
  )
}
