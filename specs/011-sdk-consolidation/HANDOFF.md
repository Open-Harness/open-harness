# SDK Consolidation Handoff (Updated)

## Current State

**Commit:** `ee55afe`
**Branch:** `refactor-02`

We paused mid-refactor because we realized the architecture is wrong.

---

## What We Did

1. **Created `@openharness/anthropic` package** ✅
   - Moved all agents (ParserAgent, CodingAgent, etc.)
   - Moved AnthropicRunner
   - Moved recording system (Vault, ReplayRunner)
   - Package builds and tests pass

2. **Started SDK cleanup**
   - Deleted `providers/anthropic/` directory
   - Updated container.ts, tokens.ts for provider-agnostic

3. **Moved TaskHarness to examples/** ❌ (WRONG APPROACH)
   - Moved 12 files to `examples/task-harness/`
   - This is when we realized the problem

---

## The Problem

We moved **12 files (~2000+ lines)** to examples:

| File | Lines | Purpose |
|------|-------|---------|
| `task-harness.ts` | 935 | Main orchestration |
| `task-harness-types.ts` | 650 | Zod schemas |
| `base-renderer.ts` | ~450 | Abstract renderer |
| `console-renderer.ts` | ~230 | Terminal output |
| `harness-recorder.ts` | ~200 | Recording system |
| `replay-controller.ts` | ~300 | Replay playback |
| ... | ... | ... |

**This is NOT an example.** An example should be:
- ~50-100 lines
- Glanceable
- Copy-paste-able
- Uses SDK primitives

---

## The Architectural Tension

### Two Harness APIs Exist

1. **TaskHarness (OLD)** - 935-line class with:
   - Hardcoded agent dependencies
   - Custom state management
   - Recording/replay
   - Renderer infrastructure
   - Phase/task lifecycle

2. **defineHarness() (NEW)** - Fluent factory with:
   - Any agents via DI
   - User-defined state
   - Built-in phase/task helpers
   - Transport interface for attachments
   - Session mode for interactivity

**defineHarness() was built to REPLACE TaskHarness complexity.**

---

## What a Real Example Should Look Like

```typescript
// examples/task-harness/index.ts (~50 lines)
import { defineHarness } from '@openharness/sdk';
import { ParserAgent, CodingAgent, ReviewAgent } from '@openharness/anthropic';

const TaskHarness = defineHarness({
  name: 'task-harness',
  agents: {
    parser: ParserAgent,
    coder: CodingAgent,
    reviewer: ReviewAgent
  },
  state: ({ tasksPath }) => ({
    tasks: [] as ParsedTask[],
    completed: new Set<string>(),
  }),
  run: async ({ agents, state, phase, task }) => {
    // Phase 1: Parse tasks.md
    state.tasks = await phase('parse', async () => {
      const content = await Bun.file(tasksPath).text();
      return agents.parser.parse({ content });
    });

    // Phase 2: Execute each task
    for (const t of state.tasks) {
      await task(t.id, async () => {
        const result = await agents.coder.execute(t.description);
        await agents.reviewer.validate(t, result);
        state.completed.add(t.id);
      });
    }

    return {
      total: state.tasks.length,
      completed: state.completed.size
    };
  }
});

// Usage
const result = await TaskHarness
  .create({ tasksPath: 'specs/feature/tasks.md' })
  .attach(consoleRenderer)  // <- This is the question: where does this come from?
  .run();

console.log(`Completed ${result.completed}/${result.total} tasks`);
```

---

## The Key Questions

### 1. What about renderers?

TaskHarness has:
- `IHarnessRenderer` interface
- `BaseRenderer` abstract class
- `ConsoleRenderer` implementation
- `CompositeRenderer` for multiple outputs

**Question:** Are these SDK primitives or TaskHarness-specific?

If they're useful for ANY harness, they should be in SDK:
```typescript
import { ConsoleRenderer } from '@openharness/sdk';
```

If they're TaskHarness-specific, they should be deleted (defineHarness uses Attachments).

### 2. What about recording/replay?

TaskHarness has:
- `HarnessRecorder` for recording runs
- `ReplayController` for playback

**Question:** Is this useful for ANY harness?

The Anthropic package already has `Vault` + `ReplayRunner` for agent-level recording.
Harness-level recording might be a separate concern.

### 3. What about task state management?

TaskHarness has:
- `task-state.ts` with functional state transitions
- `dependency-resolver.ts` for topological sorting

**Question:** Are these useful primitives?

Dependency resolution might be useful for any workflow.
But `task-state.ts` is specific to TaskHarness's state shape.

### 4. What about the type schemas?

`task-harness-types.ts` has 650 lines of Zod schemas:
- `ParsedTask`, `PhaseInfo`, `TaskFlags`
- `ParserAgentInput/Output`
- `ReviewAgentInput/Output`
- `HarnessSummary`, etc.

**Question:** Where do these belong?

- Agent input/output types → `@openharness/anthropic`
- Harness types → User's responsibility (their harness, their types)
- Generic task types → Maybe a shared package?

---

## Options Going Forward

### Option A: Delete TaskHarness Entirely

**Approach:** TaskHarness was the prototype. defineHarness() is the product.

- Delete all TaskHarness files
- Examples use defineHarness()
- Move useful primitives to SDK (renderers, dependency resolver)

**Pros:** Clean separation, forces modern API usage
**Cons:** Users who liked TaskHarness must rewrite

### Option B: TaskHarness as defineHarness() Wrapper

**Approach:** Rewrite TaskHarness as a thin wrapper around defineHarness():

```typescript
// @openharness/anthropic/harnesses/task-harness.ts
export const TaskHarness = defineHarness({
  name: 'task-harness',
  agents: { parser: ParserAgent, coder: CodingAgent, reviewer: ValidationReviewAgent },
  // ... implementation using SDK primitives
});

// Export factory
export function createTaskHarness(config: TaskHarnessConfig) {
  return TaskHarness.create(config);
}
```

**Pros:** Preserves API, shows how to use defineHarness()
**Cons:** Still maintenance burden

### Option C: Move Infrastructure to SDK, Delete TaskHarness

**Approach:** Extract the USEFUL parts as SDK primitives:

1. **Renderers** → `@openharness/sdk`
   - `defineRenderer()` (already exists!)
   - `ConsoleRenderer` as example attachment

2. **Dependency Resolution** → `@openharness/sdk`
   - `resolveDependencies()` function
   - Generic topological sort

3. **Recording** → Keep in `@openharness/anthropic`
   - Agent-level recording with Vault
   - Harness-level is user's concern

4. **TaskHarness** → Delete
   - Examples show defineHarness() usage

**Pros:** SDK gets useful primitives, clean architecture
**Cons:** Work to extract and test

---

## Recommended Path: Option C

1. **Identify useful primitives** in TaskHarness code
2. **Move to SDK** as standalone utilities
3. **Delete TaskHarness** from everywhere
4. **Create simple example** using defineHarness()
5. **Document** the migration path

---

## Files to Analyze

```
examples/task-harness/src/
├── task-harness.ts        # DELETE (use defineHarness)
├── task-harness-types.ts  # SPLIT (agent types → anthropic, rest → user)
├── task-state.ts          # DELETE (user manages state)
├── harness-factory.ts     # DELETE (defineHarness replaces this)
├── dependency-resolver.ts # MAYBE SDK (generic utility)
├── event-protocol.ts      # DELETE (defineHarness has event system)
├── harness-recorder.ts    # DELETE (anthropic has recording)
├── replay-controller.ts   # DELETE (anthropic has replay)
├── renderer-interface.ts  # CHECK (defineRenderer already in SDK?)
├── base-renderer.ts       # CHECK (needed?)
├── console-renderer.ts    # MAYBE SDK (as example attachment)
├── composite-renderer.ts  # DELETE (attachments handle this)
```

---

## Next Steps

1. **Architectural Decision:** Agree on Option A, B, or C
2. **If Option C:**
   - Check if `defineRenderer()` already covers renderer needs
   - Check if dependency resolver is worth keeping
   - Create minimal example harness
3. **Clean up:**
   - Delete TaskHarness from SDK
   - Delete examples/task-harness (it's wrong)
   - Create proper simple example

---

## SDK Should Export

After cleanup, SDK exports should be:

**Core Primitives:**
- `defineHarness()`, `HarnessInstance`
- `BaseHarness`, `PersistentState`
- `EventBus`, `UnifiedEventBus`
- `createContainer()`, DI tokens

**Transport/Attachments:**
- `Transport` interface
- `Attachment` type
- `defineRenderer()` (if keeping)

**Control Flow:**
- `retry()`, `parallel()` helpers

**NO TaskHarness. NO agent-specific interfaces.**
