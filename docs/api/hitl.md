# Human-in-the-Loop (HITL) Guide

**How to pause workflows for human input and resume execution.**

This guide covers the HITL system as specified in [ADR-002](../plans/adr/002-hitl-architecture.md). HITL allows workflows to pause at specific points, request human input (approval, choice, or feedback), and continue based on the response.

---

## Table of Contents

1. [Overview](#overview)
2. [Two Input Types](#two-input-types)
3. [Defining HITL on Phases](#defining-hitl-on-phases)
4. [Conditional HITL](#conditional-hitl)
5. [Processing Responses](#processing-responses)
6. [Routing Based on Response](#routing-based-on-response)
7. [Handler API](#handler-api)
8. [Built-in Handlers](#built-in-handlers)
9. [Event Flow](#event-flow)
10. [React Integration](#react-integration)
11. [Complete Examples](#complete-examples)

---

## Overview

HITL enables human oversight at any point in a workflow. Common use cases:

| Use Case | Example |
|----------|---------|
| **Approval gates** | Review a plan before execution |
| **Quality control** | Verify agent output meets standards |
| **Decision points** | Choose between multiple approaches |
| **Feedback loops** | Provide corrections for agent to incorporate |
| **Compliance** | Human sign-off required by policy |

The HITL system is **inline on phases** -- you configure human input as part of a phase definition, not as a separate phase. This keeps workflows compact and clearly associates human input with the preceding agent work.

---

## Two Input Types

Per ADR-002, there are exactly two input types:

| Type | Description | Handler Method | Response |
|------|-------------|----------------|----------|
| `approval` | Yes/No decision | `handler.approval(prompt)` | `boolean` |
| `choice` | Pick from options | `handler.choice(prompt, options)` | `string` (selected option) |

For freeform text input, use `choice` with an "Other..." option that allows custom input.

---

## Defining HITL on Phases

Add a `human` field to any phase to request human input:

### Static Configuration

```typescript
import { workflow, phase } from "@open-scaffold/core"

const myWorkflow = workflow({
  name: "approval-workflow",
  initialState: { plan: "", approved: false },
  start: (input, draft) => { draft.plan = input },
  phases: {
    review: {
      // No agent -- pure human phase
      human: {
        prompt: "Do you approve this plan?",
        type: "approval"
      },
      onResponse: (response, draft) => {
        draft.approved = response === "yes"
      },
      next: (state) => state.approved ? "execute" : "revise"
    },
    revise: { run: reviserAgent, next: "review" },
    execute: { run: executorAgent, next: "done" },
    done: phase.terminal()
  }
})
```

### Dynamic Prompt from State

The `prompt` can be a function that receives state:

```typescript
human: {
  prompt: (state) => `
    Review the following plan:

    ${state.plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

    Do you approve?
  `,
  type: "approval"
}
```

### Choice with Dynamic Options

For `choice` type, provide `options`:

```typescript
human: {
  prompt: "Which deployment strategy?",
  type: "choice",
  options: ["Blue-Green", "Canary", "Rolling", "Recreate"]
}

// Or dynamic options from state:
human: {
  prompt: "Select a task to prioritize:",
  type: "choice",
  options: (state) => state.tasks.map(t => t.title)
}
```

---

## Conditional HITL

The `human` field can be a function that returns a config or `null` to skip:

### Based on Agent Output

```typescript
phases: {
  classify: {
    run: classifierAgent,
    // Only ask human if confidence is low
    human: (state, output) => output.confidence < 0.8
      ? { prompt: `Verify classification: "${output.label}"?`, type: "approval" }
      : null,
    next: "process"
  }
}
```

### Based on State

```typescript
phases: {
  review: {
    run: reviewerAgent,
    // Skip human review for small changes
    human: (state) => state.changeCount > 10
      ? { prompt: "Large change detected. Approve?", type: "approval" }
      : null,
    next: "apply"
  }
}
```

### Dynamic from Agent Request

An agent can signal it needs human help:

```typescript
// Agent output schema includes HITL request
const reviewerAgent = agent({
  name: "reviewer",
  output: z.object({
    approved: z.boolean(),
    needsHuman: z.boolean(),
    humanPrompt: z.string().optional(),
    humanOptions: z.array(z.string()).optional()
  }),
  // ...
})

// Phase uses agent output to decide HITL
phases: {
  review: {
    run: reviewerAgent,
    human: (state, output) => output.needsHuman ? {
      prompt: output.humanPrompt ?? "Agent needs your input:",
      type: "choice",
      options: output.humanOptions ?? ["Approve", "Reject", "Modify"]
    } : null,
    next: (state) => state.humanResponse?.value === "Modify" ? "modify" : "complete"
  }
}
```

---

## Processing Responses

Use `onResponse` to update state with the human's input:

```typescript
phases: {
  approval: {
    human: { prompt: "Approve?", type: "approval" },
    onResponse: (response, draft) => {
      // response is "yes" or "no" for approval type
      draft.approved = response === "yes"
      draft.reviewedAt = new Date().toISOString()
    },
    next: (state) => state.approved ? "execute" : "revise"
  }
}
```

For `choice` type, the response is the selected option string:

```typescript
phases: {
  strategy: {
    human: {
      prompt: "Choose approach:",
      type: "choice",
      options: ["Fast", "Thorough", "Balanced"]
    },
    onResponse: (response, draft) => {
      draft.selectedStrategy = response // "Fast", "Thorough", or "Balanced"
    },
    next: (state) => ({
      "Fast": "fastPath",
      "Thorough": "thoroughPath",
      "Balanced": "balancedPath"
    })[state.selectedStrategy]
  }
}
```

---

## Routing Based on Response

The human response is also stored in `state.humanResponse` for routing:

```typescript
// Response structure in state
state.humanResponse = {
  value: string,      // The response text or selected option
  approved?: boolean  // For approval type: true/false
}

// Use in next function
next: (state) => {
  if (state.humanResponse?.approved) return "proceed"
  if (state.humanResponse?.value === "Retry") return "retry"
  return "abort"
}
```

---

## Handler API

When running a workflow, provide a `humanInput` handler:

```typescript
import { run, type HumanInputHandler } from "@open-scaffold/core"

const handler: HumanInputHandler = {
  approval: async (prompt) => {
    // Return true for approved, false for rejected
    return await showApprovalDialog(prompt)
  },
  choice: async (prompt, options) => {
    // Return the selected option string
    return await showChoiceDialog(prompt, options)
  }
}

const result = await run(myWorkflow, {
  input: "Build API",
  runtime: myRuntime,
  humanInput: handler
})
```

### Handler Interface

```typescript
interface HumanInputHandler {
  /**
   * Request approval from a human.
   * @param prompt - The prompt to display
   * @returns Promise resolving to true (approved) or false (rejected)
   */
  approval: (prompt: string) => Promise<boolean>

  /**
   * Request a choice from a human.
   * @param prompt - The prompt to display
   * @param options - Available options to choose from
   * @returns Promise resolving to the selected option string
   */
  choice: (prompt: string, options: string[]) => Promise<string>
}
```

---

## Built-in Handlers

Open Scaffold provides two built-in handlers:

### cliPrompt() -- Terminal Input

For CLI applications, use readline-based prompts:

```typescript
import { run, cliPrompt } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build API",
  runtime: myRuntime,
  humanInput: cliPrompt()
})
```

Output example:
```
Approve deployment to production? (y/n): y
Choose environment:
1. staging
2. production
3. development
Enter number: 2
```

### autoApprove() -- Testing

For automated testing, auto-approve everything:

```typescript
import { run, autoApprove } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build API",
  runtime: { ...myRuntime, mode: "playback" },
  humanInput: autoApprove()  // Always true, always first option
})
```

The `autoApprove()` handler:
- Returns `true` for all approval requests
- Returns the first option for all choice requests

---

## Event Flow

HITL interactions emit events for observability:

```
agent:completed { output: {...} }
  |
  v
input:requested { id, prompt, type, options? }
  |
  v [Handler called, human responds]
  |
input:received { id, value, approved? }
  |
  v
[Routing evaluated with humanResponse in state]
  |
  v
[Next phase starts]
```

### Event Payloads

**input:requested**
```typescript
{
  id: string           // Correlation ID
  prompt: string       // Display text
  type: "approval" | "choice"
  options?: string[]   // For choice type
}
```

**input:received**
```typescript
{
  id: string           // Correlates to request
  value: string        // "yes"/"no" or selected option
  approved?: boolean   // For approval type
}
```

### Observing HITL Events

Use the observer pattern to track HITL:

```typescript
await run(myWorkflow, {
  input: "Build API",
  runtime: myRuntime,
  humanInput: cliPrompt(),
  observer: {
    onInputRequested: async (request) => {
      console.log(`HITL requested: ${request.type}`)
      console.log(`Prompt: ${request.prompt}`)
      // Note: Handler is called separately, this is for logging
    },
    onEvent: (event) => {
      if (event.name === "input:received") {
        console.log(`Human responded: ${event.payload.value}`)
      }
    }
  }
})
```

---

## React Integration

For React applications, use the `useWorkflowHITL` hook:

```tsx
import { useWorkflowHITL } from "@open-scaffold/client/react"

function HITLPanel({ sessionId }: { sessionId: string }) {
  const { pending, respond, isResponding } = useWorkflowHITL(sessionId)

  if (pending.length === 0) return <p>No pending requests</p>

  const request = pending[0]

  if (request.type === "approval") {
    return (
      <div>
        <p>{request.prompt}</p>
        <button
          onClick={() => respond(request.id, "yes")}
          disabled={isResponding}
        >
          Approve
        </button>
        <button
          onClick={() => respond(request.id, "no")}
          disabled={isResponding}
        >
          Reject
        </button>
      </div>
    )
  }

  if (request.type === "choice") {
    return (
      <div>
        <p>{request.prompt}</p>
        {request.options?.map(option => (
          <button
            key={option}
            onClick={() => respond(request.id, option)}
            disabled={isResponding}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  return null
}
```

### Hook Return Value

```typescript
interface WorkflowHITLResult {
  /** List of pending input requests awaiting response */
  pending: ReadonlyArray<PendingInteraction>

  /** Respond to a pending interaction */
  respond: (interactionId: EventId, response: string) => Promise<void>

  /** Whether a response is being sent */
  isResponding: boolean
}

interface PendingInteraction {
  id: EventId
  prompt: string
  type: "freeform" | "approval" | "choice"
  options?: ReadonlyArray<string>
  timestamp: Date
}
```

---

## Complete Examples

### Example 1: Plan-and-Execute with Approval

```typescript
import { workflow, phase, agent, run, cliPrompt } from "@open-scaffold/core"
import { z } from "zod"

// State shape
interface PlanState {
  goal: string
  plan: string[]
  approved: boolean
  results: string[]
}

// Planner agent
const planner = agent<PlanState, { steps: string[] }>({
  name: "planner",
  provider: myProvider,
  output: z.object({ steps: z.array(z.string()) }),
  prompt: (state) => `Create a plan to: ${state.goal}`,
  update: (output, draft) => { draft.plan = output.steps }
})

// Executor agent
const executor = agent<PlanState, { result: string }>({
  name: "executor",
  provider: myProvider,
  output: z.object({ result: z.string() }),
  prompt: (state) => `Execute step: ${state.plan[state.results.length]}`,
  update: (output, draft) => { draft.results.push(output.result) }
})

// Workflow with HITL approval gate
const planExecuteWorkflow = workflow<PlanState, string, "plan" | "approve" | "execute" | "done">({
  name: "plan-execute",
  initialState: { goal: "", plan: [], approved: false, results: [] },
  start: (input, draft) => { draft.goal = input },
  phases: {
    plan: {
      run: planner,
      next: "approve"
    },
    approve: {
      human: {
        prompt: (state) => `
Approve this plan?

${state.plan.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`,
        type: "approval"
      },
      onResponse: (response, draft) => {
        draft.approved = response === "yes"
      },
      next: (state) => state.approved ? "execute" : "plan"
    },
    execute: {
      run: executor,
      until: (state) => state.results.length >= state.plan.length,
      next: "done"
    },
    done: phase.terminal()
  }
})

// Run with CLI prompts
const result = await run(planExecuteWorkflow, {
  input: "Build a REST API",
  runtime: { mode: "live" },
  humanInput: cliPrompt()
})

console.log("Plan:", result.state.plan)
console.log("Results:", result.state.results)
```

### Example 2: Multi-Choice Branching

```typescript
const branchingWorkflow = workflow({
  name: "branching-demo",
  initialState: {
    approach: "" as "fast" | "thorough" | "balanced",
    result: ""
  },
  start: (_input, draft) => {},
  phases: {
    choose: {
      human: {
        prompt: "How should we proceed?",
        type: "choice",
        options: ["Fast (quick but basic)", "Thorough (slow but complete)", "Balanced"]
      },
      onResponse: (response, draft) => {
        if (response.startsWith("Fast")) draft.approach = "fast"
        else if (response.startsWith("Thorough")) draft.approach = "thorough"
        else draft.approach = "balanced"
      },
      next: (state) => state.approach  // Routes to "fast", "thorough", or "balanced"
    },
    fast: { run: fastAgent, next: "done" },
    thorough: { run: thoroughAgent, next: "done" },
    balanced: { run: balancedAgent, next: "done" },
    done: phase.terminal()
  }
})
```

### Example 3: Conditional HITL Based on Confidence

```typescript
const confidenceWorkflow = workflow({
  name: "confidence-demo",
  initialState: {
    query: "",
    classification: "",
    confidence: 0,
    humanVerified: false
  },
  start: (input, draft) => { draft.query = input },
  phases: {
    classify: {
      run: classifierAgent,  // Sets classification and confidence
      // Only ask human when confidence is below threshold
      human: (state, output) => {
        if (output.confidence >= 0.9) return null  // Skip HITL
        return {
          prompt: `
The classifier is ${Math.round(output.confidence * 100)}% confident.

Query: "${state.query}"
Classification: "${output.classification}"

Is this correct?
`,
          type: "approval"
        }
      },
      onResponse: (response, draft) => {
        draft.humanVerified = true
        if (response === "no") {
          draft.classification = ""  // Clear for re-classification
        }
      },
      next: (state) => {
        if (!state.humanVerified) return "process"  // High confidence, skip verification
        if (state.classification) return "process"  // Human approved
        return "classify"  // Human rejected, try again
      }
    },
    process: { run: processorAgent, next: "done" },
    done: phase.terminal()
  }
})
```

---

## Best Practices

1. **Keep prompts clear and actionable** -- Tell the human exactly what decision they need to make.

2. **Provide context** -- Include relevant state information in prompts so humans can make informed decisions.

3. **Use conditional HITL** -- Don't interrupt unnecessarily. Use confidence thresholds or state checks.

4. **Handle both responses** -- Always account for both approval and rejection in your routing logic.

5. **Test with autoApprove()** -- Use the auto-approve handler in tests for deterministic behavior.

6. **Log HITL events** -- Track human decisions via the observer for audit trails.

---

## Related Documentation

- [ADR-002: HITL Architecture](../plans/adr/002-hitl-architecture.md) -- Design rationale
- [Building Workflows](../building-workflows.md) -- Phase and workflow basics
- [React Integration](../react-integration.md) -- Full React hook documentation
- [API Reference](../api-reference.md) -- Complete type signatures
