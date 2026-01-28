# Open Scaffold Documentation

Effect-based workflow runtime for AI agents.

## Getting Started

**New to Open Scaffold?** Start here:

1. [Getting Started Guide](./getting-started.md) - Installation and quick start
2. [Mental Model](./reference/mental-model.md) - Core concepts explained
3. [Architecture Overview](./reference/architecture.md) - How the pieces fit together

## Guides

| Guide | Description |
|-------|-------------|
| [Testing](./guides/testing.md) | Unit, integration, and E2E testing |
| [Error Handling](./guides/error-handling.md) | Error types and recovery patterns |
| [Extension](./guides/extension.md) | Custom events, handlers, agents, providers |

## API Reference

| Document | Description |
|----------|-------------|
| [React Hooks](./api/react-hooks.md) | All 18 hooks documented with examples |
| [Components](./api/components.md) | UI component library with Tailwind styling |
| [Configuration](./api/configuration.md) | Server, client, and workflow options |

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  @open-scaffold/client                                  │
│  React hooks (VCR, HITL, state, events)                │
└─────────────────────────┬──────────────────────────────┘
                          │ HTTP/SSE
┌─────────────────────────▼──────────────────────────────┐
│  @open-scaffold/server                                  │
│  OpenScaffold facade, HTTP routes, stores              │
└─────────────────────────┬──────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────┐
│  @open-scaffold/core                                    │
│  Events, handlers, agents, Effect programs             │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Events** | Immutable facts (past tense) that form the source of truth |
| **Handlers** | Pure reducers that compute state from events |
| **Agents** | AI actors with provider + tools + schema |
| **VCR Controls** | Pause, resume, fork sessions (like a VCR tape) |
| **HITL** | Human-in-the-loop via event-based interactions |

## Reference Documentation

For SDK developers and contributors:

| Document | Purpose |
|----------|---------|
| [core/01-domain-map.md](core/01-domain-map.md) | Domain entities and services |
| [core/02-service-contracts.md](core/02-service-contracts.md) | Effect service interfaces |
| [core/03-effect-programs.md](core/03-effect-programs.md) | Effect program compositions |
| [core/04-stub-layers.md](core/04-stub-layers.md) | Stub layer patterns |
| [reference/sdk-internals.md](reference/sdk-internals.md) | Effect patterns |
| [reference/architecture-diagrams.md](reference/architecture-diagrams.md) | Visual diagrams |
| [reference/reference-implementation.md](reference/reference-implementation.md) | Complete workflow example |

## Documentation Structure

```
docs/
├── README.md                      # This file
├── getting-started.md             # Quick start guide
├── api/                           # API reference
│   ├── react-hooks.md             # React hooks (18 total)
│   ├── components.md              # UI component library
│   └── configuration.md           # Server/client options
├── guides/                        # Developer guides
│   ├── testing.md                 # Testing strategies
│   ├── error-handling.md          # Error handling patterns
│   └── extension.md               # Extending Open Scaffold
├── core/                          # Technical specifications
│   ├── 01-domain-map.md
│   ├── 02-service-contracts.md
│   ├── 03-effect-programs.md
│   └── 04-stub-layers.md
├── reference/                     # User-facing documentation
│   ├── mental-model.md
│   ├── architecture.md
│   ├── architecture-diagrams.md
│   ├── sdk-internals.md
│   └── reference-implementation.md
└── archive/                       # Historical documents
    └── ROADMAP-archived-2026-01-26.md
```
