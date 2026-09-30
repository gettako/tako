import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type SkeletonVariant = "card" | "table" | "metrics" | "block"

export interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
  rows?: number
  columns?: number
  count?: number
}

function CardSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-card p-6",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-2 flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  )
}

function TableSkeleton({
  rows = 5,
  className,
  ...props
}: { rows?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
      {...props}
    >
      <div className="flex h-10 items-center gap-4 border-b border-border bg-muted/40 px-4">
        <Skeleton className="h-3.5 w-1/4" />
        <Skeleton className="h-3.5 w-1/6" />
        <Skeleton className="h-3.5 w-1/5" />
        <Skeleton className="ml-auto h-3.5 w-16" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex h-12 items-center gap-4 px-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/6" />
            <Skeleton className="h-3 w-1/5" />
            <Skeleton className="ml-auto h-4 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricsSkeleton({
  columns = 3,
  className,
  ...props
}: { columns?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-4", className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      {...props}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
        >
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  )
}

export function LoadingSkeleton({
  variant = "block",
  rows = 5,
  columns = 3,
  count = 1,
  className,
  ...props
}: LoadingSkeletonProps) {
  if (variant === "card") {
    if (count > 1) {
      return (
        <div
          className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}
        >
          {Array.from({ length: count }).map((_, index) => (
            <CardSkeleton key={index} {...props} />
          ))}
        </div>
      )
    }
    return <CardSkeleton className={className} {...props} />
  }

  if (variant === "table") {
    return <TableSkeleton rows={rows} className={className} {...props} />
  }

  if (variant === "metrics") {
    return (
      <MetricsSkeleton columns={columns} className={className} {...props} />
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export { CardSkeleton, TableSkeleton, MetricsSkeleton }
