# PRD: Signal Adapter Refactor - Pure Data Signals

## Problem Statement

The current signal architecture **couples data with presentation**:

```typescript
// CURRENT: Signals carry display hints
const signal = {
  name: "plan:created",
  payload: { tasks: [...] },
  display: { type: "notification", title: (p) => `Plan with ${p.tasks.length} tasks`, icon: "✓" }
};
```

This violates the principle: **Signals are data, not presentation**.

### Issues with Current Design

1. **Signals know too much** - They shouldn't know how to render themselves
2. **`display` on Signal interface** - Adds weight to every signal in the system
3. **`defineSignal()` complexity** - Has `display` config that gets copied to signals
4. **`meta` field is dead code** - Never actually copied to signals, logsAdapter casts lie
5. **Inference fallback** - `inferDisplayFromName()` adds implicit magic
6. **Same signal, different contexts** - A signal might render differently in terminal vs web

### The Mental Model

From `docs/internal/MENTAL_MODEL.md`:

> **Design Principle 6: Signals are data, not presentation**
>
> Signals carry meaning. How they're displayed is a separate concern handled by adapters.

## Solution

**Invert the responsibility**: Adapters define how to render signals, not signals themselves.

```typescript
// NEW: Adapters take renderer maps
const renderers = {
  "plan:created": (s) => `✓ Plan with ${s.payload.tasks.length} tasks`,
  "task:ready": (s) => `▶ ${s.payload.title}`,
  "workflow:complete": () => `🎉 Done`,
};

const adapter = terminalAdapter({ renderers });
```

Signals become pure data:
```typescript
interface Signal<T = unknown> {
  id: string;
  name: string;
  payload: T;
  timestamp: string;
  source?: SignalSource;
  // display?: SignalDisplay;  ← REMOVED
}
```

## Success Criteria

1. `Signal` interface has no `display` field
2. `defineSignal()` has no `display` or `meta` config
3. `terminalAdapter()` accepts a `renderers` map
4. `logsAdapter()` works without signal metadata (uses name patterns only)
5. Signals without renderers are silently skipped
6. `bun run prd:replay` renders workflow output via renderer map
7. All tests pass, typecheck passes

## Architecture

### Before (Current)
```
defineSignal({ display: {...} })
        ↓
Signal { payload, display }
        ↓
terminalAdapter reads signal.display
```

### After (Target)
```
defineSignal({ name, schema })  ← simplified
        ↓
Signal { payload }              ← pure data
        ↓
terminalAdapter({ renderers })  ← renderers defined here
        ↓
renderers["plan:created"](signal)
```

## Technical Requirements

### Phase 1: Remove Display from Signal Core

#### TR-1.1: Remove display types from signal.ts
Location: `packages/internal/signals-core/src/signal.ts`

Remove:
- `SignalDisplayType` type
- `SignalDisplayStatus` type
- `SignalDisplay` interface
- `display` field from `Signal` interface
- `display` field from `CreateSignalOptions`
- Display-related logic in `createSignal()`

Keep:
- `SignalSource` (still useful for debugging)

#### TR-1.2: Remove display/meta from defineSignal()
Location: `packages/internal/signals-core/src/define-signal.ts`

Remove:
- `SignalDisplayConfig` interface
- `SignalMeta` interface (dead code - never copied to signals)
- `display` and `meta` from `DefineSignalConfig`
- `displayConfig` and `meta` from `SignalDefinition`
- `convertToSignalDisplay()` function
- All display-related logic in `create()` method

#### TR-1.3: Update signals-core exports
Location: `packages/internal/signals-core/src/index.ts`

Remove exports:
- `SignalDisplay`
- `SignalDisplayType`
- `SignalDisplayStatus`
- `SignalDisplayConfig`
- `SignalMeta`

### Phase 2: Refactor Terminal Adapter

#### TR-2.1: Add RendererMap type
Location: `packages/internal/signals/src/adapters/terminal.ts`

```typescript
/**
 * A function that renders a signal to a string for terminal output.
 * Receives the signal and returns the formatted string.
 */
export type SignalRenderer<T = unknown> = (signal: Signal<T>) => string;

/**
 * Maps signal names to render functions.
 * Signals not in the map are silently skipped.
 */
export type RendererMap = Record<string, SignalRenderer>;
```

#### TR-2.2: Refactor terminalAdapter to accept renderers
Location: `packages/internal/signals/src/adapters/terminal.ts`

New signature:
```typescript
export interface TerminalAdapterOptions {
  renderers: RendererMap;
  write?: (text: string) => void;
  showTimestamp?: boolean;
  colors?: boolean;
}

export function terminalAdapter(options: TerminalAdapterOptions): SignalAdapter;
```

Behavior:
- Look up `renderers[signal.name]`
- If found: call renderer, write output
- If not found: skip silently (no output)
- Remove `inferDisplayFromName()` - no fallback

#### TR-2.3: Remove inference logic
Location: `packages/internal/signals/src/adapters/terminal.ts`

Delete:
- `inferDisplayFromName()` function
- `resolveTitle()` function
- `resolveSubtitle()` function
- `formatProgress()` function
- All display type/status logic

Simplify to just: render function returns string → write to output.

### Phase 3: Refactor Logs Adapter

#### TR-3.1: Simplify logsAdapter
Location: `packages/internal/signals/src/adapters/logs.ts`

Remove:
- `SignalWithMeta` interface (it was a lie)
- `getLogLevel()` meta.level check (never worked)

Keep:
- `inferLevelFromName()` - name-based log level routing is fine
- Pattern matching for log levels (`*:error` → error, etc.)

The logs adapter doesn't "render" in the same way - it routes signals to Pino log levels. Name-based inference is acceptable here since it's about log routing, not user presentation.

### Phase 4: Update PRD Workflow

#### TR-4.1: Remove display from signal definitions
Location: `packages/prd-workflow/src/signals/index.ts`

For all 13 signal definitions, remove:
- `meta: { level, category }`
- `display: { type, title, subtitle, icon, status }`

Keep only:
- `name`
- `schema`

#### TR-4.2: Create renderer map for PRD workflow
Location: `packages/prd-workflow/src/cli.ts` (or new file `src/renderers.ts`)

```typescript
export const prdRenderers: RendererMap = {
  "plan:start": () => `📋 Planning...`,
  "plan:created": (s) => `✓ Plan created with ${s.payload.tasks.length} tasks (${s.payload.milestones.length} milestones)`,
  "task:ready": (s) => `▶ ${s.payload.title}`,
  "task:complete": (s) => `${s.payload.outcome === "success" ? "✓" : "✗"} Task ${s.payload.taskId} ${s.payload.outcome}`,
  "task:approved": (s) => `✓ Task ${s.payload.taskId ?? ""} approved`,
  "discovery:submitted": (s) => `🔍 ${s.payload.count} task${s.payload.count === 1 ? "" : "s"} discovered`,
  "discovery:reviewed": (s) => `✓ ${s.payload.accepted} accepted, ${s.payload.rejected} rejected`,
  "milestone:testable": (s) => `🧪 Testing milestone ${s.payload.milestoneId}`,
  "milestone:passed": (s) => `✓ Milestone ${s.payload.milestoneId} passed`,
  "milestone:failed": (s) => `✗ Milestone ${s.payload.milestoneId} failed`,
  "milestone:retry": (s) => `🔄 Retrying milestone ${s.payload.milestoneId}`,
  "fix:required": (s) => `🔧 Fixing task ${s.payload.taskId} (attempt ${s.payload.attempt})`,
  "workflow:complete": (s) => `🎉 ${s.payload.reason === "all_milestones_passed" ? "All milestones passed!" : s.payload.reason}`,
};
```

#### TR-4.3: Update CLI to pass renderers
Location: `packages/prd-workflow/src/cli.ts`

```typescript
const adapters = [
  terminalAdapter({ renderers: prdRenderers }),
  logsAdapter({ logger }),
];
```

### Phase 5: Cleanup

#### TR-5.1: Delete inference test file
Location: `packages/internal/signals/src/adapters/terminal-inference.test.ts`

Delete entirely - no more inference to test.

#### TR-5.2: Update adapter tests
Location: `packages/internal/signals/src/adapters/terminal.test.ts`

Rewrite tests to:
- Pass renderers to adapter
- Verify only signals with renderers produce output
- Verify signals without renderers are skipped

#### TR-5.3: Update README
Location: `packages/internal/signals/README.md`

Update documentation to reflect new renderer map pattern.

## Verification

### V-01: Type check passes
```bash
bun run typecheck
```
Zero errors.

### V-02: Unit tests pass
```bash
bun run test
```
All tests pass.

### V-03: Signal interface is pure
Verify `Signal` interface in signal.ts has no `display` field.

### V-04: Replay renders correctly
```bash
cd packages/prd-workflow
bun run prd:replay --recording <existing-recording-id>
```
Must show formatted output via renderer map.

### V-05: Unknown signals are skipped
Create a test that emits a signal not in the renderer map - verify no output and no error.

## Out of Scope

- React adapter (future)
- Web/SSE adapter (future)
- Streaming text support in renderers (can be added later)
- Progress bars (can be added via renderer return type extension later)

## Migration Notes

This is a **breaking change** for:
- Any code using `signal.display`
- Any code using `defineSignal({ display: {...} })`
- Any code relying on `inferDisplayFromName()` behavior

Since this is internal code with no external consumers yet, migration is straightforward.
