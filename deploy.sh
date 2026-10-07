#!/usr/bin/env bash
# ==============================================================================
# Tako PaaS Remote Deployment Helper (rsync & docker-compose)
# https://gettako.dev
#
# Penggunaan:
#   ./deploy.sh                  => Deploy semua (Master Server, Agent, Console, Traefik)
#   ./deploy.sh --next           => Deploy hanya frontend Next.js Console
#   ./deploy.sh --agent          => Deploy hanya daemon Tako Agent
#   ./deploy.sh --server         => Deploy hanya control plane Tako Server
#   ./deploy.sh --agent --server => Deploy Agent & Server sekaligus
#
# Opsi Tambahan:
#   ./deploy.sh --dry-run        => Simulasi sync rsync tanpa menulis file
#   ./deploy.sh --ip=<IP>        => Override IP server tujuan
#   ./deploy.sh --user=<USER>    => Override SSH user
# ==============================================================================

set -euo pipefail

# Load .env.deploy jika tersedia di root
if [[ -f ".env.deploy" ]]; then
  # shellcheck source=/dev/null
  source ".env.deploy"
fi

# ==============================================================================
# 1. KONFIGURASI TARGET SERVER & KREDENSIAL (Ubah sesuai server ujicoba Anda)
# ==============================================================================
TARGET_IP="${TARGET_IP:-YOUR_SERVER_IP}"          # Masukkan IP VPS/Server Anda di sini
SSH_USER="${SSH_USER:-root}"                      # User SSH (default: root)
SSH_PORT="${SSH_PORT:-22}"                        # Port SSH (default: 22)
REMOTE_DIR="${REMOTE_DIR:-/opt/tako}"             # Direktori tujuan di remote server

TAKO_EMAIL="${TAKO_EMAIL:-admin@gettako.dev}"     # Email Admin untuk login Console & ACME
TAKO_PASSWORD="${TAKO_PASSWORD:-admin123456}"     # Password Admin untuk login Console
TAKO_DOMAIN="${TAKO_DOMAIN:-}"                    # Domain opsional (contoh: gettako.dev)

# Styling warna
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ==============================================================================
# 2. PARSING ARGUMEN & FLAGS
# ==============================================================================
SYNC_NEXT=0
SYNC_AGENT=0
SYNC_SERVER=0
SYNC_ALL=1
DRY_RUN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --next|--console)
      SYNC_NEXT=1
      SYNC_ALL=0
      shift
      ;;
    --agent)
      SYNC_AGENT=1
      SYNC_ALL=0
      shift
      ;;
    --server)
      SYNC_SERVER=1
      SYNC_ALL=0
      shift
      ;;
    --all)
      SYNC_ALL=1
      shift
      ;;
    --dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --ip=*)
      TARGET_IP="${1#*=}"
      shift
      ;;
    --user=*)
      SSH_USER="${1#*=}"
      shift
      ;;
    --port=*)
      SSH_PORT="${1#*=}"
      shift
      ;;
    -h|--help)
      echo -e "${BOLD}Panduan Penggunaan deploy.sh:${NC}"
      echo "  ./deploy.sh                  Deploy semua komponen (full master stack)"
      echo "  ./deploy.sh --next           Deploy hanya Console Next.js"
      echo "  ./deploy.sh --agent          Deploy hanya Tako Agent"
      echo "  ./deploy.sh --server         Deploy hanya Tako Server"
      echo "  ./deploy.sh --agent --server Deploy Agent dan Server"
      echo "  ./deploy.sh --dry-run        Uji coba sync rsync tanpa mengubah file server"
      echo ""
      echo -e "${BOLD}Konfigurasi Environment:${NC}"
      echo "  TARGET_IP='1.2.3.4' ./deploy.sh"
      echo "  Atau buat file '.env.deploy' dengan isi:"
      echo "    TARGET_IP=1.2.3.4"
      echo "    TAKO_EMAIL=me@example.com"
      echo "    TAKO_PASSWORD=secret"
      exit 0
      ;;
    *)
      echo -e "${RED}[ERROR] Opsi tidak dikenal: $1${NC}"
      echo "Gunakan ./deploy.sh --help untuk panduan lengkap."
      exit 1
      ;;
  esac
done

# Validasi IP target
if [[ "$TARGET_IP" == "YOUR_SERVER_IP" || -z "$TARGET_IP" ]]; then
  echo -e "${RED}[ERROR] TARGET_IP belum disetel!${NC}"
  echo -e "Silakan ubah variabel ${BOLD}TARGET_IP${NC} di baris 26 pada script ${BOLD}deploy.sh${NC},"
  echo -e "atau jalankan dengan perintah: ${CYAN}TARGET_IP=1.2.3.4 ./deploy.sh${NC}"
  exit 1
fi

# Tentukan target services yang akan di-restart di remote docker compose
TARGET_SERVICES=()
COMPONENT_NAMES=()

if [[ $SYNC_ALL -eq 1 ]]; then
  TARGET_SERVICES=("") # Empty string means all services
  COMPONENT_NAMES+=("Full Stack (Traefik, Server, Console, Agent)")
else
  if [[ $SYNC_NEXT -eq 1 ]]; then
    TARGET_SERVICES+=("console")
    COMPONENT_NAMES+=("Next.js Console")
  fi
  if [[ $SYNC_SERVER -eq 1 ]]; then
    TARGET_SERVICES+=("server")
    COMPONENT_NAMES+=("Tako Server")
  fi
  if [[ $SYNC_AGENT -eq 1 ]]; then
    TARGET_SERVICES+=("agent")
    COMPONENT_NAMES+=("Tako Agent")
  fi
fi

echo -e "\n${BLUE}${BOLD}======================================================${NC}"
echo -e "${BLUE}${BOLD}         🐙 TAKO PAAS REMOTE DEPLOYMENT               ${NC}"
echo -e "${BLUE}${BOLD}======================================================${NC}"
echo -e "${BOLD}Target Server   :${NC} ${SSH_USER}@${TARGET_IP}:${SSH_PORT}"
echo -e "${BOLD}Remote Path     :${NC} ${REMOTE_DIR}"
echo -e "${BOLD}Komponen Deploy :${NC} ${GREEN}${COMPONENT_NAMES[*]}${NC}"
echo -e "${BOLD}Admin Email     :${NC} ${TAKO_EMAIL}"
echo -e "${BOLD}Admin Password  :${NC} [TERSEDIA]"
if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}${BOLD}Mode            :${NC} DRY-RUN (Simulasi saja)${NC}"
fi
echo "------------------------------------------------------"

# ==============================================================================
# 3. CEK KONEKSI SSH KE REMOTE SERVER
# ==============================================================================
echo -e "\n${YELLOW}1. Memverifikasi konektivitas SSH ke ${TARGET_IP}...${NC}"
if ! ssh -p "${SSH_PORT}" -o BatchMode=yes -o ConnectTimeout=5 "${SSH_USER}@${TARGET_IP}" "echo 2>&1" >/dev/null 2>&1; then
  # Coba verifikasi dengan koneksi interaktif
  if ! ssh -p "${SSH_PORT}" -o ConnectTimeout=8 "${SSH_USER}@${TARGET_IP}" "mkdir -p ${REMOTE_DIR}"; then
    echo -e "${RED}[ERROR] Gagal terhubung ke ${SSH_USER}@${TARGET_IP} melalui SSH.${NC}"
    echo "Pastikan IP, Port, dan SSH key/password sudah benar."
    exit 1
  fi
else
  ssh -p "${SSH_PORT}" "${SSH_USER}@${TARGET_IP}" "mkdir -p ${REMOTE_DIR}"
fi
echo -e "${GREEN}✓ Terhubung ke server!${NC}"

# ==============================================================================
# 4. SINGKRONISASI DENGAN RSYNC (MENAMPILKAN FILE SECARA REALTIME)
# ==============================================================================
echo -e "\n${YELLOW}2. Memulai transfer file menggunakan rsync...${NC}"

# Filter exclusions agar tidak mengirim cache yang membebani & platform-dependent
RSYNC_EXCLUDES=(
  --exclude="node_modules"
  --exclude=".next"
  --exclude=".git"
  --exclude=".DS_Store"
  --exclude="*.tmp"
  --exclude="*.log"
  --exclude="*.db"
  --exclude="*.db-shm"
  --exclude="*.db-wal"
  --exclude="data/sqlite/*"
  --exclude=".env"
  --exclude=".env.local"
  --exclude=".env.deploy"
)

# Susun daftar direktori/file yang perlu disync sesuai mode
RSYNC_PATHS=()

if [[ $SYNC_ALL -eq 1 ]]; then
  RSYNC_PATHS+=(
    "server"
    "agent"
    "proto"
    "console"
    "deploy"
    "go.work"
    "go.work.sum"
    "install.sh"
    "DESIGN.md"
  )
else
  # Deploy selalu butuh deploy/ agar compose file terupdate
  RSYNC_PATHS+=("deploy")

  if [[ $SYNC_NEXT -eq 1 ]]; then
    RSYNC_PATHS+=("console")
  fi

  if [[ $SYNC_SERVER -eq 1 ]]; then
    RSYNC_PATHS+=("server" "proto" "go.work" "go.work.sum")
  fi

  if [[ $SYNC_AGENT -eq 1 ]]; then
    RSYNC_PATHS+=("agent" "proto" "go.work" "go.work.sum")
  fi
fi

# Jalankan rsync dengan parameter yang menampilkan file yang tersync
# -a : archive mode
# -v : verbose
# -z : compress file data during the transfer
# -h : human-readable numbers
# -P : progress & keep partial
# -i : itemize-changes (menampilkan status perubahan tiap file)
echo -e "${CYAN}File yang disinkronisasikan ke remote:${NC}"

rsync -avzh -P -i --delete \
  -e "ssh -p ${SSH_PORT}" \
  "${RSYNC_EXCLUDES[@]}" \
  $DRY_RUN \
  "${RSYNC_PATHS[@]}" \
  "${SSH_USER}@${TARGET_IP}:${REMOTE_DIR}/"

echo -e "\n${GREEN}✓ Sinkronisasi rsync selesai tanpa ada file yang tertinggal!${NC}"

if [[ -n "$DRY_RUN" ]]; then
  echo -e "\n${YELLOW}[INFO] Mode dry-run selesai. Tidak ada service yang di-restart.${NC}"
  exit 0
fi

# ==============================================================================
# 5. MENJALANKAN DOCKER COMPOSE BUILD & UP DI REMOTE SERVER
# ==============================================================================
echo -e "\n${YELLOW}3. Menyiapkan environment dan menjalankan Docker di server...${NC}"

REMOTE_SCRIPT="
set -euo pipefail

# 1. Pastikan folder data dan direktori fisik /etc/tako/traefik siap
mkdir -p ${REMOTE_DIR}/data/sqlite
mkdir -p ${REMOTE_DIR}/data/agent
mkdir -p /etc/tako/traefik/dynamic

# Salin konfigurasi ke mount fisik /etc/tako/traefik
if [ -f "${REMOTE_DIR}/deploy/traefik/traefik.yml" ]; then
  cp "${REMOTE_DIR}/deploy/traefik/traefik.yml" /etc/tako/traefik/traefik.yml
fi
if [ -f "${REMOTE_DIR}/deploy/traefik/tako.yml" ]; then
  cp "${REMOTE_DIR}/deploy/traefik/tako.yml" /etc/tako/traefik/tako.yml
fi

touch /etc/tako/traefik/acme.json
chmod 600 /etc/tako/traefik/acme.json

# 2. Bersihkan sisa rute ambigu/stale di console jika ada
if [ -d "${REMOTE_DIR}/console/app/services/[id]" ]; then
  echo '==> Membersihkan rute lama yang bentrok: console/app/services/[id]'
  rm -rf "${REMOTE_DIR}/console/app/services/[id]"
fi

# 3. Bersihkan node ghost lama jika ada
if [ -f "${REMOTE_DIR}/data/sqlite/tako.db" ]; then
  sqlite3 "${REMOTE_DIR}/data/sqlite/tako.db" 'DELETE FROM nodes WHERE id = '\''node-master-01'\'';' 2>/dev/null || true
fi

# 3. Buat .env untuk docker compose di server
cat << 'ENVEOF' > ${REMOTE_DIR}/deploy/.env
TAKO_EMAIL=${TAKO_EMAIL}
TAKO_PASSWORD=${TAKO_PASSWORD}
TAKO_ACME_EMAIL=${TAKO_EMAIL}
TAKO_DOMAIN=${TAKO_DOMAIN}
TAKO_PUBLIC_IP=${TARGET_IP}
ENVEOF

# 4. Pastikan network bridge tako-network tersedia
docker network inspect tako-network >/dev/null 2>&1 || docker network create --driver bridge tako-network

# 5. Jalankan docker compose build & up
cd ${REMOTE_DIR}/deploy
echo '==> Menjalankan: docker compose -f compose.master.yml up -d --build ${TARGET_SERVICES[*]}'
docker compose -f compose.master.yml up -d --build ${TARGET_SERVICES[*]}

echo '==> Status container saat ini:'
docker compose -f compose.master.yml ps
"

ssh -p "${SSH_PORT}" "${SSH_USER}@${TARGET_IP}" "bash -c $(printf '%q' "$REMOTE_SCRIPT")"

# ==============================================================================
# 6. RINGKASAN DEPLOYMENT & INFORMASI AKSES
# ==============================================================================
echo -e "\n${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}     🎉 DEPLOYMENT BERHASIL KE SERVER!                ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "Dashboard URL    : ${CYAN}${BOLD}http://${TARGET_IP}:3000${NC}"
echo -e "Admin Email      : ${BOLD}${TAKO_EMAIL}${NC}"
echo -e "Admin Password   : ${BOLD}${TAKO_PASSWORD}${NC}"
echo -e "gRPC Master Port : ${BOLD}50051${NC}"
echo -e "App Ingress Ports: ${BOLD}80 / 443${NC} (Traefik)"
echo "------------------------------------------------------"
echo -e "Untuk memantau log container di server, jalankan:"
echo -e "  ${CYAN}ssh ${SSH_USER}@${TARGET_IP} 'docker compose -f ${REMOTE_DIR}/deploy/compose.master.yml logs -f'${NC}"
echo -e "======================================================\n"
