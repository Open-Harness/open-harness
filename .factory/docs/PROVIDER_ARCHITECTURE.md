# Provider Architecture: Design Decisions

**Date:** 2026-01-07  
**Status:** APPROVED  
**Decision:** Pause/Resume is a workflow-level concept, not provider-level

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

### Pause Flow
```
1. User requests pause
2. Workflow calls ctx.cancel.interrupt()
3. Provider receives abort via ctx.signal.aborted
4. Provider stops and returns partial result (if any)
5. Workflow saves snapshot:
   {
     runId: "run-123",
     nodeId: "coder",
     sessionId: "claude-session-abc",  // From provider output
     state: { code: "partial..." },
     resumeMessage: null,  // Will be set on resume
   }
```

### Resume Flow
```
1. User resumes with optional message (default: "continue")
2. Workflow loads snapshot
3. Workflow constructs provider input:
   {
     prompt: resumeMessage ?? "continue",
     options: {
       resume: snapshot.sessionId,  // Claude: uses this
     }
   }
4. Provider continues from where it left off
5. Provider returns new output with updated sessionId
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
