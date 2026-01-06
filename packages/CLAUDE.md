# Open Harness Packages

This directory contains all Open Harness packages organized by category.

## Package Structure

### Core
- **`sdk/`** - Core SDK providing runtime, events, state management, and workflow orchestration

### Persistence (`persistence/`)
Persistence implementations for storing and retrieving run state:
- **`sqlite/`** - SQLite-based run store implementation
- **`testing/`** - Shared testing contracts and utilities for persistence implementations

### Providers (`providers/`)
AI provider implementations that integrate with external services:
- **`anthropic/`** - Claude/Anthropic provider with agent node implementation
- **`testing/`** - Shared testing utilities for provider implementations

### Transports (`transport/`)
Transport layer implementations for different communication protocols:
- **`websocket/`** - WebSocket transport for real-time communication
- **`ai-sdk/`** - Vercel AI SDK adapter for React integration

### Nodes
- **`nodes-basic/`** - Basic node types (constant, echo) for testing and examples

## Package Dependencies

- All packages depend on `@open-harness/sdk` as a peer dependency
- Persistence packages implement the `RunStore` interface from SDK
- Provider packages implement the `NodeTypeDefinition` interface from SDK
- Transport packages implement transport interfaces from SDK

## Development

Each package has its own:
- `package.json` with workspace dependencies
- `tsconfig.json` for TypeScript configuration
- `CLAUDE.md` with package-specific context
- Tests in `tests/` directory

Run quality checks:
```bash
bun run typecheck  # Type checking
bun run lint       # Linting
bun run test       # Tests
```
