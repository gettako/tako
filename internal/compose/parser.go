package compose

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// BuildConfig defines build settings for a service container.
type BuildConfig struct {
	Context    string `json:"context,omitempty"`
	Dockerfile string `json:"dockerfile,omitempty"`
}

// PortMapping represents a parsed port binding.
type PortMapping struct {
	HostPort      int    `json:"host_port,omitempty"`
	ContainerPort int    `json:"container_port"`
	Protocol      string `json:"protocol,omitempty"` // "tcp" or "udp"
}

// ComposeServiceConfig holds parsed configuration for a sub-service in a Compose file.
type ComposeServiceConfig struct {
	Name        string            `json:"name"`
	Image       string            `json:"image,omitempty"`
	Build       *BuildConfig      `json:"build,omitempty"`
	Ports       []PortMapping     `json:"ports,omitempty"`
	Environment map[string]string `json:"environment,omitempty"`
	Volumes     []string          `json:"volumes,omitempty"`
	Command     []string          `json:"command,omitempty"`
	Restart     string            `json:"restart,omitempty"`
	DependsOn   []string          `json:"depends_on,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
}

// ComposeFile represents the top-level structure of a Docker Compose file.
type ComposeFile struct {
	Version  string                          `json:"version,omitempty"`
	Services map[string]ComposeServiceConfig `json:"services"`
	Networks map[string]any                  `json:"networks,omitempty"`
	Volumes  map[string]any                  `json:"volumes,omitempty"`
}

// ValidationResult summarizes schema verification and parsed services.
type ValidationResult struct {
	Valid    bool                   `json:"valid"`
	Services []ComposeServiceConfig `json:"services"`
	Errors   []string               `json:"errors"`
}

// ParsePortMapping parses port strings like "80:80", "8080:80/tcp", or "3000".
func ParsePortMapping(portStr string) (PortMapping, error) {
	portStr = strings.TrimSpace(portStr)
	if portStr == "" {
		return PortMapping{}, fmt.Errorf("empty port string")
	}

	proto := "tcp"
	if idx := strings.Index(portStr, "/"); idx != -1 {
		proto = strings.ToLower(portStr[idx+1:])
		portStr = portStr[:idx]
	}

	parts := strings.Split(portStr, ":")
	if len(parts) == 1 {
		cp, err := strconv.Atoi(parts[0])
		if err != nil || cp < 1 || cp > 65535 {
			return PortMapping{}, fmt.Errorf("invalid container port %q", parts[0])
		}
		return PortMapping{ContainerPort: cp, Protocol: proto}, nil
	} else if len(parts) == 2 {
		hp, err1 := strconv.Atoi(parts[0])
		cp, err2 := strconv.Atoi(parts[1])
		if err1 != nil || hp < 1 || hp > 65535 {
			return PortMapping{}, fmt.Errorf("invalid host port %q", parts[0])
		}
		if err2 != nil || cp < 1 || cp > 65535 {
			return PortMapping{}, fmt.Errorf("invalid container port %q", parts[1])
		}
		return PortMapping{HostPort: hp, ContainerPort: cp, Protocol: proto}, nil
	} else if len(parts) == 3 {
		// ip:hostPort:containerPort
		hp, err1 := strconv.Atoi(parts[1])
		cp, err2 := strconv.Atoi(parts[2])
		if err1 != nil || hp < 1 || hp > 65535 {
			return PortMapping{}, fmt.Errorf("invalid host port %q", parts[1])
		}
		if err2 != nil || cp < 1 || cp > 65535 {
			return PortMapping{}, fmt.Errorf("invalid container port %q", parts[2])
		}
		return PortMapping{HostPort: hp, ContainerPort: cp, Protocol: proto}, nil
	}

	return PortMapping{}, fmt.Errorf("unsupported port mapping format: %q", portStr)
}

// rawCompose defines intermediate yaml unmarshaling structure.
type rawCompose struct {
	Version  string                    `yaml:"version"`
	Services map[string]rawServiceNode `yaml:"services"`
	Networks map[string]any            `yaml:"networks"`
	Volumes  map[string]any            `yaml:"volumes"`
}

type rawServiceNode struct {
	Image       string            `yaml:"image"`
	Build       yaml.Node         `yaml:"build"`
	Ports       []any             `yaml:"ports"`
	Environment yaml.Node         `yaml:"environment"`
	Volumes     []string          `yaml:"volumes"`
	Command     yaml.Node         `yaml:"command"`
	Restart     string            `yaml:"restart"`
	DependsOn   yaml.Node         `yaml:"depends_on"`
	Labels      map[string]string `yaml:"labels"`
}

// ParseAndValidate parses the Compose YAML content and validates schema rules.
func ParseAndValidate(yamlContent string) (*ComposeFile, ValidationResult) {
	var errs []string

	yamlContent = strings.TrimSpace(yamlContent)
	if yamlContent == "" {
		return nil, ValidationResult{
			Valid:  false,
			Errors: []string{"Compose file content is empty"},
		}
	}

	var raw rawCompose
	if err := yaml.Unmarshal([]byte(yamlContent), &raw); err != nil {
		return nil, ValidationResult{
			Valid:  false,
			Errors: []string{fmt.Sprintf("YAML parse error: %v", err)},
		}
	}

	if len(raw.Services) == 0 {
		errs = append(errs, "Compose file must define at least one service under 'services'")
	}

	cf := &ComposeFile{
		Version:  raw.Version,
		Services: make(map[string]ComposeServiceConfig),
		Networks: raw.Networks,
		Volumes:  raw.Volumes,
	}

	var parsedServices []ComposeServiceConfig

	for svcName, node := range raw.Services {
		svc := ComposeServiceConfig{
			Name:        svcName,
			Image:       strings.TrimSpace(node.Image),
			Restart:     node.Restart,
			Volumes:     node.Volumes,
			Labels:      node.Labels,
			Environment: make(map[string]string),
		}

		// Handle build
		if node.Build.Kind == yaml.ScalarNode && node.Build.Value != "" {
			svc.Build = &BuildConfig{Context: node.Build.Value, Dockerfile: "Dockerfile"}
		} else if node.Build.Kind == yaml.MappingNode {
			var b BuildConfig
			if err := node.Build.Decode(&b); err == nil {
				if b.Dockerfile == "" {
					b.Dockerfile = "Dockerfile"
				}
				svc.Build = &b
			}
		}

		if svc.Image == "" && svc.Build == nil {
			errs = append(errs, fmt.Sprintf("Service %q must specify either 'image' or 'build'", svcName))
		}

		// Handle ports
		for _, p := range node.Ports {
			var pStr string
			switch v := p.(type) {
			case string:
				pStr = v
			case int:
				pStr = strconv.Itoa(v)
			case map[string]any:
				// Long syntax: target: 80, published: 8080
				target, _ := v["target"].(int)
				published, _ := v["published"].(int)
				proto, _ := v["protocol"].(string)
				if proto == "" {
					proto = "tcp"
				}
				if target > 0 {
					svc.Ports = append(svc.Ports, PortMapping{
						HostPort:      published,
						ContainerPort: target,
						Protocol:      proto,
					})
					continue
				}
			}

			if pStr != "" {
				pm, err := ParsePortMapping(pStr)
				if err != nil {
					errs = append(errs, fmt.Sprintf("Service %q invalid port %q: %v", svcName, pStr, err))
				} else {
					svc.Ports = append(svc.Ports, pm)
				}
			}
		}

		// Handle environment
		if node.Environment.Kind == yaml.MappingNode {
			var envMap map[string]string
			if err := node.Environment.Decode(&envMap); err == nil {
				for k, v := range envMap {
					svc.Environment[k] = v
				}
			}
		} else if node.Environment.Kind == yaml.SequenceNode {
			var envList []string
			if err := node.Environment.Decode(&envList); err == nil {
				for _, item := range envList {
					eqIdx := strings.Index(item, "=")
					if eqIdx != -1 {
						svc.Environment[item[:eqIdx]] = item[eqIdx+1:]
					} else {
						svc.Environment[item] = ""
					}
				}
			}
		}

		// Handle command
		if node.Command.Kind == yaml.ScalarNode && node.Command.Value != "" {
			svc.Command = strings.Fields(node.Command.Value)
		} else if node.Command.Kind == yaml.SequenceNode {
			var cmdList []string
			if err := node.Command.Decode(&cmdList); err == nil {
				svc.Command = cmdList
			}
		}

		// Handle depends_on
		if node.DependsOn.Kind == yaml.SequenceNode {
			var deps []string
			if err := node.DependsOn.Decode(&deps); err == nil {
				svc.DependsOn = deps
			}
		} else if node.DependsOn.Kind == yaml.MappingNode {
			var depMap map[string]any
			if err := node.DependsOn.Decode(&depMap); err == nil {
				for dep := range depMap {
					svc.DependsOn = append(svc.DependsOn, dep)
				}
			}
		}

		cf.Services[svcName] = svc
		parsedServices = append(parsedServices, svc)
	}

	// Validate dependencies exist
	for _, svc := range parsedServices {
		for _, dep := range svc.DependsOn {
			if _, exists := cf.Services[dep]; !exists {
				errs = append(errs, fmt.Sprintf("Service %q depends on undefined service %q", svc.Name, dep))
			}
		}
	}

	// Check circular dependencies
	if _, cycleErr := ResolveStartupOrder(parsedServices); cycleErr != nil {
		errs = append(errs, cycleErr.Error())
	}

	// Sort alphabetically for deterministic output
	sort.Slice(parsedServices, func(i, j int) bool {
		return parsedServices[i].Name < parsedServices[j].Name
	})

	return cf, ValidationResult{
		Valid:    len(errs) == 0,
		Services: parsedServices,
		Errors:   errs,
	}
}

// ResolveStartupOrder determines service launch sequence using topological sort.
func ResolveStartupOrder(services []ComposeServiceConfig) ([]string, error) {
	inDegree := make(map[string]int)
	graph := make(map[string][]string)
	serviceSet := make(map[string]bool)

	for _, svc := range services {
		serviceSet[svc.Name] = true
		if _, ok := inDegree[svc.Name]; !ok {
			inDegree[svc.Name] = 0
		}
		for _, dep := range svc.DependsOn {
			graph[dep] = append(graph[dep], svc.Name)
			inDegree[svc.Name]++
		}
	}

	var queue []string
	for name := range serviceSet {
		if inDegree[name] == 0 {
			queue = append(queue, name)
		}
	}
	sort.Strings(queue)

	var ordered []string
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		ordered = append(ordered, curr)

		for _, neighbor := range graph[curr] {
			inDegree[neighbor]--
			if inDegree[neighbor] == 0 {
				queue = append(queue, neighbor)
			}
		}
		sort.Strings(queue)
	}

	if len(ordered) != len(serviceSet) {
		return nil, fmt.Errorf("circular dependency detected in Compose services")
	}

	return ordered, nil
}
