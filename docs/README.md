# Tako Documentation

The official Tako documentation is built using [Mintlify](https://mintlify.com) and located in this `docs/` directory.

## Getting Started

### Prerequisites

You need [Node.js](https://nodejs.org) (v18+) or [Bun](https://bun.sh).

### Run Local Development Server

To run the local preview server with hot-reloading:

```bash
# Inside the docs directory:
cd docs
npx mintlify dev
```

Or install the Mintlify CLI globally:

```bash
npm install -g mintlify
mintlify dev
```

The documentation will be available locally at [http://localhost:3000](http://localhost:3000).

### Check Broken Links & Validate

Before committing documentation updates, validate the documentation links:

```bash
cd docs
npx mintlify broken-links
```

### Synchronize OpenAPI Specification

The API Reference documentation is dynamically populated from the root OpenAPI 3.1 specification (`api/openapi.yaml`). To synchronize any changes from the API specification:

```bash
# From the repository root:
bun docs/sync-openapi.ts

# Or verify without modifying:
bun docs/sync-openapi.ts --check
```

## Directory Structure

```text
docs/
├── docs.json                 # Mintlify navigation and theme configuration
├── introduction.mdx          # Welcome & high-level overview
├── why-tako.mdx              # Philosophy, design choices, and motivations
├── limitations.mdx           # Technical boundaries & current limitations
├── roadmap.mdx               # Product roadmap and planned features
├── quickstart/               # Step-by-step setup and first deployment guides
│   ├── installation.mdx
│   └── first-deploy.mdx
├── architecture/             # Deep dive into system internals & topology
│   ├── overview.mdx
│   ├── agent-protocol.mdx
│   ├── deployment-lifecycle.mdx
│   └── reverse-proxy.mdx
├── guides/                   # Task-oriented how-to guides
│   ├── deploying-apps.mdx
│   ├── docker-compose.mdx
│   ├── databases.mdx
│   ├── domains-and-ssl.mdx
│   ├── environment-variables.mdx
│   ├── github-integration.mdx
│   └── ...
├── comparisons/              # Comparisons with Coolify, Dokploy, etc.
│   └── coolify-and-dokploy.mdx
├── reference/                # CLI commands, configuration options
│   ├── cli.mdx
│   └── configuration.mdx
├── api-reference/            # OpenAPI specification for Control Plane REST API
│   └── openapi.yaml
└── images/                   # Static media assets & diagrams
```
