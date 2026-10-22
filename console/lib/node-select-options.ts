import { getNodeGeo } from "@/lib/node-geo"
import type { SelectOption } from "@/lib/select-option"
import type { ClusterNode } from "@/types/platform"

export function buildNodeSelectOptions(
  nodes: ClusterNode[],
  allOption: Pick<SelectOption, "label" | "description">
): SelectOption[] {
  return [
    { value: "all", ...allOption },
    ...nodes.map((node) => {
      const geo = getNodeGeo(node)

      return {
        value: node.id,
        label: `${node.name} (${geo.city})`,
        description: `${node.ipAddress} • ${node.role.toUpperCase()}`,
        flag: geo.flag,
        badge:
          node.status === "offline" ? "OFFLINE" : `${node.grpcLatencyMs}ms`,
      }
    }),
  ]
}
