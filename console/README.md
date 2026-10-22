# Tako Console

The Tako operator console. This directory contains only the Next.js 16
application; the Go control plane and worker agent live in the sibling
`server/`, `agent/`, and `api/` directories.

## Development

```bash
bun install
bun run dev
```

The console runs at `http://127.0.0.1:3000`.

## API proxy

`app/api/v1/[...path]/route.ts` forwards REST and SSE requests to the master
server at `TAKO_SERVER_URL` (default `http://127.0.0.1:8080`). Browser code can
therefore use same-origin URLs such as `/api/v1/nodes` without CORS.

## Checks

```bash
bun run lint
bun run typecheck
bun run build
```

## Documentation

Backend architecture and operations are documented in
[../docs/README.md](../docs/README.md).
