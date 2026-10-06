# Milestone 05: Traefik Reverse Proxy & Network Routing

---
- **ID**: `M05`
- **Status**: `completed`
- **Blocking**: `[M03]`
- **Target**: Mengonfigurasi Traefik v3 sebagai reverse proxy dinamis (berjalan murni di Docker Compose). Mengatur routing traffic HTTP/HTTPS, routing gRPC port untuk Master, otomatisasi sertifikat SSL Let's Encrypt (ACME), dan standarisasi container labels yang akan disematkan oleh Agent ke setiap container aplikasi.
---

## Acceptance Criteria
- [x] Traefik berjalan di Docker Compose dengan provider Docker (`/var/run/docker.sock`) dan network bridge `tako-network`.
- [x] Traefik HANYA memegang port `80:80` dan `443:443`, murni untuk me-route domain aplikasi yang di-deploy user.
- [x] `tako-console` dilarang di-bind langsung ke port 80/443 (console selalu diakses di port `:3000`). Traefik hanya me-route ke console jika user secara eksplisit menyetel custom domain di Settings.
- [x] Port gRPC `:50051` TIDAK melewati Traefik; diekspos langsung oleh container `tako-server`.
- [x] Di Worker Node: Traefik lokal otomatis mendeteksi container aplikasi yang baru di-deploy oleh Agent via Docker labels.
- [x] Konfigurasi ACME / Let's Encrypt siap pakai untuk otomatisasi SSL sertifikat HTTPS di port 80 & 443.
- [x] Agent memiliki modul label generator untuk menyusun label Traefik standar pada setiap container (domain, router, service port, middleware SSL).

## Checklist
- [x] **Docker Network & Base Traefik Compose (`deploy/traefik/`)**:
  - [x] Definisikan bridge network `tako-network` di Docker Compose
  - [x] Konfigurasi `traefik:v3` dengan entrypoints: `web` (port 80) dan `websecure` (port 443)
  - [x] Konfigurasi HTTP ke HTTPS automatic redirect
- [x] **SSL / ACME Configuration**:
  - [x] Siapkan konfigurasi Let's Encrypt HTTP Challenge / TLS Challenge
  - [x] Mount volume lokal `./acme.json` dengan permission `600`
- [x] **Agent Traefik Label Generator (`agent/internal/traefik/`)**:
  - [x] Buat package untuk menghasilkan Docker container labels otomatis berdasarkan domain & port target service:
    - `traefik.enable=true`
    - `traefik.http.routers.<name>.rule=Host(...)`
    - `traefik.http.routers.<name>.entrypoints=websecure`
    - `traefik.http.routers.<name>.tls.certresolver=letsencrypt`
    - `traefik.http.services.<name>.loadbalancer.server.port=<port>`
  - [x] Dukungan custom middleware (misal: redirect-regex, basic-auth, rate-limiting)
- [x] **Health & Readiness Check**:
  - [x] Verifikasi Traefik static config dan ping endpoint run normal
