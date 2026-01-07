# Provider Architecture: Design Decisions

**Date:** 2026-01-07  
**Status:** ✅ APPROVED + EXTENDED  
**Last Updated:** 2026-01-07 (Added stateful SDK clarification + API terminology)

**Key Decisions:**
1. Pause/Resume is a workflow-level concept, not provider-level
2. Remove inbox entirely - no mid-stream message injection
3. Simplify NodeRunContext - pure providers with minimal context
4. HITL is workflow-level (human.input node type)
5. **Provider SDKs are STATEFUL** - they maintain their own history
6. **Clean Runtime API** - `pause()`, `resume()`, `stop()` (not overloaded "abort")

**Related Documents:**
- `PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md` - Complete implementation plan (Phase 3 in progress)

---

## 🧹 Second Key Insight: Remove the Inbox Entirely

**The Question:** Do providers need mid-stream message injection?

**The Answer:** NO

**Why the inbox existed:**
- External messages via WebSocket/HTTP → inject into running agent
- Tool replies for human-in-the-loop
- Resume messages internally queued

**Why we don't need it:**
- Most providers (Claude SDK, OpenAI) don't support mid-stream injection
- They're **function calls**, not chat UIs: Start → Stream → Complete → Done
- Multi-turn = Multiple separate calls with session ID, not one long call

**The Clean Pattern:**
- Provider runs once: Input → Events → Output
- For continuation: Call again with session ID + new message
- For HITL: Use `human.input` node type (workflow-level)
- For resume: Runtime prepares full input (original messages + resume message)

**What gets removed:**
- ❌ `CommandInbox` interface and implementation
- ❌ `ctx.inbox` from NodeRunContext
- ❌ `dispatch({ type: "send" })` - replaced with `runtime.resume()`
- ❌ Mid-execution message queuing
- ❌ Inbox draining logic in providers

**What we gain:**
- ✅ Providers are pure functions (no side effects)
- ✅ Simpler testing (just input/output)
- ✅ Universal pattern (works for ALL providers)
- ✅ Clear responsibilities (runtime = orchestration, provider = execution)

---

## 🎯 Key Insight: All Providers Support Session-Based Restart

**The Problem We Solved:**
- Initially designed `pauseResume: boolean` capability
- Assumed only Claude SDK could "pause"
- But this was wrong - ALL providers support abort + session restart

**The Truth:**
- **Claude**: `sessionId` - continue conversation
- **OpenAI**: `thread_id` - continue thread
- **Anthropic API**: `conversation_id` - continue conversation
- **Codex**: Session tokens
- **OpenCode**: TBD but will support sessions

---

## 📐 Architectural Decision

### Pause/Resume is a WORKFLOW Concern

**What providers actually support:**
1. ✅ **Abort** - All providers support `AbortSignal`
2. ✅ **Session ID** - All providers have some form of session/conversation ID
3. ✅ **Resume** - All providers can continue from a previous session

**What workflow does:**
1. User requests pause → Abort current provider call via `AbortSignal`
2. Save snapshot with:
   - Node ID
   - Provider session ID (from output)
   - Current state
3. On resume → Workflow passes:
   - Session ID (from snapshot)
   - Resume message (default: "continue", or user-provided)

---

## 🏗️ Provider Trait (Final Design)

```typescript
/**
 * Provider capabilities.
 * 
 * NOTE: Pause/resume is NOT a capability.
 * All providers support session-based restart via their input/output.
 */
export interface ProviderCapabilities {
  /**
   * Can the provider stream events?
   */
  streaming: boolean;
  
  /**
   * Can the provider return structured JSON output?
   */
  structuredOutput: boolean;
}

/**
 * Provider trait: The essence of what an AI provider IS.
 */
export interface ProviderTrait<TInput, TOutput> {
  readonly type: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  readonly inputSchema: ZodSchema<TInput>;
  readonly outputSchema: ZodSchema<TOutput>;
  
  execute(
    input: TInput,
    ctx: ExecutionContext,
  ): AsyncGenerator<StreamEvent, TOutput>;
}
```

---

## 📝 Provider Input/Output Pattern

**Each provider defines session handling in their I/O:**

### Claude Provider
```typescript
interface ClaudeInput {
  prompt: string;
  options?: {
    resume?: string;  // Session ID to resume
    model?: string;
    // ...
  };
}

interface ClaudeOutput {
  text: string;
  sessionId: string;  // For future resume
  structuredOutput?: unknown;
  usage?: TokenUsage;
}
```

### OpenAI Provider (Future)
```typescript
interface OpenAIInput {
  messages: Message[];
  threadId?: string;  // Thread ID to continue
  model?: string;
}

interface OpenAIOutput {
  content: string;
  threadId: string;  // For future continuation
  usage?: TokenUsage;
}
```

### Codex Provider (Future)
```typescript
interface CodexInput {
  prompt: string;
  sessionToken?: string;  // Session to resume
}

interface CodexOutput {
  code: string;
  sessionToken: string;  // For future resume
}
```

---

## 🔄 Workflow Pause/Resume Flow

### Critical Understanding: Stateful SDKs

**Provider SDKs (Claude, OpenAI, etc.) are STATEFUL:**
- They maintain their own conversation history internally
- They track all tool calls, messages, and context
- On resume, you do NOT need to pass back previous messages
- You only need: `sessionId` + `new message`

```typescript
// Resume is just this - SDK has full history for this session
{
  prompt: "continue with the deployment",
  options: {
    resume: "session-abc-123",  // SDK looks up its own history
  }
}
```

### Runtime API (Clean Terminology)

```typescript
interface Runtime {
  run(input?: Record<string, unknown>): Promise<RunSnapshot>;
  pause(): Promise<RunSnapshot>;   // Soft stop, saves state, resumable
  resume(message?: string): Promise<RunSnapshot>;  // Continue with new message
  stop(): void;                    // Hard stop, NOT resumable
  getSnapshot(): RunSnapshot;
}
```

**Note:** We use `pause()` and `stop()` instead of overloaded "abort" terminology.
- `pause()` = User wants to stop temporarily, will resume later
- `stop()` = User wants to cancel entirely, no resume

### Pause Flow
```
1. User calls runtime.pause()
2. Runtime signals abort to provider (AbortSignal)
3. Provider stops streaming, returns current sessionId
4. Runtime saves snapshot (includes sessionId)
5. runtime.pause() returns snapshot for external persistence
```

### Resume Flow
```
1. Caller loads snapshot from storage
2. Caller creates runtime with snapshot: createRuntime({ flow, registry, snapshot })
3. Caller calls runtime.resume("approved, continue")
4. Runtime finds paused node, gets sessionId from snapshot
5. Runtime calls provider with ONLY: sessionId + new message
6. Provider SDK looks up its own history, continues conversation
```

### What Runtime Passes on Resume
```typescript
// Runtime constructs this for the provider:
{
  prompt: message,  // "approved, continue" or default "continue"
  options: {
    resume: sessionId,  // From snapshot.agentSessions[nodeId]
  }
}

// That's ALL. No message history reconstruction.
// The SDK maintains its own conversation state.
```

---

## 🎯 Benefits of This Design

### ✅ Simplicity
- No `pauseResume` capability needed
- All providers work the same way
- Workflow handles pause/resume uniformly

### ✅ Flexibility
- Each provider defines its own session mechanism
- OpenAI uses `threadId`, Claude uses `sessionId`, etc.
- Workflow doesn't care about provider-specific details

### ✅ Consistency
- Abort is universal (`AbortSignal`)
- Session is provider-specific (in I/O schema)
- Resume message is workflow-controlled

### ✅ Extensibility
- New providers just need to:
  1. Accept optional session ID in input
  2. Return session ID in output
  3. Handle abort signal
- No special capabilities needed

---

## 📊 Comparison: Old vs New Design

### ❌ Old Design (Wrong)
```typescript
interface ProviderCapabilities {
  streaming: boolean;
  pauseResume: boolean;  // ❌ Wrong - not all providers
  structuredOutput: boolean;
}

// Problem: Assumes pause/resume is provider-specific
// Reality: All providers support session-based restart
```

### ✅ New Design (Correct)
```typescript
interface ProviderCapabilities {
  streaming: boolean;
  structuredOutput: boolean;
  // No pauseResume - it's a workflow concern!
}

// Providers expose session via input/output
interface ClaudeInput {
  options?: { resume?: string };
}

interface ClaudeOutput {
  sessionId: string;
}

// Workflow handles pause/resume logic
```

---

## 🔧 Implementation Changes

### Files to Update
1. ✅ `packages/internal/core/src/providers/trait.ts` - Remove `pauseResume` from capabilities
2. ✅ `packages/internal/core/src/providers/adapter.ts` - Remove `multiTurn` from NodeTypeDefinition
3. ✅ Provider implementations (Claude, future providers) - Session in I/O

### Claude Provider Changes
```typescript
// Input already has resume support
interface ClaudeAgentInput {
  prompt?: string;
  messages?: ClaudeMessageInput[];
  options?: {
    resume?: string;  // ✅ Already supports this!
    // ...
  };
}

// Output already returns sessionId
interface ClaudeAgentOutput {
  text?: string;
  sessionId?: string;  // ✅ Already returns this!
  // ...
}

// Just remove pauseResume from capabilities
const claudeTrait: ProviderTrait<...> = {
  capabilities: {
    streaming: true,
    structuredOutput: true,
    // pauseResume: true ❌ Remove this line
  },
  // ...
};
```

---

## 📖 Summary

**Pause/Resume Architecture:**
- ❌ NOT a provider capability
- ✅ IS a workflow-level feature
- ✅ All providers support via session IDs
- ✅ Workflow coordinates pause/resume
- ✅ Resume message comes from user or defaults to "continue"

**Provider Responsibility:**
- Accept optional session ID in input
- Return session ID in output
- Handle abort signal

**Workflow Responsibility:**
- Save snapshot with session ID
- Pass session ID on resume
- Provide resume message (user or default)
- Coordinate pause/resume UX

---

## ✨ This Makes Everything Simpler

No special cases. No provider-specific pause logic. Just:
1. Abort with signal
2. Save session ID
3. Resume with session ID + message

Universal pattern that works for Claude, OpenAI, Codex, Droid, and any future provider.
