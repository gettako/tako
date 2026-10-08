#!/usr/bin/env bash
# ==============================================================================
# Tako PaaS Universal Installer Script
# https://gettako.dev
#
# Usage:
#   Master Node:  curl -fsSL https://gettako.dev/install.sh | bash
#   Worker Node:  curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent
# ==============================================================================

set -euo pipefail

TAKO_VERSION="latest"
TAKO_DIR="${TAKO_DIR:-/opt/tako}"
IS_AGENT=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent|-a)
      IS_AGENT=1
      shift
      ;;
    --version|-v)
      TAKO_VERSION="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Color styling
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}"
echo "  _____     _       "
echo " |_   _|_ _| | _____ "
echo "   | |/ _\` | |/ / _ \\"
echo "   | | (_| |   < (_) |"
echo "   |_|\\__,_|_|\\_\\___/ "
echo -e "${NC}"
echo -e "${BOLD}Tako PaaS Installer (${TAKO_VERSION})${NC}"
echo "--------------------------------------------------"

# 1. Root & OS Verification
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}[ERROR] This installer must be run as root (or via sudo).${NC}"
  exit 1
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo -e "${RED}[ERROR] Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}✓ Host detected:${NC} OS=$OS, Arch=$ARCH"

# 2. Docker Check & Auto-Installation
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Docker not found. Installing Docker engine...${NC}"
  curl -fsSL https://get.docker.com | sh
  if command -v systemctl &> /dev/null; then
    systemctl enable --now docker
  fi
  echo -e "${GREEN}✓ Docker successfully installed.${NC}"
else
  echo -e "${GREEN}✓ Docker is already installed.${NC}"
fi

# Ensure docker compose plugin is available
if ! docker compose version &> /dev/null; then
  echo -e "${RED}[ERROR] Docker Compose v2 plugin is required.${NC}"
  exit 1
fi

# 3. Detect Host IPs (Public & Private)
detect_public_ip() {
  local ip=""
  if [[ -n "${TAKO_PUBLIC_IP:-}" ]]; then
    echo "$TAKO_PUBLIC_IP"
    return
  fi
  ip=$(curl -s -4 --connect-timeout 2 https://ifconfig.co 2>/dev/null) || true
  if [[ -z "$ip" ]]; then
    ip=$(curl -s -4 --connect-timeout 2 https://api.ipify.org 2>/dev/null) || true
  fi
  if [[ -z "$ip" ]]; then
    ip=$(curl -s -4 --connect-timeout 2 https://icanhazip.com 2>/dev/null) || true
  fi
  if [[ -z "$ip" ]]; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}') || true
  fi
  if [[ -z "$ip" ]]; then
    ip="127.0.0.1"
  fi
  echo "$ip" | tr -d '\n '
}

detect_private_ip() {
  local ip=""
  if [[ -n "${TAKO_PRIVATE_IP:-}" ]]; then
    echo "$TAKO_PRIVATE_IP"
    return
  fi
  # 1. Best source: outbound interface IP via ip route
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}') || true
  if [[ -z "$ip" ]]; then
    ip=$(ip -4 route show default 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}') || true
  fi
  # 2. Interface inspection fallback: filter loopback, docker bridge (172.16-31.x, 10.0.0.x docker0)
  if [[ -z "$ip" ]]; then
    for cand in $(hostname -I 2>/dev/null); do
      if [[ ! "$cand" =~ ^127\. ]] && [[ ! "$cand" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] && [[ ! "$cand" =~ ^10\.0\.0\. ]]; then
        ip="$cand"
        break
      fi
    done
  fi
  if [[ -z "$ip" ]]; then
    ip="127.0.0.1"
  fi
  echo "$ip" | tr -d '\n '
}

PUBLIC_IP="$(detect_public_ip)"
PRIVATE_IP="$(detect_private_ip)"

# 4. Interactive Reader via /dev/tty
prompt_input() {
  local prompt_text="$1"
  local default_val="$2"
  local var_name="$3"
  local input=""

  if [[ -t 0 ]] || [[ -c /dev/tty ]]; then
    echo -en "${BOLD}${prompt_text} [${default_val}]: ${NC}" > /dev/tty
    read -r input < /dev/tty || true
  fi

  if [[ -z "$input" ]]; then
    input="$default_val"
  fi
  eval "$var_name=\"$input\""
}

prompt_secret() {
  local prompt_text="$1"
  local default_val="$2"
  local var_name="$3"
  local input=""

  if [[ -t 0 ]] || [[ -c /dev/tty ]]; then
    echo -en "${BOLD}${prompt_text} [hidden]: ${NC}" > /dev/tty
    read -rs input < /dev/tty || true
    echo "" > /dev/tty
  fi

  if [[ -z "$input" ]]; then
    input="$default_val"
  fi
  eval "$var_name=\"$input\""
}

mkdir -p "${TAKO_DIR}/data"
mkdir -p /etc/tako/traefik/dynamic

# Write default Traefik config to physical host /etc/tako/traefik/traefik.yml
cat << 'EOF' > /etc/tako/traefik/traefik.yml
global:
  checkNewVersion: false
  sendAnonymousUsage: false

api:
  dashboard: false

providers:
  docker:
    exposedByDefault: false
    network: tako-network
    watch: true
  file:
    directory: /etc/traefik/dynamic
    watch: true

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: "admin@gettako.dev"
      storage: "/acme.json"
      httpChallenge:
        entryPoint: web
EOF

touch /etc/tako/traefik/acme.json
chmod 600 /etc/tako/traefik/acme.json

# Create network if not exists
docker network inspect tako-network >/dev/null 2>&1 || docker network create --driver bridge tako-network

# ==============================================================================
# MODE: WORKER AGENT
# ==============================================================================
if [[ $IS_AGENT -eq 1 ]]; then
  echo -e "\n${BOLD}=== Configuring Tako Worker Node ===${NC}\n"

  MASTER_URL="${TAKO_MASTER_URL:-}"
  AGENT_TOKEN="${TAKO_AGENT_TOKEN:-}"
  NODE_NAME="${TAKO_NODE_NAME:-$(hostname)}"
  NODE_IP="${TAKO_PUBLIC_IP:-$PUBLIC_IP}"
  NODE_PRIVATE_IP="${TAKO_PRIVATE_IP:-$PRIVATE_IP}"

  if [[ -z "$MASTER_URL" ]]; then
    prompt_input "Enter Master gRPC URL (<master-ip>:50051)" "${PUBLIC_IP}:50051" MASTER_URL
  fi

  if [[ -z "$AGENT_TOKEN" ]]; then
    prompt_secret "Enter Agent Enrollment Token" "master-enroll-token" AGENT_TOKEN
  fi

  if [[ -z "${TAKO_PUBLIC_IP:-}" ]]; then
    prompt_input "Enter Node Public IP" "$NODE_IP" NODE_IP
  fi

  if [[ -z "${TAKO_PRIVATE_IP:-}" ]]; then
    prompt_input "Enter Node Private IP" "$NODE_PRIVATE_IP" NODE_PRIVATE_IP
  fi

  cat << EOF > "${TAKO_DIR}/docker-compose.yml"
services:
  traefik:
    image: traefik:latest
    container_name: tako-traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /etc/tako/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - /etc/tako/traefik/dynamic:/etc/traefik/dynamic
      - /etc/tako/traefik/acme.json:/acme.json
    networks:
      - tako-network

  agent:
    image: ghcr.io/gettakodev/tako-agent:latest
    container_name: tako-agent
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc/tako/traefik/dynamic:/etc/tako/traefik/dynamic
      - ./data/agent:/data
      - /proc/sysrq-trigger:/host-sysrq-trigger
    environment:
      - TAKO_SERVER_ADDR=${MASTER_URL}
      - TAKO_ENROLL_TOKEN=${AGENT_TOKEN}
      - TAKO_NODE_NAME=${NODE_NAME}
      - TAKO_PUBLIC_IP=${NODE_IP}
      - TAKO_IP_ADDRESS=${NODE_PRIVATE_IP}
      - TAKO_METRICS_INTERVAL=3s
      - TAKO_TRAEFIK_DYNAMIC_DIR=/etc/tako/traefik/dynamic
    networks:
      - tako-network

networks:
  tako-network:
    external: true
EOF

  echo -e "\n${YELLOW}Starting Tako Worker containers...${NC}"
  (cd "${TAKO_DIR}" && docker compose up -d)

  echo -e "\n${GREEN}${BOLD}✓ Tako Worker Agent successfully started!${NC}"
  echo "Node '${NODE_NAME}' connected to Master at ${MASTER_URL}."
  echo "Your worker node is now reporting metrics and ready for deployments."
  exit 0
fi

# ==============================================================================
# MODE: MASTER SERVER
# ==============================================================================
echo -e "\n${BOLD}=== Configuring Tako Master Server ===${NC}\n"

ADMIN_EMAIL="${TAKO_EMAIL:-}"
ADMIN_PASSWORD="${TAKO_PASSWORD:-}"
AUTH_SECRET="${TAKO_AUTH_SECRET:-$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)}"
SERVER_IP="${TAKO_PUBLIC_IP:-$PUBLIC_IP}"
SERVER_PRIVATE_IP="${TAKO_PRIVATE_IP:-$PRIVATE_IP}"

if [[ -z "$ADMIN_EMAIL" ]]; then
  prompt_input "Enter Admin Email" "admin@gettako.dev" ADMIN_EMAIL
fi

if [[ -z "$ADMIN_PASSWORD" ]]; then
  prompt_secret "Enter Admin Password" "admin123456" ADMIN_PASSWORD
fi

if [[ -z "${TAKO_PUBLIC_IP:-}" ]]; then
  prompt_input "Enter Server Public IP" "$SERVER_IP" SERVER_IP
fi

if [[ -z "${TAKO_PRIVATE_IP:-}" ]]; then
  prompt_input "Enter Server Private IP" "$SERVER_PRIVATE_IP" SERVER_PRIVATE_IP
fi

# Write dynamic Tako Console routing config for Traefik
cat << 'EOF' > /etc/tako/traefik/tako.yml
http:
  routers:
    tako-console-secure:
      rule: "PathPrefix(`/`)"
      entryPoints:
        - websecure
      priority: 1
      tls:
        certResolver: letsencrypt
      service: tako-console

    tako-console:
      rule: "PathPrefix(`/`)"
      entryPoints:
        - web
      priority: 1
      service: tako-console

  services:
    tako-console:
      loadBalancer:
        servers:
          - url: "http://tako-console:3000"
EOF

cat << EOF > "${TAKO_DIR}/docker-compose.yml"
services:
  traefik:
    image: traefik:latest
    container_name: tako-traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /etc/tako/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - /etc/tako/traefik/tako.yml:/etc/traefik/dynamic/tako.yml:ro
      - /etc/tako/traefik/dynamic:/etc/traefik/dynamic
      - /etc/tako/traefik/acme.json:/acme.json
    environment:
      - TAKO_ACME_EMAIL=${ADMIN_EMAIL}
    networks:
      - tako-network

  server:
    image: ghcr.io/gettakodev/tako-server:latest
    container_name: tako-server
    restart: unless-stopped
    ports:
      - "50051:50051"
      - "127.0.0.1:8080:8080"
    volumes:
      - ./data/sqlite:/data
      - /etc/tako/traefik:/etc/tako/traefik
    environment:
      - TAKO_HTTP_PORT=8080
      - TAKO_GRPC_PORT=50051
      - TAKO_DB_PATH=/data/tako.db
      - TAKO_AUTH_SECRET=${AUTH_SECRET}
      - TAKO_INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}
      - TAKO_INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - TAKO_AGENT_SECRET=local-master-token
      - TAKO_NODE_NAME=tako-master-01
    networks:
      - tako-network

  console:
    image: ghcr.io/gettakodev/tako-console:latest
    container_name: tako-console
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - TAKO_SERVER_URL=http://tako-server:8080
      - NEXT_PUBLIC_TAKO_SERVER_URL=http://${SERVER_IP}:3000
    depends_on:
      - server
    networks:
      - tako-network

  agent:
    image: ghcr.io/gettakodev/tako-agent:latest
    container_name: tako-agent
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc/os-release:/etc/os-release:ro
      - /etc/tako/traefik/dynamic:/etc/tako/traefik/dynamic
      - ./data/agent:/data
      - /proc/sysrq-trigger:/host-sysrq-trigger
    environment:
      - TAKO_SERVER_ADDR=tako-server:50051
      - TAKO_MASTER_URL=tako-server:50051
      - TAKO_ENROLL_TOKEN=local-master-token
      - TAKO_NODE_ID=tako-master-01
      - TAKO_NODE_NAME=tako-master-01
      - TAKO_NODE_ROLE=leader
      - TAKO_PUBLIC_IP=${SERVER_IP}
      - TAKO_IP_ADDRESS=${SERVER_PRIVATE_IP}
      - TAKO_STATE_FILE=/data/agent.json
      - TAKO_METRICS_INTERVAL=3s
      - TAKO_TRAEFIK_DYNAMIC_DIR=/etc/tako/traefik/dynamic
    depends_on:
      - server
    networks:
      - tako-network

networks:
  tako-network:
    external: true
EOF

echo -e "\n${YELLOW}Starting Tako Master stack (4 containers)...${NC}"
(cd "${TAKO_DIR}" && docker compose up -d)

echo -e "\n--------------------------------------------------"
echo -e "${GREEN}${BOLD}✓ Tako Master successfully deployed!${NC}"
echo -e "--------------------------------------------------"
echo -e "Console Dashboard : ${BOLD}http://${PUBLIC_IP}:3000${NC}"
echo -e "Admin Email       : ${BOLD}${ADMIN_EMAIL}${NC}"
echo -e "Master gRPC Port  : ${BOLD}50051${NC}"
echo -e "App Ingress Ports : ${BOLD}80 / 443${NC} (Managed by Traefik)"
echo ""
echo -e "To add worker nodes, run on your worker server:"
echo -e "  ${BOLD}curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent${NC}"
echo "--------------------------------------------------"
