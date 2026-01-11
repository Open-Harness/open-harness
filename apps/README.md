---
title: "Applications"
description: "Deployable applications built on Open Harness"
---

# Applications

This directory contains deployable applications built on Open Harness infrastructure.

## Contents

| Directory | Description |
|-----------|-------------|
| `docs/` | Documentation site (Next.js + Fumadocs) |
| `starter-kit/` | Starter template for new Open Harness projects |

## Applications

### Documentation Site (`docs/`)

The official Open Harness documentation at [docs.open-harness.dev](https://docs.open-harness.dev).

- **Stack**: Next.js 15, Fumadocs, MDX
- **Features**: Tutorials, guides, API reference, interactive examples
- **Run**: `cd apps/docs && bun run dev`

### Starter Kit (`starter-kit/`)

A minimal template for starting new Open Harness projects.

- **Stack**: TypeScript, Bun
- **Features**: Pre-configured harness, example workflow, test setup
- **Use**: Copy to start a new project

## Development

```bash
# Run docs site
cd apps/docs && bun run dev

# Build all apps
bun run build --filter=./apps/*
```

## See Also

- [`packages/`](../packages/README.md) - Core packages and libraries
- [`examples/`](../examples/README.md) - Example implementations
