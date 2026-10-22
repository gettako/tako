import type {
  ProjectService,
  ServiceContainer,
  ServiceDomain,
} from "@/types/platform"

export function getServiceContainers(
  service: ProjectService
): ServiceContainer[] {
  if (service.containers?.length) return service.containers

  return [
    {
      name: `tako_${service.slug}`,
      isMain: true,
      ports: service.portMappings.map((mapping) => ({
        port: mapping.container,
        protocol: mapping.protocol,
      })),
    },
  ]
}

export function getMainContainer(
  service: ProjectService
): ServiceContainer | undefined {
  const containers = getServiceContainers(service)
  return containers.find((container) => container.isMain) ?? containers[0]
}

export function resolveDomainContainer(
  service: ProjectService,
  domain: Pick<ServiceDomain, "targetContainer" | "targetPort">
): ServiceContainer | undefined {
  const containers = getServiceContainers(service)

  return (
    containers.find((container) => container.name === domain.targetContainer) ??
    containers.find((container) =>
      container.ports.some((port) => port.port === domain.targetPort)
    ) ??
    getMainContainer(service)
  )
}
