# SDK Consolidation: Deletion Plan

**Date:** 2025-12-28
**Branch:** `refactor-02`
**Safety Commit:** (to be created)

---

## Executive Summary

The SDK has TWO parallel APIs doing the same thing:
1. **OLD:** `TaskHarness` class (935 lines) - hardcoded agents, custom state management
2. **NEW:** `defineHarness()` factory (282 lines) - composable, DI-based, fluent API

**Decision:** Delete everything related to the OLD API. No deprecation. Scorched earth.

**Key Finding:** `TaskHarness` is already BROKEN - it imports from `providers/anthropic/` which is an empty directory. The previous consolidation moved agents to `@openharness/anthropic` but left dead code behind.

---

## What Gets DELETED

### packages/sdk/src/harness/ (DELETE: 3,189 lines)

| File | Lines | Why Delete |
|------|-------|------------|
| `task-harness.ts` | 935 | OLD API - broken imports, replaced by defineHarness() |
| `task-harness-types.ts` | 605 | Types for OLD API - agent-specific, not generic SDK types |
| `task-state.ts` | 216 | State management for OLD API - defineHarness() users manage their own state |
| `base-renderer.ts` | 596 | OLD renderer class - replaced by defineRenderer() |
| `console-renderer.ts` | 229 | OLD console renderer - users build with defineRenderer() |
| `composite-renderer.ts` | 119 | OLD composite renderer - attachments handle multiple renderers |
| `renderer-interface.ts` | 196 | OLD renderer interface - defineRenderer() has its own types |
| `event-protocol.ts` | 240 | OLD event types - replaced by event-types.ts |
| `harness-recorder.ts` | 310 | OLD recording system - @openharness/anthropic has Vault |
| `replay-controller.ts` | 428 | OLD replay system - @openharness/anthropic has ReplayRunner |
| `base-harness.ts` | 128 | OLD base class - defineHarness() doesn't need inheritance |
| `state.ts` | 135 | PersistentState for OLD API |
| `types.ts` | 132 | Types for OLD base-harness pattern |
| `agent.ts` | 57 | OLD agent wrapper - wrapAgent() replaces it |

### packages/sdk/src/factory/ (DELETE: 110 lines)

| File | Lines | Why Delete |
|------|-------|------------|
| `harness-factory.ts` | 110 | Factory for OLD TaskHarness - broken imports |

### packages/sdk/tests/unit/ (DELETE: ~600 lines)

| File | Why Delete |
|------|------------|
| `harness.test.ts` | Tests OLD BaseHarness/PersistentState |

### examples/task-harness/ (DELETE: entire directory)

Duplicated files from failed consolidation attempt. All 14 files, ~2000+ lines.

### packages/sdk/src/index.ts (MODIFY: remove exports)

Remove all exports related to deleted files:
- `TaskHarness`
- `BaseHarness`, `PersistentState`, `Agent`
- All task-harness-types.ts exports (ParsedTask, ParserAgentInput, etc.)
- Harness recorder exports
- Old renderer exports

---

## What Gets KEPT

### packages/sdk/src/harness/ (KEEP: 1,792 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `define-renderer.ts` | 400 | NEW declarative renderer factory |
| `render-output.ts` | 185 | Terminal output helpers (used by defineRenderer) |
| `harness-instance.ts` | 826 | NEW HarnessInstance runtime |
| `event-types.ts` | 385 | NEW fluent event type system |
| `control-flow.ts` | 329 | retry() and parallel() helpers |
| `async-queue.ts` | 204 | Session mode infrastructure |
| `session-context.ts` | 191 | Session mode context |
| `event-context.ts` | 52 | Event context helpers |

### packages/sdk/src/factory/ (KEEP: 400 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `define-harness.ts` | 282 | NEW defineHarness() factory |
| `wrap-agent.ts` | 200 | wrapAgent() for single-agent use |
| `agent-factory.ts` | 95 | createAgent() utility |

### Questionable Files (DECISION NEEDED)

| File | Lines | Notes |
|------|-------|-------|
| `dependency-resolver.ts` | 221 | Generic topological sort - USEFUL but uses ParsedTask type |
| `backoff.ts` | 189 | Generic backoff utilities - USEFUL, used by control-flow.ts |

**Recommendation:** Keep `backoff.ts` (generic utility). Delete or refactor `dependency-resolver.ts` (tied to OLD types).

---

## Dependency Analysis

### Files that import from deleted files

These imports will break after deletion and need cleanup in packages/sdk/src/index.ts:

```
index.ts imports from:
  - ./harness/task-harness-types.js (DELETE)
  - ./harness/index.js (will export less)
```

### Broken imports (already broken)

```
task-harness.ts imports from:
  - ../providers/anthropic/agents/parser-agent.js (EMPTY DIR!)
  - ../providers/anthropic/agents/validation-review-agent.js (EMPTY DIR!)

harness-factory.ts imports from:
  - ../providers/anthropic/agents/parser-agent.js (EMPTY DIR!)
  - ../providers/anthropic/agents/validation-review-agent.js (EMPTY DIR!)
```

---

## Post-Deletion SDK Exports

After cleanup, the SDK should export:

```typescript
// CORE - defineHarness factory
export { defineHarness } from "./factory/define-harness.js";
export { wrapAgent } from "./factory/wrap-agent.js";
export { createAgent } from "./factory/agent-factory.js";

// HARNESS INSTANCE
export { HarnessInstance } from "./harness/harness-instance.js";

// EVENTS
export type { FluentHarnessEvent, HarnessEventType, ... } from "./harness/event-types.js";

// RENDERERS
export { defineRenderer, toAttachment } from "./harness/define-renderer.js";
export { RenderOutput } from "./harness/render-output.js";

// CONTROL FLOW
export { retry, parallel } from "./harness/control-flow.js";

// DI CONTAINER
export { createContainer } from "./core/container.js";

// UNIFIED EVENT BUS
export { UnifiedEventBus } from "./core/unified-event-bus.js";

// UTILITIES (keep)
export { withBackoff, calculateDelay, ... } from "./harness/backoff.js";
```

---

## Deletion Sequence

1. **Safety commit** - commit current state as recovery point
2. **Delete harness/ files** - remove OLD API files
3. **Delete factory/harness-factory.ts** - remove OLD factory
4. **Delete examples/task-harness/** - remove duplicate
5. **Delete tests/unit/harness.test.ts** - remove OLD tests
6. **Update harness/index.ts** - remove OLD exports
7. **Update src/index.ts** - remove OLD exports from main barrel
8. **Run typecheck** - verify no broken imports
9. **Run tests** - verify remaining tests pass
10. **Commit** - clean SDK state

---

## Verification Steps

After deletion:

```bash
# 1. Typecheck should pass
bun run typecheck

# 2. Tests should pass (some may be gone, that's expected)
bun run test

# 3. These imports should work
import { defineHarness, defineRenderer, wrapAgent } from '@openharness/sdk';

# 4. These imports should NOT exist (should fail)
import { TaskHarness } from '@openharness/sdk';  // ERROR
import { BaseHarness } from '@openharness/sdk';  // ERROR
import { ParsedTask } from '@openharness/sdk';   // ERROR
```

---

## Rollback

If anything goes wrong:

```bash
git reset --hard <safety-commit-hash>
```

---

## Files Summary

| Category | Files | Lines |
|----------|-------|-------|
| DELETE from harness/ | 14 | ~3,189 |
| DELETE from factory/ | 1 | ~110 |
| DELETE from tests/ | 1 | ~600 |
| DELETE examples/ | 14 | ~2,000 |
| **TOTAL DELETE** | **30** | **~5,899** |
| KEEP in harness/ | 8 | ~1,792 |
| KEEP in factory/ | 3 | ~577 |
| **TOTAL KEEP** | **11** | **~2,369** |

**Net reduction: ~5,899 lines of dead/duplicate code**
