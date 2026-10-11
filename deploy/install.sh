#!/usr/bin/env bash
# ==============================================================================
# Tako PaaS Universal Installer Script (Git Clone & Local Build)
# https://gettako.dev
#
# Usage:
#   Master Node:
#     curl -fsSL https://gettako.dev/install.sh | bash
#     # Or when running from a cloned repo:
#     ./install.sh
#
#   Worker Node:
#     curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent --token <TOKEN> --master <MASTER_IP:50051>
# ==============================================================================

set -euo pipefail

TAKO_REPO="${TAKO_REPO:-https://github.com/gettako/tako.git}"
TAKO_BRANCH="${TAKO_BRANCH:-main}"
TAKO_DIR="${TAKO_DIR:-/opt/tako}"
IS_AGENT=0
if [[ "${0:-}" =~ agent ]]; then
  IS_AGENT=1
fi
AGENT_TOKEN="${TAKO_AGENT_TOKEN:-}"
MASTER_URL="${TAKO_MASTER_URL:-}"
ADMIN_EMAIL="${TAKO_EMAIL:-}"
ADMIN_PASSWORD="${TAKO_PASSWORD:-}"

# Parse command line flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent|-a)
      IS_AGENT=1
      shift
      ;;
    --token|-t)
      AGENT_TOKEN="$2"
      shift 2
      ;;
    --master|-m)
      MASTER_URL="$2"
      shift 2
      ;;
    --branch|-b)
      TAKO_BRANCH="$2"
      shift 2
      ;;
    --repo|-r)
      TAKO_REPO="$2"
      shift 2
      ;;
    --dir|-d)
      TAKO_DIR="$2"
      shift 2
      ;;
    --email|-e)
      ADMIN_EMAIL="$2"
      shift 2
      ;;
    --password|-p)
      ADMIN_PASSWORD="$2"
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
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}"
echo "  _____     _       "
echo " |_   _|_ _| | _____ "
echo "   | |/ _\` | |/ / _ \\"
echo "   | | (_| |   < (_) |"
echo "   |_|\\__,_|_|\\_\\___/ "
echo -e "${NC}"
echo -e "${BOLD}Tako PaaS Installer (Source Clone & Local Build)${NC}"
echo "Branch: ${TAKO_BRANCH} | Target Directory: ${TAKO_DIR}"
echo "--------------------------------------------------"

# 1. Root & OS Verification
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}[ERROR] This installer must be run as root (or via sudo).${NC}"
  exit 1
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo -e "${RED}[ERROR] Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}✓ Host detected:${NC} OS=$OS, Arch=$ARCH"

# 2. Git Check & Auto-Installation
if ! command -v git &> /dev/null; then
  echo -e "${YELLOW}Git not found. Installing git...${NC}"
  if command -v apt-get &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq git
  elif command -v yum &> /dev/null; then
    yum install -y git
  elif command -v dnf &> /dev/null; then
    dnf install -y git
  elif command -v pacman &> /dev/null; then
    pacman -Sy --noconfirm git
  elif command -v apk &> /dev/null; then
    apk add --no-cache git
  else
    echo -e "${RED}[ERROR] Please install git manually on your system.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Git installed successfully.${NC}"
else
  echo -e "${GREEN}✓ Git is already installed.${NC}"
fi

# 3. Docker Check & Auto-Installation
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Docker not found. Installing Docker engine...${NC}"
  curl -fsSL https://get.docker.com | sh
  if command -v systemctl &> /dev/null; then
    systemctl enable --now docker
  fi
  echo -e "${GREEN}✓ Docker engine installed successfully.${NC}"
else
  echo -e "${GREEN}✓ Docker engine is already installed.${NC}"
fi

# Ensure docker compose plugin is available
if ! docker compose version &> /dev/null; then
  echo -e "${RED}[ERROR] Docker Compose v2 plugin is required.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker Compose v2 verified.${NC}"

# 4. Detect Host IPs (Public & Private)
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
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}') || true
  if [[ -z "$ip" ]]; then
    ip=$(ip -4 route show default 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}') || true
  fi
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

# Cryptographically Secure Random String Generator
generate_random_secret() {
  local len="${1:-32}"
  if command -v openssl &>/dev/null; then
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$len"
  else
    head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "$len"
  fi
}

# Interactive Helpers
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
    echo -en "${BOLD}${prompt_text}: ${NC}" > /dev/tty
    read -rs input < /dev/tty || true
    echo "" > /dev/tty
  fi

  if [[ -z "$input" ]]; then
    input="$default_val"
  fi
  eval "$var_name=\"$input\""
}

# 5. Setup Source Code Directory (Clone or Reuse Existing Working Directory)
mkdir -p "${TAKO_DIR}/data"
mkdir -p /etc/tako/traefik/dynamic

if [[ -f "./server/Dockerfile" ]] && [[ -f "./console/Dockerfile" ]]; then
  TAKO_SRC_DIR="$(pwd)"
  echo -e "${GREEN}✓ Using existing local repository directory:${NC} ${TAKO_SRC_DIR}"
else
  TAKO_SRC_DIR="${TAKO_DIR}/src"
  if [[ ! -d "${TAKO_SRC_DIR}/.git" ]]; then
    echo -e "${YELLOW}Cloning Tako repository (${TAKO_REPO} @ ${TAKO_BRANCH})...${NC}"
    mkdir -p "${TAKO_DIR}"
    git clone --depth 1 -b "${TAKO_BRANCH}" "${TAKO_REPO}" "${TAKO_SRC_DIR}"
  else
    echo -e "${YELLOW}Updating repository source code in ${TAKO_SRC_DIR}...${NC}"
    (cd "${TAKO_SRC_DIR}" && git fetch origin "${TAKO_BRANCH}" && git reset --hard "origin/${TAKO_BRANCH}")
  fi
fi

# Write Traefik baseline config
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

# Create docker network if not exists
docker network inspect tako-network >/dev/null 2>&1 || docker network create --driver bridge tako-network

# ==============================================================================
# MODE: WORKER AGENT
# ==============================================================================
if [[ $IS_AGENT -eq 1 ]]; then
  echo -e "\n${BOLD}=== Configure Tako Worker Node ===${NC}\n"

  NODE_NAME="${TAKO_NODE_NAME:-$(hostname)}"
  NODE_IP="${TAKO_PUBLIC_IP:-$PUBLIC_IP}"
  NODE_PRIVATE_IP="${TAKO_PRIVATE_IP:-$PRIVATE_IP}"

  if [[ -z "$MASTER_URL" ]]; then
    prompt_input "Enter Master gRPC URL (<master-ip>:50051)" "${PUBLIC_IP}:50051" MASTER_URL
  fi

  if [[ -z "$AGENT_TOKEN" ]]; then
    prompt_secret "Enter Enrollment Token from Master Server" "" AGENT_TOKEN
    if [[ -z "$AGENT_TOKEN" ]]; then
      echo -e "${RED}[ERROR] Enrollment Token is required for worker node.${NC}"
      exit 1
    fi
  fi

  if [[ -z "${TAKO_PUBLIC_IP:-}" ]]; then
    prompt_input "Enter Node Public IP" "$NODE_IP" NODE_IP
  fi

  if [[ -z "${TAKO_PRIVATE_IP:-}" ]]; then
    prompt_input "Enter Node Private IP" "$NODE_PRIVATE_IP" NODE_PRIVATE_IP
  fi

  # Save worker configuration
  cat << EOF > "${TAKO_DIR}/.env"
TAKO_MASTER_URL=${MASTER_URL}
TAKO_AGENT_TOKEN=${AGENT_TOKEN}
TAKO_NODE_NAME=${NODE_NAME}
TAKO_PUBLIC_IP=${NODE_IP}
TAKO_PRIVATE_IP=${NODE_PRIVATE_IP}
EOF
  chmod 600 "${TAKO_DIR}/.env"

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
      - /etc/tako/traefik/dynamic:/etc/tako/traefik/dynamic
      - /etc/tako/traefik/acme.json:/acme.json
    networks:
      - tako-network

  agent:
    build:
      context: ${TAKO_SRC_DIR}
      dockerfile: agent/Dockerfile
    image: tako-agent:local
    container_name: tako-agent
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc/os-release:/etc/os-release:ro
      - /etc/tako/traefik/dynamic:/etc/tako/traefik/dynamic
      - ./data/agent:/data
      - /proc/sysrq-trigger:/host-sysrq-trigger
    environment:
      - TAKO_SERVER_ADDR=${MASTER_URL}
      - TAKO_MASTER_URL=${MASTER_URL}
      - TAKO_ENROLL_TOKEN=${AGENT_TOKEN}
      - TAKO_NODE_NAME=${NODE_NAME}
      - TAKO_NODE_ROLE=worker
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

  echo -e "\n${YELLOW}Building Tako Agent container from source code...${NC}"
  (cd "${TAKO_DIR}" && docker compose build)

  echo -e "\n${YELLOW}Starting Tako Worker Agent...${NC}"
  (cd "${TAKO_DIR}" && docker compose up -d)

  echo -e "\n--------------------------------------------------"
  echo -e "${GREEN}${BOLD}✓ Tako Worker Agent installed successfully!${NC}"
  echo -e "--------------------------------------------------"
  echo -e "Node Name        : ${BOLD}${NODE_NAME}${NC}"
  echo -e "Connected to     : ${BOLD}${MASTER_URL}${NC}"
  echo -e "Working Dir      : ${BOLD}${TAKO_DIR}${NC}"
  echo -e "--------------------------------------------------"
  echo -e "Service Control (Docker Compose):"
  echo -e "  Status : ${BOLD}cd ${TAKO_DIR} && docker compose ps${NC}"
  echo -e "  Logs   : ${BOLD}cd ${TAKO_DIR} && docker compose logs -f${NC}"
  echo -e "--------------------------------------------------"
  exit 0
fi

# ==============================================================================
# MODE: MASTER SERVER
# ==============================================================================
echo -e "\n${BOLD}=== Configure Tako Master Server ===${NC}\n"

# Security Hardening: Generate Strong Default Secrets
AUTH_SECRET="${TAKO_AUTH_SECRET:-$(generate_random_secret 32)}"
ENROLL_TOKEN="${TAKO_AGENT_TOKEN:-$(generate_random_secret 32)}"
DEFAULT_ADMIN_PASS="$(generate_random_secret 16)"

SERVER_IP="${TAKO_PUBLIC_IP:-$PUBLIC_IP}"
SERVER_PRIVATE_IP="${TAKO_PRIVATE_IP:-$PRIVATE_IP}"

if [[ -z "$ADMIN_EMAIL" ]]; then
  prompt_input "Enter Admin Email" "admin@gettako.dev" ADMIN_EMAIL
fi

if [[ -z "$ADMIN_PASSWORD" ]]; then
  prompt_secret "Enter Admin Password (Press Enter to use secure random password)" "$DEFAULT_ADMIN_PASS" ADMIN_PASSWORD
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

# Save credentials & environment variables to .env with 600 permissions
cat << EOF > "${TAKO_DIR}/.env"
TAKO_AUTH_SECRET=${AUTH_SECRET}
TAKO_AGENT_SECRET=${ENROLL_TOKEN}
TAKO_INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}
TAKO_INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
TAKO_PUBLIC_IP=${SERVER_IP}
TAKO_PRIVATE_IP=${SERVER_PRIVATE_IP}
EOF
chmod 600 "${TAKO_DIR}/.env"

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
    build:
      context: ${TAKO_SRC_DIR}
      dockerfile: server/Dockerfile
    image: tako-server:local
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
      - TAKO_AGENT_SECRET=${ENROLL_TOKEN}
      - TAKO_NODE_NAME=tako-master-01
    networks:
      - tako-network

  console:
    build:
      context: ${TAKO_SRC_DIR}/console
      dockerfile: Dockerfile
    image: tako-console:local
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
    build:
      context: ${TAKO_SRC_DIR}
      dockerfile: agent/Dockerfile
    image: tako-agent:local
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
      - TAKO_ENROLL_TOKEN=${ENROLL_TOKEN}
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

echo -e "\n${YELLOW}Building Tako Master containers from local source code...${NC}"
(cd "${TAKO_DIR}" && docker compose build)

echo -e "\n${YELLOW}Starting Tako Master stack...${NC}"
(cd "${TAKO_DIR}" && docker compose up -d)

echo -e "\n=================================================="
echo -e "${GREEN}${BOLD}✓ Tako Master Installed Successfully from Source!${NC}"
echo -e "=================================================="
echo -e "Console Dashboard : ${BOLD}http://${SERVER_IP}:3000${NC}"
echo -e "Admin Email       : ${BOLD}${ADMIN_EMAIL}${NC}"
echo -e "Admin Password    : ${YELLOW}${BOLD}${ADMIN_PASSWORD}${NC}  ${RED}(Save this password!)${NC}"
echo -e "Enrollment Token  : ${CYAN}${BOLD}${ENROLL_TOKEN}${NC}"
echo -e "Working Dir       : ${BOLD}${TAKO_DIR}${NC}"
echo -e "Credentials File  : ${BOLD}${TAKO_DIR}/.env (chmod 600)${NC}"
echo -e "--------------------------------------------------"
echo -e "Service Control (Docker Compose):"
echo -e "  Status : ${BOLD}cd ${TAKO_DIR} && docker compose ps${NC}"
echo -e "  Logs   : ${BOLD}cd ${TAKO_DIR} && docker compose logs -f${NC}"
echo -e "--------------------------------------------------"
echo -e "To add a Worker Node, run this command on the worker server:"
echo -e "  ${BOLD}curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent --token '${ENROLL_TOKEN}' --master '${SERVER_IP}:50051'${NC}"
echo -e "=================================================="
