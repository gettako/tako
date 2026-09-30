#!/usr/bin/env bash
# ==============================================================================
# Tako — Production Installation Script
# https://gettako.dev/install
# ==============================================================================

set -euo pipefail

# ANSI color codes
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info() {
    printf "${CYAN}==>${NC} ${BOLD}%s${NC}\n" "$1"
}

success() {
    printf "${GREEN}==>${NC} ${BOLD}%s${NC}\n" "$1"
}

warn() {
    printf "${YELLOW}WARNING:${NC} %s\n" "$1"
}

error() {
    printf "${RED}ERROR:${NC} %s\n" "$1" >&2
    exit 1
}

# 1. Root / Sudo Check
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        exec sudo -E -- "$0" "$@"
    else
        error "This installation script must be run as root or with sudo."
    fi
fi

# 2. Operating System Detection
OS="unknown"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="${ID:-linux}"
elif [ -f /etc/alpine-release ]; then
    OS="alpine"
fi

info "Detected operating system: ${OS}"

# 3. Check and Install Docker & Docker Compose v2
has_docker=false
has_compose=false

if command -v docker >/dev/null 2>&1; then
    has_docker=true
fi

if docker compose version >/dev/null 2>&1; then
    has_compose=true
fi

if [ "${has_docker}" = false ] || [ "${has_compose}" = false ]; then
    info "Docker Engine or Docker Compose v2 is missing. Installing official packages..."
    case "${OS}" in
        ubuntu|debian|raspbian)
            export DEBIAN_FRONTEND=noninteractive
            apt-get update -qq
            apt-get install -y -qq curl ca-certificates gnupg lsb-release openssl
            curl -fsSL https://get.docker.com | sh
            systemctl enable --now docker || true
            ;;
        centos|rhel|rocky|almalinux|fedora)
            yum install -y curl ca-certificates openssl
            curl -fsSL https://get.docker.com | sh
            systemctl enable --now docker || true
            ;;
        alpine)
            apk update
            apk add --no-cache docker docker-cli-compose curl ca-certificates openssl
            rc-update add docker default || true
            service docker start || true
            ;;
        *)
            warn "Unrecognized Linux distribution '${OS}'. Attempting generic get.docker.com script..."
            curl -fsSL https://get.docker.com | sh
            ;;
    esac

    if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
        error "Docker installation failed. Please install Docker Engine and Compose v2 manually."
    fi
fi

success "Docker Engine $(docker --version) and Compose $(docker compose version --short) verified."

# 4. Detect Host Public IP
DETECTED_IP=""
if command -v curl >/dev/null 2>&1; then
    DETECTED_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://icanhazip.com || true)
fi
if [ -z "${DETECTED_IP}" ]; then
    DETECTED_IP="localhost"
fi

# 5. Prompts / Interactive Configuration
NON_INTERACTIVE="${TAKO_NON_INTERACTIVE:-false}"

DOMAIN="${TAKO_DOMAIN:-}"
if [ -z "${DOMAIN}" ]; then
    if [ "${NON_INTERACTIVE}" = "true" ]; then
        DOMAIN="${DETECTED_IP}"
    else
        printf "${BOLD}Enter domain or public IP for Tako (optional, default [${DETECTED_IP}]): ${NC}"
        read -r input_domain
        DOMAIN="${input_domain:-${DETECTED_IP}}"
    fi
fi

ADMIN_EMAIL="${TAKO_ADMIN_EMAIL:-}"
if [ -z "${ADMIN_EMAIL}" ]; then
    if [ "${NON_INTERACTIVE}" = "true" ]; then
        ADMIN_EMAIL="admin@gettako.dev"
    else
        printf "${BOLD}Enter administrator email [admin@gettako.dev]: ${NC}"
        read -r input_email
        ADMIN_EMAIL="${input_email:-admin@gettako.dev}"
    fi
fi

ADMIN_PASSWORD="${TAKO_ADMIN_PASSWORD:-}"
if [ -z "${ADMIN_PASSWORD}" ]; then
    if [ "${NON_INTERACTIVE}" = "true" ]; then
        if command -v openssl >/dev/null 2>&1; then
            ADMIN_PASSWORD=$(openssl rand -base64 12)
        else
            ADMIN_PASSWORD=$(head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 16)
        fi
    else
        printf "${BOLD}Enter initial admin password (leave empty to auto-generate): ${NC}"
        read -rs input_pwd
        printf "\n"
        if [ -z "${input_pwd}" ]; then
            if command -v openssl >/dev/null 2>&1; then
                ADMIN_PASSWORD=$(openssl rand -base64 12)
            else
                ADMIN_PASSWORD=$(head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 16)
            fi
            printf "Generated initial password: ${BOLD}%s${NC}\n" "${ADMIN_PASSWORD}"
        else
            ADMIN_PASSWORD="${input_pwd}"
        fi
    fi
fi

# 6. Generate Secret Key & Local Enrollment Token
SECRET_KEY="${TAKO_SECRET_KEY:-}"
if [ -z "${SECRET_KEY}" ]; then
    if command -v openssl >/dev/null 2>&1; then
        SECRET_KEY=$(openssl rand -hex 32)
    else
        SECRET_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    fi
fi

LOCAL_TOKEN="${TAKO_LOCAL_ENROLLMENT_TOKEN:-}"
if [ -z "${LOCAL_TOKEN}" ]; then
    if command -v openssl >/dev/null 2>&1; then
        LOCAL_TOKEN="tok_$(openssl rand -hex 16)"
    else
        LOCAL_TOKEN="tok_$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    fi
fi

# 7. Create Directory Structure
TAKO_DIR="/etc/tako"
TRAEFIK_DYNAMIC_DIR="/etc/tako/traefik/dynamic"
mkdir -p "${TAKO_DIR}"
mkdir -p "${TRAEFIK_DYNAMIC_DIR}"
chmod 700 "${TAKO_DIR}"
chmod 755 "/etc/tako/traefik" "${TRAEFIK_DYNAMIC_DIR}"

# 8. Write Production .env (with 0600 permissions)
ENV_FILE="${TAKO_DIR}/.env"
cat <<EOF > "${ENV_FILE}"
TAKO_DOMAIN=${DOMAIN}
TAKO_ADMIN_EMAIL=${ADMIN_EMAIL}
TAKO_SECRET_KEY=${SECRET_KEY}
TAKO_LOCAL_ENROLLMENT_TOKEN=${LOCAL_TOKEN}
TAKO_CONSOLE_PORT=3000
TAKO_PORT=8080
TAKO_GRPC_PORT=50051
EOF
chmod 600 "${ENV_FILE}"

# 9. Write Production traefik.yaml
TRAEFIK_CONFIG="${TAKO_DIR}/traefik.yaml"
cat <<EOF > "${TRAEFIK_CONFIG}"
global:
  checkNewVersion: false
  sendAnonymousUsage: false

log:
  level: INFO
  format: common

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${ADMIN_EMAIL}
      storage: /etc/traefik/acme/acme.json
      httpChallenge:
        entryPoint: web

providers:
  file:
    directory: /etc/traefik/dynamic
    watch: true
EOF
chmod 644 "${TRAEFIK_CONFIG}"

# 10. Write Production docker-compose.yml
COMPOSE_FILE="${TAKO_DIR}/docker-compose.yml"
cat <<EOF > "${COMPOSE_FILE}"
services:
  traefik:
    image: traefik:v3.2
    container_name: tako-traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yaml:/etc/traefik/traefik.yaml:ro
      - tako_traefik_dynamic:/etc/traefik/dynamic
      - tako_traefik_acme:/etc/traefik/acme
    networks:
      - tako_network

  console:
    image: ghcr.io/gettako/console:latest
    container_name: tako-console
    restart: unless-stopped
    ports:
      - "\${TAKO_CONSOLE_PORT:-\${TAKO_WEB_PORT:-3000}}:3000"
    environment:
      - TAKO_BACKEND_URL=http://server:8080
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
    networks:
      - tako_network
    depends_on:
      - server

  server:
    image: ghcr.io/gettako/server:latest
    container_name: tako-server
    restart: unless-stopped
    ports:
      - "\${TAKO_PORT:-8080}:8080"
      - "\${TAKO_GRPC_PORT:-50051}:50051"
    environment:
      - TAKO_PORT=8080
      - TAKO_GRPC_PORT=50051
      - TAKO_DOMAIN=\${TAKO_DOMAIN:-localhost}
      - TAKO_DB_PATH=/etc/tako/tako.db
      - TAKO_SECRET_KEY=\${TAKO_SECRET_KEY}
      - TAKO_LOCAL_ENROLLMENT_TOKEN=\${TAKO_LOCAL_ENROLLMENT_TOKEN}
      - TAKO_GITHUB_APP_ID=\${TAKO_GITHUB_APP_ID:-}
      - TAKO_GITHUB_APP_PRIVATE_KEY=\${TAKO_GITHUB_APP_PRIVATE_KEY:-}
      - TAKO_GITHUB_WEBHOOK_SECRET=\${TAKO_GITHUB_WEBHOOK_SECRET:-}
      - TAKO_GITHUB_PAT=\${TAKO_GITHUB_PAT:-}
    volumes:
      - tako_server_data:/etc/tako
      - tako_traefik_dynamic:/etc/traefik/dynamic
    networks:
      - tako_network

  agent-local:
    image: ghcr.io/gettako/agent:latest
    container_name: tako-agent-local
    restart: unless-stopped
    environment:
      - TAKO_SERVER_URL=http://server:50051
      - TAKO_ENROLLMENT_TOKEN=\${TAKO_LOCAL_ENROLLMENT_TOKEN}
      - TAKO_CONFIG_DIR=/etc/tako
      - TAKO_TRAEFIK_DYNAMIC_DIR=/etc/traefik/dynamic
      - TAKO_TRAEFIK_ACME_PATH=/etc/traefik/acme/acme.json
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - tako_agent_data:/etc/tako
      - tako_traefik_dynamic:/etc/traefik/dynamic
      - tako_traefik_acme:/etc/traefik/acme:ro
    networks:
      - tako_network
    depends_on:
      - server

volumes:
  tako_server_data:
    name: tako_server_data
  tako_agent_data:
    name: tako_agent_data
  tako_traefik_dynamic:
    name: tako_traefik_dynamic
  tako_traefik_acme:
    name: tako_traefik_acme

networks:
  tako_network:
    name: tako_network
EOF
chmod 644 "${COMPOSE_FILE}"

# 11. Start Containers
info "Spreading sails... Launching Tako control plane stack..."
cd "${TAKO_DIR}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

# 12. Display Success Banner
DASHBOARD_URL="http://${DOMAIN}:3000"
if [ "${DOMAIN}" != "localhost" ] && [ "${DOMAIN}" != "127.0.0.1" ] && [[ ! "${DOMAIN}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    DASHBOARD_URL="https://${DOMAIN}"
fi

printf "\n"
printf "${GREEN}================================================================${NC}\n"
printf "${BOLD}         🎉 Tako Control Plane Successfully Installed! 🎉${NC}\n"
printf "${GREEN}================================================================${NC}\n"
printf "\n"
printf "  ${BOLD}Dashboard URL :${NC} ${CYAN}%s${NC}\n" "${DASHBOARD_URL}"
printf "  ${BOLD}Direct Web    :${NC} ${CYAN}http://%s:3000${NC}\n" "${DETECTED_IP}"
printf "  ${BOLD}Admin Email   :${NC} %s\n" "${ADMIN_EMAIL}"
printf "  ${BOLD}Admin Password:${NC} %s\n" "${ADMIN_PASSWORD}"
printf "  ${BOLD}Config Dir    :${NC} %s\n" "${TAKO_DIR}"
printf "  ${BOLD}Custom Domain :${NC} Configure anytime in Settings > Console Domain\n"
printf "\n"
printf "  To view logs:\n"
printf "    ${BOLD}cd /etc/tako && docker compose logs -f${NC}\n"
printf "\n"
printf "${GREEN}================================================================${NC}\n"
