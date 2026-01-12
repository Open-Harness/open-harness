# @open-harness/core DX Audit - v3.1 Roadmap

**Date**: 2026-01-12
**Auditor**: Consumer project (long-horizon) testing npm package
**Version Tested**: 3.0.x (via tarball)

---

## Executive Summary

Testing @open-harness/core from a real consumer project revealed significant DX friction. The core architecture is sound, but the "batteries-included" experience is missing. Users must manually wire up observability, handle SDK path issues, and write boilerplate for common patterns.

---

## Issues by Priority

### 🔴 Critical (Blocking adoption)

#### 1. Claude Code Executable Path Not Found
**File**: `@open-harness/claude` harness
**Issue**: The bundled `@anthropic-ai/claude-agent-sdk` looks for `cli.js` relative to the bundle location, not where Claude Code is actually installed globally.
**Error**: `Error: Could not find Claude Code executable`
**Workaround**:
```typescript
// User must add SDK directly and create wrapper
import { query } from "@anthropic-ai/claude-agent-sdk";
const CLAUDE_CODE_PATH = "/Users/me/.bun/install/global/node_modules/@anthropic-ai/claude-code/cli.js";
const queryWithPath: typeof query = (options) =>
    query({ ...options, pathToClaudeCodeExecutable: CLAUDE_CODE_PATH });
```
**Fix**: Either auto-detect common install paths OR expose `pathToClaudeCodeExecutable` as a ClaudeHarness config option.
**GitHub Issue**: #152

---

#### 2. Type Bundling Broken - Re-exports Internal Packages
**File**: `dist/index.d.ts` in all packages
**Issue**: `.d.ts` files re-export from unpublished internal packages like `@internal/core`, `@internal/signals`
**Error**: `Cannot find module '@internal/core'`
**Status**: ✅ **FIXED** in this session
**Fix Applied**: Added `includeExternal` + `compilerOptions.paths` to rollup-plugin-dts config

---

### 🟠 High (Major DX friction)

#### 3. Observability Not Batteries-Included
**Issue**: Logging, telemetry, and wide events infrastructure EXISTS but is entirely opt-in manual wiring.

**What exists but isn't auto-wired**:
- `getLogger()` → writes to `.open-harness/logs/`
- `createTelemetrySubscriber()` → creates wide events
- `createWideEvent()` → structured workflow events
- Recording mode in `runReactive`

**Expected**: Running a workflow should automatically:
- Write logs to disk
- Emit wide events for tracing
- Record signals without manual store setup

**Current state**: Zero observability by default. User sees nothing.

**Fix**: Add `observability` config with sensible defaults:
```typescript
runReactive({
    // ...
    observability: {
        logs: true,        // default: true
        wideEvents: true,  // default: true
        recording: true,   // default: true
        logDir: ".open-harness/logs",
    }
});
```

---

#### 4. Tool Calls Not Visible as Signals
**Issue**: When an agent uses tools (Task, WebSearch, etc.), the tool call doesn't appear as a first-class signal like `harness:tool:call`. Instead, it's buried in the response content string.

**What we see**:
```
"I'll use the Task tool to search..."
```

**What we should see**:
```
Signal: harness:tool:call { tool: "Task", args: {...} }
Signal: harness:tool:result { tool: "Task", result: {...} }
```

**Impact**: Can't trace what tools agents used, can't replay tool calls, can't build proper observability.

---

#### 5. Low-Level API Too Verbose
**Issue**: Basic workflow requires ~50 lines of boilerplate for what should be a 15-line declarative config.

**Current experience** (workflow.ts):
```typescript
import { ClaudeHarness, createWorkflow, MemorySignalStore } from "@open-harness/core";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Path workaround
const CLAUDE_CODE_PATH = "...";
const queryWithPath = (options) => query({ ...options, pathToClaudeCodeExecutable: CLAUDE_CODE_PATH });

// Create harness
const harness = new ClaudeHarness({ model: "...", queryFn: queryWithPath });

// Create workflow primitives
const { agent, runReactive } = createWorkflow<State>();

// Define each agent
const greeter = agent({ prompt: "...", activateOn: [...], emits: [...], updates: "..." });
const responder = agent({ ... });

// Run with signal store
const store = new MemorySignalStore();
const result = await runReactive({ agents: { greeter, responder }, state, harness, endWhen });
```

**Dream experience** (dream-workflow.ts):
```typescript
import { runWorkflow, getCleanState } from "@open-harness/core";

const result = await runWorkflow({
    name: "greeting-conversation",
    state: { topic: "weather", greeting: null, response: null },
    agents: {
        greeter: { prompt: "...", updates: "greeting" },
        responder: { prompt: "...", updates: "response", activateOn: ["greeting:done"] },
    },
    endWhen: (state) => state.response !== null,
});
```

**Fix**: Promote `easy-workflow.ts` abstraction to core package.

---

### 🟡 Medium (Quality of life)

#### 6. Player Class Runtime Bug
**File**: Signal replay/playback
**Issue**: `this.signals is undefined` when accessing `.position`
**GitHub Issue**: #151
**Status**: Filed, not fixed

---

#### 7. Response Content Extraction Messy
**Issue**: Agent responses come back as objects with metadata. Extracting clean text requires manual parsing.

**What comes back**:
```typescript
state.greeting = {
    content: "I'll use the Task tool...\n\nHello, lovely weather today!",
    role: "assistant",
    // ... metadata
}
```

**What user wants**:
```typescript
state.greeting = "Hello, lovely weather today!"
```

**Workaround created**: `getCleanState()` function that extracts and cleans text.

**Fix**: Either:
1. Provide this as a built-in utility
2. Have `updates` field auto-extract text content
3. Add `extractAs: 'text' | 'full'` option to agent config

---

#### 8. No Default Model Configuration
**Issue**: Must specify model for every harness. No project-level default.

**Current**:
```typescript
const harness = new ClaudeHarness({ model: "claude-3-5-haiku-latest", ... });
```

**Better**:
```typescript
// In config or env
OPEN_HARNESS_DEFAULT_MODEL=claude-3-5-haiku-latest

// Then just:
const harness = new ClaudeHarness();
```

---

#### 9. Recording Requires Manual File I/O
**Issue**: `runReactive` can record to a MemorySignalStore, but saving to disk is manual.

**Current**:
```typescript
const store = new MemorySignalStore();
await runReactive({ ..., recording: { mode: 'record', store } });
// Manual:
await Bun.write("recording.json", JSON.stringify(store.getSignals()));
```

**Better**: Built-in `recordingsDir` option that auto-saves with timestamp.

---

### 🟢 Low (Nice to have)

#### 10. No CLI for Common Operations
- `open-harness init` - scaffold a new workflow
- `open-harness replay <recording.json>` - replay a recorded workflow
- `open-harness inspect <recording.json>` - view signals/state

---

#### 11. Missing TypeScript Strict Mode Support
Some internal types use `any` that leak to consumers, causing issues with `strict: true` projects.

---

## Files Created During Audit

| File | Purpose |
|------|---------|
| `workflow.ts` | Low-level workflow with workarounds |
| `dream-workflow.ts` | High-level dream API usage |
| `lib/easy-workflow.ts` | Abstraction that should be in core |
| `replay.ts` | Recording playback utility |
| `recordings/*.json` | Saved workflow recordings |

---

## Recommended 3.1 Milestones

### Milestone 1: Critical Fixes
- [ ] Fix Claude Code path detection (#152)
- [x] Fix type bundling (completed this session)
- [ ] Fix Player class bug (#151)

### Milestone 2: Batteries-Included Observability
- [ ] Auto-wire logging to disk by default
- [ ] Auto-wire wide events for tracing
- [ ] Auto-wire recording with `recordingsDir` option
- [ ] Surface tool calls as first-class signals

### Milestone 3: Dream API
- [ ] Promote `easy-workflow` abstraction to core
- [ ] Add `getCleanState()` utility
- [ ] Add sensible defaults (model from env, auto-detect paths)
- [ ] Simplify agent config with smart defaults

### Milestone 4: Developer Experience
- [ ] CLI scaffolding and utilities
- [ ] Better error messages with suggested fixes
- [ ] TypeScript strict mode compatibility

---

## Summary Stats

| Category | Count |
|----------|-------|
| 🔴 Critical | 2 (1 fixed) |
| 🟠 High | 3 |
| 🟡 Medium | 4 |
| 🟢 Low | 2 |
| **Total** | **11** |
