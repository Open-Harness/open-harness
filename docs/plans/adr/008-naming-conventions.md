# ADR-008: Naming Conventions

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Naming Conventions
**Related Issues:** NAME-001, NAME-002, NAME-003, NAME-004, NAME-008

---

## Context

The codebase has **inconsistent naming** across APIs:

| Issue | Examples | Decision Needed |
|-------|----------|-----------------|
| NAME-001 | `agentName` vs `agent` in payloads | Prefer shorter |
| NAME-002 | `promptText` vs `prompt` in HITL | Prefer shorter |
| NAME-003 | `inputType` vs `type` in HITL | Prefer shorter |
| NAME-004 | `UseFilteredEventsOptions` | Drop `Use` prefix |
| NAME-005 | Two `Event<N,P>` definitions | Consolidate |
| NAME-006 | Error class naming inconsistent | Standardize (→ ADR-007) |
| NAME-007 | `onStateChanged` vs `onTextDelta` | Standardize tense |
| NAME-008 | `EventId` vs other IDs | Consistent casing |

### Current Inconsistencies Found

**Same concept, different names:**
```typescript
// InputRequest (WorkflowObserver) uses:
{ prompt: string, type: "freeform" | "approval" | "choice" }

// InputRequestedPayload (event types) uses:
{ promptText: string, inputType: "freeform" | "approval" | "choice" }

// PendingInteraction (client hooks) uses:
{ prompt: string, inputType: "freeform" | "approval" | "choice" }  // Mixed!
```

**Observer callback tense inconsistency:**
```typescript
// Past tense:
onStateChanged, onPhaseChanged, onAgentStarted, onAgentCompleted, onInputRequested

// Present tense:
onTextDelta, onThinkingDelta, onToolCall, onToolResult, onEvent

// Weird:
onErrored  // Should be onError or onFailed
```

**Two identical Event definitions:**
- `Engine/types.ts`: `Event<N extends string, P>`
- `Domain/Interaction.ts`: `Event<Name extends string, Payload>`

---

## Decision

### 1. Payload Field Names — Use Shorter Names

| Current | New | Affected Files |
|---------|-----|----------------|
| `agentName` | `agent` | `types.ts` (6 payloads), `Interaction.ts`, `hooks.ts` |
| `workflowName` | `workflow` | `types.ts` |
| `promptText` | `prompt` | `types.ts` (already `prompt` in `InputRequest`) |
| `inputType` | `type` | `types.ts`, `Interaction.ts`, `hooks.ts` |

**Keep `sessionId` as-is** — IDs benefit from explicit suffix for clarity.

### 2. Type Naming Conventions

| Pattern | Convention | Example |
|---------|------------|---------|
| Options types | `{Thing}Options` | `RunOptions`, `ExecuteOptions` |
| Config types | `{Thing}Config` | `RuntimeConfig`, `ServerConfig` |
| Payload types | `{Event}Payload` | `AgentStartedPayload` |
| Result types | `{Thing}Result` | `WorkflowResult`, `StateAtResult` |
| Hook options | `{Hook}Options` | `FilteredEventsOptions` ~~`UseFilteredEventsOptions`~~ |
| Hook results | `{Hook}Result` | `StateAtResult` ~~`UseStateAtResult`~~ |

**Rule:** Never prefix types with `Use` — that's a React hook naming pattern, not a type pattern.

### 3. Observer Callback Naming — Use Past Tense for Completed Events

**Principle:** Callbacks are invoked *after* something happened, so past tense is correct.

| Current | New | Rationale |
|---------|-----|-----------|
| `onStateChanged` | `onStateChanged` | ✓ Keep (past tense) |
| `onPhaseChanged` | `onPhaseChanged` | ✓ Keep (past tense) |
| `onAgentStarted` | `onAgentStarted` | ✓ Keep (past tense) |
| `onAgentCompleted` | `onAgentCompleted` | ✓ Keep (past tense) |
| `onTextDelta` | `onTextDelta` | ✓ Keep (delta is a noun, not a verb) |
| `onThinkingDelta` | `onThinkingDelta` | ✓ Keep |
| `onToolCall` | `onToolCalled` | Fix to past tense |
| `onToolResult` | `onToolResult` | ✓ Keep (result is a noun) |
| `onInputRequested` | `onInputRequested` | ✓ Keep |
| `onErrored` | `onError` | Fix (error is a noun) |

### 4. Consolidate Event Definition — Single Source in `Engine/types.ts`

- **Remove** `Event<Name, Payload>` from `Domain/Interaction.ts`
- **Import** from `Engine/types.ts` instead
- This eliminates the duplicate definition (NAME-005)

### 5. ID Type Naming — Keep Current Convention

All IDs use `{Thing}Id` with lowercase 'd':
- `EventId` ✓
- `SessionId` ✓
- `WorkflowId` ✓
- `AgentId` ✓

### 6. Casing Conventions — Formalized

| Context | Convention | Example |
|---------|------------|---------|
| Types/Interfaces | PascalCase | `WorkflowResult` |
| Functions | camelCase | `createWorkflow` |
| Constants | SCREAMING_SNAKE | `DEFAULT_TIMEOUT`, `EVENTS` |
| Event names | kebab:colon | `workflow:started`, `agent:completed` |
| File names | PascalCase (types), camelCase (utils) | `Workflow.ts`, `utils.ts` |

---

## Alternatives Considered

### A. Keep verbose names for explicitness
- **Rejected:** The context makes meaning clear. `AgentStartedPayload.agent` is obviously the agent name.

### B. Use present tense for all observer callbacks
- **Rejected:** Past tense is more accurate — callbacks fire *after* the event occurred.

### C. Use `*Id` with capital 'I' (e.g., `EventID`)
- **Rejected:** `Id` follows TypeScript conventions (e.g., `userId`, not `userID`).

---

## Consequences

### Positive
- Consistent, predictable naming across all packages
- Shorter payloads reduce verbosity
- Single Event definition eliminates confusion
- Observer callbacks have consistent tense

### Negative
- Breaking changes to payload shapes (requires migration)
- Breaking changes to observer callbacks (`onToolCall` → `onToolCalled`, `onErrored` → `onError`)

### Migration Path
1. Add new names as aliases
2. Deprecate old names with JSDoc `@deprecated`
3. Remove old names in next major version

---

## Implementation Notes

### Files to Update

**Payload field renames:**
- `packages/core/src/Engine/types.ts` — All payloads with `agentName`, `workflowName`
- `packages/core/src/Domain/Interaction.ts` — `agentName`, `inputType`
- `packages/client/src/react/hooks.ts` — `agentName`, `inputType` in `PendingInteraction`

**Type renames:**
- `packages/client/src/react/hooks.ts` — `UseFilteredEventsOptions` → `FilteredEventsOptions`
- `packages/client/src/react/hooks.ts` — `UseStateAtResult` → `StateAtResult` (but conflicts with `Contract.ts`)

**Observer callback renames:**
- `packages/core/src/Engine/types.ts` — `onToolCall` → `onToolCalled`, `onErrored` → `onError`

**Event definition consolidation:**
- `packages/core/src/Domain/Interaction.ts` — Remove duplicate `Event` definition, import from `Engine/types.ts`

### Order of Operations
1. Rename types first (non-breaking if aliased)
2. Rename payload fields (breaking)
3. Rename observer callbacks (breaking)
4. Consolidate Event definition (non-breaking)

---

## Related Files

- `packages/core/src/Engine/types.ts` — Event payloads, observer, Event definition
- `packages/core/src/Domain/Interaction.ts` — Duplicate Event definition, interaction payloads
- `packages/core/src/Domain/Ids.ts` — ID types
- `packages/client/src/react/hooks.ts` — Hook option types, PendingInteraction
