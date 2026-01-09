# SpecKit State & Edge Design

**Design Choice:** Option B - Task Queue State (Multiple Tasks)
**Date:** 2026-01-08

---

## State Schema

```typescript
import { z } from 'zod'

/**
 * Task status enum - tracks lifecycle of each task
 */
const TaskStatus = z.enum([
  'pending',      // Not yet started
  'in_progress',  // Coding agent working on it
  'review',       // Sent to reviewer
  'complete',     // Approved by reviewer
  'failed'        // Max attempts exceeded
])

/**
 * Individual task from spec agent
 */
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.number().int().min(1).max(5),
  complexity: z.enum(['simple', 'medium', 'complex']),
  acceptanceCriteria: z.array(z.string()),
  status: TaskStatus
})

/**
 * Harness State Schema - the single source of truth
 */
export const SpecKitStateSchema = z.object({
  // ─────────────────────────────────────────────────────────────
  // TASK QUEUE (populated by Spec Agent)
  // ─────────────────────────────────────────────────────────────

  /** All tasks extracted from PRD */
  tasks: z.array(TaskSchema),

  /** Index of current task being processed (0-based) */
  currentTaskIndex: z.number().int().min(0),

  // ─────────────────────────────────────────────────────────────
  // ITERATION TRACKING (used by edges)
  // ─────────────────────────────────────────────────────────────

  /** Attempts per task: { [taskId]: attemptCount } */
  taskAttempts: z.record(z.string(), z.number()),

  /** Current task's self-validation attempt count */
  currentAttempts: z.number().int().min(0),

  // ─────────────────────────────────────────────────────────────
  // OUTPUTS (written by agents, read by edges)
  // ─────────────────────────────────────────────────────────────

  /** Last coding agent output */
  coderOutput: z.object({
    code: z.string(),
    taskId: z.string(),
    status: z.enum(['complete', 'needs_revision', 'blocked']),
    selfValidation: z.object({
      passed: z.boolean(),
      issues: z.array(z.string())
    })
  }).nullable(),

  /** Last reviewer output */
  reviewerOutput: z.object({
    taskId: z.string(),
    approved: z.boolean(),
    issues: z.array(z.object({
      severity: z.enum(['blocker', 'major', 'minor']),
      description: z.string()
    }))
  }).nullable(),

  // ─────────────────────────────────────────────────────────────
  // AGGREGATE METRICS
  // ─────────────────────────────────────────────────────────────

  metrics: z.object({
    tasksCompleted: z.number().int().min(0),
    tasksFailed: z.number().int().min(0),
    totalAttempts: z.number().int().min(0),
    totalReviews: z.number().int().min(0)
  })
})

export type SpecKitState = z.infer<typeof SpecKitStateSchema>
export type Task = z.infer<typeof TaskSchema>
```

---

## Initial State

```typescript
const initialState: SpecKitState = {
  tasks: [],
  currentTaskIndex: 0,
  taskAttempts: {},
  currentAttempts: 0,
  coderOutput: null,
  reviewerOutput: null,
  metrics: {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalAttempts: 0,
    totalReviews: 0
  }
}
```

---

## Agent Contracts

### 1. Spec Agent

**Purpose:** Transform PRD into structured task queue

```typescript
// INPUT (from user)
type SpecAgentInput = {
  prd: string  // Product Requirements Document
}

// OUTPUT (written to state)
type SpecAgentOutput = {
  tasks: Task[]
  summary: {
    totalTasks: number
    byPriority: Record<string, number>
    estimatedComplexity: 'hours' | 'days' | 'weeks'
  }
}

// STATE MUTATIONS
// - Writes: tasks[], currentTaskIndex = 0
// - Reads: nothing
```

### 2. Coding Agent

**Purpose:** Implement current task with self-validation

```typescript
// INPUT (from state)
type CodingAgentInput = {
  task: Task                           // tasks[currentTaskIndex]
  previousAttempt: string | null       // coderOutput.code if retry
  previousIssues: string[] | null      // coderOutput.selfValidation.issues if retry
  attemptNumber: number                // currentAttempts
}

// OUTPUT (written to state)
type CodingAgentOutput = {
  code: string
  taskId: string
  status: 'complete' | 'needs_revision' | 'blocked'
  selfValidation: {
    passed: boolean
    issues: string[]
  }
}

// STATE MUTATIONS
// - Writes: coderOutput, currentAttempts++, taskAttempts[taskId]++
// - Reads: tasks[currentTaskIndex], currentAttempts, coderOutput (if retry)
```

### 3. Reviewer Agent

**Purpose:** Validate completed task against acceptance criteria

```typescript
// INPUT (from state)
type ReviewerAgentInput = {
  task: Task                    // tasks[currentTaskIndex]
  code: string                  // coderOutput.code
  acceptanceCriteria: string[]  // task.acceptanceCriteria
}

// OUTPUT (written to state)
type ReviewerAgentOutput = {
  taskId: string
  approved: boolean
  issues: Array<{
    severity: 'blocker' | 'major' | 'minor'
    description: string
  }>
  criteriaResults: Array<{
    criterion: string
    met: boolean
  }>
}

// STATE MUTATIONS
// - Writes: reviewerOutput, metrics.totalReviews++
// - If approved: tasks[currentTaskIndex].status = 'complete', metrics.tasksCompleted++
// - If not approved: tasks[currentTaskIndex].status = 'in_progress'
// - Reads: tasks[currentTaskIndex], coderOutput
```

---

## Edge Definitions with JSONata

```typescript
const edges: EdgeDefinition[] = [
  // ─────────────────────────────────────────────────────────────
  // EDGE 1: Spec → Coder (always, starts the workflow)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'spec-to-coder',
    from: 'spec',
    to: 'coder'
    // No condition - always fires after spec completes
  },

  // ─────────────────────────────────────────────────────────────
  // EDGE 2: Coder self-loop (needs revision)
  // Fires when: self-validation failed AND under max attempts
  // ─────────────────────────────────────────────────────────────
  {
    id: 'coder-retry',
    from: 'coder',
    to: 'coder',
    when: 'coderOutput.selfValidation.passed = false',
    maxIterations: 3
  },

  // ─────────────────────────────────────────────────────────────
  // EDGE 3: Coder → Reviewer (self-validation passed)
  // Fires when: self-validation passed
  // ─────────────────────────────────────────────────────────────
  {
    id: 'coder-to-reviewer',
    from: 'coder',
    to: 'reviewer',
    when: 'coderOutput.selfValidation.passed = true'
  },

  // ─────────────────────────────────────────────────────────────
  // EDGE 4: Reviewer → Coder (not approved, needs fixes)
  // Fires when: reviewer rejected
  // ─────────────────────────────────────────────────────────────
  {
    id: 'reviewer-reject',
    from: 'reviewer',
    to: 'coder',
    when: 'reviewerOutput.approved = false',
    maxIterations: 2  // Max 2 review cycles per task
  },

  // ─────────────────────────────────────────────────────────────
  // EDGE 5: Reviewer → Coder (approved, next task)
  // Fires when: approved AND more tasks remain
  // ─────────────────────────────────────────────────────────────
  {
    id: 'next-task',
    from: 'reviewer',
    to: 'coder',
    when: 'reviewerOutput.approved = true and currentTaskIndex < $count(tasks) - 1'
  }

  // ─────────────────────────────────────────────────────────────
  // IMPLICIT: Workflow ends when:
  // - reviewerOutput.approved = true AND currentTaskIndex = $count(tasks) - 1
  // - OR max iterations exceeded on any edge
  // ─────────────────────────────────────────────────────────────
]
```

---

## Flow Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      START                              │
                    └─────────────────────────┬───────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                    SPEC AGENT                           │
                    │  Input: PRD                                             │
                    │  Output: tasks[] populated in state                     │
                    └─────────────────────────┬───────────────────────────────┘
                                              │
                                              │ Edge 1: spec-to-coder (always)
                                              ▼
              ┌───────────────────────────────────────────────────────────────────┐
              │                                                                   │
              │  ┌─────────────────────────────────────────────────────────────┐  │
              │  │                    CODING AGENT                             │  │
              │  │  Input: tasks[currentTaskIndex], previousAttempt?           │  │
              │  │  Output: coderOutput { code, status, selfValidation }       │  │
              │  └─────────────────────────┬───────────────────────────────────┘  │
              │                            │                                      │
              │            ┌───────────────┴───────────────┐                      │
              │            │                               │                      │
              │            ▼                               ▼                      │
              │  ┌─────────────────────┐       ┌─────────────────────┐            │
              │  │ selfValidation.passed│       │ selfValidation.passed│           │
              │  │      = false         │       │      = true          │           │
              │  └──────────┬──────────┘       └──────────┬──────────┘            │
              │             │                             │                       │
              │             │ Edge 2: coder-retry         │ Edge 3: coder-to-reviewer
              │             │ (maxIterations: 3)          │                       │
              │             │                             │                       │
              │             └──────────┐                  │                       │
              │                        │                  │                       │
              │                        ▼                  │                       │
              │               [Loop back to               │                       │
              │                CODING AGENT]              │                       │
              │                                           │                       │
              └───────────────────────────────────────────┼───────────────────────┘
                                                          │
                                                          ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                   REVIEWER AGENT                        │
                    │  Input: task, coderOutput.code                          │
                    │  Output: reviewerOutput { approved, issues }            │
                    └─────────────────────────┬───────────────────────────────┘
                                              │
                          ┌───────────────────┴───────────────────┐
                          │                                       │
                          ▼                                       ▼
                ┌─────────────────────┐               ┌─────────────────────┐
                │ approved = false    │               │ approved = true     │
                └──────────┬──────────┘               └──────────┬──────────┘
                           │                                     │
                           │ Edge 4: reviewer-reject             │
                           │ (maxIterations: 2)                  │
                           │                                     │
                           └──────────┐                          │
                                      │                          │
                                      ▼                          │
                           [Loop back to                         │
                            CODING AGENT]                        │
                                                                 │
                          ┌──────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│ currentTaskIndex <  │       │ currentTaskIndex =  │
│ $count(tasks) - 1   │       │ $count(tasks) - 1   │
│ (more tasks)        │       │ (last task)         │
└──────────┬──────────┘       └──────────┬──────────┘
           │                             │
           │ Edge 5: next-task           │
           │                             │
           └──────────┐                  │
                      │                  │
                      ▼                  ▼
           [Loop back to          ┌─────────────────┐
            CODING AGENT          │      END        │
            with currentTaskIndex │  (all tasks     │
            incremented]          │   complete)     │
                                  └─────────────────┘
```

---

## State Transitions

### After Spec Agent

```typescript
// Before
state = { tasks: [], currentTaskIndex: 0, ... }

// After
state = {
  tasks: [
    { id: 'T001', title: 'Validate email', status: 'pending', ... },
    { id: 'T002', title: 'Hash password', status: 'pending', ... },
    { id: 'T003', title: 'Create session', status: 'pending', ... }
  ],
  currentTaskIndex: 0,
  ...
}
```

### After Coding Agent (Self-Validation Failed)

```typescript
// Before
state = { currentTaskIndex: 0, currentAttempts: 0, coderOutput: null, ... }

// After
state = {
  currentTaskIndex: 0,
  currentAttempts: 1,
  coderOutput: {
    taskId: 'T001',
    code: '// attempt 1...',
    status: 'needs_revision',
    selfValidation: {
      passed: false,
      issues: ['Missing input validation', 'No error handling']
    }
  },
  taskAttempts: { 'T001': 1 },
  metrics: { totalAttempts: 1, ... }
}
```

### After Coding Agent (Self-Validation Passed)

```typescript
// After
state = {
  currentTaskIndex: 0,
  currentAttempts: 2,
  coderOutput: {
    taskId: 'T001',
    code: '// attempt 2 - fixed...',
    status: 'complete',
    selfValidation: {
      passed: true,
      issues: []
    }
  },
  tasks: [
    { id: 'T001', status: 'review', ... },  // Updated to 'review'
    ...
  ],
  ...
}
```

### After Reviewer (Approved)

```typescript
// After
state = {
  currentTaskIndex: 1,  // Incremented to next task
  currentAttempts: 0,   // Reset for new task
  coderOutput: null,    // Cleared for new task
  reviewerOutput: {
    taskId: 'T001',
    approved: true,
    issues: []
  },
  tasks: [
    { id: 'T001', status: 'complete', ... },  // Updated to 'complete'
    { id: 'T002', status: 'pending', ... },   // Next task
    ...
  ],
  metrics: {
    tasksCompleted: 1,
    totalReviews: 1,
    ...
  }
}
```

---

## JSONata Expression Reference

| Expression | Returns | Used In |
|------------|---------|---------|
| `coderOutput.selfValidation.passed = false` | boolean | Edge 2 (coder-retry) |
| `coderOutput.selfValidation.passed = true` | boolean | Edge 3 (coder-to-reviewer) |
| `reviewerOutput.approved = false` | boolean | Edge 4 (reviewer-reject) |
| `reviewerOutput.approved = true` | boolean | Edge 5 (next-task) |
| `currentTaskIndex < $count(tasks) - 1` | boolean | Edge 5 (more tasks?) |
| `$count(tasks)` | number | Task count |

---

## Testing the Design

### Edge Condition Tests

```typescript
describe('Edge Conditions', () => {
  it('coder-retry fires when self-validation fails', () => {
    const state = {
      coderOutput: {
        selfValidation: { passed: false, issues: ['error'] }
      }
    }
    expect(evaluateJSONata('coderOutput.selfValidation.passed = false', state)).toBe(true)
  })

  it('next-task fires when approved and more tasks', () => {
    const state = {
      reviewerOutput: { approved: true },
      currentTaskIndex: 0,
      tasks: [{}, {}, {}]  // 3 tasks
    }
    expect(evaluateJSONata('reviewerOutput.approved = true and currentTaskIndex < $count(tasks) - 1', state)).toBe(true)
  })

  it('workflow ends when all tasks complete', () => {
    const state = {
      reviewerOutput: { approved: true },
      currentTaskIndex: 2,
      tasks: [{}, {}, {}]  // 3 tasks, on last one
    }
    // No edge fires - currentTaskIndex (2) is NOT < $count(tasks) - 1 (2)
    expect(evaluateJSONata('currentTaskIndex < $count(tasks) - 1', state)).toBe(false)
  })
})
```

---

## Level Mapping

| Level | State Fields Used | Edges Used |
|-------|-------------------|------------|
| **1-2** | None (single agent) | None |
| **3** | `currentAttempts`, `coderOutput` | Edge 2 (self-loop) |
| **4** | + `tasks[]`, `currentTaskIndex` | + Edge 1, 3 |
| **5** | + `reviewerOutput`, `taskAttempts` | + Edge 4, 5 |
| **6-7** | + `metrics` (full state) | All edges |

---

*Design complete: Option B - Task Queue State*
