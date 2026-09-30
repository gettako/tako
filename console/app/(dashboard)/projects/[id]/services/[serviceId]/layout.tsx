"use client"

import * as React from "react"
import { ServiceProvider } from "@/components/services/service-context"
import { ServiceHeader } from "@/components/services/service-header"
import { ServiceTabs } from "@/components/services/service-tabs"
import { ActiveDeploymentBanner } from "@/components/services/active-deployment-banner"

export default function ServiceLayout({
  children,
  params,
  initialService,
}: {
  children: React.ReactNode
  params:
    | { id: string; serviceId: string }
    | Promise<{ id: string; serviceId: string }>
  initialService?: any
}) {
  const [routeParams, setRouteParams] = React.useState<{
    id: string
    serviceId: string
  }>(() => {
    if (
      params &&
      typeof (params as Promise<{ id: string; serviceId: string }>).then !==
        "function"
    ) {
      return params as { id: string; serviceId: string }
    }
    return { id: "", serviceId: "" }
  })

  React.useEffect(() => {
    if (
      params &&
      typeof (params as Promise<{ id: string; serviceId: string }>).then ===
        "function"
    ) {
      Promise.resolve(params).then((resolved) => {
        setRouteParams(resolved)
      })
    } else if (params) {
      setRouteParams(params as { id: string; serviceId: string })
    }
  }, [params])

  if (!routeParams.id || !routeParams.serviceId) {
    return (
      <div className="flex animate-pulse flex-col gap-6">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
    )
  }

  return (
    <ServiceProvider
      serviceId={routeParams.serviceId}
      projectId={routeParams.id}
      initialService={initialService}
    >
      <div className="flex flex-col gap-6 md:gap-8">
        <ServiceHeader />
        <ServiceTabs />
        <ActiveDeploymentBanner />
        <div className="w-full">{children}</div>
      </div>
    </ServiceProvider>
  )
}
