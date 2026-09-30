package docker

import (
	"gettako.dev/tako/agent/traefik"
)

type ServiceRoute = traefik.ServiceRoute
type IngressRule = traefik.IngressRule

type TraefikManager struct {
	gen *traefik.Generator
}

func NewTraefikManager(configPath string) *TraefikManager {
	return &TraefikManager{
		gen: traefik.NewGenerator(configPath),
	}
}

func (tm *TraefikManager) UpdateRoute(serviceID, domain, ip string, port int32) error {
	var domains []string
	if domain != "" {
		domains = []string{domain}
	}
	return tm.gen.UpdateRoute(serviceID, domains, ip, port)
}

func (tm *TraefikManager) UpdateIngressRules(serviceID string, rules []IngressRule, defaultIP string, defaultPort int32) error {
	return tm.gen.UpdateIngressRules(serviceID, rules, defaultIP, defaultPort)
}

func (tm *TraefikManager) RemoveRoute(serviceID string) error {
	return tm.gen.RemoveRoute(serviceID)
}

func (tm *TraefikManager) GetRoute(serviceID string) (ServiceRoute, bool) {
	return tm.gen.GetRoute(serviceID)
}
