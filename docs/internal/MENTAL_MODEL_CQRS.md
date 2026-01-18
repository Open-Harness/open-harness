# Open Harness Mental Model: CQRS for AI Agent Workflows

> **Purpose**: Define how developers should think about the Open Harness SDK architecture.
> **Central Pattern**: Command Query Responsibility Segregation (CQRS)
> **Status**: Architectural Vision Document

---

## Executive Summary

Open Harness is a **reactive workflow engine for AI agents**. The core mental model borrows from event-driven architecture, specifically **CQRS** (Command Query Responsibility Segregation) and **Event Sourcing**.

Understanding these patterns is essential for:
- Building workflows that are debuggable and reproducible
- Avoiding common pitfalls (mixed concerns, tight coupling)
- Leveraging the SDK's strengths (signal replay, state projection)

---

## Part 1: CQRS Fundamentals

### What is CQRS?

**Command Query Responsibility Segregation** separates operations into two categories:

| Aspect | Commands | Queries |
|--------|----------|---------|
| **Intent** | Change the system | Read the system |
| **Side Effects** | Yes (mutations) | No (pure reads) |
| **Validation** | Required (can fail) | N/A |
| **Naming** | Imperative ("StartTask") | Descriptive ("getTask") |

### Why CQRS for AI Workflows?

AI agent workflows have unique requirements:

1. **Reproducibility**: You need to replay exact sequences for debugging
2. **Auditability**: Every decision should be traceable
3. **Parallelism**: Multiple agents may operate concurrently
4. **Recovery**: Long-running workflows need checkpoint/resume

CQRS + Event Sourcing provides all of these naturally.

---

## Part 2: The Signal Taxonomy

In Open Harness, "signals" are the communication primitive. But not all signals are equal. Understanding the taxonomy is critical.

### 2.1 Events (Facts - Past Tense)

Events describe **what happened**. They are:
- **Immutable**: Once emitted, never changed
- **Past tense**: "TaskCompleted", "PlanCreated"
- **Source of truth**: The event log IS the system history

```typescript
// ✅ Events - describe facts
"plan:created"      // A plan was created
"task:completed"    // A task finished
"milestone:passed"  // A milestone's acceptance test passed
"discovery:found"   // The coder discovered new work
```

**Key Insight**: Events should be named so that reading the log tells a story:
> "Plan was created, then Task T001 started, then Task T001 completed, then Task T001 was approved..."

### 2.2 Commands (Intent - Imperative)

Commands describe **what should happen**. They are:
- **Imperative**: "StartTask", "RetryTask"
- **Validated**: May fail if preconditions aren't met
- **Transient**: Not stored long-term (only events are)

```typescript
// ✅ Commands - express intent
"task:start"        // Please start this task
"task:retry"        // Please retry with fixes
"milestone:test"    // Please run acceptance test
"workflow:abort"    // Please stop the workflow
```

### 2.3 Current Anti-Pattern: Mixed Naming

The current SDK mixes event and command naming:

```typescript
// ❌ Current (ambiguous)
"task:ready"        // Is this a command to start? Or an event that it's ready?
"fix:required"      // Is this a command to fix? Or an event that fixes are needed?
```

**Recommendation**: Adopt explicit prefixes:

```typescript
// Proposed convention
"evt:task:completed"    // Event: task finished
"cmd:task:start"        // Command: please start task
"qry:task:status"       // Query: get task status (rare in signal systems)
```

Or use past/present tense consistently:
- Events: `task:completed`, `plan:created`, `review:passed`
- Commands: `task:start`, `review:request`, `milestone:test`

---

## Part 3: The Three Layers

Open Harness workflows have three conceptual layers. Each has distinct responsibilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 3: PROJECTIONS                        │
│                     (Derived State / Views)                     │
│                                                                 │
│  "What is the current state?"                                   │
│  • Computed from event stream                                   │
│  • Multiple views of same data                                  │
│  • Used for UI, queries, guards                                 │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ derives from
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 2: EVENT STORE                        │
│                     (Source of Truth)                           │
│                                                                 │
│  "What happened?"                                               │
│  • Append-only log of events                                    │
│  • Immutable history                                            │
│  • Enables replay, debugging, audit                             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ produces
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 1: COMMAND HANDLERS                   │
│                     (Agents + Process Managers)                 │
│                                                                 │
│  "What should happen?"                                          │
│  • Agents execute LLM calls                                     │
│  • Process managers orchestrate flow                            │
│  • Validate commands, emit events                               │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: Command Handlers (Agents & Orchestration)

**Agents** are command handlers that:
- Receive activation signals
- Execute LLM calls via harness
- Emit events describing outcomes

```typescript
// Conceptual agent behavior
const coderAgent = {
  activateOn: ["cmd:task:start"],

  async handle(command, ctx) {
    // Execute LLM
    const result = await ctx.harness.run(buildPrompt(command.taskId));

    // Emit event (fact about what happened)
    ctx.emit({
      type: "evt:task:completed",
      taskId: command.taskId,
      result
    });
  }
};
```

**Process Managers** orchestrate multi-step flows:
- React to events
- Emit commands for next steps
- Handle long-running sagas

```typescript
// Conceptual process manager
const workflowOrchestrator = {
  "evt:task:completed": (event, state) => {
    if (allMilestoneTasksComplete(state, event.milestoneId)) {
      return [{ type: "cmd:milestone:test", milestoneId: event.milestoneId }];
    }
    const next = getNextReadyTask(state);
    return next ? [{ type: "cmd:task:start", taskId: next.id }] : [];
  }
};
```

### Layer 2: Event Store (Source of Truth)

The event log is the **single source of truth**. Current state is derived, not stored.

```typescript
// The event store conceptually
const eventStore = [
  { type: "evt:plan:created", plan: {...}, timestamp: "..." },
  { type: "evt:task:started", taskId: "T001", timestamp: "..." },
  { type: "evt:task:completed", taskId: "T001", result: {...}, timestamp: "..." },
  { type: "evt:task:approved", taskId: "T001", timestamp: "..." },
  // ...
];
```

**Benefits**:
- **Replay**: Re-run events to reproduce any state
- **Debugging**: See exactly what happened
- **Audit**: Complete history for compliance
- **Time Travel**: Project state at any point in time

### Layer 3: Projections (Derived State)

State is **computed from events**, not mutated directly.

```typescript
// A projection function
function projectTaskState(events: Event[]): Map<string, Task> {
  const tasks = new Map<string, Task>();

  for (const event of events) {
    switch (event.type) {
      case "evt:plan:created":
        for (const task of event.plan.tasks) {
          tasks.set(task.id, { ...task, status: "pending" });
        }
        break;
      case "evt:task:started":
        tasks.set(event.taskId, {
          ...tasks.get(event.taskId)!,
          status: "in_progress"
        });
        break;
      case "evt:task:completed":
        tasks.set(event.taskId, {
          ...tasks.get(event.taskId)!,
          status: "awaiting_review",
          lastResult: event.result
        });
        break;
      // ...
    }
  }

  return tasks;
}
```

**Multiple Projections**: Same events, different views:

```typescript
const tasks = projectTaskState(events);       // Task-centric view
const milestones = projectMilestones(events); // Milestone-centric view
const timeline = projectTimeline(events);     // Chronological view
const metrics = projectMetrics(events);       // Analytics view
```

---

## Part 4: Reducers vs. Process Managers

### The Current Problem

In the current SDK, reducers do too much:

```typescript
// ❌ Current anti-pattern: reducer with side effects
export const taskCompleteReducer = (state, signal, ctx) => {
  // 1. Update state (correct)
  state.tasks[id].status = "complete";

  // 2. Business logic (wrong layer)
  if (hasDiscoveries(result)) {
    state.pendingDiscoveries.push(...discoveries);
  }

  // 3. Emit new signals (wrong layer!)
  ctx.emit(createSignal("task:approved", ...));

  // 4. More state updates (coupling)
  state.review.taskUnderReview = id;
};
```

This violates CQRS by mixing:
- State derivation (correct for reducers)
- Orchestration logic (should be process manager)
- Command emission (should be process manager)

### The CQRS Solution

**Reducers** (or "Projectors") should be **pure functions**:

```typescript
// ✅ Pure reducer - only derives state from events
function applyTaskCompleted(state: State, event: TaskCompletedEvent): State {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [event.taskId]: {
        ...state.tasks[event.taskId],
        status: "awaiting_review",
        lastResult: event.result
      }
    }
  };
}
```

**Process Managers** handle orchestration:

```typescript
// ✅ Process manager - decides what happens next
const taskCompletionSaga = {
  "evt:task:completed": (event, state) => {
    const commands = [];

    // Handle discoveries
    if (event.result.discoveries.length > 0) {
      commands.push({
        type: "cmd:discoveries:process",
        discoveries: event.result.discoveries
      });
    }

    // Request review
    commands.push({
      type: "cmd:review:request",
      taskId: event.taskId
    });

    return commands;
  }
};
```

---

## Part 5: Practical Mapping to Current SDK

### Current Concepts → CQRS Concepts

| Current SDK | CQRS Equivalent | Notes |
|-------------|-----------------|-------|
| `Signal` | Event or Command | Needs disambiguation by name |
| `SignalBus` | Event Bus | Good foundation |
| `Reducer` | Projector + Process Manager | Currently mixed, should split |
| `Agent` | Command Handler | Correct abstraction |
| `Harness` | External Service | Correct abstraction |
| `State` | Projection | Should be derived, not mutated |

### Migration Path

1. **Phase 1**: Adopt naming convention (evt:/cmd: prefixes)
2. **Phase 2**: Extract process managers from reducers
3. **Phase 3**: Make reducers pure (return new state, don't mutate)
4. **Phase 4**: Introduce formal event store

---

## Part 6: Design Principles

### Principle 1: Events are Facts, Commands are Requests

```typescript
// Events: past tense, describe what happened
"evt:task:completed"  // The task completed
"evt:plan:created"    // The plan was created

// Commands: imperative, describe what should happen
"cmd:task:start"      // Start the task
"cmd:plan:create"     // Create a plan
```

### Principle 2: State is Derived, Not Stored

```typescript
// ❌ Anti-pattern: storing derived state
state.execution.currentTask = state.planning.allTasks[taskId];

// ✅ Pattern: compute when needed
const currentTask = computed(() =>
  allTasks.value.get(currentTaskId.value)
);
```

### Principle 3: Side Effects Belong in Process Managers

```typescript
// ❌ Anti-pattern: side effects in reducer
const reducer = (state, event, ctx) => {
  state.x = event.data;
  ctx.emit(nextSignal);  // Side effect!
};

// ✅ Pattern: pure reducer + separate saga
const reducer = (state, event) => ({ ...state, x: event.data });
const saga = (event, state) => [{ type: "cmd:next", ... }];
```

### Principle 4: Agents are Autonomous Actors

Agents should:
- Have a single responsibility
- Not know about other agents
- Communicate only via events/commands
- Be replaceable/mockable

```typescript
// ✅ Autonomous agent
const reviewer = agent({
  activateOn: ["cmd:review:request"],
  async handle(cmd, ctx) {
    const decision = await ctx.harness.run(reviewPrompt);
    ctx.emit({ type: "evt:review:completed", decision });
  }
});
```

### Principle 5: The Event Log is the Source of Truth

```typescript
// ✅ Replay capability
async function replayWorkflow(eventLog: Event[]) {
  let state = initialState;
  for (const event of eventLog) {
    state = applyEvent(state, event);
  }
  return state;
}

// ✅ Time travel
async function stateAtTime(eventLog: Event[], timestamp: Date) {
  const eventsUpToTime = eventLog.filter(e => e.timestamp <= timestamp);
  return replayWorkflow(eventsUpToTime);
}
```

---

## Part 7: Glossary

| Term | Definition |
|------|------------|
| **Command** | A request to change the system. May fail validation. Imperative naming. |
| **Event** | A fact about what happened. Immutable. Past-tense naming. |
| **Query** | A request for information. No side effects. |
| **Projection** | A derived view of state computed from events. |
| **Reducer** | A pure function that applies an event to produce new state. |
| **Process Manager** | A component that reacts to events and emits commands. |
| **Saga** | A long-running process manager that handles multi-step workflows. |
| **Agent** | An autonomous actor that handles commands by executing LLM calls. |
| **Harness** | An adapter that executes LLM calls and emits streaming signals. |
| **Event Store** | An append-only log of all events. Source of truth. |

---

## Part 8: Quick Reference

### Signal Naming Convention

```
Events:   evt:<domain>:<past-tense-verb>
          evt:task:completed, evt:plan:created, evt:review:passed

Commands: cmd:<domain>:<imperative-verb>
          cmd:task:start, cmd:plan:create, cmd:review:request

Harness:  harness:<lifecycle>
          harness:start, harness:end, harness:error

Stream:   text:delta, text:complete, tool:call, tool:result
```

### Reducer Template

```typescript
// Pure reducer - no side effects
function applyEvent(state: State, event: Event): State {
  switch (event.type) {
    case "evt:task:completed":
      return {
        ...state,
        tasks: updateTask(state.tasks, event.taskId, {
          status: "awaiting_review",
          result: event.result
        })
      };
    default:
      return state;
  }
}
```

### Process Manager Template

```typescript
// Orchestration logic - emits commands
const processManager: Record<string, ProcessHandler> = {
  "evt:task:completed": (event, state) => {
    const commands = [];

    // Decide what happens next
    if (needsReview(state, event.taskId)) {
      commands.push({ type: "cmd:review:request", taskId: event.taskId });
    }

    return commands;
  }
};
```

### Agent Template

```typescript
// Autonomous command handler
const agent = createAgent({
  name: "coder",
  activateOn: ["cmd:task:start"],

  async handle(command, ctx) {
    // Execute LLM
    const result = await ctx.harness.run(prompt);

    // Emit result event
    ctx.emit({
      type: "evt:task:completed",
      taskId: command.taskId,
      result
    });
  }
});
```

---

## Conclusion

The Open Harness SDK is a powerful foundation for AI agent workflows. By adopting CQRS principles:

1. **Separate commands from events** - Clear intent vs. facts
2. **Keep reducers pure** - State derivation only
3. **Use process managers for orchestration** - Side effects isolated
4. **Treat the event log as source of truth** - Enable replay and debugging

This mental model provides a clear framework for building complex, multi-agent workflows that are debuggable, reproducible, and maintainable.

---

*Document Version: 1.0*
*Last Updated: 2026-01-18*
*Author: Architectural Analysis Session*
