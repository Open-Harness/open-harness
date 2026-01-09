# Phase 5: Threaded Example Design

**Status:** DESIGN APPROVED
**Date:** 2026-01-08
**Domain:** Spec-to-Code Agent System (SpecKit)

---

## Executive Summary

A 7-level threaded example that builds from a simple Task Executor to a full 3-agent SpecKit system capable of transforming PRDs into implemented code with validation gates at every level.

**Key Differentiator:** Testing and evaluation are shown from Level 1, not as an afterthought.

---

## Critical Design Decision: Example as Golden Test

**The SpecKit example is not just documentation - it IS the integration test for Open Harness.**

### Why This Matters

1. **If the example breaks, the release is blocked** - Forces us to maintain working code
2. **Eat our own dog food** - If we can't build SpecKit with our API, users can't either
3. **Documentation stays in sync** - Tutorials link to real code, not outdated snippets
4. **Proves the DX works** - End-to-end validation of the entire framework

### Documentation Strategy

Tutorials don't contain code snippets - they **link to the example**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCUMENTATION                            │
├─────────────────────────────────────────────────────────────────┤
│  Tutorial Page              │  Links To                        │
│  ─────────────────────────────────────────────────────────────  │
│  "Getting Started"          │  examples/speckit/level-1/       │
│  "Adding State"             │  examples/speckit/level-2/       │
│  "Self-Validation Loops"    │  examples/speckit/level-3/       │
│  "Multi-Agent Harnesses"    │  examples/speckit/level-4/       │
│  "Full Agent Systems"       │  examples/speckit/level-5/       │
│  "Testing with Fixtures"    │  examples/speckit/level-6/       │
│  "CI/CD Integration"        │  examples/speckit/level-7/       │
└─────────────────────────────────────────────────────────────────┘
```

### Tutorial Format

Each tutorial page should:

1. **Explain the concept** - What are we learning?
2. **Link to the example** - "See the full implementation: [level-X/](link)"
3. **Walk through key code** - Embedded from the example (not duplicated)
4. **Show the test** - How to verify it works
5. **Run it yourself** - `bun test examples/speckit/level-X/`

### CI Integration

```yaml
# .github/workflows/release.yml
jobs:
  golden-test:
    name: SpecKit Golden Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun install
      - run: FIXTURE_MODE=replay bun test examples/speckit/
      # If this fails, release is blocked
```

**The example must pass before any release.**

---

## State Schema (Option B: Task Queue)

The harness uses a **task queue** pattern where the Spec Agent populates tasks, and the Coding/Reviewer agents process them sequentially.

```typescript
import { z } from 'zod'

// Task status tracks lifecycle
const TaskStatus = z.enum(['pending', 'in_progress', 'review', 'complete', 'failed'])

// Individual task from spec agent
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.number().int().min(1).max(5),
  complexity: z.enum(['simple', 'medium', 'complex']),
  acceptanceCriteria: z.array(z.string()),
  status: TaskStatus
})

// Full harness state
export const SpecKitStateSchema = z.object({
  // TASK QUEUE (populated by Spec Agent)
  tasks: z.array(TaskSchema),
  currentTaskIndex: z.number().int().min(0),

  // ITERATION TRACKING (used by edges)
  taskAttempts: z.record(z.string(), z.number()),
  currentAttempts: z.number().int().min(0),

  // OUTPUTS (written by agents, read by edges)
  coderOutput: z.object({
    code: z.string(),
    taskId: z.string(),
    status: z.enum(['complete', 'needs_revision', 'blocked']),
    selfValidation: z.object({
      passed: z.boolean(),
      issues: z.array(z.string())
    })
  }).nullable(),

  reviewerOutput: z.object({
    taskId: z.string(),
    approved: z.boolean(),
    issues: z.array(z.object({
      severity: z.enum(['blocker', 'major', 'minor']),
      description: z.string()
    }))
  }).nullable(),

  // METRICS
  metrics: z.object({
    tasksCompleted: z.number().int().min(0),
    tasksFailed: z.number().int().min(0),
    totalAttempts: z.number().int().min(0),
    totalReviews: z.number().int().min(0)
  })
})
```

**See full state design:** `SPECKIT_STATE_DESIGN.md`

---

## Edge Definitions (JSONata)

| Edge ID | From | To | JSONata Condition | maxIterations |
|---------|------|----|--------------------|---------------|
| `spec-to-coder` | spec | coder | *(always)* | - |
| `coder-retry` | coder | coder | `coderOutput.selfValidation.passed = false` | 3 |
| `coder-to-reviewer` | coder | reviewer | `coderOutput.selfValidation.passed = true` | - |
| `reviewer-reject` | reviewer | coder | `reviewerOutput.approved = false` | 2 |
| `next-task` | reviewer | coder | `reviewerOutput.approved = true and currentTaskIndex < $count(tasks) - 1` | - |

**Workflow ends when:** `reviewerOutput.approved = true` AND `currentTaskIndex = $count(tasks) - 1`

---

## The Full System (Level 7 Target)

```
                         START
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SPEC AGENT                             │
│  Input: PRD                                                 │
│  Output: tasks[] → state                                    │
│  Writes: tasks, currentTaskIndex = 0                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Edge: spec-to-coder (always)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     CODING AGENT                            │
│  Input: tasks[currentTaskIndex], previousAttempt?           │
│  Output: coderOutput { code, status, selfValidation }       │
│  Writes: coderOutput, currentAttempts++                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│ selfValidation.passed│      │ selfValidation.passed│
│      = false         │      │      = true          │
└──────────┬───────────┘      └──────────┬───────────┘
           │                             │
           │ Edge: coder-retry           │ Edge: coder-to-reviewer
           │ (maxIterations: 3)          │
           │                             │
           └─────► [CODING AGENT]        ▼
                                ┌─────────────────────────────┐
                                │      REVIEWER AGENT         │
                                │  Input: task, code          │
                                │  Output: reviewerOutput     │
                                └─────────────┬───────────────┘
                                              │
                          ┌───────────────────┴───────────────┐
                          │                                   │
                          ▼                                   ▼
                ┌──────────────────┐              ┌──────────────────┐
                │ approved = false │              │ approved = true  │
                └────────┬─────────┘              └────────┬─────────┘
                         │                                 │
                         │ Edge: reviewer-reject           │
                         │ (maxIterations: 2)              │
                         │                                 │
                         └─────► [CODING AGENT]            │
                                                           │
                          ┌────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│ currentTaskIndex <   │      │ currentTaskIndex =   │
│ $count(tasks) - 1    │      │ $count(tasks) - 1    │
│ (more tasks)         │      │ (last task)          │
└──────────┬───────────┘      └──────────┬───────────┘
           │                             │
           │ Edge: next-task             │
           │                             │
           └─────► [CODING AGENT]        ▼
                  (currentTaskIndex++)   END
```

---

## File Structure

```
examples/
└── speckit/
    ├── README.md                    # Tutorial overview
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    │
    ├── level-1/                     # Basic Task Executor
    │   ├── task-executor.ts         # Agent definition
    │   └── task-executor.test.ts    # Vitest test
    │
    ├── level-2/                     # Task Executor + State
    │   ├── task-executor.ts
    │   └── task-executor.test.ts
    │
    ├── level-3/                     # Coding Agent with Self-Validation
    │   ├── coding-agent.ts
    │   └── coding-agent.test.ts
    │
    ├── level-4/                     # Spec Agent + Coding Agent Harness
    │   ├── spec-agent.ts
    │   ├── coding-agent.ts
    │   ├── speckit-harness.ts
    │   └── speckit.test.ts
    │
    ├── level-5/                     # Full 3-Agent System
    │   ├── spec-agent.ts
    │   ├── coding-agent.ts
    │   ├── reviewer-agent.ts
    │   ├── speckit-harness.ts
    │   └── speckit.test.ts
    │
    ├── level-6/                     # Fixtures + Replay
    │   ├── agents/
    │   │   ├── spec-agent.ts
    │   │   ├── coding-agent.ts
    │   │   └── reviewer-agent.ts
    │   ├── speckit-harness.ts
    │   ├── speckit.test.ts
    │   └── fixtures/                # Pre-recorded fixtures
    │       └── simple-prd/
    │           ├── spec-agent/inv0.json
    │           ├── coding-agent/inv0.json
    │           └── reviewer-agent/inv0.json
    │
    └── level-7/                     # Model Comparison + CI Gates
        ├── agents/
        ├── speckit-harness.ts
        ├── speckit.test.ts
        ├── speckit.variants.test.ts # Model comparison tests
        ├── fixtures/
        └── .github/
            └── workflows/
                └── quality-gate.yml
```

---

## Level-by-Level Code

### Level 1: Basic Task Executor (~15 lines)

**Concept:** Create and run a single agent with structured output

**File:** `level-1/task-executor.ts`
```typescript
import { agent } from '@open-harness/core'
import { z } from 'zod'

/**
 * Task Executor Agent - Level 1
 *
 * Takes a task description and creates an implementation plan.
 * This is the simplest building block of the SpecKit system.
 */
export const taskExecutor = agent({
  prompt: `You are a task planning assistant.
Given a task description, create a clear implementation plan.
Be specific and actionable.`,
  output: {
    schema: z.object({
      plan: z.array(z.string()).describe('Step-by-step implementation plan'),
      confidence: z.number().min(0).max(1).describe('Confidence in the plan'),
      status: z.enum(['ready', 'needs_clarification']).describe('Whether the task is clear enough to implement')
    })
  }
})
```

**File:** `level-1/task-executor.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { run } from '@open-harness/core'
import { taskExecutor } from './task-executor'

describe('Task Executor - Level 1', () => {
  it('creates a plan for a clear task', async () => {
    const result = await run(taskExecutor, {
      prompt: 'Implement a function that validates email addresses'
    })

    // Structured assertions - no regex!
    expect(result.output.status).toBe('ready')
    expect(result.output.plan.length).toBeGreaterThan(0)
    expect(result.output.confidence).toBeGreaterThan(0.5)
  })

  it('identifies unclear tasks', async () => {
    const result = await run(taskExecutor, {
      prompt: 'Make it better'  // Vague task
    })

    expect(result.output.status).toBe('needs_clarification')
  })

  it('returns metrics', async () => {
    const result = await run(taskExecutor, {
      prompt: 'Add a login button'
    })

    expect(result.metrics.latencyMs).toBeGreaterThan(0)
    expect(result.metrics.tokens.input).toBeGreaterThan(0)
    expect(result.metrics.tokens.output).toBeGreaterThan(0)
  })
})
```

**Aha Moment:** "I can get structured, type-safe output from an LLM in 15 lines, and my tests are deterministic."

---

### Level 2: Task Executor + State (~25 lines)

**Concept:** Agents can maintain state across invocations

**File:** `level-2/task-executor.ts`
```typescript
import { agent } from '@open-harness/core'
import { z } from 'zod'

/**
 * Task Executor Agent - Level 2
 *
 * Now with state! Tracks how many tasks have been processed
 * and maintains a history of task types.
 */
export const taskExecutor = agent({
  prompt: `You are a task planning assistant.
Given a task description, create a clear implementation plan.

Context: You have processed {{state.tasksProcessed}} tasks so far.
Recent task types: {{state.taskTypeHistory}}`,

  // State persists across invocations
  state: {
    tasksProcessed: 0,
    taskTypeHistory: [] as string[],
    lastTaskConfidence: 0
  },

  output: {
    schema: z.object({
      plan: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      status: z.enum(['ready', 'needs_clarification']),
      taskType: z.enum(['feature', 'bug', 'refactor', 'docs', 'test']),
      // State update returned with output
      nextState: z.object({
        tasksProcessed: z.number(),
        taskTypeHistory: z.array(z.string()),
        lastTaskConfidence: z.number()
      })
    })
  }
})
```

**File:** `level-2/task-executor.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { run } from '@open-harness/core'
import { taskExecutor } from './task-executor'

describe('Task Executor - Level 2 (State)', () => {
  it('tracks tasks processed in state', async () => {
    // First invocation
    const result1 = await run(taskExecutor, {
      prompt: 'Add email validation'
    })

    expect(result1.output.taskType).toBe('feature')
    expect(result1.state?.tasksProcessed).toBe(1)

    // Second invocation with updated state
    const result2 = await run(taskExecutor, {
      prompt: 'Fix the login bug',
      state: result1.state  // Thread state through
    })

    expect(result2.output.taskType).toBe('bug')
    expect(result2.state?.tasksProcessed).toBe(2)
    expect(result2.state?.taskTypeHistory).toContain('feature')
    expect(result2.state?.taskTypeHistory).toContain('bug')
  })

  it('uses state context in responses', async () => {
    const result = await run(taskExecutor, {
      prompt: 'Refactor the auth module',
      state: {
        tasksProcessed: 10,
        taskTypeHistory: ['feature', 'feature', 'bug'],
        lastTaskConfidence: 0.9
      }
    })

    // Agent should reference the context
    expect(result.output.status).toBe('ready')
  })
})
```

**Aha Moment:** "State makes agents remember context - this is how conversations and workflows work."

---

### Level 3: Coding Agent with Self-Validation Loop (~40 lines)

**Concept:** Agents can self-validate and iterate

**File:** `level-3/coding-agent.ts`
```typescript
import { agent } from '@open-harness/core'
import { z } from 'zod'

/**
 * Coding Agent - Level 3
 *
 * Implements tasks with self-validation. Can revise its own output
 * until validation passes (or max iterations reached).
 */

const validationResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    suggestion: z.string().optional()
  }))
})

export const codingAgent = agent({
  prompt: `You are a coding agent that implements tasks and validates its own work.

Current task: {{input.task}}
Attempt: {{state.attempts}} of 3

{{#if state.lastValidation}}
Previous validation issues:
{{state.lastValidation.issues}}
Address these issues in your revision.
{{/if}}

Implement the task, then self-validate. Be critical of your own work.`,

  state: {
    attempts: 0,
    lastValidation: null as z.infer<typeof validationResultSchema> | null,
    implementedTasks: [] as string[]
  },

  output: {
    schema: z.object({
      code: z.string().describe('The implementation'),
      selfValidation: validationResultSchema,
      status: z.enum(['complete', 'needs_revision', 'blocked']),
      // State update
      nextState: z.object({
        attempts: z.number(),
        lastValidation: validationResultSchema.nullable(),
        implementedTasks: z.array(z.string())
      })
    })
  }
})
```

**File:** `level-3/coding-agent.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { run } from '@open-harness/core'
import { codingAgent } from './coding-agent'

describe('Coding Agent - Level 3 (Self-Validation Loop)', () => {
  it('completes a simple task on first try', async () => {
    const result = await run(codingAgent, {
      task: 'Create a function that adds two numbers'
    })

    expect(result.output.status).toBe('complete')
    expect(result.output.selfValidation.passed).toBe(true)
    expect(result.output.code).toContain('function')
  })

  it('iterates until validation passes', async () => {
    // Start with a complex task that might need revision
    let result = await run(codingAgent, {
      task: 'Create a secure password validator with strength scoring'
    })

    let iterations = 1
    const maxIterations = 3

    // Self-validation loop
    while (
      result.output.status === 'needs_revision' &&
      iterations < maxIterations
    ) {
      result = await run(codingAgent, {
        task: 'Create a secure password validator with strength scoring',
        state: result.state
      })
      iterations++
    }

    // Should eventually pass or reach max iterations
    expect(iterations).toBeLessThanOrEqual(maxIterations)
    if (result.output.status === 'complete') {
      expect(result.output.selfValidation.passed).toBe(true)
    }
  })

  it('tracks attempts in state', async () => {
    const result1 = await run(codingAgent, {
      task: 'Implement a rate limiter'
    })

    if (result1.output.status === 'needs_revision') {
      const result2 = await run(codingAgent, {
        task: 'Implement a rate limiter',
        state: result1.state
      })

      expect(result2.state?.attempts).toBe(2)
    }
  })
})
```

**Aha Moment:** "Agents can refine their own output until quality thresholds are met."

---

### Level 4: Spec Agent + Coding Agent Harness (~60 lines)

**Concept:** Multiple agents coordinated by a harness

**File:** `level-4/spec-agent.ts`
```typescript
import { agent } from '@open-harness/core'
import { z } from 'zod'

/**
 * Spec Agent - Takes a PRD and outputs structured tasks
 */

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['feature', 'bug', 'refactor', 'test']),
  priority: z.number().int().min(1).max(5),
  estimatedComplexity: z.enum(['simple', 'medium', 'complex']),
  acceptanceCriteria: z.array(z.string())
})

export const specAgent = agent({
  prompt: `You are a specification agent.
Given a PRD (Product Requirements Document), break it down into actionable tasks.

Each task should:
- Have clear acceptance criteria
- Be independently implementable
- Have accurate complexity estimates

PRD:
{{input.prd}}`,

  output: {
    schema: z.object({
      tasks: z.array(taskSchema),
      validationSummary: z.object({
        totalTasks: z.number(),
        byPriority: z.record(z.string(), z.number()),
        byComplexity: z.record(z.string(), z.number()),
        estimatedTotalEffort: z.enum(['hours', 'days', 'weeks'])
      }),
      status: z.enum(['complete', 'needs_more_context'])
    })
  }
})

export type Task = z.infer<typeof taskSchema>
```

**File:** `level-4/speckit-harness.ts`
```typescript
import { harness } from '@open-harness/core'
import { specAgent } from './spec-agent'
import { codingAgent } from './coding-agent'

/**
 * SpecKit Harness - Level 4
 *
 * Coordinates Spec Agent and Coding Agent.
 * Spec Agent breaks down PRD → Tasks, then Coding Agent implements them.
 *
 * State Design: Option B (Task Queue)
 * - Spec agent populates tasks[]
 * - Coding agent processes tasks[currentTaskIndex]
 * - Edge conditions use JSONata to reference state fields
 */
export const specKit = harness({
  agents: {
    spec: specAgent,
    coder: codingAgent
  },

  edges: [
    // Edge 1: Spec → Coder (always fires after spec completes)
    {
      id: 'spec-to-coder',
      from: 'spec',
      to: 'coder'
    },

    // Edge 2: Coder self-loop (retry on failed self-validation)
    // JSONata references coderOutput in state
    {
      id: 'coder-retry',
      from: 'coder',
      to: 'coder',
      when: 'coderOutput.selfValidation.passed = false',
      maxIterations: 3
    }
  ],

  // Shared state - subset of full schema for Level 4
  state: {
    // Task queue (populated by spec agent)
    tasks: [],
    currentTaskIndex: 0,

    // Iteration tracking
    currentAttempts: 0,

    // Coding agent output (read by edge conditions)
    coderOutput: null
  }
})
```

**File:** `level-4/speckit.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { run } from '@open-harness/core'
import { specKit } from './speckit-harness'

describe('SpecKit Harness - Level 4', () => {
  it('transforms PRD into implemented tasks', async () => {
    const result = await run(specKit, {
      prd: `
        Feature: User Authentication

        Users should be able to:
        1. Register with email and password
        2. Login with existing credentials
        3. Reset their password via email
      `
    })

    // Spec agent produced tasks
    expect(result.state?.tasks.length).toBeGreaterThan(0)

    // Coding agent implemented something
    expect(result.output.code).toBeDefined()

    // Metrics aggregated across both agents
    expect(result.metrics.tokens.input).toBeGreaterThan(0)
    expect(result.metrics.tokens.output).toBeGreaterThan(0)
  })

  it('respects max iterations for coding agent', async () => {
    const result = await run(specKit, {
      prd: 'Implement a complex distributed system' // Very hard task
    })

    // Should not exceed maxIterations
    expect(result.state?.totalIterations).toBeLessThanOrEqual(3)
  })
})
```

**Aha Moment:** "I can compose agents into pipelines declaratively."

---

### Level 5: Full 3-Agent System (~80 lines)

**Concept:** Milestone validation with Reviewer Agent

**File:** `level-5/reviewer-agent.ts`
```typescript
import { agent } from '@open-harness/core'
import { z } from 'zod'

/**
 * Reviewer Agent - Validates completed work against spec
 */
export const reviewerAgent = agent({
  prompt: `You are a code reviewer agent.

Review the implemented code against the original specification.

Original Tasks:
{{state.tasks}}

Implemented Code:
{{input.code}}

Acceptance Criteria to verify:
{{state.currentTask.acceptanceCriteria}}

Check for:
1. All acceptance criteria met
2. No TODO comments or incomplete sections
3. Code quality and best practices
4. Potential bugs or edge cases`,

  output: {
    schema: z.object({
      approved: z.boolean(),
      criteriaResults: z.array(z.object({
        criterion: z.string(),
        met: z.boolean(),
        notes: z.string().optional()
      })),
      issues: z.array(z.object({
        severity: z.enum(['blocker', 'major', 'minor']),
        description: z.string(),
        location: z.string().optional(),
        suggestion: z.string()
      })),
      summary: z.string()
    })
  }
})
```

**File:** `level-5/speckit-harness.ts`
```typescript
import { harness } from '@open-harness/core'
import { specAgent } from './spec-agent'
import { codingAgent } from './coding-agent'
import { reviewerAgent } from './reviewer-agent'

/**
 * SpecKit Harness - Level 5 (Full System)
 *
 * Complete 3-agent system with Option B (Task Queue) state design:
 * 1. Spec Agent: PRD → tasks[] in state
 * 2. Coding Agent: tasks[currentTaskIndex] → code (with self-validation loop)
 * 3. Reviewer Agent: code → approval (validates against spec)
 *
 * Edge conditions use JSONata to reference state fields:
 * - coderOutput.selfValidation.passed
 * - reviewerOutput.approved
 * - currentTaskIndex, $count(tasks)
 */
export const specKit = harness({
  agents: {
    spec: specAgent,
    coder: codingAgent,
    reviewer: reviewerAgent
  },

  edges: [
    // Edge 1: Spec → Coder (always fires)
    {
      id: 'spec-to-coder',
      from: 'spec',
      to: 'coder'
    },

    // Edge 2: Coder self-loop (retry on failed self-validation)
    {
      id: 'coder-retry',
      from: 'coder',
      to: 'coder',
      when: 'coderOutput.selfValidation.passed = false',
      maxIterations: 3
    },

    // Edge 3: Coder → Reviewer (self-validation passed)
    {
      id: 'coder-to-reviewer',
      from: 'coder',
      to: 'reviewer',
      when: 'coderOutput.selfValidation.passed = true'
    },

    // Edge 4: Reviewer → Coder (not approved, needs fixes)
    {
      id: 'reviewer-reject',
      from: 'reviewer',
      to: 'coder',
      when: 'reviewerOutput.approved = false',
      maxIterations: 2
    },

    // Edge 5: Reviewer → Coder (approved, process next task)
    {
      id: 'next-task',
      from: 'reviewer',
      to: 'coder',
      when: 'reviewerOutput.approved = true and currentTaskIndex < $count(tasks) - 1'
    }
    // Workflow ends when: approved = true AND currentTaskIndex = $count(tasks) - 1
  ],

  // Full state schema (Option B: Task Queue)
  state: {
    // Task queue (populated by spec agent)
    tasks: [],
    currentTaskIndex: 0,

    // Iteration tracking
    taskAttempts: {},
    currentAttempts: 0,

    // Agent outputs (read by edge conditions)
    coderOutput: null,
    reviewerOutput: null,

    // Aggregate metrics
    metrics: {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalAttempts: 0,
      totalReviews: 0
    }
  }
})
```

**File:** `level-5/speckit.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { run } from '@open-harness/core'
import { setupMatchers } from '@open-harness/vitest'
import { specKit } from './speckit-harness'

// Register custom matchers
setupMatchers()

describe('SpecKit - Level 5 (Full 3-Agent System)', () => {
  it('completes full PRD → Code → Review workflow', async () => {
    const result = await run(specKit, {
      prd: `
        Feature: Email Validation

        Implement a function that:
        1. Validates email format
        2. Checks for common domains
        3. Returns detailed validation results
      `
    })

    // Reviewer approved
    expect(result.output.approved).toBe(true)

    // All criteria met
    const unmetCriteria = result.output.criteriaResults.filter(c => !c.met)
    expect(unmetCriteria).toHaveLength(0)

    // No blocker issues
    const blockers = result.output.issues.filter(i => i.severity === 'blocker')
    expect(blockers).toHaveLength(0)
  })

  it('reviewer catches missing requirements', async () => {
    const result = await run(specKit, {
      prd: `
        Feature: Complex Validation System

        Must support:
        1. Credit card validation with Luhn algorithm
        2. Phone number validation for all countries
        3. Address validation with postal code lookup
        4. Name validation with unicode support
      `
    })

    // May not be approved on complex requirements
    if (!result.output.approved) {
      expect(result.output.issues.length).toBeGreaterThan(0)
      expect(result.state?.reviewHistory.length).toBeGreaterThan(0)
    }
  })

  it('meets performance requirements', async () => {
    const result = await run(specKit, {
      prd: 'Simple task: add two numbers function'
    })

    // Custom matchers from @open-harness/vitest
    expect(result).toHaveLatencyUnder(30000)  // < 30 seconds
    expect(result).toCostUnder(0.50)          // < $0.50
    expect(result).toHaveTokensUnder(10000)   // < 10k tokens total
  })
})
```

**Aha Moment:** "The full workflow with validation gates just works."

---

### Level 6: Fixtures + Replay (~60 lines test file)

**Concept:** Record and replay for deterministic testing

**File:** `level-6/speckit.test.ts`
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { run } from '@open-harness/core'
import { FileFixtureStore } from '@open-harness/stores'
import { setupMatchers } from '@open-harness/vitest'
import { specKit } from './speckit-harness'

setupMatchers()

// Fixture store for recordings
const store = new FileFixtureStore('./fixtures')

describe('SpecKit - Level 6 (Fixtures)', () => {
  // This test records or replays based on FIXTURE_MODE env var
  describe('simple-prd workflow', () => {
    const prdInput = {
      prd: `
        Feature: Email Validation
        Implement a function that validates email addresses.
      `
    }

    it('records the workflow', async () => {
      const result = await run(specKit, prdInput, {
        fixture: 'simple-prd',
        store
        // mode determined by FIXTURE_MODE env var
      })

      expect(result.output.approved).toBe(true)
    })

    it('produces consistent fixtures', async () => {
      // In replay mode, this uses the recorded fixture
      const result1 = await run(specKit, prdInput, {
        fixture: 'simple-prd',
        mode: 'replay',
        store
      })

      const result2 = await run(specKit, prdInput, {
        fixture: 'simple-prd',
        mode: 'replay',
        store
      })

      // Replayed results should be identical
      expect(result1.output).toEqual(result2.output)
      expect(result1.metrics.tokens).toEqual(result2.metrics.tokens)
    })
  })

  describe('complex-prd workflow', () => {
    const complexPrd = {
      prd: `
        Feature: User Authentication System

        1. User registration with email verification
        2. Login with rate limiting
        3. Password reset flow
        4. Session management
      `
    }

    it('handles complex PRDs', async () => {
      const result = await run(specKit, complexPrd, {
        fixture: 'complex-prd',
        store
      })

      expect(result.state?.tasks.length).toBeGreaterThan(3)
    })
  })
})
```

**CI Usage:**
```bash
# First run: Record fixtures
FIXTURE_MODE=record bun test

# CI: Replay fixtures (no API calls, deterministic)
FIXTURE_MODE=replay bun test

# Local development: Live mode (default)
bun test
```

**Aha Moment:** "I can test my agent workflows without hitting the API in CI."

---

### Level 7: Model Comparison + CI Gates (~80 lines)

**Concept:** Evaluate model variants and enforce quality gates

**File:** `level-7/speckit.variants.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { run, setDefaultProvider } from '@open-harness/core'
import { createClaudeNode } from '@open-harness/server'
import { FileFixtureStore } from '@open-harness/stores'
import { setupMatchers } from '@open-harness/vitest'
import { specKit } from './speckit-harness'

setupMatchers()

const store = new FileFixtureStore('./fixtures')

/**
 * Model Variant Testing
 *
 * Compare performance across Claude models:
 * - Opus: Best quality, highest cost
 * - Sonnet: Balanced quality/cost
 * - Haiku: Fastest, cheapest
 */
describe.each([
  { name: 'opus', model: 'claude-opus-4-5-20251101', maxCost: 2.00, maxLatency: 60000 },
  { name: 'sonnet', model: 'claude-sonnet-4-20250514', maxCost: 0.50, maxLatency: 30000 },
  { name: 'haiku', model: 'claude-haiku', maxCost: 0.10, maxLatency: 15000 }
])('SpecKit with $name', ({ name, model, maxCost, maxLatency }) => {

  const prdInput = {
    prd: `
      Feature: Email Validation
      Implement a function that validates email format.
    `
  }

  it(`${name}: completes workflow`, async () => {
    const result = await run(specKit, prdInput, {
      provider: createClaudeNode({ model }),
      fixture: `model-comparison/${name}`,
      store
    })

    expect(result.output.approved).toBe(true)
  })

  it(`${name}: meets cost threshold ($${maxCost})`, async () => {
    const result = await run(specKit, prdInput, {
      provider: createClaudeNode({ model }),
      fixture: `model-comparison/${name}`,
      mode: 'replay',
      store
    })

    expect(result).toCostUnder(maxCost)
  })

  it(`${name}: meets latency threshold (${maxLatency}ms)`, async () => {
    const result = await run(specKit, prdInput, {
      provider: createClaudeNode({ model }),
      fixture: `model-comparison/${name}`,
      mode: 'replay',
      store
    })

    expect(result).toHaveLatencyUnder(maxLatency)
  })
})

describe('Model Selection Recommendations', () => {
  it('identifies best model for cost', async () => {
    const results = await Promise.all([
      run(specKit, { prd: 'Simple task' }, { fixture: 'model-comparison/opus', mode: 'replay', store }),
      run(specKit, { prd: 'Simple task' }, { fixture: 'model-comparison/sonnet', mode: 'replay', store }),
      run(specKit, { prd: 'Simple task' }, { fixture: 'model-comparison/haiku', mode: 'replay', store })
    ])

    const cheapest = results.reduce((prev, curr) =>
      curr.metrics.cost < prev.metrics.cost ? curr : prev
    )

    console.log(`Cheapest model cost: $${cheapest.metrics.cost}`)
    expect(cheapest.output.approved).toBe(true)  // Quality still acceptable
  })
})
```

**File:** `level-7/.github/workflows/quality-gate.yml`
```yaml
name: SpecKit Quality Gates

on:
  pull_request:
    paths:
      - 'examples/speckit/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests with fixtures
        working-directory: examples/speckit/level-7
        run: FIXTURE_MODE=replay bun test

  quality-gate:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests with reporter
        working-directory: examples/speckit/level-7
        run: |
          FIXTURE_MODE=replay bun test --reporter=json > results.json

      - name: Check quality gates
        run: |
          # Parse results and check gates
          PASS_RATE=$(jq '.numPassedTests / .numTotalTests' results.json)
          if (( $(echo "$PASS_RATE < 0.95" | bc -l) )); then
            echo "❌ Pass rate $PASS_RATE < 0.95 threshold"
            exit 1
          fi
          echo "✅ Pass rate $PASS_RATE meets threshold"
```

**vitest.config.ts for Level 7:**
```typescript
import { defineConfig } from 'vitest/config'
import { OpenHarnessReporter } from '@open-harness/vitest'

export default defineConfig({
  test: {
    setupFiles: ['@open-harness/vitest/setup'],
    reporters: [
      'default',
      new OpenHarnessReporter({
        passRate: 0.95,        // 95% pass rate required
        maxLatencyMs: 60000,   // 60 second max
        maxCostUsd: 2.00       // $2 max per test
      })
    ]
  }
})
```

**Aha Moment:** "I can compare models systematically and enforce quality gates in CI."

---

## README Content

**File:** `examples/speckit/README.md`

```markdown
# SpecKit: Threaded Example

A progressive tutorial that builds from a simple Task Executor to a full 3-agent
system that transforms PRDs into implemented code.

## Quick Start

\`\`\`bash
cd examples/speckit
bun install
bun test level-1/
\`\`\`

## Levels

| Level | Concept | Run |
|-------|---------|-----|
| 1 | Basic agent + structured output | `bun test level-1/` |
| 2 | Agent with state | `bun test level-2/` |
| 3 | Self-validation loop | `bun test level-3/` |
| 4 | Multi-agent harness | `bun test level-4/` |
| 5 | Full 3-agent system | `bun test level-5/` |
| 6 | Fixtures + replay | `bun test level-6/` |
| 7 | Model comparison + CI | `bun test level-7/` |

## The Full System

By Level 7, you'll have built:

\`\`\`
PRD → Spec Agent → Coding Agent ↔ Self-Validation → Reviewer Agent → Approved Code
                                    (loop)
\`\`\`

## Recording Fixtures

\`\`\`bash
# Record new fixtures
FIXTURE_MODE=record bun test level-6/

# Replay in CI (no API calls)
FIXTURE_MODE=replay bun test level-6/
\`\`\`

## Model Comparison

\`\`\`bash
# Compare Opus vs Sonnet vs Haiku
bun test level-7/speckit.variants.test.ts
\`\`\`

## Learn More

- [Open Harness Documentation](https://open-harness.dev/docs)
- [API Reference](https://open-harness.dev/docs/reference/api)
- [Pattern Guides](https://open-harness.dev/docs/patterns)
```

---

## What Goes Where

| Content | Location | Rationale |
|---------|----------|-----------|
| SpecKit Tutorial (Levels 1-7) | `examples/speckit/` | Primary learning path, versioned with docs |
| Starter Template | `apps/starter-kit/` | Empty project template users clone |
| Pre-recorded Fixtures | `examples/speckit/level-6/fixtures/` | Enables instant CI without API keys |
| CI Workflow | `examples/speckit/level-7/.github/` | Shows production integration |

---

## Quality Gates

All levels must pass:

```bash
bun run typecheck              # Zero errors
bun run lint                   # Zero warnings
bun test examples/speckit/     # All tests pass
```

Level 6-7 specific:
```bash
FIXTURE_MODE=record bun test level-6/  # Creates fixtures
FIXTURE_MODE=replay bun test level-6/  # Replay works
FIXTURE_MODE=replay bun test level-7/  # Variant tests pass
```

---

## Success Criteria

### Golden Test Requirements (MUST PASS)

- [ ] `bun test examples/speckit/` passes with `FIXTURE_MODE=replay`
- [ ] All 7 levels execute without errors
- [ ] Pre-recorded fixtures are checked into git
- [ ] CI blocks release if example fails

### DX Requirements

- [ ] User can `bun install && bun test level-1/` and see passing tests
- [ ] Level 1 is < 15 lines and works
- [ ] Each level adds exactly ONE concept
- [ ] No regex assertions on LLM output
- [ ] Variant comparison is shown (Opus vs Sonnet vs Haiku)
- [ ] Fixtures work: `FIXTURE_MODE=record` then `FIXTURE_MODE=replay`
- [ ] OpenHarnessReporter shows pass rate and gates

### Documentation Requirements

- [ ] Each tutorial page links to corresponding example level
- [ ] Code shown in docs matches code in examples/ exactly
- [ ] README in examples/speckit/ is complete
- [ ] "Run it yourself" command works for each level

### User Validation (DX Audit)

- [ ] Fresh-eyes user follows tutorial from Level 1 → Level 7
- [ ] They can run each level successfully
- [ ] They say "I understand how this works"

---

## Next Steps

1. **Implement Level 1-2** - Basic agent + state (quick wins)
2. **Implement Level 3** - Self-validation loop (core pattern)
3. **Implement Level 4-5** - Harness coordination (key value prop)
4. **Implement Level 6** - Fixtures (differentiator)
5. **Implement Level 7** - Model comparison + CI (production-ready)
6. **Record fixtures** - Pre-record for instant CI
7. **DX Audit** - Fresh eyes test

---

*Design approved 2026-01-08*
