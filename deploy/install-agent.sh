#!/usr/bin/env bash
# ==============================================================================
# Tako — Remote Worker Agent Installation Script
# https://gettako.dev/install-agent.sh
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { printf "${CYAN}==>${NC} ${BOLD}%s${NC}\n" "$1"; }
success() { printf "${GREEN}==>${NC} ${BOLD}%s${NC}\n" "$1"; }
error() { printf "${RED}ERROR:${NC} %s\n" "$1" >&2; exit 1; }

# Root check
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        exec sudo -E -- "$0" "$@"
    else
        error "This script must be run as root or with sudo."
    fi
fi

# Variables
SERVER_URL="${TAKO_SERVER_URL:-${TAKO_SERVER:-${1:-}}}"
TOKEN="${TAKO_ENROLLMENT_TOKEN:-${TAKO_TOKEN:-${2:-}}}"

if [ -z "${SERVER_URL}" ]; then
    printf "${BOLD}Enter Tako Control Plane gRPC URL (e.g. http://203.0.113.10:50051): ${NC}"
    if [ -c /dev/tty ]; then
        read -r SERVER_URL < /dev/tty || true
    else
        read -r SERVER_URL || true
    fi
fi

if [ -z "${TOKEN}" ]; then
    printf "${BOLD}Enter Enrollment Token: ${NC}"
    if [ -c /dev/tty ]; then
        read -r TOKEN < /dev/tty || true
    else
        read -r TOKEN || true
    fi
fi

[ -z "${SERVER_URL}" ] && error "Server URL is required."
[ -z "${TOKEN}" ] && error "Enrollment token is required."

# Verify / Install Docker
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    info "Installing Docker Engine and Compose..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker || true
fi

success "Docker Engine verified."

# Create config directory
CONFIG_DIR="/etc/tako"
mkdir -p "${CONFIG_DIR}" "${CONFIG_DIR}/traefik/dynamic"
chmod 700 "${CONFIG_DIR}"

# Write traefik config
cat <<EOF > "${CONFIG_DIR}/traefik.yaml"
global:
  checkNewVersion: false
  sendAnonymousUsage: false
log:
  level: INFO
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
providers:
  file:
    directory: /etc/traefik/dynamic
    watch: true
EOF
chmod 644 "${CONFIG_DIR}/traefik.yaml"

# Write docker-compose.agent.yml
COMPOSE_FILE="${CONFIG_DIR}/docker-compose.agent.yml"
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

  agent:
    image: ghcr.io/gettako/agent:latest
    container_name: tako-agent
    restart: unless-stopped
    environment:
      - TAKO_SERVER_URL=${SERVER_URL}
      - TAKO_ENROLLMENT_TOKEN=${TOKEN}
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

volumes:
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

# Start agent stack
info "Starting Tako Agent on remote worker..."
cd "${CONFIG_DIR}"
docker compose -f "${COMPOSE_FILE}" up -d

success "Tako Agent successfully started and enrolled!"
