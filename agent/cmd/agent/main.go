package main

import (
	"context"
	"flag"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"gettako.dev/tako/agent/internal/daemon"
)

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func detectPublicIP() string {
	endpoints := []string{
		"https://ifconfig.co",
		"https://api.ipify.org",
		"https://icanhazip.com",
	}
	client := &http.Client{Timeout: 3 * time.Second}
	for _, ep := range endpoints {
		resp, err := client.Get(ep)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if err == nil && resp.StatusCode == http.StatusOK {
			ip := strings.TrimSpace(string(body))
			if parsed := net.ParseIP(ip); parsed != nil && !parsed.IsLoopback() {
				return ip
			}
		}
	}
	return ""
}

func detectPrivateIP() string {
	// Try establishing a UDP connection to determine preferred outbound interface
	conn, err := net.Dial("udp", "1.1.1.1:80")
	if err == nil {
		defer conn.Close()
		localAddr, ok := conn.LocalAddr().(*net.UDPAddr)
		if ok && localAddr.IP != nil && !localAddr.IP.IsLoopback() {
			if ip4 := localAddr.IP.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}

	// Fallback to scanning network interfaces
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip == nil || ip.IsLoopback() {
					continue
				}
				if ip4 := ip.To4(); ip4 != nil {
					return ip4.String()
				}
			}
		}
	}
	return ""
}

func main() {
	defaultHost, _ := os.Hostname()
	if defaultHost == "" {
		defaultHost = "tako-worker"
	}

	serverAddr := getEnv("TAKO_MASTER_URL", getEnv("TAKO_SERVER_ADDR", "127.0.0.1:50051"))
	masterURL := flag.String("master-url", serverAddr, "Master gRPC server address (host:port)")
	enrollToken := flag.String("token", getEnv("TAKO_ENROLL_TOKEN", ""), "Master enrollment token for agent")
	nodeID := flag.String("node-id", getEnv("TAKO_NODE_ID", ""), "Node ID (auto-generated if empty)")
	nodeName := flag.String("node-name", getEnv("TAKO_NODE_NAME", defaultHost), "Human-readable name for this node")
	role := flag.String("role", getEnv("TAKO_NODE_ROLE", "worker"), "Node role: leader or worker")
	ipAddress := flag.String("ip-address", getEnv("TAKO_IP_ADDRESS", getEnv("TAKO_PRIVATE_IP", "")), "Node IP address")
	publicIP := flag.String("public-ip", getEnv("TAKO_PUBLIC_IP", ""), "Public IP address (optional)")
	stateFile := flag.String("state-file", getEnv("TAKO_STATE_FILE", "/tmp/tako-agent.json"), "Path to persist local agent registration state")
	insecure := flag.Bool("insecure", getEnv("TAKO_INSECURE", "true") == "true", "Use insecure gRPC connection (no TLS)")
	heartbeatInterval := flag.Duration("interval", 3*time.Second, "Heartbeat interval")

	flag.Parse()

	if *publicIP == "" {
		if detected := detectPublicIP(); detected != "" {
			log.Printf("[tako-agent] auto-detected public IP: %s", detected)
			*publicIP = detected
		} else {
			log.Printf("[tako-agent] public IP auto-detection failed")
		}
	}

	if *ipAddress == "" || *ipAddress == "127.0.0.1" {
		if priv := detectPrivateIP(); priv != "" {
			log.Printf("[tako-agent] auto-detected private IP: %s", priv)
			*ipAddress = priv
		} else if *publicIP != "" {
			*ipAddress = *publicIP
		} else {
			*ipAddress = "127.0.0.1"
		}
	}

	log.Printf("[tako-agent] starting agent daemon (node: %s, role: %s, master: %s, ip: %s, public_ip: %s)...", *nodeName, *role, *masterURL, *ipAddress, *publicIP)

	cfg := daemon.Config{
		MasterURL:         *masterURL,
		EnrollToken:       *enrollToken,
		NodeID:            *nodeID,
		NodeName:          *nodeName,
		Role:              *role,
		IPAddress:         *ipAddress,
		PublicIP:          *publicIP,
		StateFile:         *stateFile,
		HeartbeatInterval: *heartbeatInterval,
		Insecure:          *insecure,
	}

	d, err := daemon.New(cfg)
	if err != nil {
		log.Fatalf("[tako-agent] failed to initialize daemon: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := d.Run(ctx); err != nil {
		log.Printf("[tako-agent] daemon stopped with notice: %v", err)
	}

	log.Println("[tako-agent] process exited cleanly")
}
