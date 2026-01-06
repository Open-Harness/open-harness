# SDK v0.2.0 Migration Notes

## New entrypoints

- Core: `@open-harness/sdk`
- Server-only: `@open-harness/sdk/server` (blocked for browser/edge)
- Client: `@open-harness/sdk/client`
- React: `@open-harness/sdk/react`
- Testing utilities: `@open-harness/sdk/testing`

## Bundling

- Bundles are produced with **rollup** (ESM outputs in `dist/`), not `tsc`.
- Type declarations still come from `tsc --project tsconfig.build.json`.

## Server in browser/edge

- The `server` export is marked `browser: false` and `edge-runtime: false` to avoid accidental client bundling.

## Build commands

- `bun run build:bundle` — rollup all entrypoints (core, server, client, react, testing)
- `bun run build:types` — emit `.d.ts`
- `bun run build` — types + bundle

## React usage

- Hooks are available from `@open-harness/sdk/react`: `useRuntime`, `useHarness`.
- The hooks are experimental; send/command helpers are intentionally TODO.
