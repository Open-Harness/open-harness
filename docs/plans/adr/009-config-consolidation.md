# ADR-009: Config Consolidation

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Config Consolidation
**Related Issues:** API-002, API-006, API-007
**Depends On:** [ADR-010](./010-provider-ownership-model.md) (Provider Ownership Model)

---

## Context

The codebase has **multiple overlapping config types**:

### In `@open-scaffold/server`

| Type | Location | Purpose |
|------|----------|---------|
| `OpenScaffoldConfig` | `OpenScaffold.ts` | Main server config |
| `ServerConfig` | `http/Server.ts` | HTTP server config |
| `CreateServerOptions` | `http/Server.ts` | Server creation options |

### In `@open-scaffold/core`

| Type | Location | Purpose |
|------|----------|---------|
| `RuntimeConfig` | `Engine/types.ts` | Execution runtime config |
| `WorkflowConfig` | `Engine/types.ts` | Workflow definition config |
| `RunOptions` | `Engine/run.ts` | Options for `run()` |

### Problems Identified

1. **Three overlapping server configs** — Unclear which to use
2. **Two server creation paths** — `OpenScaffold.createServer()` vs `createServer()`
3. **Config shapes inconsistent** — Different patterns across packages

### Dependency: ADR-010 (Provider Ownership Model)

This ADR depends on [ADR-010](./010-provider-ownership-model.md).

The decision on provider ownership affects config shape:
- If agents own providers directly (ADR-010 decision), the `providers` map is **removed** from runtime config
- This significantly simplifies the config consolidation — fewer concerns to manage

Once ADR-010 is accepted, the config types reduce to:
- **Server:** `database`, `mode`, `port`, `host`, `workflow`
- **Runtime:** `mode`, `database`

---

## Decision

### Summary

1. **Use nested config objects** to keep concerns separated and avoid option name collisions.
2. **Make the server a single-workflow host** (one `workflow` per server instance).
3. **Define one public “golden path” for server creation** that does not require Effect knowledge.

### Public API Shape (Chosen)

#### `@open-scaffold/core`: keep runtime config nested

```typescript
import { run } from "@open-scaffold/core"

await run(workflow, {
  input: "Build X",
  runtime: {
    mode: "playback",
    database: "./data/app.db"
  }
})
```

#### `@open-scaffold/server`: one-step server creation (single workflow)

```typescript
import { createServer } from "@open-scaffold/server"

const server = createServer({
  workflow: myWorkflow,
  runtime: {
    mode: "live",
    database: "./data/app.db"
  },
  server: {
    host: "127.0.0.1",
    port: 3000
  }
})

await server.listen()
```

Notes:
- The server hosts **exactly one** `workflow` instance.
- This matches the current HTTP route contract (`POST /sessions` body is `{ input }` and the server already holds a single `workflow` in its route context).

### What This Replaces

#### Server-side config consolidation

Replace the overlapping trio:
- `OpenScaffoldConfig`
- `ServerConfig`
- `CreateServerOptions`

with one public top-level config shape:

```typescript
export interface ServerAppConfig<S> {
  readonly workflow: WorkflowDef<S, string, string>
  readonly runtime: {
    readonly mode: "live" | "playback"
    readonly database: string
  }
  readonly server?: {
    readonly host?: string
    readonly port?: number
    readonly cors?: unknown
  }
}
```

Internally we may still have a resolved/expanded config (e.g. defaults applied), but it is not part of the public API.

---

## Server Creation API

### One public creation path

**Public:** one-step `createServer(config)` returning an object with Promise-based lifecycle (`listen`, `close`, `address`).

**Not public / advanced-only:** any Effect-native server constructors or route wiring should move behind an internal entrypoint (see ADR-003).

---

## Config Hierarchy

```text
ServerAppConfig (top-level)
├── workflow
├── runtime
└── server
```

---

## Defaults Strategy

Defaults are applied internally during config resolution:

- `server.host` defaults to `DEFAULT_HOST`
- `server.port` defaults to `DEFAULT_PORT`

Runtime defaults are handled consistently across packages:

- `runtime.mode` is required by callers (explicitly choose live vs playback)
- `runtime.database` is required by callers (explicitly choose persistence location)

---

## Alternatives Considered

### Alternative 1: Flat config (rejected)

Flat configs are concise, but become brittle as options expand (naming collisions and unclear ownership of options).

### Alternative 2: Builder pattern (rejected)

Builders improve discoverability but add implementation overhead and complexity without solving the core inconsistency problem.

### Alternative 3: Multi-workflow server registry (deferred)

A `workflows: Record<string, WorkflowDef>` registry requires changing the HTTP contract (`POST /sessions` must include a workflow id) and ensuring workflow identity is persisted and used on resume/fork. This is out of scope for this ADR.

---

## HTTP Server Implementation

**Current:** Raw Node.js `http` module with manual routing (~300 LoC of if/else route matching).

**Target:** `@effect/platform-node` HTTP server

### Decision

Migrate to Effect's native HTTP platform rather than raw Node.js.

### Why

| Aspect | Raw Node.js | Effect HTTP |
|--------|-------------|-------------|
| Fiber-aware | ❌ Manual | ✅ Built-in — requests run in fibers with proper interruption |
| Error handling | ❌ Try/catch boilerplate | ✅ Effect error channels propagate correctly |
| Testing | ❌ Mock Node.js server | ✅ Run handlers as pure Effect programs with test layers |
| Routing | ❌ Manual if/else (~300 LoC) | ✅ Composable router with type-safe routes |
| Middleware | ❌ Manual | ✅ Built-in CORS, logging, error mapping |

### Migration Path

1. Add `@effect/platform-node` dependency
2. Replace `http.createServer()` with `NodeHttpServer.make`
3. Convert manual routing to `Http.router`:
   ```typescript
   const router = Http.router.empty.pipe(
     Http.router.get("/sessions", listSessionsHandler),
     Http.router.post("/sessions", createSessionHandler),
     // ... etc
   )
   ```
4. Keep public `createServer()` API unchanged — internal refactor only

### Scope

This is an internal implementation change. The public API (`createServer()` config shape, route contract, SSE behavior) remains identical.

---

## Consequences

### Positive
- One clear config shape per package.
- Nested structure prevents collisions and clarifies responsibility.
- Server behavior matches current implementation: one workflow per server instance.

### Negative
- Requires consolidating/renaming existing public types.
- Some previously-exported server internals will need to become internal-only (coordinated with ADR-003).

---

## Implementation Notes

1. Align `@open-scaffold/core` runtime options with a single shape (`runtime: { mode, database }`) to resolve the ADR-001 vs ADR-010 mismatch.
2. Provide a single promise-based server lifecycle surface (`listen/close/address`) for the public server creation path.
3. Keep Effect-native server primitives and individual route exports behind an internal entrypoint.

---

## Related Files

- `packages/server/src/OpenScaffold.ts`
- `packages/server/src/http/Server.ts`
- `packages/core/src/Engine/types.ts`
- `packages/core/src/Engine/run.ts`
