# Provider Clean Break: Implementation Plan

**Date:** 2026-01-07  
**Branch:** `feat/provider-trait-recording-eval`  
**Status:** 🟡 Phase 1-2 Complete, Phase 3 Ready to Start  
**Decision:** Clean Break - Remove inbox, simplify NodeRunContext, pure providers

---

## 📋 What This Plan Covers

This document describes the **Clean Break** refactoring of the provider system based on first-principles analysis.

**Related Documents:**
- `PROVIDER_ARCHITECTURE.md` - Initial pause/resume decision (pause is workflow-level)
- `2026-01-07-eval-architecture-options-provider-workflow-level.md` - Eval system design (Option E)
- This document - Complete implementation plan with inbox removal

---

## 🎯 The Clean Break Decision

### What We're Removing
1. ❌ `CommandInbox` - No mid-stream message injection
2. ❌ `ctx.inbox` - Removed from NodeRunContext
3. ❌ `ctx.getAgentSession() / setAgentSession()` - Runtime manages sessions
4. ❌ `ctx.resumeMessage` - Passed in input instead
5. ❌ Complex `CancelContext` - Just `AbortSignal`
6. ❌ `dispatch({ type: "send" })` - Replaced with `runtime.resume()`

### What We're Building
1. ✅ Pure providers - Input → Events → Output (zero runtime coupling)
2. ✅ Runtime manages sessions - Before/after node execution
3. ✅ HITL as workflow nodes - `human.input` node type
4. ✅ Simplified NodeRunContext - Just essentials
5. ✅ Universal pattern - Works for ALL providers

---

## 🏗️ Core Architecture Changes

### Before (Current)
```typescript
interface NodeRunContext {
  nodeId: string;
  runId: string;
  emit: (event) => void;
  state: StateStore;
  inbox: CommandInbox;  // ← Remove
  getAgentSession: () => string;  // ← Remove
  setAgentSession: (id: string) => void;  // ← Remove
  resumeMessage: string | undefined;  // ← Remove
  cancel: CancelContext;  // ← Simplify to signal
}
```

### After (Clean)
```typescript
interface NodeRunContext {
  nodeId: string;
  runId: string;
  emit: (event: RuntimeEvent) => void;
  signal: AbortSignal;  // Just the signal
  state: StateStore;
}
```

---

## 📊 Session Management (Runtime Responsibility)

### Pattern
```typescript
// Runtime snapshot stores sessions
interface RunSnapshot {
  status: "running" | "paused" | "complete";
  sessions: Record<string, string>;  // { [nodeId]: sessionId }
  // ...
}

// Runtime handles lifecycle
class Runtime {
  async executeNode(node, input) {
    // BEFORE: Prepare full input
    const fullInput = {
      ...input,
      sessionId: this.snapshot.sessions[nodeId],  // From snapshot
    };
    
    // RUN: Pure provider
    const output = await node.run(ctx, fullInput);
    
    // AFTER: Save session
    if (output.sessionId) {
      this.snapshot.sessions[nodeId] = output.sessionId;
    }
  }
}
```

---

## 🤖 Human-in-the-Loop (Workflow Level)

### How It Works
```typescript
// HITL is just another node type
const humanInputNode: NodeTypeDefinition = {
  type: "human.input",
  run: async (ctx, input) => {
    ctx.emit({
      type: "human:waiting",
      nodeId: ctx.nodeId,
      prompt: input.prompt,
      context: input.context,
    });
    
    return {
      status: "waiting",
      prompt: input.prompt,
    };
  },
};

// Workflow with HITL
const deploymentFlow = {
  nodes: [
    { id: "planner", type: "claude.agent", input: {...} },
    { id: "approval", type: "human.input", input: {  // ← HITL node
      prompt: "Approve deployment?",
      context: "{{ planner.output }}"
    }},
    { id: "executor", type: "claude.agent", input: {...} },
  ],
  edges: [
    { from: "planner", to: "approval" },
    { from: "approval", to: "executor" },
  ]
};

// User flow:
// 1. Workflow runs, hits human.input, pauses
// 2. UI polls: runtime.getSnapshot() → status="paused", currentNode="approval"
// 3. User provides input:
runtime.resume({
  runId: "run-123",
  nodeId: "approval",
  input: { approved: true, notes: "LGTM" }
});
// 4. Workflow continues
```

---

## 🎭 Provider Pattern (Universal)

### ALL Providers Follow This

```typescript
// Universal input pattern
interface ProviderInput {
  messages: string[];  // All messages (original + resume + HITL)
  sessionId?: string;  // For continuity
  // ... provider-specific fields
}

// Universal output pattern
interface ProviderOutput {
  // ... provider-specific fields
  sessionId?: string;  // For next call
}

// Pure trait (example: Claude)
const claudeTrait: ProviderTrait<ClaudeInput, ClaudeOutput> = {
  type: "claude.agent",
  capabilities: { streaming: true, structuredOutput: true },
  
  async *execute(input, ctx) {
    // Pure function - ALL data from input
    const query = sdk.query({
      prompt: messageStream(input.messages, input.sessionId),
      options: input.options,
    });
    
    for await (const msg of query) {
      if (ctx.signal.aborted) return;
      yield mapToStreamEvent(msg);
    }
    
    return { text, sessionId, usage };
  },
};
```

---

## 📝 Resume Pattern (Replaces Inbox)

### Old (with inbox)
```typescript
runtime.dispatch({ type: "send", runId, message: "continue" });
```

### New (clean)
```typescript
runtime.resume({ 
  runId: "run-123",
  message: "continue"  // Optional - defaults to "continue"
});

// How it works internally:
function prepareResumeInput(snapshot, resumeData) {
  const baseInput = snapshot.nodeInputs[resumeData.nodeId];
  
  return {
    ...baseInput,
    messages: [
      ...(baseInput.messages ?? []),
      resumeData.message ?? "continue",
    ],
    sessionId: snapshot.sessions[resumeData.nodeId],
  };
}
```

---

## 🚀 Implementation Phases

### ✅ Phase 1: Core Provider Abstractions (COMPLETE)
**Status:** Done and committed (`ce77cbc`)  
**Time:** 3-4 hours

**Delivered:**
- ✅ `ProviderTrait<I,O>` interface
- ✅ `ExecutionContext` (signal + emit)
- ✅ `StreamEvent` types
- ✅ `ProviderError` + neverthrow helpers
- ✅ `toNodeDefinition` adapter
- ✅ All exports from `@internal/core`

---

### ✅ Phase 2: Core State Cleanup (COMPLETE)
**Status:** Done and committed (`1eca77a`)  
**Time:** 2 hours

**Delivered:**
- ✅ Removed `pauseResume` from `ProviderCapabilities`
- ✅ Removed `multiTurn` mapping in adapter
- ✅ Removed `__setQuery` from `CancelContextInternal`
- ✅ Removed `Query` import from runtime
- ✅ Created `PROVIDER_ARCHITECTURE.md` documenting decisions

---

### 🔄 Phase 3: Clean Break Implementation (IN PROGRESS)
**Status:** Ready to start  
**Time:** 8-12 hours  
**Blockers:** None

#### 3.1: Update Core Types (~2 hours)

**Files to change:**
- `packages/internal/core/src/nodes/registry.ts` - NodeRunContext interface
- `packages/internal/core/src/state/state.ts` - Remove CommandInbox interface
- `packages/internal/core/src/state/index.ts` - Remove CommandInbox export
- `packages/internal/core/src/runtime/execution/runtime.ts` - Remove InMemoryCommandInbox class

**Changes:**
```typescript
// registry.ts - Simplify NodeRunContext
interface NodeRunContext {
  nodeId: string;
  runId: string;
  emit: (event: RuntimeEventPayload) => void;
  signal: AbortSignal;  // Changed from cancel: CancelContext
  state: StateStore;
  // REMOVED: inbox, getAgentSession, setAgentSession, resumeMessage
}

// state.ts - Remove CommandInbox
// DELETE: export interface CommandInbox { ... }
// DELETE: export type RuntimeCommand = ...

// runtime.ts - Remove inbox infrastructure
// DELETE: private readonly inboxes = new Map<...>();
// DELETE: private getInbox(runId: string): InMemoryCommandInbox { ... }
// DELETE: class InMemoryCommandInbox { ... }
```

**Validation:**
```bash
cd packages/internal/core
bun run typecheck  # Should pass with type errors in server (expected)
```

---

#### 3.2: Update Runtime Session Management (~3 hours)

**Files to change:**
- `packages/internal/core/src/runtime/execution/runtime.ts`
- `packages/internal/core/src/state/state.ts` (add sessions to RunSnapshot)

**Changes:**
```typescript
// state.ts - Add sessions to snapshot
interface RunState {
  status: RuntimeStatus;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  loopCounters: Record<string, number>;
  inbox: RuntimeCommand[];  // Keep for now (backward compat)
  agentSessions: Record<string, string>;  // RENAME to 'sessions'
}

// runtime.ts - Manage sessions in executeNode
private async executeNode(node, nodeId, input) {
  // BEFORE: Add session to input
  const fullInput = {
    ...input,
    sessionId: this.snapshot.sessions?.[nodeId],
  };
  
  // Context without inbox/session methods
  const ctx: NodeRunContext = {
    nodeId,
    runId,
    emit: this.emit,
    signal: cancelContext.__controller.signal,  // Just the signal
    state: this.stateStore,
  };
  
  // RUN
  const output = await node.run(ctx, fullInput);
  
  // AFTER: Save session from output
  if (output.sessionId) {
    this.snapshot.sessions = this.snapshot.sessions || {};
    this.snapshot.sessions[nodeId] = output.sessionId;
    this.persistSnapshot();
  }
  
  return output;
}

// Remove dispatch({ type: "send" }) - replace with direct message handling
private prepareResumeInput(nodeId: string, resumeMessage?: string) {
  const baseInput = this.resumeSnapshot?.inputs?.[nodeId] || {};
  
  return {
    ...baseInput,
    messages: [
      ...(baseInput.messages || []),
      resumeMessage || "continue",
    ],
    sessionId: this.snapshot.sessions?.[nodeId],
  };
}
```

**Validation:**
```bash
cd packages/internal/core
bun run typecheck  # Should pass
bun run test       # Core tests should pass
```

---

#### 3.3: Refactor Claude Provider (~3 hours)

**Files to change:**
- `packages/internal/server/src/providers/claude/claude.agent.ts`

**Changes:**
```typescript
// Remove inbox draining
const queuedCommands = drainInbox(ctx.inbox);  // ← DELETE
const queuedMessages = commandsToMessages(queuedCommands);  // ← DELETE

// Remove session methods
const knownSessionId = ctx.getAgentSession() ?? input.options?.resume;  // ← CHANGE
// TO:
const knownSessionId = input.sessionId ?? input.options?.resume;

// Remove setAgentSession
ctx.setAgentSession(sessionId);  // ← DELETE (runtime handles this)

// Remove resumeMessage from context
const resumeMessage = ctx.resumeMessage;  // ← DELETE
// (Resume message is in input.messages)

// Update input schema
interface ClaudeAgentInput {
  messages: ClaudeMessageInput[];  // Changed from prompt?/messages?
  sessionId?: string;  // Added
  options?: ClaudeAgentExtendedOptions;
}

// Prepare messages from input.messages directly
const promptMessages = input.messages;  // All messages from input
const prompt = messageStream(promptMessages, input.sessionId);
```

**Validation:**
```bash
cd packages/internal/server
bun run typecheck  # Should pass
bun run test       # All 26 tests should pass
```

---

#### 3.4: Update Tests (~2-3 hours)

**Files to change:**
- `packages/open-harness/server/tests/unit/cancellation.test.ts`
- `packages/open-harness/server/tests/integration/*.test.ts`
- `packages/open-harness/core/tests/persistence/resume.test.ts`

**Changes:**
```typescript
// OLD:
runtime.dispatch({ type: "send", runId, message: "continue" });

// NEW:
runtime.resume({ runId, message: "continue" });

// Update mock contexts to remove inbox/session methods
const mockCtx: NodeRunContext = {
  nodeId: "test",
  runId: "run-123",
  emit: vi.fn(),
  signal: new AbortController().signal,  // Changed
  state: mockStateStore,
  // REMOVED: inbox, getAgentSession, setAgentSession, resumeMessage
};
```

**Validation:**
```bash
bun run test  # All tests should pass
```

---

#### 3.5: Quality Gates (~1 hour)

**Run full validation:**
```bash
# From repository root
bun run typecheck   # 0 errors
bun run lint        # 0 issues
bun run test        # 139+ tests passing
```

**Commit:**
```bash
git add -A
git commit -m "refactor(core): clean break - remove inbox, simplify NodeRunContext

BREAKING CHANGES:
- Removed CommandInbox from NodeRunContext
- Removed getAgentSession/setAgentSession methods
- Removed resumeMessage from context
- Simplified CancelContext to just AbortSignal
- Runtime now manages session state
- dispatch({ type: 'send' }) replaced with runtime.resume()

Providers are now pure functions:
- All data from input
- Sessions via input.sessionId
- Zero runtime coupling

HITL pattern:
- human.input node type (workflow-level)
- runtime.resume() for user responses
- No special provider logic needed

Migrated Claude provider to new pattern.
All 139 tests passing."
```

---

### ⏳ Phase 4: Recording Infrastructure (PENDING)
**Status:** Not started  
**Time:** 8-10 hours  
**Blockers:** Phase 3 must complete  
**Priority:** High (enables evals)

**Deliverables:**
- Recording types (Recording, RecordedEvent, RecordingMetadata)
- RecordingStore interface + implementations (InMemory, File, SQLite)
- withRecording() wrapper (live, record, replay, passthrough)
- Event normalization (StreamEvent → RecordedEvent)

---

### ⏳ Phase 5: Template Provider + Docs (PENDING)
**Status:** Not started  
**Time:** 2 hours  
**Blockers:** Phase 3 must complete  
**Priority:** High (enables other providers)

**Deliverables:**
- template.trait.ts with extensive comments
- README: How to create providers
- Test examples

---

### ⏳ Phase 6: Eval Core Types (PENDING)
**Status:** Not started  
**Time:** 2 hours  
**Blockers:** Phase 4 must complete  
**Priority:** Medium

**Deliverables:**
- Assertion types
- Scorer interface
- TestCase/EvalDataset types
- Built-in scorers (latency, cost, tokens)

---

### ⏳ Phase 7: Eval Engine (PENDING)
**Status:** Not started  
**Time:** 8-10 hours  
**Blockers:** Phase 6 must complete  
**Priority:** Medium

**Deliverables:**
- Dataset runner (runTest, runDataset)
- Assertion evaluation
- Comparison engine
- LLM-as-judge scorer
- Reporting

---

### ⏳ Phase 8: Integration & Validation (PENDING)
**Status:** Not started  
**Time:** 6-7 hours  
**Blockers:** All previous phases  
**Priority:** Low (polish)

**Deliverables:**
- End-to-end tests
- Documentation updates
- Migration guide
- Performance validation

---

## 📊 Progress Tracking

| Phase | Status | Time Estimated | Time Actual | Commits |
|-------|--------|---------------|-------------|---------|
| 1: Core Abstractions | ✅ Complete | 3-4h | 3h | `ce77cbc` |
| 2: State Cleanup | ✅ Complete | 2h | 2h | `1eca77a` |
| 3: Clean Break | 🔄 Ready | 8-12h | - | - |
| 4: Recording | ⏳ Pending | 8-10h | - | - |
| 5: Template | ⏳ Pending | 2h | - | - |
| 6: Eval Types | ⏳ Pending | 2h | - | - |
| 7: Eval Engine | ⏳ Pending | 8-10h | - | - |
| 8: Integration | ⏳ Pending | 6-7h | - | - |

**Total Estimated:** 39-49 hours  
**Total Completed:** 5 hours (10-13%)  
**Remaining:** 34-44 hours

---

## 🎯 Success Criteria

### Phase 3 (Clean Break) Success:
- ✅ NodeRunContext has only 5 fields (nodeId, runId, emit, signal, state)
- ✅ No CommandInbox anywhere in codebase
- ✅ Runtime manages sessions (before/after node execution)
- ✅ Claude provider uses input.sessionId
- ✅ All 139 tests passing
- ✅ 0 typecheck errors
- ✅ 0 lint issues

### Overall Initiative Success:
- ✅ Pure provider pattern validated (Claude working)
- ✅ Template provider created (easy to extend)
- ✅ Recording infrastructure complete
- ✅ Eval system functional (datasets + scorers + comparisons)
- ✅ 200+ tests passing
- ✅ Documentation complete

---

## 🔗 Related Documents

1. **PROVIDER_ARCHITECTURE.md** - Pause/resume decision (workflow-level)
2. **2026-01-07-eval-architecture-options-provider-workflow-level.md** - Eval design (Option E)
3. **This document** - Complete implementation plan
4. **EPIC_DEPENDENCY_MATRIX.md** - 46-bead neverthrow initiative (separate)

---

## 📞 Next Actions

**Immediate (Phase 3 - Clean Break):**
1. Update core types (NodeRunContext, remove CommandInbox)
2. Update runtime session management
3. Refactor Claude provider
4. Update tests
5. Run quality gates
6. Commit with detailed BREAKING CHANGES message

**After Phase 3:**
1. Move to Phase 4 (Recording Infrastructure)
2. Continue through phases 5-8
3. Document migration path for other providers

---

**This plan is ready for execution. All architectural decisions are documented and approved.**
