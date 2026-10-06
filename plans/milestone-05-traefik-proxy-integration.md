# Milestone 05: Traefik Reverse Proxy & Network Routing

---
- **ID**: `M05`
- **Status**: `todo`
- **Blocking**: `[M03]`
- **Target**: Mengonfigurasi Traefik v3 sebagai reverse proxy dinamis (berjalan murni di Docker Compose). Mengatur routing traffic HTTP/HTTPS, routing gRPC port untuk Master, otomatisasi sertifikat SSL Let's Encrypt (ACME), dan standarisasi container labels yang akan disematkan oleh Agent ke setiap container aplikasi.
---

## Acceptance Criteria
- [ ] Traefik berjalan di Docker Compose dengan provider Docker (`/var/run/docker.sock`) dan network bridge `tako-network`.
- [ ] Di Master Node: Traefik me-route domain web console ke port Next.js, dan meneruskan port gRPC `:50051` ke Go Server.
- [ ] Di Worker Node: Traefik otomatis mendeteksi container aplikasi yang baru di-deploy oleh Agent via Docker labels.
- [ ] Konfigurasi ACME / Let's Encrypt siap pakai untuk otomatisasi SSL sertifikat HTTPS di port 80 & 443.
- [ ] Agent memiliki modul label generator untuk menyusun label Traefik standar pada setiap container (domain, router, service port, middleware SSL).

## Checklist
- [ ] **Docker Network & Base Traefik Compose (`deploy/traefik/`)**:
  - [ ] Definisikan bridge network `tako-network` di Docker Compose
  - [ ] Konfigurasi `traefik:v3` dengan entrypoints: `web` (port 80) dan `websecure` (port 443)
  - [ ] Tambahkan entrypoint `grpc` (port 50051) pada Master Node Traefik
  - [ ] Konfigurasi HTTP ke HTTPS automatic redirect
- [ ] **SSL / ACME Configuration**:
  - [ ] Siapkan konfigurasi Let's Encrypt HTTP Challenge / TLS Challenge
  - [ ] Mount volume lokal `./acme.json` dengan permission `600`
- [ ] **Agent Traefik Label Generator (`agent/internal/traefik/`)**:
  - [ ] Buat package untuk menghasilkan Docker container labels otomatis berdasarkan domain & port target service:
    - `traefik.enable=true`
    - `traefik.http.routers.<name>.rule=Host(...)`
    - `traefik.http.routers.<name>.entrypoints=websecure`
    - `traefik.http.routers.<name>.tls.certresolver=letsencrypt`
    - `traefik.http.services.<name>.loadbalancer.server.port=<port>`
  - [ ] Dukungan custom middleware (misal: redirect-regex, basic-auth, rate-limiting)
- [ ] **Health & Readiness Check**:
  - [ ] Verifikasi Traefik dashboard / ping endpoint berjalan normal
