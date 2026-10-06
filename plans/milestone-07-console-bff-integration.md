# Milestone 07: Console Next.js BFF & SSE Wiring

---
- **ID**: `M07`
- **Status**: `completed`
- **Blocking**: `[M06]`
- **Target**: Menghubungkan frontend Next.js Console dengan Master Server Go melalui pola Backend-For-Frontend (BFF). Semua request browser diarahkan ke internal Route Handlers / Server Actions Next.js, menjaga token dalam HttpOnly cookies, dan menyambungkan stream SSE untuk status Nodes realtime dan live Deployment Logs.
---

## Acceptance Criteria
- [x] Browser tidak pernah memanggil Master Go Server secara langsung; semua request melalui `same-origin` Next.js (`/api/...`).
- [x] Next.js BFF meneruskan request ke Go Server internal (`http://server:8080`) dengan aman.
- [x] Session authentication menggunakan `HttpOnly` Cookies (kebal XSS di browser).
- [x] Halaman Nodes (`/nodes`) menampilkan status aktual setiap node (Online/Offline) dan metrik CPU/RAM yang bergerak live via SSE tanpa refresh.
- [x] Tombol "Deploy" di UI Service memicu deployment, lalu membuka modal/drawer log yang menampilkan output build real-time via SSE.
- [x] Dialog "Add Node / Enroll" menampilkan perintah curl one-line installer lengkap dengan token yang siap di-copy ke server worker.

## Checklist
- [x] **BFF Client & HTTP Transport (`console/lib/api-client.ts`)**:
  - [x] Buat type-safe internal fetcher ke Go Server (`http://server:8080/api/v1`)
  - [x] Error handling standar dan format response terpadu
- [x] **Route Handlers / Server Actions (`console/app/api/`)**:
  - [x] Auth endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`) dengan HttpOnly cookies
  - [x] Nodes proxy (`/api/nodes`, `/api/nodes/enroll-token`)
  - [x] Services & Deploy proxy (`/api/services`, `/api/services/[id]/deploy`)
- [x] **SSE Streaming Route Handlers**:
  - [x] `GET /api/sse/nodes`: Pipe SSE stream dari Go Server ke browser menggunakan `ReadableStream`
  - [x] `GET /api/sse/deployments/[id]/logs`: Pipe log build real-time ke terminal/log viewer di browser
- [x] **Frontend React Hooks & UI Integration**:
  - [x] Buat hook `useNodeEvents()` menggunakan Web standard `EventSource` untuk auto-update UI nodes
  - [x] Buat hook `useDeploymentLogs(deploymentId)` untuk streaming log ke komponen log viewer
  - [x] Hubungkan modal "Add Node" di `console/app/nodes/page.tsx` untuk menampilkan perintah instalasi agent
  - [x] Hubungkan trigger deploy di halaman Service detail
