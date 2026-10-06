# Milestone 07: Console Next.js BFF & SSE Wiring

---
- **ID**: `M07`
- **Status**: `todo`
- **Blocking**: `[M06]`
- **Target**: Menghubungkan frontend Next.js Console dengan Master Server Go melalui pola Backend-For-Frontend (BFF). Semua request browser diarahkan ke internal Route Handlers / Server Actions Next.js, menjaga token dalam HttpOnly cookies, dan menyambungkan stream SSE untuk status Nodes realtime dan live Deployment Logs.
---

## Acceptance Criteria
- [ ] Browser tidak pernah memanggil Master Go Server secara langsung; semua request melalui `same-origin` Next.js (`/api/...`).
- [ ] Next.js BFF meneruskan request ke Go Server internal (`http://server:8080`) dengan aman.
- [ ] Session authentication menggunakan `HttpOnly` Cookies (kebal XSS di browser).
- [ ] Halaman Nodes (`/nodes`) menampilkan status aktual setiap node (Online/Offline) dan metrik CPU/RAM yang bergerak live via SSE tanpa refresh.
- [ ] Tombol "Deploy" di UI Service memicu deployment, lalu membuka modal/drawer log yang menampilkan output build real-time via SSE.
- [ ] Dialog "Add Node / Enroll" menampilkan perintah curl one-line installer lengkap dengan token yang siap di-copy ke server worker.

## Checklist
- [ ] **BFF Client & HTTP Transport (`console/lib/api-client.ts`)**:
  - [ ] Buat type-safe internal fetcher ke Go Server (`http://server:8080/api/v1`)
  - [ ] Error handling standar dan format response terpadu
- [ ] **Route Handlers / Server Actions (`console/app/api/`)**:
  - [ ] Auth endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`) dengan HttpOnly cookies
  - [ ] Nodes proxy (`/api/nodes`, `/api/nodes/enroll-token`)
  - [ ] Services & Deploy proxy (`/api/services`, `/api/services/[id]/deploy`)
- [ ] **SSE Streaming Route Handlers**:
  - [ ] `GET /api/sse/nodes`: Pipe SSE stream dari Go Server ke browser menggunakan `ReadableStream`
  - [ ] `GET /api/sse/deployments/[id]/logs`: Pipe log build real-time ke terminal/log viewer di browser
- [ ] **Frontend React Hooks & UI Integration**:
  - [ ] Buat hook `useNodeEvents()` menggunakan Web standard `EventSource` untuk auto-update UI nodes
  - [ ] Buat hook `useDeploymentLogs(deploymentId)` untuk streaming log ke komponen log viewer
  - [ ] Hubungkan modal "Add Node" di `console/app/nodes/page.tsx` untuk menampilkan perintah instalasi agent
  - [ ] Hubungkan trigger deploy di halaman Service detail
