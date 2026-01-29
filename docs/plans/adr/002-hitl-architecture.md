# ADR-002: Human-in-the-Loop (HITL) Architecture

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** HITL Architecture
**Related Issues:** HITL-001, HITL-002, HITL-003, ARCH-012, DEAD-009, DEAD-011

---

## Context

The codebase had **three competing HITL systems**:

| System | Location | Pattern | Status |
|--------|----------|---------|--------|
| Domain/Interaction.ts | `Domain/Interaction.ts` | Handler-based factory | Test-only, unused |
| Phase/Runtime Queue | `Engine/runtime.ts` | Queue blocking with `respond()` | Actually used |
| Observer Callback | `Engine/types.ts` | `onInputRequested` returns Promise | Defined but broken |

### Problems Identified

1. **Three systems, unclear which is canonical** — Users and maintainers confused
2. **Observer callback broken** — `onInputRequested` defined but never awaited
3. **Inconsistent payloads** — System 1 has `interactionId`, System 2 has `promptText`
4. **React hooks incompatible** — `usePendingInteraction` expects System 1 payloads
5. **No support for dynamic HITL** — Can't conditionally request human input based on agent output
6. **Explicit human phases verbose** — Every human checkpoint needs its own phase

### Use Cases That Must Work

1. **Planned checkpoint** — Planner always needs approval (known upfront)
2. **Dynamic HITL** — Reviewer discovers it needs human help (emerges from execution)
3. **Multiple approvals** — Research → approve → Write → approve → Publish
4. **Conditional approval** — Only ask human if confidence < threshold
5. **Branching on choice** — Human picks option → different execution paths
6. **Iterative refinement** — Agent → human feedback → agent revises → loop

---

## Decision

**Inline human input on phase** — Human input configuration is part of the phase definition, not a separate phase.

### Two Input Types

Simplify to two types (not three):

| Type | Description | Response |
|------|-------------|----------|
| `approval` | Yes/No decision | `boolean` |
| `choice` | Pick from options | `string` (selected option) |

For freeform input, use `choice` with an "Other..." option.

### Phase Definition API

```typescript
interface PhaseDef<S, Output = unknown> {
  name?: string
  agent?: AgentDef<S, Output>

  // Human input — static config OR function (returns config or null to skip)
  human?: HumanConfig | ((state: S, output?: Output) => HumanConfig | null)

  // Routing — sees state and optionally agent output
  next?: string | ((state: S, output?: Output) => string)

  terminal?: boolean
}

interface HumanConfig {
  prompt: string | ((state: S) => string)
  type: "approval" | "choice"
  options?: string[] | ((state: S) => string[])  // Required for choice
}
```

### Usage Examples

**Planned checkpoint (always needs approval):**
```typescript
phases: [
  {
    agent: planner,
    human: {
      prompt: (s) => `Approve plan?\n${s.plan.join('\n')}`,
      type: "approval"
    },
    next: (s) => s.approved ? "execute" : "planner"
  },
  { agent: executor, terminal: true }
]
```

**Conditional HITL (only when needed):**
```typescript
phases: [
  {
    agent: classifier,
    human: (s, output) => output.confidence < 0.8
      ? { prompt: `Verify: "${output.label}"?`, type: "approval" }
      : null,  // Skip human if confident
    terminal: true
  }
]
```

**Dynamic HITL (agent requests help):**
```typescript
phases: [
  { agent: coder, next: "reviewer" },
  {
    agent: reviewer,
    human: (s, output) => output.needsHuman ? {
      prompt: output.humanPrompt,
      type: "choice",
      options: output.humanOptions
    } : null,
    next: (s, output) => {
      if (output.approved) return "done"
      if (s.humanResponse?.value === "Redesign") return "planner"
      return "coder"
    }
  }
]
```

**Branching on human choice:**
```typescript
phases: [
  {
    agent: planner,
    human: {
      prompt: "Choose approach:",
      type: "choice",
      options: ["Fast", "Thorough", "Custom"]
    },
    next: (s) => ({
      "Fast": "fastPath",
      "Thorough": "thoroughPath",
      "Custom": "customPath"
    })[s.humanResponse.value]
  },
  { name: "fastPath", agent: fastExecutor, terminal: true },
  { name: "thoroughPath", agent: thoroughExecutor, terminal: true },
  { name: "customPath", agent: customExecutor, terminal: true }
]
```

**Human-only phase (no agent):**
```typescript
phases: [
  {
    human: { prompt: "What do you want to build?", type: "choice", options: ["App", "API", "Library"] },
    next: "planner"
  },
  { agent: planner, next: "execute" }
]
```

### Handler API (Caller Side)

```typescript
interface HumanInputHandler {
  approval: (prompt: string) => Promise<boolean>
  choice: (prompt: string, options: string[]) => Promise<string>
}

// Usage
const result = await run(workflow, {
  input: "Hello",
  runtime,
  humanInput: {
    approval: async (prompt) => confirm(prompt),
    choice: async (prompt, options) => select(prompt, options)
  }
})
```

### Built-in Handlers

```typescript
// CLI — readline prompts
const result = await run(workflow, {
  input: "Hello",
  runtime,
  humanInput: cliPrompt()
})

// Auto-approve — for testing
const result = await run(workflow, {
  input: "Hello",
  runtime,
  humanInput: autoApprove()  // true for approval, first option for choice
})

// Custom
const result = await run(workflow, {
  input: "Hello",
  runtime,
  humanInput: {
    approval: myApprovalHandler,
    choice: myChoiceHandler
  }
})
```

### Event Flow

All HITL flows through the event system:

```
agent:completed { output: {...} }
  ↓
input:requested { id, prompt, type, options? }
  ↓ [Handler called, human responds]
input:received { id, value, approved? }
  ↓
[Routing evaluated with humanResponse in state]
  ↓
[Next phase starts]
```

### Event Payloads

```typescript
// input:requested
interface InputRequestedPayload {
  readonly id: string           // Unique correlation ID
  readonly prompt: string
  readonly type: "approval" | "choice"
  readonly options?: string[]   // For choice type
}

// input:received
interface InputReceivedPayload {
  readonly id: string           // Correlates to request
  readonly value: string        // Selected option or "yes"/"no"
  readonly approved?: boolean   // For approval type
}
```

---

## What Gets Removed

| Export | Reason |
|--------|--------|
| `Domain/Interaction.ts` | Delete — over-engineered, unused |
| `createInteraction()` | Delete — not needed |
| `execution.respond()` | Remove from public API — internal only |
| Old event payloads | Replace with unified structure |

---

## What Gets Added/Changed

| Change | Notes |
|--------|-------|
| `PhaseDef.human` field | Inline human config on phase |
| `human` as function | Conditional HITL based on output |
| `HumanInputHandler` type | Typed callbacks for approval/choice |
| `cliPrompt()` helper | Built-in CLI handler |
| `autoApprove()` helper | Built-in testing handler |
| `state.humanResponse` | Response stored in state for routing |
| `state.approved` | Convenience field for approval type |

---

## Alternatives Considered

### Option A: Explicit Human Phases
- Separate phase for every human checkpoint
- **Rejected:** Too verbose — doubles phase count for multi-approval workflows

### Option B: One Reusable Human Phase + State Config
- Single human phase, configured from state
- **Rejected:** Too much boilerplate in `onOutput` to wire up

### Option C: Tool-Based HITL
- Agent calls `requestHumanInput` tool
- **Rejected:** Different providers have different tool interfaces

### Option D (Chosen): Inline Human on Phase
- `human` field on phase definition
- Can be static config or function returning config (or null)
- **Accepted:** Best DX — compact, conditional, clear association with agent

---

## Consequences

### Positive
- One canonical HITL system
- Half the phases for multi-approval workflows
- Conditional HITL is natural — `human: (s, o) => o.needsHelp ? {...} : null`
- Clear association between agent and its human input
- Two simple types instead of three
- Built-in handlers reduce boilerplate

### Negative
- Breaking change for anyone using `execute().respond()`
- Need to migrate existing human phases to inline style
- `human` function seeing `output` adds coupling

### Migration Path
1. Delete `Domain/Interaction.ts`
2. Convert explicit human phases to inline `human` on preceding agent phase
3. Replace `respond()` calls with `humanInput` handler
4. Update React hooks to work with new event payloads

---

## Implementation Notes

1. **Runtime must await human callback** — When `human` config is present/returned, pause and call handler
2. **Store response in state** — `state.humanResponse = { value, approved? }`
3. **Convenience fields** — Also set `state.approved` for approval type
4. **Correlation IDs** — Generate unique ID per request for concurrent support
5. **Null means skip** — When `human` function returns `null`, continue without human input

---

## Related Files

- `packages/core/src/Domain/Interaction.ts` — Delete
- `packages/core/src/Engine/phase.ts` — Add `human` field to `PhaseDef`
- `packages/core/src/Engine/runtime.ts` — Implement human input handling
- `packages/core/src/Engine/types.ts` — Update event payloads
- `packages/core/src/Engine/run.ts` — Add `humanInput` to `RunOptions`
- `packages/core/src/helpers/humanInput.ts` — New file for `cliPrompt()`, `autoApprove()`
- `packages/client/src/react/hooks.ts` — Update `usePendingInteraction` for new payloads
