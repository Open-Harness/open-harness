# kernel

Graph-first workflow runtime for Open Harness. This package contains only the
runtime, compiler, and core types. UI, servers, and adapters live elsewhere.

## Docs
- `docs/architecture.md`
- `docs/recording.md`
- `src/core/README.md`
- `src/registry/README.md`
- `src/runtime/README.md`
- `src/persistence/README.md`
- `src/transport/README.md`

## Install
```bash
bun install
```

## Scripts
```bash
bun run typecheck
bun run lint
bun run test
bun run test:e2e
bun run record:fixtures --flow path/to/flow.yaml --out tests/fixtures/recordings/my-flow
```
