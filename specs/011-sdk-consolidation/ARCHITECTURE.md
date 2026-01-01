# Open Harness Architecture

**Status**: Canonical Architecture Document
**Date**: 2025-12-28
**Purpose**: Visual map of current vs intended architecture

---

## Package Structure

### Current (Single Package - Mixed Concerns)

```
packages/
└── sdk/                              # 67 files, mixed concerns
    ├── src/
    │   ├── core/                     # DI + events (split across folders)
    │   ├── harness/                  # 26 files (6+ concerns)
    │   ├── providers/anthropic/      # Provider + specific agents
    │   ├── factory/                  # Creation utilities
    │   ├── monologue/                # Narrative system
    │   ├── callbacks/                # 2 files
    │   ├── workflow/                 # 2 files
    │   └── index.ts                  # 295 lines of exports
    └── prompts/                      # Duplicate prompts
```

### Intended (5 Packages - Clean Separation)

```
packages/
├── core/                             # @openharness/core (~10 files)
│   └── Interfaces, EventHub, Transport type, DI tokens
│
├── sdk/                              # @openharness/sdk (~30 files)
│   └── Runtime, factories, recording, monologue (NO transports)
│
├── anthropic/                        # @openharness/anthropic (~8 files)
│   └── AnthropicRunner, BaseAnthropicAgent, prompt system
│
├── transports/                       # @openharness/transports (~10+ files)
│   └── console, websocket, http, sse (all output destinations)
│
└── agents/                           # @openharness/agents (~10 files)
    └── CodingAgent, ReviewAgent, PlannerAgent, ParserAgent
```

**Design Principle**: SDK is pure runtime infrastructure with ZERO assumptions
about how you want to observe events. Even console output is a choice you make
explicitly by installing @openharness/transports. This keeps the SDK lean and
lets users control exactly what dependencies they bring in.

---

## Dependency Flow

### Current (Circular/Tangled)

```
┌─────────────────────────────────────────────────────────────┐
│                      packages/sdk                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                     src/core/                         │   │
│  │  container.ts ←───────────────────────────────────┐  │   │
│  │       ↓                                           │  │   │
│  │  tokens.ts ──────────────────────────────────────→│  │   │
│  │       ↓                                           │  │   │
│  │  unified-event-bus.ts                             │  │   │
│  │       ↓                                           │  │   │
│  │  unified-events/types.ts ←── RE-EXPORTS FROM ─────┼──┼───┤
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    src/harness/                       │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │  EVENTS     │  │  RENDERING  │  │  RUNTIME    │   │   │
│  │  │  (3 systems)│  │  (6 files)  │  │  (5 files)  │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │  UTILITIES  │  │  RECORDING  │  │  TYPES      │   │   │
│  │  │  (4 files)  │  │  (2 files)  │  │  (2 files)  │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  │                                                       │   │
│  │  event-context.ts ─── CANONICAL SOURCE ──────────────┼───┤
│  │       ↑                                               │   │
│  │       └──── unified-events/types.ts imports from here│   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              src/providers/anthropic/                 │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │                   agents/                        │ │   │
│  │  │  base-anthropic-agent.ts   ← SDK infrastructure  │ │   │
│  │  │  coding-agent.ts           ← SPECIFIC IMPL       │ │   │
│  │  │  review-agent.ts           ← SPECIFIC IMPL       │ │   │
│  │  │  planner-agent.ts          ← SPECIFIC IMPL       │ │   │
│  │  │  parser-agent.ts           ← SPECIFIC IMPL       │ │   │
│  │  │  *.prompt.md               ← PROMPTS BUNDLED     │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │                   runner/                        │ │   │
│  │  │  anthropic-runner.ts       ← SDK infrastructure  │ │   │
│  │  │  event-mapper.ts           ← SDK infrastructure  │ │   │
│  │  │  prompts.ts                ← Template registry   │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Intended (Clean Dependencies - 5 Packages)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        @openharness/core                            │
│                        (NO dependencies)                            │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │   interfaces/  │  │    events/     │  │      di/       │        │
│  │                │  │                │  │                │        │
│  │  IAgent        │  │  EventHub      │  │  Container     │        │
│  │  IRunner       │  │  Transport     │  │  Tokens        │        │
│  │  IEventBus     │  │  BaseEvent     │  │  Decorators    │        │
│  │  ICallbacks    │  │  EnrichedEvent │  │                │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────────┐
       │                            │                                │
       ▼                            ▼                                ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│                 │      │                     │      │                 │
│ @openharness/sdk│      │@openharness/anthropic│     │ @openharness/   │
│ (depends: core) │      │  (depends: core)    │      │   transports    │
│                 │      │                     │      │ (depends: core) │
│ ┌─────────────┐ │      │ ┌─────────────────┐ │      │                 │
│ │  harness/   │ │      │ │     runner/     │ │      │ ┌─────────────┐ │
│ │ Instance    │ │      │ │AnthropicRunner  │ │      │ │   console   │ │
│ │ TaskHarness │ │      │ │ event-mapper    │ │      │ │ formatting  │ │
│ │ control-flow│ │      │ └─────────────────┘ │      │ │ colors      │ │
│ │ state       │ │      │ ┌─────────────────┐ │      │ │ spinners    │ │
│ └─────────────┘ │      │ │   base-agent/   │ │      │ └─────────────┘ │
│ ┌─────────────┐ │      │ │BaseAnthropicAgt │ │      │ ┌─────────────┐ │
│ │ recording/  │ │      │ │ AgentRunOptions │ │      │ │  websocket  │ │
│ │ Recorder    │ │      │ └─────────────────┘ │      │ │ real-time   │ │
│ │ Vault       │ │      │ ┌─────────────────┐ │      │ │ bidirection │ │
│ └─────────────┘ │      │ │    prompts/     │ │      │ └─────────────┘ │
│ ┌─────────────┐ │      │ │ PromptRegistry  │ │      │ ┌─────────────┐ │
│ │  factory/   │ │      │ │ template loader │ │      │ │    http     │ │
│ │defineHarness│ │      │ └─────────────────┘ │      │ │ REST APIs   │ │
│ │ wrapAgent   │ │      │                     │      │ │ production  │ │
│ └─────────────┘ │      │                     │      │ └─────────────┘ │
│ ┌─────────────┐ │      │                     │      │ ┌─────────────┐ │
│ │ monologue/  │ │      │                     │      │ │     sse     │ │
│ │ Monologue   │◄├──────┤ (uses runner)      │      │ │ server-sent │ │
│ └─────────────┘ │      │                     │      │ └─────────────┘ │
│ ┌─────────────┐ │      │                     │      │                 │
│ │   utils/    │ │      │                     │      │                 │
│ │ async-queue │ │      │                     │      │                 │
│ │ backoff     │ │      │                     │      │                 │
│ └─────────────┘ │      │                     │      │                 │
│                 │      │                     │      │                 │
└─────────────────┘      └─────────────────────┘      └─────────────────┘
       │                            │                        │
       └────────────┬───────────────┘                        │
                    ▼                                        │
         ┌─────────────────────┐                             │
         │                     │                             │
         │ @openharness/agents │◄────────────────────────────┘
         │(depends: core, anth)│  (agents may use transports)
         │                     │
         │ ┌─────────────────┐ │
         │ │  coding-agent   │ │
         │ └─────────────────┘ │
         │ ┌─────────────────┐ │
         │ │  review-agent   │ │
         │ └─────────────────┘ │
         │ ┌─────────────────┐ │
         │ │  planner-agent  │ │
         │ └─────────────────┘ │
         │ ┌─────────────────┐ │
         │ │  parser-agent   │ │
         │ └─────────────────┘ │
         └─────────────────────┘
```

**Note**: SDK has NO transports - it only defines the runtime. ALL transport
implementations live in @openharness/transports.

---

## Event System Architecture

### Current (3 Incompatible Systems)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THREE EVENT SYSTEMS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SYSTEM A: event-protocol.ts (TaskHarness Domain)            │    │
│  │                                                              │    │
│  │ HarnessEvent = HarnessStartEvent | HarnessCompleteEvent     │    │
│  │              | PhaseStartEvent | PhaseCompleteEvent          │    │
│  │              | TaskStartEvent | TaskNarrativeEvent           │    │
│  │              | TaskCompleteEvent | TaskFailedEvent           │    │
│  │              | ValidationStartEvent | ValidationCompleteEvent│    │
│  │                                                              │    │
│  │ Used by: TaskHarness, BaseHarnessRenderer, ConsoleRenderer  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SYSTEM B: event-types.ts (Fluent Harness)                   │    │
│  │                                                              │    │
│  │ FluentHarnessEvent = PhaseEvent | TaskEvent | StepEvent     │    │
│  │                    | NarrativeEvent | ErrorEvent             │    │
│  │                    | RetryEvent | ParallelEvent              │    │
│  │                    | SessionEvent                            │    │
│  │                                                              │    │
│  │ Used by: HarnessInstance, control-flow helpers              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SYSTEM C: event-context.ts (Unified Event Bus) ← CANONICAL  │    │
│  │                                                              │    │
│  │ BaseEvent = HarnessStartEvent | HarnessCompleteEvent        │    │
│  │           | PhaseStartEvent | PhaseCompleteEvent             │    │
│  │           | TaskStartEvent | TaskCompleteEvent | TaskFailed  │    │
│  │           | AgentStartEvent | AgentThinkingEvent | AgentText │    │
│  │           | AgentToolStartEvent | AgentToolCompleteEvent     │    │
│  │           | AgentCompleteEvent | NarrativeEvent              │    │
│  │           | SessionPromptEvent | SessionReplyEvent           │    │
│  │           | SessionAbortEvent | ExtensionEvent               │    │
│  │                                                              │    │
│  │ Wrapped in: EnrichedEvent { id, timestamp, context, event } │    │
│  │ Used by: UnifiedEventBus, defineRenderer, processors        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ TYPE CONFLICTS                                               │    │
│  │                                                              │    │
│  │ NarrativeEvent:                                              │    │
│  │   A: { taskId, entry: NarrativeEntry }                      │    │
│  │   B: { agent, text, timestamp }                              │    │
│  │   C: { text, importance }                                    │    │
│  │                                                              │    │
│  │ SessionPromptEvent:                                          │    │
│  │   B: { promptId, prompt, choices?, timestamp }              │    │
│  │   C: { promptId, prompt, choices?, ...BaseEventPayload }    │    │
│  │                                                              │    │
│  │ PhaseStartEvent:                                             │    │
│  │   A: { phase, phaseNumber }                                  │    │
│  │   B: { phaseNumber, phase }                                  │    │
│  │   C: { type, ...BaseEventPayload }                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Intended (Single System)

System C (`event-context.ts`) becomes the canonical source, moved to `@openharness/core`.

---

## Transport Pattern (Pino-Inspired)

```
                    ┌─────────────────────────────────┐
                    │         HarnessInstance         │
                    │       (implements EventHub)     │
                    │                                 │
                    │  .attach(consoleTransport)      │
                    │  .attach(webSocketTransport)    │
                    │  .attach(metricsTransport)      │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │   Console    │  │  WebSocket   │  │   Metrics    │
         │  Transport   │  │  Transport   │  │  Transport   │
         │              │  │              │  │              │
         │ subscribe()  │  │ subscribe()  │  │ subscribe()  │
         │     ↓        │  │     ↓        │  │     ↓        │
         │ format →     │  │ serialize → │  │ aggregate → │
         │ console.log  │  │ ws.send()   │  │ prometheus  │
         └──────────────┘  └──────────────┘  └──────────────┘
                    │                │                │
                    ▼                ▼                ▼
               [stdout]         [network]       [monitoring]


// Usage:
import { defineHarness } from "@openharness/sdk";
import { consoleTransport, wsTransport } from "@openharness/transports";

const harness = defineHarness({ ... })
  .attach(consoleTransport({ colors: true }))
  .attach(wsTransport({ port: 8080 }));
```

---

## File Migration Map

### Phase 1: Create @openharness/core

```
FROM packages/sdk/src/           TO packages/core/src/
─────────────────────────────────────────────────────────

core/tokens.ts                →  di/tokens.ts
core/decorators.ts            →  di/decorators.ts
core/container.ts             →  di/container.ts

harness/event-context.ts      →  events/types.ts (CANONICAL)
core/unified-events/types.ts  →  events/types.ts (MERGE)
core/unified-events/filter.ts →  events/filter.ts

callbacks/types.ts            →  interfaces/callbacks.ts
providers/.../types.ts        →  interfaces/agent.ts (IAgent)
```

### Phase 2: Clean @openharness/sdk

```
FROM packages/sdk/src/           TO packages/sdk/src/
─────────────────────────────────────────────────────────

harness/harness-instance.ts   →  harness/instance.ts
harness/task-harness.ts       →  harness/task-harness.ts
harness/control-flow.ts       →  harness/control-flow.ts
harness/state.ts              →  harness/state.ts

harness/harness-recorder.ts   →  recording/recorder.ts
harness/replay-controller.ts  →  recording/controller.ts
core/replay-runner.ts         →  recording/runner.ts
core/vault.ts                 →  recording/vault.ts
core/recording-factory.ts     →  recording/factory.ts

harness/async-queue.ts        →  utils/async-queue.ts
harness/backoff.ts            →  utils/backoff.ts
harness/dependency-resolver.ts→  utils/dep-resolver.ts

factory/*                     →  factory/* (stays)
monologue/*                   →  monologue/* (stays)
workflow/*                    →  workflow/* (stays)

DELETE:
  harness/base-harness.ts      (unused)
  harness/agent.ts             (replaced by defineHarness)
  harness/composite-renderer.ts (replaced by .attach())
  harness/event-protocol.ts    (legacy, create adapter)
  harness/event-types.ts       (merge into core/events/)
  harness/base-renderer.ts     (legacy)
  harness/renderer-interface.ts (legacy)
  core/event-bus.ts            (legacy)
  core/unified-events/index.ts (re-exports only)
  dashboard/                   (empty)
```

### Phase 3: Create @openharness/transports

```
FROM packages/sdk/src/           TO packages/transports/src/
─────────────────────────────────────────────────────────

harness/define-renderer.ts    →  define.ts
harness/console-renderer.ts   →  console/index.ts
harness/session-context.ts    →  session/context.ts
harness/render-output.ts      →  utils/output.ts

NEW FILES:
  websocket/index.ts           (future)
  http/index.ts                (future)
  sse/index.ts                 (future)
```

### Phase 4: Create @openharness/anthropic

```
FROM packages/sdk/src/providers/anthropic/
TO   packages/anthropic/src/
─────────────────────────────────────────────

runner/anthropic-runner.ts    →  runner.ts
runner/event-mapper.ts        →  event-mapper.ts
runner/base-agent.ts          →  DELETE (replaced by below)

agents/base-anthropic-agent.ts→  base-agent.ts
agents/types.ts               →  types.ts
runner/prompts.ts             →  prompts/registry.ts
runner/models.ts              →  models.ts
```

### Phase 5: Create @openharness/agents

```
FROM packages/sdk/src/providers/anthropic/agents/
TO   packages/agents/src/
─────────────────────────────────────────────────

coding-agent.ts               →  coding/agent.ts
coder.prompt.md               →  coding/prompt.md

review-agent.ts               →  review/agent.ts
reviewer.prompt.md            →  review/prompt.md

planner-agent.ts              →  planner/agent.ts
planner.prompt.md             →  planner/prompt.md

parser-agent.ts               →  parser/agent.ts
(no prompt, uses schema)

validation-review-agent.ts    →  validation-review/agent.ts
```

---

## Import Changes

### Before (Current)

```typescript
// Everything from one package
import {
  defineHarness,
  wrapAgent,
  AnthropicRunner,
  CodingAgent,
  ReviewAgent,
  BaseEvent,
  defineRenderer,
  toAttachment,
} from "@openharness/sdk";
```

### After (Intended)

```typescript
// Core types (rarely imported directly)
import type { IAgent, EventHub, Transport } from "@openharness/core";

// SDK runtime (no transports!)
import { defineHarness, wrapAgent } from "@openharness/sdk";

// Transports (explicit choice)
import { consoleTransport, defineRenderer } from "@openharness/transports";

// Provider
import { AnthropicRunner, BaseAnthropicAgent } from "@openharness/anthropic";

// Pre-built agents (optional)
import { CodingAgent, ReviewAgent } from "@openharness/agents";
```

---

## Dead Code to Delete

| File | Reason |
|------|--------|
| `src/harness/base-harness.ts` | Abstract class, 0 imports |
| `src/harness/agent.ts` | Replaced by defineHarness |
| `src/harness/composite-renderer.ts` | Replaced by .attach() |
| `src/dashboard/` | Empty directory |
| `src/core/event-bus.ts` | Replaced by UnifiedEventBus |
| `src/providers/anthropic/runner/base-agent.ts` | Replaced by BaseAnthropicAgent |
| `src/harness/replay-controller.ts` | Never imported |

---

## Public API Surface (Post-Migration)

### @openharness/core

```typescript
// Interfaces
export type { IAgent, IRunner, IEventBus, ICallbacks };

// Events
export type { BaseEvent, EnrichedEvent, EventContext };
export type { EventHub, Transport, Unsubscribe };
export type { /* all event types */ };

// DI
export { createContainer, createTestContainer };
export { /* all tokens */ };
```

### @openharness/sdk

```typescript
// Factory
export { defineHarness, wrapAgent, createWorkflow };

// Harness
export { HarnessInstance, TaskHarness };
export { retry, parallel };

// Recording
export { HarnessRecorder, ReplayController, Vault };

// Monologue
export { Monologue };

// Utils
export { AsyncQueue, withBackoff, resolveDependencies };
```

### @openharness/transports

```typescript
// Factory
export { defineRenderer, toTransport };

// Built-in transports
export { consoleTransport } from "./console";
export { wsTransport } from "./websocket";       // future
export { httpTransport } from "./http";          // future
export { sseTransport } from "./sse";            // future

// Utilities
export { RenderOutput, SessionContext };
```

### @openharness/anthropic

```typescript
// Runner
export { AnthropicRunner };

// Agent base
export { BaseAnthropicAgent };
export type { AgentRunOptions };

// Prompts
export { PromptRegistry };

// Types
export type { AgentDefinition, RunnerOptions };
```

### @openharness/agents

```typescript
// Pre-built agents
export { CodingAgent, ReviewAgent, PlannerAgent, ParserAgent };
export { ValidationReviewAgent };

// Types
export type { CodingAgentOptions, ReviewAgentOptions };
export type { PlannerAgentOptions, PlannerResult };
```

---

## Implementation Order

1. **Phase 0: Documentation** (this file) ✓
2. **Phase 1: Create packages/core** with interfaces + events
3. **Phase 2: Clean packages/sdk** - move files, remove transports
4. **Phase 3: Create packages/transports** - extract all transports
5. **Phase 4: Create packages/anthropic** - extract provider
6. **Phase 5: Create packages/agents** - extract specific agents
7. **Phase 6: Update harnesses/coding** - test everything works
8. **Phase 7: Delete dead code**
9. **Phase 8: Update all documentation**

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| 5 packages: core, sdk, transports, anthropic, agents | Clean separation of concerns | 2025-12-28 |
| SDK has NO transports | SDK is pure runtime, transports are explicit choice | 2025-12-28 |
| Console transport in transports package | Even console is a choice, not assumed | 2025-12-28 |
| Move agents to separate package | Agents are implementations, not infrastructure | 2025-12-28 |
| Rename Transport→EventHub, Attachment→Transport | Follow Pino/Winston conventions | 2025-12-28 |
| event-context.ts is canonical | Broadest scope, EnrichedEvent wrapper, newest design | 2025-12-28 |
| Delete BaseHarness, Agent classes | Replaced by defineHarness pattern | 2025-12-28 |
