# Migration Plan Validation — Handoff Prompt

## Role

You are a senior software architect reviewing a migration plan for an Effect-TS workflow SDK. Your job is to find gaps, contradictions, risks, and better alternatives before implementation begins.

## Context

Two documents define the migration:

1. **Migration plan** (phases 1-10): `docs/plans/migration-plan.md`
2. **Architecture decisions** (Q1-Q9): `docs/plans/architecture-decisions.md`

The codebase is an Effect-TS monorepo:
- `packages/core/` — SDK with workflow runtime, services, domain types
- `packages/server/` — HTTP server with LibSQL storage, SSE streaming
- `packages/client/` — React hooks for consuming workflows
- `apps/cli/` — Terminal UI for running workflows

Read both documents fully before proceeding.

## Instructions

Execute these validation passes in parallel using sub-agents. Each agent reads both plan documents plus the specific source files listed. Report findings as `PASS`, `WARN`, or `BLOCK`.

### Agent 1: Type Signature Audit

Verify the runtime's Effect type signature after all decisions are applied.

Read: `packages/core/src/Next/runtime.ts`, `packages/core/src/Next/provider.ts`, `packages/core/src/Services/EventStore.ts`, `packages/core/src/Services/EventBus.ts`

Validate:
- `executeWorkflow` gains `EventStore | EventBus` in its `R` type parameter (Q1)
- `emitEvent` uses `yield* EventStore` and `yield* EventBus` directly (Q1)
- No conditional `if (onEvent)` branching remains (Q4)
- `ProviderRegistry | ProviderRecorder | ProviderModeContext` still required
- All error types in `E` are still correct after provider type move (Q3)

### Agent 2: Import Graph Validation

Trace every import that will break and verify the plan covers it.

Read: `packages/core/src/index.ts`, `packages/core/src/Domain/index.ts`, `packages/core/src/Next/index.ts`, `packages/core/src/Programs/index.ts`, `packages/core/src/Services/index.ts`

Validate:
- Every `import from "../Domain/Agent.js"` is accounted for after Q3 (move to Next/provider.ts)
- Every `import from "../Domain/Event.js"` is accounted for after Phase 6 deletion
- Every `import from "../Programs/Execution/"` is accounted for after Phase 5 deletion
- `EventStore.ts` and `EventBus.ts` import `AnyEvent` from `Domain/Event.ts` — plan must update these to `AnyInternalEvent` from `Next/types.ts`
- `packages/server/` imports from `@open-scaffold/core` — verify all used exports survive
- `packages/client/` imports — verify compatibility

### Agent 3: Programs/ Deletion Feasibility

Verify that deleting `Programs/` (Q2=C) doesn't orphan callers.

Read: All files in `packages/core/src/Programs/`, `packages/server/src/http/Routes.ts`, `packages/server/src/http/Server.ts`, `apps/cli/src/`

For each surviving program (`computeStateAt`, `observeEvents`, `loadSession`, `forkSession`, `resumeSession`, `loadWorkflowTape`):
- List every caller across all packages
- Verify the plan specifies where it moves
- Check that the moved function's imports still resolve

For each deleted program (`recordEvent`, `createSession`, `getCurrentState`, `observeState`, `runWorkflow`, `execute-workflow [was event-loop]`, `processEvent`, `runAgentWithStreaming`, `mapStreamEvent`, `runHandler`):
- Verify zero remaining callers after server route rewrites (Phase 2)

### Agent 4: WorkflowObserver Protocol Feasibility

Verify the observer protocol (Q8) works with the existing runtime architecture.

Read: `packages/core/src/Next/runtime.ts`, `packages/core/src/Next/execute.ts`, `packages/core/src/Next/run.ts`, `apps/cli/src/ui/hooks/useEventStream.ts`

Validate:
- Runtime's `emitEvent` can dispatch to observer methods (where does the observer live in the runtime context?)
- `execute.ts` async iterator: does WorkflowObserver replace it, coexist with it, or wrap it?
- `run.ts`: current flat callbacks replaced — verify no breaking change for existing callers
- CLI's `useEventStream.ts`: verify it can be reimplemented on top of WorkflowObserver
- HITL: `inputRequested` returns `Promise<string>` — verify this integrates with runtime's `Queue.take(ctx.inputQueue)` flow

### Agent 5: Live Naming + Stubs Deletion Impact

Verify the naming rename (Q9) and stubs deletion (Q6) are safe.

Read: `packages/server/src/store/`, `packages/core/src/Layers/Stubs/`, `packages/core/src/Layers/index.ts`, all test files (`packages/*/test/`)

Validate:
- List every file that imports from `Layers/Stubs/` — each must be updated or deleted
- List every test that uses `AppLayerStub` or individual stubs — each needs `makeTestLayer()` replacement
- Verify `makeTestLayer()` using LibSQL `:memory:` actually works (do LibSQL layers support `:memory:` URLs?)
- Renaming `EventStoreLive` → `EventStoreLive` — list every import site
- Check for any circular dependency risks after moving provider types to `Next/provider.ts`

### Agent 6: Phase Ordering and Dependency Audit

Verify the migration phases can execute in the stated order without deadlocks.

Read: Both plan documents.

Validate:
- Phase 1 (add `onEvent` callback) — but Q1 says we're NOT using callbacks. **Is Phase 1 still valid?** The plan was written before Q1 was decided. Flag if Phase 1 needs rewriting.
- Phase 2 (rewrite server routes) — depends on runtime having `EventStore | EventBus` in R. Is this added in Phase 1 or does Phase 1 need to change?
- Phase 5 (delete Execution/) — verify every caller is updated in Phases 2-4
- Phase 6.5 (update EventStore/EventBus imports) — verify this happens BEFORE Phase 9 rename
- Phase 9 (rename `InternalEvent` → `Event`) — will this collide with deleted `Domain/Event.ts`?
- Q2 (delete Programs/) is not in any phase — which phase does it belong in?
- Q8 (WorkflowObserver) is not in any phase — which phase does it belong in?
- Q9 (Live rename) is not in any phase — which phase does it belong in?

### Agent 7: DX Surface Audit

Verify the public API after migration is clean and consistent.

Read: `packages/core/src/index.ts`, `packages/core/src/Next/index.ts`

Validate:
- No `@deprecated` exports remain
- No `export * as Next` namespace
- No `export * as Legacy` namespace
- `WorkflowObserver` is exported
- `StreamChunk`, `InputRequest` types are exported
- Provider types (`AgentProvider`, `AgentStreamEvent`, etc.) are re-exported from `index.ts`
- `run()`, `execute()`, `runSimple()`, `runWithText()` all accept `observer` parameter
- `RuntimeConfig` has `database` field (optional, defaults to `./scaffold.db`)
- No old types in public surface: `WorkflowDef [was Definition]`, `HandlerDefinition`, `define-event [OLD]`, `define-handler [OLD]`

## Output Format

For each agent, produce:

```
### Agent N: [Name]
Status: PASS | WARN | BLOCK

Findings:
- [Finding 1]
- [Finding 2]

Risks:
- [Risk with severity: LOW/MEDIUM/HIGH]

Recommendations:
- [Specific actionable recommendation]
```

End with a summary:

```
### Summary
BLOCK: [count] — must fix before implementation
WARN: [count] — should address, not blocking
PASS: [count] — validated, no issues

Critical items:
1. [Most important finding]
2. [Second most important]
3. [Third most important]
```

## Constraints

- Read source files directly. Do not guess file contents.
- Report BLOCK only for contradictions, broken imports, or impossible sequences.
- Report WARN for suboptimal choices or missing plan coverage.
- Report PASS only after verifying against source code.
- Do not modify any files. This is a read-only audit.
- If a plan phase contradicts an architecture decision, the architecture decision wins.
