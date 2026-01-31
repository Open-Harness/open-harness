# ADR Convergence Audit Report (Code-Validated)

Generated: 2026-01-30

## Scope

Deep audit for ADR/spec drift with emphasis on **legacy/backward-compat layers**, **dual architectures**, and **event/state model convergence** across:

- `packages/core`
- `packages/server`
- `packages/client`
- tests validating/locking behavior

This report is evidence-based (file-level reads + ripgrep + validators).

## What the system actually does today (observed, not “ADR says”)

- **Runtime emits `WorkflowEvent` (Data.TaggedClass)**, but immediately **converts to legacy `AnyEvent`** and **persists + SSE-broadcasts the legacy shape**.
  - `packages/core/src/Engine/runtime.ts` → `workflowEventToLegacy` → `Services.EventStore.append` + `Services.EventBus.publish`
- **Persistence and SSE are typed as `AnyEvent` end-to-end**.
  - `packages/core/src/Services/EventStore.ts`, `EventBus.ts`
  - `packages/server/src/store/EventStoreLive.ts`
  - `packages/server/src/http/SSE.ts`
- Server “state” endpoints and resume tooling still depend on **`state:updated` scanning** (`computeStateAt`) rather than the new `state:intent/state:checkpoint` model.
  - `packages/core/src/Engine/utils.ts`
  - `packages/server/src/http/Routes.ts`
  - `packages/server/src/programs/resumeSession.ts`, `loadWorkflowTape.ts`
- Tests in server/core actively validate the **legacy HITL wire format** `{ promptText, inputType }` and `{ response }`, meaning migration isn’t merely “supported”—it’s enforced.
  - `packages/server/test/hitl-integration.test.ts`

## Inventory: legacy / compat / dual-architecture layers

| Area | Item | Location(s) | What it does (actual) | Why it exists | Bug risk | Removal prerequisites |
|---|---|---|---|---|---|---|
| Event model | **Dual event types**: `WorkflowEvent` vs `AnyEvent` | `core/src/Domain/Events.ts` vs `core/src/Engine/types.ts` (+ many consumers) | Two parallel “canonical” event representations live in the same package | Migration-in-progress; old public API still expects `AnyEvent` | Drift + confusing semantics | Pick **one** as the public/wire truth; update store/bus/client/tests |
| Serialization | **New canonical serializer exists but isn’t used** | `core/src/Domain/Events.ts` (`SerializedEvent`, `toSerializedEvent`, `tagToEventName`) | Defines wire format with `timestamp: number` and names like `state:intent` | Intended ADR-004 boundary | Silent divergence (client code already assumes this) | Make server SSE/store emit this format (or delete it) |
| Serialization | **Runtime has its own legacy serializer** | `core/src/Engine/runtime.ts` (`workflowEventToLegacy`) | Converts `WorkflowEvent` → `AnyEvent` and publishes/stores that | Back-compat for SSE + observer + results | Guarantees event-name/payload drift | Replace with single shared serializer import; update consumers |
| Serialization | **Duplicate serializer #2** | `core/src/Engine/dispatch.ts` (`toSerializedEvent`) | Re-implements mapping + legacy payload rewrites | Observer compatibility | Drift (mapping differs from Domain serializer) | Delete and use canonical serializer |
| Serialization | **Duplicate serializer #3** | `core/src/Engine/subscribers.ts` (`toSerializedEvent`, `tagToEventName`) | Same idea again + “for now” mappings | Originally ADR-004 fiber subscribers | Dead code + drift | Either wire runtime to use subscribers, or delete subscribers |
| Naming | **Spec name map vs real name map conflict** | `Domain/Events.ts` uses `state:intent`, `state:checkpoint`, `session:forked`, `input:received` vs runtime/types use `state:updated`, `workflow:started`, `input:response` | The “new” names never appear on the wire today | Old clients/tests rely on old names | High: replay/clients/state invalidation broken when mixed | Rename migration needs coordinated server+client+fixtures |
| Naming | **State events collapsed** | `core/src/Engine/runtime.ts`, `dispatch.ts`, `subscribers.ts` | `StateIntent` + `StateCheckpoint` both map to `state:updated` | Keep old wire name | Loses semantic distinction; breaks checkpoint-based replay logic | Move wire to `state:intent` + `state:checkpoint`; update state derivation/tests |
| Naming | **SessionForked mapped wrong (“for now”)** | `core/src/Engine/runtime.ts`, `subscribers.ts`, `dispatch.ts` | Maps `SessionForked` → `workflow:started` | Placeholder | Fork lineage becomes indistinguishable | Introduce `session:forked` wire event + update server fork route/tests |
| HITL payload | **Correlation dropped in legacy conversion** | `core/src/Engine/runtime.ts` (`InputRequested`/`InputReceived` mapping) | Emits request/response with `id`, but legacy payload becomes `{ promptText, inputType }` and `{ response }` (drops `id`, drops `approved`) | Match older HITL format | Cannot correlate request↔response; advanced UIs impossible | Decide canonical HITL payload, then update tests/routes/client parsing |
| HITL wiring | **Server input route writes to store/bus only** | `server/src/http/Routes.ts` (`postSessionInputRoute`) | Creates `input:response` and appends/broadcasts it | VCR-style tape mutation | Doesn’t deliver input into a running runtime queue/handler | Add runtime-facing input channel per-session (queue/handler) or make resume-based HITL explicit |
| HITL generations | **Multiple incompatible HITL schemas coexist** | `client/src/react/hooks.ts` expects `{interactionId, agent, prompt}`; server tests use `{promptText,inputType}`; runtime internal uses `{id,prompt,type}` | 3 generations of HITL in one repo | Incomplete migration | High confusion; UIs may silently never show HITL | Choose one schema; delete the others; update emitters + consumers + fixtures |
| Timestamp format | **SSE claims numeric timestamp in some client code, but server sends Date strings** | Server: `server/src/http/SSE.ts` (`JSON.stringify(AnyEvent)`); Client: `client/src/react/primitives/subscription.ts` expects `timestamp: number`; HttpClient expects string date | Two conflicting client assumptions | Partial migration to `SerializedEvent` | Cache invalidation + parsing mismatches | Standardize wire timestamp (number or string) and enforce with Schema on both sides |
| SSE transport | **Two client ingestion stacks** | Legacy: `client/src/HttpClient.ts` uses `fetch` + `createSSEStream`; New hooks: `client/src/react/primitives/subscription.ts` uses `EventSource.onmessage` | Different semantics + different expected payload format | New React Query hooks were added | New hooks likely don’t align with server’s `event:`-typed SSE messages | Decide one ingestion model; align server message format + client subscriber |
| State derivation | **Legacy `computeStateAt` is still central** | `core/src/Engine/utils.ts`, `server/src/http/Routes.ts`, `server/src/programs/resumeSession.ts`, `loadWorkflowTape.ts` | Scans for last `state:updated` | Legacy state snapshotting | Hard-pins old state event format | Replace endpoints/programs with `deriveStateOptimized` over new events |
| State derivation | **`deriveState` is permanently dual-format** | `core/src/Engine/utils.ts` | Applies both `WorkflowEvent` and legacy `AnyEvent` | “migration period” support | Migration never ends; tests will keep pinning old behavior | Cut over store to new event format, then delete old branch |
| StateCache | **Cache recompute reads legacy store** | `core/src/Services/StateCache.ts` | Calls `eventStore.getEventsFrom` (AnyEvent) then `deriveState` | Intended ADR-006 path | Still depends on `state:updated` unless store changes | Convert EventStore to new `SerializedEvent` and update derivation |
| StateCache | **Invalidates all sessions on StateIntent** | `core/src/Services/StateCache.ts` | Because StateIntent lacks sessionId, cache nukes everything | Missing session scoping in event | Perf + correctness risks at scale | Add `sessionId` to state events or scope EventHub per-session and store per-session invalidation |
| Subscribers | **Fiber-based subscribers exist but runtime bypasses them** | `core/src/Engine/subscribers.ts` vs `core/src/Engine/runtime.ts` | Subscriber fibers are ADR-004-ish, but runtime directly does store/bus/observer synchronously | Refactor in progress | Dead code + false architecture | Either rewire runtime to use subscribers or delete subscribers module |
| Provider bridge | **New AgentDef still emits legacy `AnyEvent` stream events** | `core/src/Engine/provider.ts` (`mapStreamEventToInternal`, `makeEvent(EVENTS.*)`) | Converts provider stream → `text:delta`, `tool:*` etc as `AnyEvent` | Bridge new DX to old tape | Keeps legacy wire as default | Emit `WorkflowEvent` directly (or formally declare AnyEvent as canonical) |
| ProviderRecorder API | **Deprecated “save” + incremental API coexist** | `core/src/Services/ProviderRecorder.ts` | Two recording modes in one service contract | Migration to crash-safe recording | Dual code paths forever | Delete deprecated `save` once all call sites use incremental |
| ProviderRecorder persistence | **Legacy table + new tables both supported** | `server/src/store/ProviderRecorderLive.ts` | Reads/writes `provider_recordings` and `recording_sessions/events` | Migration | Data model bifurcated | Backfill/migrate DB + drop legacy table path |
| ProviderRecorder fallback | **In-memory recorder is Map-based + dual-store** | `server/src/http/Server.ts` (`makeInMemoryRecorderLayer`) | Keeps a legacy store Map plus incremental Map | Dev convenience | Diverges from “real DB” behavior | Remove or clearly isolate to dev-only, not as a general fallback |
| Providers config | **Legacy providers map kept** | `server/src/OpenScaffold.ts`, `server/src/http/Server.ts` | Accepts `providers?: Record<string, AgentProvider>` | Backward compatibility | Confusing who owns providers | Delete once all agents fully own providers; update public API |
| Public exports | **Core main entry exports internals for back-compat** | `core/src/index.ts` exports `Services`, `Layers`, `computeStateAt`, context refs | Migration support | Users keep depending on internals | Remove from main entry, require `/internal` opt-in |
| Public exports | **Server exports internal service** | `server/src/index.ts` exports `EventBusLive` | Convenience/legacy | Locks API surface | Move to `/internal` export only |
| Client exports | **React package exports legacy Provider** | `client/src/react/index.ts` exports `WorkflowProvider` + `WorkflowContext` | Backward compatibility | Dual paradigms in docs/apps | Remove once hooks-based client is proven and aligned with wire |

## Highest-risk divergences (why the architecture feels “muddy”)

1. **Wire format contradiction**: `Domain/Events.ts` defines `SerializedEvent` (`state:intent`, numeric timestamp), but **server persists/streams `AnyEvent`** (`state:updated`, Date→string).
2. **HITL is three incompatible generations at once** (tests validate `{promptText/inputType}` + `{response}`; runtime internal uses `{id/prompt/type}`; old client expects `{interactionId/agent/prompt}`), and runtime legacy conversion **drops correlation**, preventing robust HITL UX.
3. **Multiple serializers/name maps** guarantee drift: runtime, dispatch, subscribers, and Domain all contain competing “truth”.
4. **State derivation is pinned to legacy** (`computeStateAt` + `state:updated`) across server endpoints and resume tooling, so event-sourcing migration can’t complete without breaking public behavior.

## Safe deletion sequencing (minimum viable “unmuddy”)

1. **Decide the canonical wire event format**: either fully adopt `Domain/Events.SerializedEvent` or formally delete it and commit to `AnyEvent`.
2. Make **EventStore + SSE + client parsing** match that one wire format.
3. Delete **all duplicate serializers/maps** and import the single canonical one everywhere.
4. Migrate **state derivation + routes** off `computeStateAt/state:updated` to the new state events (or keep legacy and delete new state events).
5. Fix HITL end-to-end (payload schema + correlation + delivery path), then delete old HITL generations.

## Validators

All green at time of writing:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
