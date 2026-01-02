# Context Snapshot: V2 SDK Migration & Unified Hub Architecture

**Date**: 2026-01-01
**Branch**: `flow-only-stack`
**Phase Status**: Phase 3 complete, Phase 4 blocked

---

## Executive Summary

We are simplifying the multi-turn agent architecture by:
1. **Adopting SDK V2** (`unstable_v2_createSession`, `session.send()`, `session.receive()`)
2. **Removing the Inbox abstraction** entirely
3. **Unifying message delivery through Hub** - messages to agents are just events
4. **Stop-restart pattern** for multi-turn: each turn is a complete send/receive cycle

This eliminates the async iterable complexity and enables cross-provider consistency (Anthropic first, OpenCode next).

---

## Current Architecture Problems

### The Inbox Complexity

Current flow for injecting a message to a running agent:
```
hub.sendToRun(runId, msg)
    → AgentInboxImpl.push(msg)
    → Agent reads from inbox via async iterator
    → promptStream() yields to SDK
    → ??? how to close/terminate ???
```

**Issues**:
1. `AgentInboxImpl` has `while(true)` - **no termination mechanism**
2. `close()` is in protocol but **not implemented**
3. Claude provider **doesn't consume inbox** - it's created but not wired
4. Two separate message delivery systems (Hub events vs Inbox queue)

### The Mental Model Mishmash

Three overlapping patterns:
1. **Event-Driven** (Hub) - clean, consistent
2. **Execution Pipeline** (Flow) - clean, declarative
3. **Session/Interactive** (Inbox) - messy, half-implemented

---

## New Architecture: Unified Hub

### One Mental Model

**Everything is an event flowing through Hub.**

```
┌─────────────────────────────────────────┐
│                   HUB                    │
│                                          │
│  Events OUT          Commands IN         │
│  ───────────         ──────────          │
│  agent:text          send(msg)           │
│  agent:tool:*        sendTo(node, msg)   │
│  session:message ◄── sendToRun(run, msg) │
│  harness:*           abort()             │
│                                          │
└─────────────────────────────────────────┘
```

**Key change**: `sendToRun()` just emits a `session:message` event with `runId`. Agents subscribe to their own events.

### V2 SDK Pattern

```typescript
await using session = unstable_v2_createSession({ model })

// Turn 1
await session.send(input.prompt)
for await (const msg of session.receive()) { /* emit events */ }

// External message arrives (via Hub event subscription)
const injected = await waitForMessage()  // subscribes to session:message

// Turn 2
await session.send(injected)
for await (const msg of session.receive()) { /* emit events */ }

session.close()
```

### Flow Task Semantics

Within a single task, multiple send/receive cycles are internal:
```
task:start (id: "ask-user")
  ↓
session.send(prompt1)
session.receive() → emit agent:* events
  ↓
... session:message event arrives ...
  ↓
session.send(prompt2)
session.receive() → emit agent:* events
  ↓
task:complete (id: "ask-user")
```

All turns are within ONE task. Atomic unit preserved.

---

## Abstractions Impact

### REMOVE

| Abstraction | Location | Reason |
|-------------|----------|--------|
| `AgentInbox` | `protocol/agent.ts` | Session handles state |
| `AgentInboxImpl` | `engine/inbox.ts` | Not needed |
| `promptStream()` | `providers/claude.ts` | V2 uses send/receive |
| `messageStream()` | `providers/claude.ts` | V2 uses send/receive |
| `InjectedMessage` | `protocol/agent.ts` | Just `string` now |

### KEEP (Unchanged External API)

| Abstraction | Location | Notes |
|-------------|----------|-------|
| `Hub` | `protocol/hub.ts` | Central bus |
| `Hub.sendToRun()` | `protocol/hub.ts` | Now emits event |
| `NodeTypeDefinition` | `protocol/flow.ts` | External devs use this |
| `ChannelDefinition` | `protocol/channel.ts` | External devs use this |
| Event types | `protocol/events.ts` | Stable contract |

### MODIFY

| Abstraction | Location | Changes |
|-------------|----------|---------|
| `AgentExecuteContext` | `protocol/agent.ts` | Remove `inbox`, add `waitForMessage()` or Hub subscription |
| `AgentDefinition` | `protocol/agent.ts` | Signature simplifies |
| `claude.agent` node | `flow/nodes/claude.agent.ts` | Rewrite for V2 |
| `ClaudeProvider` | `providers/claude.ts` | Complete rewrite for V2 |

---

## Spec Conflicts to Resolve

### spec.md Line 152

> **Prohibited**: any `unstable_v2_*` APIs.

**Must change to**: Use `unstable_v2_createSession()`, `unstable_v2_resumeSession()`, `unstable_v2_prompt()` for V2 patterns.

### spec.md Lines 154-157

> Agent nodes must accept async-iterable prompts for multi-turn support.
> The prompt stream must yield initial messages, then yield new user messages from `AgentInbox`.

**Must change to**: Agent nodes use V2 session pattern. Multiple `send()`/`receive()` cycles replace async iterable input.

### spec.md Lines 165-168

> Multi-turn termination rules
> - Session-like agent nodes must stop on any of:
>   - `maxTurns`
>   - explicit close of the prompt stream (e.g., `inbox.close()`)

**Must change to**: Sessions close via `session.close()`. `maxTurns` is SDK-level config. No inbox close concept.

### agent.md (entire "Async prompt stream" section)

**Must rewrite**: Remove promptStream pattern, document V2 session pattern.

---

## Files to Change

### Code Changes

| File | Action | Notes |
|------|--------|-------|
| `src/protocol/agent.ts` | MODIFY | Remove AgentInbox, simplify context |
| `src/engine/inbox.ts` | DELETE | No longer needed |
| `src/engine/index.ts` | MODIFY | Remove inbox exports |
| `src/providers/claude.ts` | REWRITE | V2 session pattern |
| `src/flow/nodes/claude.agent.ts` | REWRITE | V2 integration |
| `src/flow/executor.ts` | MODIFY | Remove inbox creation |
| `src/engine/hub.ts` | MODIFY | sendToRun emits event |
| `src/index.ts` | MODIFY | Clean exports |

### Doc Changes

| File | Action | Notes |
|------|--------|-------|
| `spec.md` | MODIFY | Remove V2 prohibition, update multi-turn |
| `manifest.md` | MODIFY | Update Phase 4 deliverables |
| `docs/spec/agent.md` | REWRITE | Remove inbox, add V2 pattern |
| `docs/spec/hub.md` | MODIFY | Document sendToRun as event emission |
| `tutorials/lesson-09-*` | REWRITE | New multi-turn approach |
| `tutorials/lesson-06-*` | MODIFY | May need V2 adjustments |

---

## Implementation Order

1. **Update specs first** - Remove V2 prohibition, document new pattern
2. **Implement Hub change** - `sendToRun()` emits `session:message` event
3. **Rewrite Claude provider** - V2 session pattern
4. **Update claude.agent node** - Wire to new provider
5. **Delete inbox** - Remove `AgentInbox`, `AgentInboxImpl`
6. **Update tutorials** - Lesson 06, 09
7. **Run Phase 4 gates** - Validate everything works

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Use V2 SDK directly | Simpler, official API, eliminates async generator complexity |
| No wrapper abstraction | User preference: direct usage, accept instability |
| Unified Hub for messages | One mental model, architectural consistency |
| Messages as events | Fits existing Hub pattern, easy to test |
| Stop-restart within task | Preserves task atomicity, clean event semantics |

---

## Open Questions

1. **V2 stability** - API may change before stable release
2. **Resume semantics** - Do we need `resumeSession()` for long flows?
3. **Abort handling** - V2 has `.interrupt()`, need to test
4. **OpenCode parity** - Need to verify OpenCode can follow same pattern

---

## Continuation Prompt

```
You are working on the V2 SDK migration for the oh-feature-planning project.

Branch: flow-only-stack
Current phase: Phase 4 (Claude + Multi-Turn) blocked → now unblocked with V2 approach

Key documents:
- CONTEXT-SNAPSHOT.md (this file) - architectural decisions
- CHANGE-OUTLINE.md - detailed change list
- spec.md - needs updates to remove V2 prohibition
- manifest.md - needs Phase 4 deliverables update

Architecture change:
- Remove AgentInbox entirely
- Use V2 SDK: unstable_v2_createSession(), session.send(), session.receive()
- sendToRun() emits session:message event
- Agents subscribe to Hub events filtered by runId

First step: Update specs to allow V2 usage, then implement Hub changes.
```
