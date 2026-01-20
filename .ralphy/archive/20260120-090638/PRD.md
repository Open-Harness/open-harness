# PRD: Handler Pattern DX + Signal Display Architecture

## Problem Statement

The PRD workflow package has **two interconnected DX issues**:

### Issue A: Poor Code Organization (from type safety refactor)

The current structure scatters related code across separate folders:
```
src/
├── agents/           # Agent definitions
├── handlers/         # Signal handlers
├── schemas/          # Zod schemas
└── types.ts          # Type definitions
```

This makes it hard to understand the full lifecycle of a signal because related code is spread across 3-4 files in different directories.

### Issue B: No Unified Signal Rendering

The signal system lacks a **unified rendering strategy**:
1. **No standard way to display signals** - ConsoleReporter just dumps `[signal] name → payload`
2. **Workflow-specific rendering requires separate adapters** - Not extensible
3. **Consumers must manually wire SignalBus** - Leaky abstraction
4. **No semantic metadata on signals** - Adapters can't render intelligently

**Current State:**
- Pino logs to file (JSONL) - works but not user-facing
- ConsoleReporter is bare-bones text output
- No TUI, no web bridge, no streaming visualization
- Each workflow would need its own adapter - doesn't scale

## Solution

### Part A: Agent-Centric Code Organization

Reorganize into a structure where each agent's related code is co-located:
```
src/
├── planner/
│   ├── planner.agent.ts      # Agent definition
│   ├── planner.prompt.ts     # Extracted prompt function
│   ├── planner.schema.ts     # Output schema
│   └── planner.handler.ts    # Signal handler (if any)
├── executor/
│   └── ...
├── signals/                  # Shared signal definitions
└── types.ts                  # Shared types
```

### Part B: Signals Carry Display Hints

1. **`defineSignal()` accepts `display` metadata** - semantic hints for rendering
2. **Standard adapters read `display`** - render appropriately for their medium
3. **`adapters: []` on workflow config** - explicit, no hidden bus
4. **Convention-based inference** - signal names encode semantics as fallback

## Success Criteria

1. PRD workflow code is organized by agent (planner/, executor/, reviewer/)
2. Each agent has co-located: agent definition, prompt, schema, handler
3. `defineSignal()` accepts `display: { type, title, icon, status }` metadata
4. Terminal adapter renders signals based on display hints (no workflow-specific code)
5. User can create custom adapter with `createAdapter()` interface
6. `bun run prd:live` shows meaningful terminal output (not just JSON dumps)

## Architecture

### Code Organization
```
packages/prd-workflow/src/
├── planner/                    # Planner agent module
│   ├── planner.agent.ts        # defineAgent() call
│   ├── planner.prompt.ts       # createPlannerPrompt()
│   ├── planner.schema.ts       # PlanCreatedPayloadSchema
│   └── index.ts                # Module exports
├── handlers/                   # Shared handlers (multi-signal)
│   ├── execution.ts            # task:ready, task:complete, etc.
│   ├── review.ts               # task:approved, milestone:*, etc.
│   ├── planning.ts             # plan:start, plan:created, etc.
│   └── index.ts                # Aggregated exports
├── signals/                    # Signal definitions with display
│   └── index.ts                # All defineSignal() calls
├── types.ts                    # Shared types
└── index.ts                    # Package exports
```

### Signal Display Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                     SIGNAL DEFINITION                           │
│  defineSignal({                                                 │
│    name: "task:ready",                                          │
│    payload: z.object({ ... }),                                  │
│    display: { type: "status", title: (p) => p.title, ... }      │
│  })                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SIGNAL INSTANCE                             │
│  { name, payload, timestamp, meta, display }  ← display travels │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       terminalAdapter   logsAdapter    customAdapter
       (reads display)   (reads level)  (user-defined)
```

## Technical Requirements

### Phase 0: Code Reorganization

#### TR-00: Reorganize planner agent into module
Location: `packages/prd-workflow/src/planner/`

Move and consolidate:
- `agents/planner.agent.ts` → `planner/planner.agent.ts`
- `agents/planner.prompt.ts` → `planner/planner.prompt.ts`
- `schemas/plan-created.ts` → `planner/planner.schema.ts`
- Create `planner/index.ts` exporting all

#### TR-00b: Update handlers to use new imports
Location: `packages/prd-workflow/src/handlers/`

Update import paths in:
- `planning.ts` - import from `../planner/`
- Any other handlers referencing moved code

#### TR-00c: Update package exports
Location: `packages/prd-workflow/src/index.ts`

Re-export from new locations maintaining public API.

### Phase 1: Core Signal Display Infrastructure

#### TR-01: Extend Signal type with display metadata
Location: `packages/internal/signals-core/src/signal.ts`

Add:
```typescript
interface SignalDisplay {
  type: "status" | "progress" | "notification" | "stream" | "log";
  title?: (payload: unknown) => string;
  subtitle?: (payload: unknown) => string;
  icon?: string;
  status?: "active" | "success" | "error" | "pending";
  progress?: (payload: unknown) => { total: number; done: number };
  append?: (payload: unknown) => string;  // For stream type
}

interface Signal<T> {
  // ... existing fields
  display?: SignalDisplay;
}
```

#### TR-02: Update `defineSignal()` to accept display
Location: `packages/internal/signals-core/src/define-signal.ts` (new file)

```typescript
export function defineSignal<TPayload extends z.ZodType>(config: {
  name: string;
  payload: TPayload;
  meta?: Partial<SignalMeta>;
  display?: SignalDisplay<z.infer<TPayload>>;
}): SignalDefinition<z.infer<TPayload>>
```

Must:
- Store display config on definition
- Attach display to created signals
- Provide type-safe `create()` and `is()` methods
- Infer meta from name if not provided

#### TR-03: Create adapter interface
Location: `packages/internal/signals/src/adapter.ts`

```typescript
export interface SignalAdapter {
  name: string;
  patterns?: string[];
  onSignal: (signal: Signal) => void | Promise<void>;
  onStart?: () => void | Promise<void>;
  onStop?: () => void | Promise<void>;
}

export function createAdapter(config: SignalAdapter): SignalAdapter;
```

### Phase 2: Adapter Implementations

#### TR-04: Create terminal adapter
Location: `packages/internal/signals/src/adapters/terminal.ts`

Must:
- Read `signal.display.type` to determine rendering
- Support: status, progress, notification, stream, log
- Fall back to inferring from signal name if no display
- Use ANSI colors for status (green=success, red=error, yellow=active)
- Handle streaming text (append mode)

#### TR-05: Create logs adapter
Location: `packages/internal/signals/src/adapters/logs.ts`

Must:
- Bridge to Pino logger
- Use `signal.meta.level` or infer from name
- Structured JSONL output (existing behavior, wrapped as adapter)

#### TR-06: Export default adapters
Location: `packages/internal/signals/src/adapters/index.ts`

```typescript
export { terminalAdapter } from "./terminal.js";
export { logsAdapter } from "./logs.js";
export { createAdapter } from "../adapter.js";

export function defaultAdapters(): SignalAdapter[] {
  return [
    terminalAdapter(),
    logsAdapter(),
  ];
}
```

### Phase 3: Workflow Integration

#### TR-07: Update `runReactive()` to accept adapters
Location: `packages/internal/core/src/api/run-reactive.ts`

Changes:
- Add `adapters?: SignalAdapter[]` to config
- Create internal SignalBus (not exposed)
- Attach all adapters to bus
- Call `adapter.onStart()` before run
- Call `adapter.onStop()` after run

#### TR-08: Define PRD workflow signals with display
Location: `packages/prd-workflow/src/signals/index.ts`

Define all PRD signals using `defineSignal()` with display hints:
- `plan:start` - status, "Planning..."
- `plan:created` - notification, success, "Plan created with N tasks"
- `task:ready` - status, active, task title
- `task:complete` - notification, success/error based on outcome
- `milestone:passed` - notification, success
- `workflow:complete` - notification, success

#### TR-09: Update CLI to use adapters
Location: `packages/prd-workflow/src/cli.ts`

Changes:
- Import `terminalAdapter, logsAdapter` from `@internal/signals`
- Pass `adapters: [terminalAdapter(), logsAdapter()]` to workflow
- Remove any manual console.log output (let adapters handle it)

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

### V-03: Code organization is correct
```bash
test -d packages/prd-workflow/src/planner
test -f packages/prd-workflow/src/planner/planner.agent.ts
test -f packages/prd-workflow/src/planner/planner.prompt.ts
```
All paths exist.

### V-04: Custom adapter works
Create test that:
- Defines custom adapter with `createAdapter()`
- Runs workflow with custom adapter
- Verifies adapter received signals

### V-05: Terminal output is meaningful
```bash
cd packages/prd-workflow
bun run prd:live ../../examples/hello-world.prd.md
```

Must show:
- Colored status updates (not raw JSON)
- Progress indicators for tasks
- Success/error notifications
- Streaming text for agent output

### V-06: Display inference works
Signal without explicit display should still render sensibly based on name conventions:
- `*:start` / `*:ready` → status, active
- `*:complete` / `*:done` → notification, success
- `*:error` / `*:failed` → notification, error
- `*:delta` → stream

## Out of Scope

- Web/SSE adapter (future iteration)
- Ink-based rich TUI (future iteration)
- SolidJS integration (future iteration)
- Recording/replay changes
- Backward compatibility with old ConsoleReporter (deprecated)

## Dependencies

- Existing SignalBus with pattern matching
- Existing Pino logger infrastructure
- zod 4.x for schema definzitions

## Display Type Reference

| Type | Use Case | Terminal Rendering |
|------|----------|-------------------|
| `status` | Current state | `▶ Title` / `  subtitle` |
| `progress` | Incremental | `[=====>    ] 5/10 Title` |
| `notification` | One-time event | `✓ Title` (colored by status) |
| `stream` | Streaming text | Append to output buffer |
| `log` | Debug/trace | `[name] payload` |
