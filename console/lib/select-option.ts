import type { ComponentType } from "react"

export interface SelectOption {
  value: string
  label: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  flag?: string
  badge?: string
}
