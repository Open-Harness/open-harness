# Research: Flow Pause/Resume with Session Persistence

**Feature Branch**: `016-pause-resume`
**Research Date**: 2026-01-02
**Status**: Complete (Validated against codebase)

## Research Questions & Decisions

### RQ-001: How should SessionContext be connected to Hub?

**Context**: The spec (FR-013) requires connecting the orphaned SessionContext (src/protocol/session.ts) which has AbortController. Hub.abort() currently emits events but doesn't signal stop.

**Decision**: Hub should own and manage SessionContext instances internally. Hub exposes AbortSignal through its API while keeping AbortController encapsulated. Hub.abort() triggers both signal.abort() and event emission.

**Rationale**:
- **Separation of concerns**: Hub remains the event bus (its core purpose) while SessionContext handles abort signaling (its purpose)
- **Event + Signal pattern**: Events for state coordination (flow:paused, session:abort), AbortSignal for imperative cancellation that executor/agents can check
- **Minimal API surface**: External systems call hub.abort(), not session.abort(). Hub translates to both event AND signal
- **Backward compatibility**: Existing hub.abort() behavior preserved, new behavior adds signal.abort() call

**Alternatives Rejected**:
| Alternative | Reason Rejected |
|-------------|-----------------|
| SessionContext as separate top-level manager | Creates two sources of truth, requires external coordination, violates mental model where Hub is central |
| Hub directly implements AbortController | Spec requires "SessionContext MUST be used", loses session hierarchy capability |
| Connect Hub and SessionContext via events only | Events are fire-and-forget, not right primitive for cancellation |

---

### RQ-002: What pattern for in-memory session state store?

**Context**: The spec requires storing session ID, current node ID, outputs, and pending message queue (FR-005). In-memory only, single flow per hub.

**Decision**: Use `private readonly _pausedSessions = new Map<string, SessionState>()` directly in HubImpl class.

**Rationale**:
- **Matches existing pattern**: Same approach used for `_channels` registry in hub.ts:32
- **YAGNI compliance**: Constitution V requires justifying abstractions. No second implementation planned (no disk persistence per assumptions)
- **Simple and obvious**: O(1) lookups meet <100ms performance requirement (SC-001)
- **Keeps state management patterns consistent**: Hub already manages Maps for channels, edges, adjacency

**Alternatives Rejected**:
| Alternative | Reason Rejected |
|-------------|-----------------|
| Separate SessionStore class | Violates YAGNI - creates abstraction for single use case with no second implementation planned |
| Integrate into SessionContext | Conceptual mismatch - SessionContext represents running sessions, pause state exists between sessions |

---

### RQ-003: How should executor check for abort/pause signals?

**Context**: The spec requires checks "between node executions" (FR-007) and "during agent node execution" (FR-008). Current executor has no abort checks.

**Decision**: Poll `hub.status` at two strategic points:
1. **Between nodes**: After each node completes (after resolveOutgoingEdges in executor.ts)
2. **During agent execution**: Between SDK message iterations (in the for-await loop in claude.ts)

**Rationale**:
- **Natural checkpoints**: Node boundaries are where state is consistent
- **Agent-aware**: Agents can run for minutes, mid-execution check enables pause (satisfies FR-008)
- **Lightweight polling**: Simple property read, no subscription overhead
- **Backward compatible**: Only adds status checks, doesn't change execution flow for non-paused flows

**Alternatives Rejected**:
| Alternative | Reason Rejected |
|-------------|-----------------|
| AbortController.signal throughout executor | Requires threading signal through all functions, larger refactor |
| Subscribe to abort events | Event subscriptions add overhead and require cleanup |
| Only check between nodes | Violates FR-008, agents can run indefinitely |
| Check on every SDK event | Too granular, dozens of times per agent turn |

---

### RQ-004: How should pause (resumable) be distinguished from abort (terminal)?

**Context**: The spec distinguishes hub.abort() without resumable (emits session:abort, FR-002) from hub.abort() with resumable:true (emits flow:paused, FR-001).

**Decision**: Extend hub.abort() with optional options parameter:
```typescript
abort(options?: { resumable?: boolean; reason?: string }): void
```

**Rationale**:
- **Backward compatible**: Existing calls work unchanged
- **Self-documenting**: `hub.abort({ resumable: true })` makes intent clear at call-site
- **Industry alignment**: Follows Argo Workflows suspend pattern, Temporal pause, modern web APIs
- **Single entry point**: One method with options simpler than separate pause() and abort()
- **Event-driven**: resumable flag determines which event emitted (flow:paused vs session:abort)
- **Status clarity**: Hub status becomes "paused" for resumable, "aborted" for terminal

**Alternatives Rejected**:
| Alternative | Reason Rejected |
|-------------|-----------------|
| Separate pause() and abort() methods | API duplication, both fundamentally stop execution |
| Use AbortController.reason for flag | Overloads reason semantics, loses type safety |
| Separate pauseSession() method | Violates spec design (FR-001 says hub.abort() with resumable option) |

---

## Implementation Implications

### Type Additions

```typescript
// protocol/hub.ts
interface PauseOptions {
  resumable?: boolean;
  reason?: string;
}

// protocol/flow-runtime.ts
interface SessionState {
  sessionId: string;
  nodeId: string;
  outputs: Record<string, unknown>;
  messageQueue: string[];
  pausedAt: Date;
}

interface ResumeRequest {
  sessionId: string;
  message: string;  // Required - SDK needs user input to continue
}
```

### Hub Status Extension

```typescript
type HubStatus = "idle" | "running" | "paused" | "complete" | "aborted";
```

### API Changes

```typescript
// protocol/hub.ts
interface Hub {
  // Existing
  abort(reason?: string): void;
  // Extended signature
  abort(options?: PauseOptions): void;

  // New
  resume(sessionId: string, message: string): void;  // message required - SDK needs user input
  getAbortSignal(): AbortSignal;
}
```

---

## Codebase Validation (2026-01-02)

*Validated by reading actual source files, not making assumptions.*

### SessionContext Infrastructure (EXISTS)

**Location**: `packages/kernel/src/protocol/session.ts`

```typescript
// Lines 10-19 - Interface already defined
interface SessionContext {
  sessionId: string;
  parentSessionId?: string;
  createdAt: Date;
  abortController: AbortController;  // ← Key: abort signal exists!
}

// Lines 24-52 - Helper functions already exist
createSessionId()        // generates session-{uuid8}
createSessionContext()   // creates with fresh AbortController
isSessionAborted()       // checks signal.aborted
abortSession()           // triggers abort
```

**Finding**: The abort infrastructure is built but not connected to Hub.

### Hub Implementation (PARTIAL)

**Location**: `packages/kernel/src/engine/hub.ts`

```typescript
// Lines 146-153 - Current abort() implementation
abort(reason?: string): void {
  if (!this._sessionActive) return;
  this._status = "aborted";  // ← Hard-coded, no "paused" option
  this.emit({
    type: "session:abort",
    reason,
  });
  // ← Missing: abortController.abort() call
}
```

**Finding**: Hub doesn't own SessionContext. Abort doesn't trigger signal.

### Executor Loop (NO ABORT CHECKS)

**Location**: `packages/kernel/src/flow/executor.ts`

```typescript
// Line 336 - Main execution loop
for (const node of compiled.order) {
  // ... process node ...
  // ← No signal.aborted check here
}
```

**Finding**: Executor runs to completion regardless of abort signals.

### Claude Agent Multi-Turn (READY)

**Location**: `packages/kernel/src/providers/claude.ts`

```typescript
// Lines 100-107 - Message stream with session ID
async function* messageStream(messages, sessionId) {
  for (const message of messages) {
    yield toUserMessage(message, sessionId);
  }
}

// Line 170 - Uses query() API
const queryStream = query({ prompt, options: mergedOptions });

// Line 176 - Iteration without abort check
for await (const message of queryStream) {
  // ← No signal check in loop
}
```

**Finding**: Multi-turn pattern exists but no cooperative abort.

### Event Types (PARTIAL)

**Location**: `packages/kernel/src/protocol/events.ts`

```typescript
// Session events exist (lines vary):
"session:message"  // ✅ Exists
"session:abort"    // ✅ Exists
"session:start"    // ✅ Exists
"session:end"      // ✅ Exists

// Missing:
"flow:paused"      // ❌ Not defined
"flow:resumed"     // ❌ Not defined
```

### HubStatus (INCOMPLETE)

**Location**: `packages/kernel/src/protocol/hub.ts`

```typescript
type HubStatus = "idle" | "running" | "complete" | "aborted";
// ← Missing: "paused"
```

---

## Sources

**AbortController/Signal Patterns**:
- [Advanced AbortController Features](https://blog.webdevsimplified.com/2025-06/advanced-abort-controller/)
- [Understanding AbortController in Node.js](https://betterstack.com/community/guides/scaling-nodejs/understanding-abortcontroller/)
- [Azure SDK: How to use abort signals](https://devblogs.microsoft.com/azure-sdk/how-to-use-abort-signals-to-cancel-operations-in-the-azure-sdk-for-javascript-typescript/)

**Workflow Orchestration Patterns**:
- [Argo Workflows: Debug Pause](https://argo-workflows.readthedocs.io/en/latest/debug-pause/)
- [Temporal vs. Argo Workflows Comparison](https://pipekit.io/blog/temporal-vs-argo-workflows)

**Cancellation Best Practices**:
- [Cancellation, Part 4: Polling](https://blog.stephencleary.com/2022/03/cancellation-4-polling.html)
- [A Deep Dive into C#'s CancellationToken](https://medium.com/@mitesh_shah/a-deep-dive-into-c-s-cancellationtoken-44bc7664555f)
- [Cancellation in Managed Threads - .NET](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads)

**YAGNI/Abstraction Guidance**:
- [YAGNI Principle: Avoid Unnecessary Abstractions](https://ironsoftware.com/academy/csharp-common-problems/yagni-abstraction-generic-code/)
- [Do you really need that abstraction?](https://codeopinion.com/do-you-really-need-that-abstraction-or-generic-code-yagni/)
