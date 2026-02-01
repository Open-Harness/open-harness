# Building Workflows

**Practical patterns for constructing real-world AI workflows.**

---

Once you understand the core concepts, it's time to build. This guide covers common patterns you'll use when constructing workflows—from simple pipelines to complex multi-agent systems with loops, branches, and human intervention.

## Starting Simple

Every workflow starts with the same structure. Here's the minimal template:

```typescript
import { workflow, phase, agent, run } from "@open-harness/core"
import { z } from "zod"

const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { /* your state shape */ },
  start: (input, draft) => { /* transform input to state */ },
  phases: { /* your execution graph */ }
})
```

Let's build up from here with increasingly sophisticated patterns.

---

## Pattern 1: Linear Pipeline

The simplest workflow is a sequence of agents, each processing the output of the previous:

```typescript
import { workflow, phase, agent } from "@open-harness/core"
import { z } from "zod"

// Agent 1: Extract key points
const extractor = agent({
  name: "extractor",
  model: "claude-sonnet-4-5",
  output: z.object({
    keyPoints: z.array(z.string()),
    mainTheme: z.string()
  }),
  prompt: (state) => `Extract key points from: ${state.document}`,
  update: (output, draft) => {
    draft.keyPoints = output.keyPoints
    draft.mainTheme = output.mainTheme
  }
})

// Agent 2: Generate summary
const summarizer = agent({
  name: "summarizer",
  model: "claude-sonnet-4-5",
  output: z.object({
    summary: z.string()
  }),
  prompt: (state) => `
    Summarize these key points about "${state.mainTheme}":
    ${state.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}
  `,
  update: (output, draft) => {
    draft.summary = output.summary
  }
})

// The workflow
const documentSummarizer = workflow({
  name: "document-summarizer",

  initialState: {
    document: "",
    keyPoints: [] as string[],
    mainTheme: "",
    summary: ""
  },

  start: (input: string, draft) => {
    draft.document = input
  },

  phases: {
    extract: { run: extractor, next: "summarize" },
    summarize: { run: summarizer, next: "done" },
    done: phase.terminal()
  }
})
```

**When to use:** Data transformation pipelines, content processing, analysis workflows.

---

## Pattern 2: Review Loop

A common pattern is iterating until quality meets a threshold:

```typescript
const writer = agent({
  name: "writer",
  model: "claude-sonnet-4-5",
  output: z.object({
    content: z.string(),
    wordCount: z.number()
  }),
  prompt: (state) => {
    if (state.feedback) {
      return `
        Revise this content based on feedback:

        Previous version:
        ${state.content}

        Feedback:
        ${state.feedback}
      `
    }
    return `Write an article about: ${state.topic}`
  },
  update: (output, draft) => {
    draft.content = output.content
    draft.iterations++
  }
})

const reviewer = agent({
  name: "reviewer",
  model: "claude-sonnet-4-5",
  output: z.object({
    approved: z.boolean(),
    score: z.number().min(0).max(1),
    feedback: z.string().optional()
  }),
  prompt: (state) => `
    Review this article for quality. Score 0-1 and approve if >= 0.8:

    ${state.content}
  `,
  update: (output, draft) => {
    draft.approved = output.approved
    draft.score = output.score
    draft.feedback = output.feedback ?? ""
  }
})

const contentWorkflow = workflow({
  name: "content-loop",

  initialState: {
    topic: "",
    content: "",
    feedback: "",
    score: 0,
    approved: false,
    iterations: 0
  },

  start: (input: string, draft) => {
    draft.topic = input
  },

  phases: {
    write: { run: writer, next: "review" },

    review: {
      run: reviewer,
      next: (output, state) => {
        // Exit conditions
        if (output.approved) return "done"
        if (state.iterations >= 3) return "done"  // Max 3 attempts
        return "write"  // Loop back
      }
    },

    done: phase.terminal()
  }
})
```

**Key points:**

- Always include a maximum iteration limit
- The `next` function receives both agent output and current state
- Use state to track loop metadata (iterations, attempts, etc.)

---

## Pattern 3: Conditional Branching

Route to different agents based on input characteristics:

```typescript
const classifier = agent({
  name: "classifier",
  model: "claude-sonnet-4-5",
  output: z.object({
    category: z.enum(["technical", "creative", "analytical"]),
    confidence: z.number()
  }),
  prompt: (state) => `Classify this request: ${state.request}`,
  update: (output, draft) => {
    draft.category = output.category
  }
})

const technicalAgent = agent({
  name: "technical",
  model: "claude-sonnet-4-5",
  output: z.object({ response: z.string() }),
  prompt: (state) => `Provide technical guidance for: ${state.request}`,
  update: (output, draft) => { draft.response = output.response }
})

const creativeAgent = agent({
  name: "creative",
  model: "claude-sonnet-4-5",
  output: z.object({ response: z.string() }),
  prompt: (state) => `Generate creative content for: ${state.request}`,
  update: (output, draft) => { draft.response = output.response }
})

const analyticalAgent = agent({
  name: "analytical",
  model: "claude-sonnet-4-5",
  output: z.object({ response: z.string() }),
  prompt: (state) => `Analyze and provide insights for: ${state.request}`,
  update: (output, draft) => { draft.response = output.response }
})

const routerWorkflow = workflow({
  name: "smart-router",

  initialState: {
    request: "",
    category: "" as "technical" | "creative" | "analytical" | "",
    response: ""
  },

  start: (input: string, draft) => {
    draft.request = input
  },

  phases: {
    classify: {
      run: classifier,
      next: (output) => {
        switch (output.category) {
          case "technical": return "handleTechnical"
          case "creative": return "handleCreative"
          case "analytical": return "handleAnalytical"
        }
      }
    },
    handleTechnical: { run: technicalAgent, next: "done" },
    handleCreative: { run: creativeAgent, next: "done" },
    handleAnalytical: { run: analyticalAgent, next: "done" },
    done: phase.terminal()
  }
})
```

**When to use:** Multi-modal processing, request routing, specialized handling.

---

## Pattern 4: Multi-Agent Collaboration

Multiple agents working together on a complex task:

```typescript
// Research agent gathers information
const researcher = agent({
  name: "researcher",
  model: "claude-sonnet-4-5",
  output: z.object({
    findings: z.array(z.object({
      fact: z.string(),
      source: z.string(),
      relevance: z.number()
    })),
    needsMore: z.boolean()
  }),
  prompt: (state) => `
    Research: ${state.topic}
    ${state.findings.length > 0 ? `\nExisting findings:\n${JSON.stringify(state.findings)}` : ""}
    Find new information. Set needsMore=false when sufficient.
  `,
  update: (output, draft) => {
    draft.findings.push(...output.findings)
    draft.needsMore = output.needsMore
  }
})

// Analyst agent evaluates findings
const analyst = agent({
  name: "analyst",
  model: "claude-sonnet-4-5",
  output: z.object({
    analysis: z.string(),
    confidence: z.number(),
    gaps: z.array(z.string())
  }),
  prompt: (state) => `
    Analyze these research findings about "${state.topic}":
    ${JSON.stringify(state.findings, null, 2)}
  `,
  update: (output, draft) => {
    draft.analysis = output.analysis
    draft.confidence = output.confidence
    draft.gaps = output.gaps
  }
})

// Writer synthesizes everything
const writer = agent({
  name: "writer",
  model: "claude-sonnet-4-5",
  output: z.object({
    report: z.string()
  }),
  prompt: (state) => `
    Write a comprehensive report on "${state.topic}".

    Analysis: ${state.analysis}

    Key findings:
    ${state.findings.map(f => `- ${f.fact}`).join("\n")}
  `,
  update: (output, draft) => {
    draft.report = output.report
  }
})

const researchWorkflow = workflow({
  name: "research-team",

  initialState: {
    topic: "",
    findings: [] as Array<{ fact: string; source: string; relevance: number }>,
    needsMore: true,
    analysis: "",
    confidence: 0,
    gaps: [] as string[],
    report: "",
    researchRounds: 0
  },

  start: (input: string, draft) => {
    draft.topic = input
  },

  phases: {
    research: {
      run: researcher,
      next: (output, state) => {
        if (!output.needsMore || state.researchRounds >= 3) {
          return "analyze"
        }
        return "research"  // Continue researching
      }
    },
    analyze: {
      run: analyst,
      next: (output, state) => {
        // If gaps found and confidence low, research more
        if (output.gaps.length > 0 && output.confidence < 0.7) {
          return "research"
        }
        return "write"
      }
    },
    write: { run: writer, next: "done" },
    done: phase.terminal()
  }
})
```

**Key insight:** Agents can loop back and forth. The analyst finding gaps triggers more research.

---

## Pattern 5: Human-in-the-Loop

Pause for human input at critical decision points:

```typescript
import { run } from "@open-harness/core"

const proposer = agent({
  name: "proposer",
  model: "claude-sonnet-4-5",
  output: z.object({
    proposal: z.string(),
    options: z.array(z.object({
      id: z.string(),
      description: z.string(),
      risk: z.enum(["low", "medium", "high"])
    }))
  }),
  prompt: (state) => `
    Generate a proposal for: ${state.request}
    Provide 2-3 options with risk levels.
  `,
  update: (output, draft) => {
    draft.proposal = output.proposal
    draft.options = output.options
  }
})

const executor = agent({
  name: "executor",
  model: "claude-sonnet-4-5",
  output: z.object({
    result: z.string(),
    success: z.boolean()
  }),
  prompt: (state) => `
    Execute the approved option: ${state.approvedOption}
    Original request: ${state.request}
  `,
  update: (output, draft) => {
    draft.result = output.result
    draft.success = output.success
  }
})

const approvalWorkflow = workflow({
  name: "approval-flow",

  initialState: {
    request: "",
    proposal: "",
    options: [] as Array<{ id: string; description: string; risk: string }>,
    approvedOption: "",
    humanFeedback: "",
    result: "",
    success: false
  },

  start: (input: string, draft) => {
    draft.request = input
  },

  phases: {
    propose: {
      run: proposer,
      next: "awaitApproval"
    },

    awaitApproval: {
      // This phase requests human input
      run: async (state, context) => {
        // Request input from human
        const response = await context.requestInput({
          prompt: `Review proposal:\n${state.proposal}\n\nOptions:\n${
            state.options.map(o => `[${o.id}] ${o.description} (${o.risk} risk)`).join("\n")
          }\n\nEnter option ID to approve or 'reject' to cancel:`,
          type: "text"
        })

        return { approved: response !== "reject", selectedOption: response }
      },
      next: (output) => output.approved ? "execute" : "done"
    },

    execute: { run: executor, next: "done" },
    done: phase.terminal()
  }
})

// Running with human input handling
const execution = await run(approvalWorkflow, {
  input: "Deploy new feature to production",
  mode: "live"
})

execution.subscribe({
  // Handle human input requests
  onInputRequested: async (request) => {
    // In a real app, this would show a UI prompt
    console.log(request.prompt)
    const userInput = await getUserInputSomehow()
    return userInput
  },

  onCompleted: ({ state }) => {
    console.log("Workflow complete:", state.result)
  }
})
```

**Important:** Human-in-the-loop pauses workflow execution until input is received. The `onInputRequested` callback is how you integrate with your UI.

---

## Pattern 6: Error Handling and Recovery

Build resilient workflows that handle failures gracefully:

```typescript
const riskyAgent = agent({
  name: "risky-operation",
  model: "claude-sonnet-4-5",
  output: z.object({
    result: z.string(),
    status: z.enum(["success", "partial", "failed"])
  }),
  prompt: (state) => `Attempt operation: ${state.operation}`,
  update: (output, draft) => {
    draft.result = output.result
    draft.status = output.status
    draft.attempts++
  }
})

const recoveryAgent = agent({
  name: "recovery",
  model: "claude-sonnet-4-5",
  output: z.object({
    suggestion: z.string(),
    canRetry: z.boolean()
  }),
  prompt: (state) => `
    The operation failed: ${state.result}
    Attempts: ${state.attempts}
    Suggest recovery steps.
  `,
  update: (output, draft) => {
    draft.recoverySuggestion = output.suggestion
    draft.canRetry = output.canRetry
  }
})

const resilientWorkflow = workflow({
  name: "resilient-operation",

  initialState: {
    operation: "",
    result: "",
    status: "" as "success" | "partial" | "failed" | "",
    attempts: 0,
    recoverySuggestion: "",
    canRetry: false,
    finalOutcome: ""
  },

  start: (input: string, draft) => {
    draft.operation = input
  },

  phases: {
    attempt: {
      run: riskyAgent,
      next: (output, state) => {
        if (output.status === "success") return "success"
        if (state.attempts >= 3) return "failure"
        return "recover"
      }
    },

    recover: {
      run: recoveryAgent,
      next: (output) => output.canRetry ? "attempt" : "failure"
    },

    success: {
      run: async (state, context) => {
        return { finalOutcome: `Success: ${state.result}` }
      },
      next: "done"
    },

    failure: {
      run: async (state, context) => {
        return {
          finalOutcome: `Failed after ${state.attempts} attempts. ${state.recoverySuggestion}`
        }
      },
      next: "done"
    },

    done: phase.terminal()
  }
})
```

**Best practices:**

- Always limit retry attempts
- Use dedicated recovery phases
- Track attempt counts in state
- Have clear success/failure terminal paths

---

## Pattern 7: Workflow Composition

Nest workflows inside workflows for complex orchestration:

```typescript
import { run } from "@open-harness/core"

// A reusable sub-workflow
const validationWorkflow = workflow({
  name: "validator",
  initialState: {
    data: {} as Record<string, unknown>,
    isValid: false,
    errors: [] as string[]
  },
  start: (input: Record<string, unknown>, draft) => {
    draft.data = input
  },
  phases: {
    validate: {
      run: validatorAgent,
      next: "done"
    },
    done: phase.terminal()
  }
})

// Parent workflow that uses the sub-workflow
const processingWorkflow = workflow({
  name: "data-processor",

  initialState: {
    rawData: {} as Record<string, unknown>,
    validatedData: {} as Record<string, unknown>,
    processedResult: "",
    validationPassed: false
  },

  start: (input: Record<string, unknown>, draft) => {
    draft.rawData = input
  },

  phases: {
    preprocess: {
      run: preprocessAgent,
      next: "validate"
    },

    // Run the validation sub-workflow
    validate: {
      run: async (state, context) => {
        const subExecution = await run(validationWorkflow, {
          input: state.rawData,
          mode: "live"
        })

        const result = await subExecution.result()
        return {
          validatedData: result.state.data,
          isValid: result.state.isValid,
          errors: result.state.errors
        }
      },
      next: (output) => output.isValid ? "process" : "handleErrors"
    },

    process: {
      run: processorAgent,
      next: "done"
    },

    handleErrors: {
      run: errorHandlerAgent,
      next: "done"
    },

    done: phase.terminal()
  }
})
```

**When to use:** Reusable validation logic, modular workflow components, complex orchestration.

---

## Best Practices

### State Design

```typescript
initialState: {
  // Inputs (set by start())
  topic: "",
  context: "",

  // Working data (modified by agents)
  findings: [] as Finding[],
  drafts: [] as string[],

  // Outputs (final results)
  result: null as string | null,

  // Metadata (for debugging/control)
  iterations: 0,
  startedAt: 0,
  phase: "" // Optional: track current phase
}
```

### Agent Design

- **Single responsibility:** One clear task per agent
- **Explicit schemas:** Detailed Zod schemas with `.describe()`
- **Focused prompts:** Only include relevant state in prompts
- **Atomic updates:** Each agent updates a specific part of state

### Phase Design

- **Meaningful names:** `analyze` not `phase2`
- **Clear transitions:** Make the flow readable
- **Bounded loops:** Always have exit conditions
- **Terminal states:** Have explicit success/failure terminals

---

## Debugging Tips

### Log Events

```typescript
execution.subscribe({
  onPhaseChanged: (phase, from) => {
    console.log(`Phase: ${from} → ${phase}`)
  },
  onAgentStarted: ({ agent }) => {
    console.log(`Agent started: ${agent}`)
  },
  onAgentCompleted: ({ agent, output, durationMs }) => {
    console.log(`Agent ${agent} completed in ${durationMs}ms:`, output)
  },
  onStateChanged: (state, patches) => {
    console.log("State patches:", patches)
  }
})
```

### Use Playback Mode

Record a session and replay it to debug:

```typescript
// Record in development
const result = await run(workflow, { input: "...", mode: "live" })

// Replay in debugging - same events, no API calls
const debug = await run(workflow, { input: "...", mode: "playback" })
```

### Fork From Any Point

```typescript
// Fork from a specific event to try alternatives
const fork = await execution.forkFrom(eventIndex)
await fork.resume()
```

---

## Summary

| Pattern | Use Case | Key Feature |
|---------|----------|-------------|
| **Linear Pipeline** | Sequential processing | Simple, predictable |
| **Review Loop** | Quality iteration | Bounded retries |
| **Conditional Branch** | Routing | Dynamic next function |
| **Multi-Agent** | Complex tasks | Agent collaboration |
| **Human-in-the-Loop** | Approvals, decisions | Input requests |
| **Error Recovery** | Resilience | Retry with recovery |
| **Composition** | Modularity | Nested workflows |

!!! success "Next Steps"
    Ready to add a UI? See [React Integration](react-integration.md) for connecting workflows to React components.

---

## Related

- [Concepts: Workflows](../concepts/workflows.md) — Deep dive on workflow structure
- [Concepts: Phases](../concepts/phases.md) — Phase patterns and transitions
- [Concepts: Agents](../concepts/agents.md) — Agent design and configuration
- [API Reference](../api/reference.md) — Complete API documentation
