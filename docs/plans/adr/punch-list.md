# ADR Convergence Punch List

Priority-ordered checklist to converge the codebase to the canonical ADRs (and `.ralphy/constitution.md`). This document is **action-only** (no implementation in this file).

## P0 — Keep main green while migrating

1. **Restore green validators on current branch before larger refactors**
   - Fix current WIP breakages: `bun run lint` (object-shorthand in `packages/core/src/Engine/runtime.ts`) + `bun run test` (rename fallout in `core/test/map-stream-event-to-internal.test.ts`).
   - Acceptance: `bun run lint && bun run typecheck && bun run test` all pass.

2. **Pick a single naming contract and finish it end-to-end (ADR-008)**
   - Canonical: `agent`, `prompt`, `type` (no `agentName`, `promptText`, `inputType`, no `"freeform"`).
   - Update: core types/events, legacy mapping, client parsing, React hooks, server tests.
   - Acceptance: repo has no remaining public-facing usage of `agentName|promptText|inputType` except explicitly documented legacy adapters.

## P1 — ADR-004 “event/observer pattern” convergence (biggest correctness/complexity reducer)

3. **Implement the missing “event serialization layer” (Ralphy task 1.5 / ADR-004)**
   - Problem today: duplicated/inconsistent serialization maps in:
     - `packages/core/src/Domain/Events.ts` (canonical mapping exists)
     - `packages/core/src/Engine/runtime.ts` (`workflowEventToLegacy`)
     - `packages/core/src/Engine/dispatch.ts` (local `toSerializedEvent`)
     - `packages/core/src/Engine/subscribers.ts` (local `toSerializedEvent`)
   - Task: create one canonical serializer (likely in `Domain/Events.ts`) and delete/replace local copies.
   - Acceptance: only one `_tag → name` map exists; all storage/SSE/observer paths use it.

4. **Make runtime actually use fiber-based subscribers (ADR-004)**
   - Problem today: `executeWorkflow()` explicitly bypasses `Engine/subscribers.ts` and does synchronous store/bus/observer dispatch inside `emitEvent()`.
   - Task: move persistence/broadcast/observer into `makeStoreSubscriber/makeBusSubscriber/makeObserverSubscriber` and have runtime only `EventHub.publish()` + in-memory tracking.
   - Decision point (must choose): how to preserve “synchronous reliability” guarantees (e.g., await flush/drain before returning, or update tests to accept eventual consistency).
   - Acceptance: single emission point; subscriber failures isolated; behavior matches ADR-004’s described architecture.

5. **Fix incorrect/placeholder event name mappings**
   - Problem today:
     - `SessionForked` mapped to `"workflow:started"` in multiple places.
     - `StateIntent/StateCheckpoint` collapsed to `"state:updated"` in legacy paths (conflicts with ADR-004 canonical `state:intent` / `state:checkpoint`).
     - `InputReceived` mapped to `"input:response"` in legacy paths, while ADR-004 has `input:received`.
   - Task: align mappings to the ADR-defined names (or explicitly maintain a *single* backwards-compat adapter layer).
   - Acceptance: storage/SSE “wire events” are stable and consistent; no silent remapping to unrelated names.

## P2 — ADR-003 “public vs internal exports” enforcement

6. **Stop leaking internals from public entrypoints**
   - Problem today: `@open-scaffold/core` public `index.ts` exports `Services`, `Layers`, `computeStateAt`, `runAgentDef`, session FiberRef context helpers; server exports `EventBusLive`.
   - Task: move these behind `/internal` only, keep public surface minimal per ADR-003.
   - Acceptance: public `index.ts` files match ADR-003’s “What Should Be Public”; internals only available via `@open-scaffold/*/internal`.

## P3 — ADR-007 “error hierarchy” implementation

7. **Consolidate errors to Domain and remove duplicate `Workflow*` errors**
   - Problem today: `Engine/types.ts` still defines multiple `Workflow*` errors, while Domain errors are not the ADR-007 consolidated set.
   - Task: implement ADR-007 taxonomy + codes (and relocate phase/timeout/aborted to Domain).
   - Acceptance: one canonical error hierarchy; duplicates removed; server/client map errors consistently.

8. **Server structured error responses + client non-throwing result shape (ADR-007)**
   - Task: server routes return `{ error: { code, message, ... } }` shapes; client returns discriminated union result instead of throwing.
   - Acceptance: client consumers don’t need `try/catch` for expected errors; errors are pattern-matchable by `code`.

## P4 — ADR-009 “config consolidation” + server architecture

9. **Implement the single “golden path” server creation API**
   - Task: expose `createServer({ workflow, runtime, server })` (or equivalent) as the only public path; keep Effect-native constructors internal.
   - Acceptance: public server API matches ADR-009; eliminate overlapping config types as public surface.

10. **Replace manual Node `http` routing with `@effect/platform-node` HTTP server (ADR-009)**
   - Problem today: ~300 LoC manual routing in `packages/server/src/http/Server.ts`.
   - Task: migrate to Effect HTTP router/middleware while preserving the HTTP contract and SSE behavior.
   - Acceptance: same endpoints/behavior; simpler code; better interruption/error propagation.

## P5 — ADR-011 “service instantiation pattern” (layer factory)

11. **Add `makeAppLayer` (and test preset) and refactor call sites to use it**
   - Problem today: no `makeAppLayer`; layer composition repeated in `core/run.ts`, `server/OpenScaffold.ts`, `server/http/Server.ts`, etc.
   - Task: implement `packages/core/src/Layers/AppLayer.ts` (+ `TestLayer.ts` if desired) and convert callers.
   - Acceptance: one canonical layer wiring path; tests and server use the same factory with different config.

## P6 — ADR-012 “phase lifecycle specification”

12. **Add lifecycle hooks + retry/pause strategy to `PhaseDef` and runtime**
   - Problem today: `PhaseDef` lacks `guard/before/after/onError`; runtime doesn’t implement retry/backoff/pause-on-error behavior.
   - Task: implement ADR-012 state machine semantics in `packages/core/src/Engine/phase.ts` + `Engine/runtime.ts`.
   - Acceptance: guards work, hooks run, retries/backoff honored, pause strategy integrates with HITL.

## P7 — Remaining type-safety boundary cleanup (ADR-005 consistency)

13. **Add schema validation in ProviderRecorder store boundary**
   - Problem today: `packages/server/src/store/ProviderRecorderLive.ts` does `JSON.parse(...) as ...` without schema validation.
   - Task: define schemas for recorded result + stream transcript rows; decode with `Schema.decodeUnknown`.
   - Acceptance: no unsafe casts at store boundaries.

## P8 — Testing gaps called out by the inventory (if you want true “done”)

14. **Close critical missing tests**
   - SSE parsing tests (ensure coverage for `client/src/SSE.ts` and React subscription parsing).
   - `hashProviderRequest` determinism tests.
   - OpenScaffold lifecycle tests (create → use → dispose).
   - Concurrent session tests + recording/playback e2e tests.

## P9 — Resolve spec/constitution contradictions (must decide)

15. **Decide what “no mocks / no in-memory fakes” means in practice**
   - Problem today: `packages/core/src/Layers/InMemory.ts` uses Map-backed stores/recorder.
   - Task options (must choose):
     - (A) Remove Map-backed layers and use only `:memory:` LibSQL implementations everywhere in tests.
     - (B) Keep them, but change the constitution/rules.
   - Acceptance: repo rules and code match—no “two truths”.
