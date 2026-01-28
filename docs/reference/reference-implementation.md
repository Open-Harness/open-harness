# Core-v3 Scaffold Workflow: Long-Running Autonomous Coding

**Date**: 2026-01-23
**Status**: Design Phase
**Reference**: Cursor's GPT-5.2 browser project (scaling-agents blog)

---

## Overview

This spec defines a **Planner/Worker/Judge scaffold** for long-running autonomous coding tasks. Based on Cursor's learnings:

### What Failed (Cursor's Learnings)

| Approach | Problem |
|----------|---------|
| **Flat coordination** | 20 agents -> throughput of 2-3. Locks held too long, forgotten, or crashed. |
| **Optimistic concurrency** | No hierarchy = risk-averse. Agents avoided hard problems, made small safe changes. |
| **Integrator role** | Created bottlenecks. Workers handled conflicts themselves better. |

### What Works

| Pattern | Why |
|---------|-----|
| **Planner/Worker separation** | Planners explore + create tasks. Workers grind independently. |
| **Recursive planning** | Planners spawn sub-planners for areas. Parallel exploration. |
| **Judge cycles** | Evaluate progress, restart fresh. Prevents drift and tunnel vision. |
| **Fresh starts** | Each cycle starts clean. Combats accumulated confusion. |

---

## Architecture

```
                              +---------------------+
                              |   EventSubscriber   |
                              |  (React/Terminal)   |
                              +----------^----------+
                                         |
                                    SSE Stream
                                         |
+----------------------------------------+----------------------------------------+
|                              Open Scaffold Runtime                               |
|                                                                                  |
|  +--------------------------------------------------------------------------+   |
|  |                            EventBus (PubSub)                              |   |
|  |   Broadcasts: cycle:*, planning:*, worker:*, judge:*, tool:*, text:*      |   |
|  +--------------------------------------------------------------------------+   |
|         ^                    ^                    ^                              |
|         |                    |                    |                              |
|  +------+------+     +------+-------+    +------+------+                        |
|  |   PLANNER   |     |    WORKER    |    |    JUDGE    |                        |
|  |   Agent     |---->|    Agents    |--->|    Agent    |                        |
|  |             |     |              |    |             |                        |
|  |  Explores   |     |  Grinds on   |    |  Evaluates  |                        |
|  |  Creates    |     |  assigned    |    |  Decides    |                        |
|  |  tasks      |     |  tasks       |    |  continue   |                        |
|  |             |     |              |    |  or stop    |                        |
|  +-------------+     +--------------+    +-------------+                        |
|         |                    |                    |                              |
|         v                    v                    v                              |
|  +--------------------------------------------------------------------------+   |
|  |                            EventStore (Tape)                              |   |
|  |   Persists all events for replay, debugging, time-travel                  |   |
|  +--------------------------------------------------------------------------+   |
|                                                                                  |
+-------------------------------------------------------------------------- ------+
```

---

## Agent Definitions

### Planner Agent

```typescript
import { agent } from "@open-scaffold/core"
import { z } from "zod"

const planner = agent({
  name: "planner",
  model: "claude-sonnet-4-5",

  output: z.object({
    tasks: z.array(z.object({
      description: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      estimatedComplexity: z.number().min(1).max(10),
      scope: z.string(),
      dependencies: z.array(z.string()),
    })),
    subPlanners: z.array(z.object({
      scope: z.string(),
      reason: z.string(),
    })),
    planningComplete: z.boolean(),
  }),

  prompt: (state) => `
You are a PLANNER in a multi-agent coding system.

## Your Role
- Explore the codebase and understand what needs to be done
- Create specific, actionable tasks for Worker agents
- Spawn sub-planners for complex subsystems that need deep exploration
- DO NOT implement anything yourself

## Current Goal
${state.goal}

## Specification
${state.specification}

## Already Created Tasks
${state.taskQueue.map(t => \`- [\${t.priority}] \${t.description}\`).join("\\n")}

## Instructions
1. Explore the relevant parts of the codebase
2. Create tasks that are specific enough for a worker to complete independently
3. If an area is too complex, spawn a sub-planner for it
4. Set planningComplete=true when your scope is fully planned
`,

  update: (output, draft) => {
    for (const task of output.tasks) {
      draft.taskQueue.push({
        id: crypto.randomUUID(),
        description: task.description,
        priority: task.priority,
        status: "pending",
        scope: task.scope,
        dependencies: task.dependencies,
      })
    }
    if (output.planningComplete) {
      draft.cyclePhase = "working"
    }
  }
})
```

### Worker Agent

```typescript
const worker = agent({
  name: "worker",
  model: "claude-sonnet-4-5",

  output: z.object({
    outcome: z.enum(["success", "blocked", "needs-review"]),
    filesModified: z.array(z.string()),
    summary: z.string(),
    blockers: z.array(z.string()).optional(),
  }),

  prompt: (state) => `
You are a WORKER in a multi-agent coding system.

## Your Role
- Focus ONLY on your assigned task
- Implement the required changes
- DO NOT coordinate with other workers
- DO NOT take on additional tasks

## Your Assigned Task
${state.currentTask?.description}

## Instructions
1. Analyze what needs to be done for this specific task
2. Implement the changes using available tools
3. Test your changes if possible
4. Report completion with a clear summary
`,

  update: (output, draft) => {
    if (draft.currentTask) {
      draft.currentTask.status = output.outcome === "success" ? "completed" : "blocked"
    }
    draft.filesModified.push(...output.filesModified)
    if (output.blockers) {
      draft.blockers.push(...output.blockers)
    }
  }
})
```

### Judge Agent

```typescript
const judge = agent({
  name: "judge",
  model: "claude-sonnet-4-5",

  output: z.object({
    verdict: z.enum(["continue", "complete", "blocked"]),
    reason: z.string(),
    learnings: z.array(z.string()),
    nextCycleGuidance: z.string().optional(),
  }),

  prompt: (state) => `
You are a JUDGE in a multi-agent coding system.

## Your Role
- Evaluate the work completed in this cycle
- Decide whether to: continue (another cycle), complete (goal achieved), or blocked

## Current Goal
${state.goal}

## This Cycle's Work
Tasks completed: ${state.completedTasks.length}
Files modified: ${state.filesModified.length}

## Blockers Encountered
${state.blockers.join("\\n") || "None"}

## Instructions
Evaluate honestly:
1. Has the goal been achieved? If yes, verdict=complete
2. Is progress being made? If yes, verdict=continue
3. Are there unresolvable blockers? If yes, verdict=blocked
`,

  update: (output, draft) => {
    if (output.verdict === "complete") {
      draft.cyclePhase = "complete"
    } else if (output.verdict === "continue") {
      draft.currentCycle += 1
      draft.cyclePhase = "planning"
      draft.taskQueue = []
      draft.completedTasks = []
      draft.previousCycles.push({
        cycleNumber: draft.currentCycle - 1,
        verdict: output.verdict,
        learnings: output.learnings,
      })
    }
  }
})
```

---

## Workflow Definition

```typescript
import { workflow, phase } from "@open-scaffold/core"

const scaffoldWorkflow = workflow({
  name: "autonomous-coding-scaffold",

  initialState: {
    currentCycle: 1,
    cyclePhase: "planning" as "planning" | "working" | "judging" | "complete",
    goal: "",
    specification: "",
    taskQueue: [] as Task[],
    currentTask: null as Task | null,
    completedTasks: [] as Task[],
    filesModified: [] as string[],
    blockers: [] as string[],
    previousCycles: [] as CycleSummary[],
  },

  start: (input, draft) => {
    draft.goal = input
  },

  phases: {
    planning: { run: planner, next: "working" },
    working: { run: worker, next: "judging" },
    judging: { run: judge, next: "done" },
    done: phase.terminal()
  }
})
```

---

## Execution

```typescript
import { execute, run } from "@open-scaffold/core"

// Async iterator API
const execution = execute(scaffoldWorkflow, {
  input: "Build a browser rendering engine",
  providers: { "claude-sonnet-4-5": anthropicProvider }
})

for await (const event of execution) {
  console.log(event.name, event.payload)
}

// Or Promise API with observer
const result = await run(scaffoldWorkflow, {
  input: "Build a browser rendering engine",
  observer: {
    stateChanged: (state) => console.log("Cycle:", state.currentCycle, "Phase:", state.cyclePhase),
    phaseChanged: (phase) => console.log("Phase:", phase),
  }
})
```

---

## Next Steps

1. **Add EventSubscriber service** to the spec
2. **Create architecture diagrams** with Mermaid
3. **Build TDD fixtures** by running simple cycles
4. **Implement layers** incrementally with tests

---

## Open Questions

1. **Worker parallelism**: How many workers run concurrently? Dynamic based on task queue?
2. **Sub-planner depth**: Maximum recursion depth for planners?
3. **Cycle timeout**: Maximum time per cycle before forcing judge evaluation?
4. **Conflict resolution**: If workers modify same file, who wins?
