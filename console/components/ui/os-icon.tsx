import * as React from "react"
import {
  siAlmalinux,
  siAlpinelinux,
  siApple,
  siArchlinux,
  siCentos,
  siDebian,
  siDocker,
  siFedora,
  siFreebsd,
  siLinux,
  siOpensuse,
  siRedhat,
  siRockylinux,
  siUbuntu,
  type SimpleIcon,
} from "simple-icons"

import { cn } from "@/lib/utils"

interface OsInfo {
  icon: SimpleIcon
  color: string
  label: string
}

export function resolveOsInfo(osString?: string): OsInfo {
  const raw = (osString || "").toLowerCase()

  if (raw.includes("ubuntu")) {
    return { icon: siUbuntu, color: "#E95420", label: "Ubuntu" }
  }
  if (raw.includes("debian")) {
    return { icon: siDebian, color: "#A81D33", label: "Debian" }
  }
  if (raw.includes("rocky")) {
    return { icon: siRockylinux, color: "#10B981", label: "Rocky Linux" }
  }
  if (raw.includes("alma")) {
    return { icon: siAlmalinux, color: "#1060FF", label: "AlmaLinux" }
  }
  if (raw.includes("alpine")) {
    return { icon: siAlpinelinux, color: "#0D597F", label: "Alpine Linux" }
  }
  if (raw.includes("red hat") || raw.includes("rhel") || raw.includes("redhat")) {
    return { icon: siRedhat, color: "#EE0000", label: "Red Hat" }
  }
  if (raw.includes("centos")) {
    return { icon: siCentos, color: "#262577", label: "CentOS" }
  }
  if (raw.includes("fedora")) {
    return { icon: siFedora, color: "#51A2DA", label: "Fedora" }
  }
  if (raw.includes("arch")) {
    return { icon: siArchlinux, color: "#1793D1", label: "Arch Linux" }
  }
  if (raw.includes("suse") || raw.includes("opensuse")) {
    return { icon: siOpensuse, color: "#73BA25", label: "openSUSE" }
  }
  if (raw.includes("freebsd") || raw.includes("bsd")) {
    return { icon: siFreebsd, color: "#AB2B28", label: "FreeBSD" }
  }
  if (
    raw.includes("darwin") ||
    raw.includes("macos") ||
    raw.includes("mac os") ||
    raw.includes("apple")
  ) {
    return { icon: siApple, color: "#A2AAAD", label: "macOS" }
  }

  return { icon: siLinux, color: "#FCC624", label: "Linux" }
}

export interface OsIconProps extends React.SVGProps<SVGSVGElement> {
  os?: string
  useBrandColor?: boolean
  className?: string
  title?: string
}

export function OsIcon({
  os,
  useBrandColor = true,
  className,
  title,
  ...props
}: OsIconProps) {
  const info = React.useMemo(() => resolveOsInfo(os), [os])
  const iconTitle = title ?? (os ? `${info.label} (${os})` : info.label)

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill={useBrandColor ? info.color : "currentColor"}
      className={cn("size-4 shrink-0 transition-colors", className)}
      {...props}
    >
      <title>{iconTitle}</title>
      <path d={info.icon.path} />
    </svg>
  )
}

export function DockerIcon({
  className,
  title = "Docker Engine",
  ...props
}: React.SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="#2496ED"
      className={cn("size-3.5 shrink-0 transition-colors", className)}
      {...props}
    >
      <title>{title}</title>
      <path d={siDocker.path} />
    </svg>
  )
}

