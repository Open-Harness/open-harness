# Handoff: Open Scaffold — impl/codex Branch

**Last session:** 2026-01-28
**Branch:** `impl/codex`
**Status:** Major refactor complete. All tests pass. Ready for next iteration.

---

## What Was Done (This Session)

### Phase 1: Renamed `Next/` to `Engine/`

Directory renamed to reflect stable API status:
- `packages/core/src/Next/` → `packages/core/src/Engine/`
- All imports updated in `packages/core/src/index.ts`
- Context.Tag identifier: `"@open-scaffold/Next/ProviderRegistry"` → `"@open-scaffold/core/ProviderRegistry"`
- Test files renamed: dropped `next-` prefix (11 files)

### Phase 2: Bug Fixes

| Bug | Fix | File |
|-----|-----|------|
| TUI blanks 2s after completion | Removed auto-unmount `useEffect` | `apps/cli/src/ui/App.tsx:57-63` |
| WorkflowBanner shows "workflow" | Changed `payload.workflow` → `payload.workflowName` | `apps/cli/src/ui/screens/EventFeed.tsx:56,61` |
| SSE misses early events in live mode | Changed `includeHistory: isReplay` → `includeHistory: true` | `apps/cli/src/ui/App.tsx:51` |
| Headless mode hangs | Added fiber interruption in `stopServer` | `packages/server/src/http/Server.ts:470-485` |

### Phase 3: Observer Redesign

Replaced bundled `streamed(StreamChunk)` with individual `on*` callbacks:

```typescript
export interface WorkflowObserver<S> {
  // Lifecycle
  onStarted?(sessionId: string): void
  onCompleted?(result: { state: S; events: ReadonlyArray<AnyEvent> }): void
  onErrored?(error: unknown): void

  // State
  onStateChanged?(state: S, patches?: ReadonlyArray<unknown>): void
  onPhaseChanged?(phase: string, from?: string): void

  // Agent lifecycle
  onAgentStarted?(info: { agent: string; phase?: string }): void
  onAgentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void

  // Streaming content
  onTextDelta?(info: { agent: string; delta: string }): void
  onThinkingDelta?(info: { agent: string; delta: string }): void

  // Tool events
  onToolCall?(info: { agent: string; toolId: string; toolName: string; input: unknown }): void
  onToolResult?(info: { agent: string; toolId: string; output: unknown; isError: boolean }): void

  // HITL
  onInputRequested?(request: InputRequest): Promise<string>

  // Raw catch-all
  onEvent?(event: AnyEvent): void
}
```

Added unified `dispatchToObserver()` helper in `runtime.ts` — eliminates duplicate dispatch logic.

### Phase 4: Lifecycle Fix — Abort Propagation

- Added `abortSignal?: AbortSignal` to `ProviderRunOptions` (Domain/Provider.ts)
- Fiber interruption wired through `execute()` and `abort()`
- Server cleans up fibers on `stopServer()` and on natural completion

### Phase 5: Database Cleanup

- Verified `*.db` in `.gitignore`
- Removed `!packages/testing/recordings/test.db` exception
- No `.db` files tracked in git

### Phase 6: Bun Migration

- Changed `packageManager` from `pnpm@10.14.0` to `bun@1.2.5`
- Replaced `pnpm.overrides` with `resolutions` for React 19
- `bun.lock` generated at root
- All tests pass under Bun

---

## Key Files

| Purpose | File |
|---------|------|
| Runtime (event emission) | `packages/core/src/Engine/runtime.ts` |
| Provider execution | `packages/core/src/Engine/provider.ts` |
| Workflow types + observer | `packages/core/src/Engine/types.ts` |
| Execute API | `packages/core/src/Engine/execute.ts` |
| Run API | `packages/core/src/Engine/run.ts` |
| Provider types | `packages/core/src/Domain/Provider.ts` |
| TUI app shell | `apps/cli/src/ui/App.tsx` |
| Event feed renderer | `apps/cli/src/ui/screens/EventFeed.tsx` |
| Server routes (SSE) | `packages/server/src/http/Routes.ts` |
| Server lifecycle | `packages/server/src/http/Server.ts` |
| Test workflow | `examples/hello-world.ts` |

---

## Running the CLI

```bash
# Build and test
bun install
bun run build
bun run typecheck
bun run test

# Run workflow (TUI mode)
bun apps/cli/src/index.ts run examples/hello-world.ts --input "Hello" --database ./scaffold.db

# Run workflow (headless mode)
bun apps/cli/src/index.ts run examples/hello-world.ts --input "Hello" --database ./scaffold.db --headless

# List sessions
bun apps/cli/src/index.ts list --database ./scaffold.db

# Replay session
bun apps/cli/src/index.ts replay --session <id> --database ./scaffold.db
```

---

## Constraints

- **No mocks.** Real recordings, real API responses. ProviderRecorder for playback.
- **No API key env vars.** Anthropic subscription handles auth automatically.
- **Build:** `bun run build` (turbo → tsdown to dist/). Never emit .js/.d.ts into src/.
- **Test:** `bun run test` (vitest). Use LibSQL `:memory:` for ephemeral DBs.
- **Never run `tsc` without proper outDir config.**

---

## What's Next

| Priority | Item | Notes |
|----------|------|-------|
| High | VCR replay controls | Step forward/back, jump by event type, play/pause, speed control |
| Medium | OpenAI provider | For model comparison in eval system |
| Medium | Eval system | Scoring + comparison layer on recordings |

See `docs/plans/next-iteration.md` for full details on the eval system design.
