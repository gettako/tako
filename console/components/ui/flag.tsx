import Image from "next/image"

import { cn } from "@/lib/utils"

interface FlagProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  title?: string
}

export function Flag({ src, alt, width, height, className, title }: FlagProps) {
  return (
    <Image
      src={src}
      alt={alt}
      title={title ?? alt}
      width={width}
      height={height}
      unoptimized
      className={cn("w-auto shrink-0 rounded-[2px]", className)}
    />
  )
}
