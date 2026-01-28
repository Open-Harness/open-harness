# Extending Open Scaffold

This guide covers how to extend Open Scaffold with custom agents, phases, workflows, and providers.

## Adding Custom Agents

Agents are AI actors that process state and produce structured output.

### Define the Agent

```typescript
// agents/reviewer.ts
import { agent } from "@open-scaffold/core"
import { z } from "zod"

/**
 * Output schema for the reviewer agent.
 */
const ReviewerOutputSchema = z.object({
  approved: z.boolean().describe("Whether the task passes review"),
  feedback: z.string().describe("Detailed feedback on the implementation"),
  suggestions: z.array(z.string()).describe("Specific improvement suggestions"),
  severity: z.enum(["minor", "major", "critical"]).describe("Severity of issues found")
})

/**
 * Reviewer agent - reviews completed tasks for quality.
 * Uses Claude Haiku for fast, cost-effective reviews.
 */
export const reviewerAgent = agent({
  name: "reviewer",
  model: "claude-haiku-4-5",

  output: ReviewerOutputSchema,

  prompt: (state) => `You are a code reviewer for a software project.

## Task Completed
Summary: ${state.lastTaskSummary}
Files Modified: ${state.lastFilesModified.join(", ")}

## Project Goal
${state.goal}

## Review Criteria
1. Does the implementation align with the project goal?
2. Are there any obvious bugs or issues?
3. Is the code clean and maintainable?
4. Are there security concerns?

## Instructions
Review the completed task and provide your assessment.
Be constructive but thorough. Flag any issues that should be addressed.`,

  update: (output, draft) => {
    draft.reviewResult = {
      approved: output.approved,
      feedback: output.feedback,
      suggestions: output.suggestions,
      severity: output.severity
    }
    if (!output.approved) {
      draft.needsRevision = true
    }
  }
})
```

### Use in a Workflow

```typescript
import { workflow, phase } from "@open-scaffold/core"
import { reviewerAgent } from "./agents/reviewer"
import { workerAgent } from "./agents/worker"

export const reviewedWorkflow = workflow({
  name: "reviewed-workflow",
  initialState: {
    goal: "",
    lastTaskSummary: "",
    lastFilesModified: [] as string[],
    reviewResult: null as ReviewResult | null,
    needsRevision: false,
  },
  start: (input, draft) => { draft.goal = input },
  phases: {
    work: { run: workerAgent, next: "review" },
    review: { run: reviewerAgent, next: "done" },
    done: phase.terminal()
  }
})
```

## Adding a Custom Provider

Providers wrap AI APIs with a consistent interface.

### Provider Interface

```typescript
interface Provider {
  name: string
  generate(
    prompt: string,
    options: ProviderOptions
  ): AsyncGenerator<StreamChunk, void, unknown>
}

interface ProviderOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  schema?: z.ZodType  // For structured output
  thinking?: {
    enabled: boolean
    budgetTokens?: number
  }
}

interface StreamChunk {
  type: "text" | "thinking" | "done" | "error"
  text?: string
  error?: Error
}
```

### OpenAI Provider Example

```typescript
// providers/openai.ts
import OpenAI from "openai"
import type { Provider, ProviderOptions, StreamChunk } from "@open-scaffold/core"

export interface OpenAIProviderConfig {
  model: string
  apiKey?: string  // Falls back to OPENAI_API_KEY env var
}

export function OpenAIProvider(config: OpenAIProviderConfig): Provider {
  const client = new OpenAI({
    apiKey: config.apiKey
  })

  return {
    name: "openai",

    async *generate(
      prompt: string,
      options: ProviderOptions
    ): AsyncGenerator<StreamChunk, void, unknown> {
      try {
        const stream = await client.chat.completions.create({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.7,
          stream: true
        })

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            yield { type: "text", text: content }
          }
        }

        yield { type: "done" }
      } catch (error) {
        yield {
          type: "error",
          error: error instanceof Error ? error : new Error(String(error))
        }
      }
    }
  }
}
```

### Using Custom Provider

```typescript
import { agent } from "@open-scaffold/core"
import { OpenAIProvider } from "./providers/openai.js"

export const gpt4Agent = agent({
  name: "gpt4-planner",
  model: "gpt-4-turbo",
  // ... rest of config
})
```

## Adding a Custom Store

Stores persist events and state snapshots. The runtime uses `EventStoreLive`, `StateSnapshotStoreLive`, and `ProviderRecorderLive` implementations.

### EventStore Interface

```typescript
interface EventStore {
  /** Append events to a session */
  append(sessionId: string, events: AnyEvent[]): Effect<void, StoreError>

  /** Read all events for a session */
  read(sessionId: string): Effect<AnyEvent[], StoreError>

  /** Read events after a specific event ID */
  readAfter(sessionId: string, afterId: string): Effect<AnyEvent[], StoreError>

  /** Subscribe to new events */
  subscribe(sessionId: string): Stream<AnyEvent, SessionNotFound>
}
```

### Postgres EventStore Example

```typescript
// stores/postgres-event-store.ts
import { Effect, Layer, Stream } from "effect"
import { Pool } from "pg"
import { Services, type AnyEvent } from "@open-scaffold/core"

export interface PostgresEventStoreConfig {
  connectionString: string
}

export function PostgresEventStore(
  config: PostgresEventStoreConfig
): Layer.Layer<Services.EventStore, never, never> {
  return Layer.succeed(
    Services.EventStore,
    Services.EventStore.of({
      append: (sessionId, events) =>
        Effect.tryPromise({
          try: async () => {
            const pool = new Pool({ connectionString: config.connectionString })

            const values = events.map((e, i) => [
              sessionId,
              e.id,
              e.type,
              JSON.stringify(e.payload),
              e.causedBy,
              e.timestamp,
              i  // Sequence number
            ])

            await pool.query(
              `INSERT INTO events (session_id, event_id, type, payload, caused_by, timestamp, sequence)
               VALUES ${values.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(", ")}`,
              values.flat()
            )

            await pool.end()
          },
          catch: (e) => new Services.StoreError({ cause: e })
        }),

      read: (sessionId) =>
        Effect.tryPromise({
          try: async () => {
            const pool = new Pool({ connectionString: config.connectionString })

            const result = await pool.query(
              `SELECT event_id, type, payload, caused_by, timestamp
               FROM events
               WHERE session_id = $1
               ORDER BY sequence ASC`,
              [sessionId]
            )

            await pool.end()

            return result.rows.map((row) => ({
              id: row.event_id,
              type: row.type,
              payload: JSON.parse(row.payload),
              causedBy: row.caused_by,
              timestamp: row.timestamp
            })) as AnyEvent[]
          },
          catch: (e) => new Services.StoreError({ cause: e })
        }),

      readAfter: (sessionId, afterId) =>
        Effect.tryPromise({
          try: async () => {
            // Implementation details...
            return [] as AnyEvent[]
          },
          catch: (e) => new Services.StoreError({ cause: e })
        }),

      subscribe: (sessionId) =>
        Stream.async<AnyEvent, Services.SessionNotFound>((emit) => {
          // Implement with LISTEN/NOTIFY for real-time updates
          return Effect.void
        })
    })
  )
}
```

## Extending State

To add new fields to the workflow state, update your state type and agent `update` functions:

### 1. Extend the State Type

```typescript
// state.ts
export interface ScaffoldState {
  // ... existing fields
  goal: string
  tasks: Task[]

  // Add new fields
  reviewedTasks: ReadonlyArray<ReviewedTask>
  reviewMetrics: {
    totalReviewed: number
    approvalRate: number
  }
}
```

### 2. Update Agent `update` Functions

Make sure agents that modify related state also update your new fields in their `update` function.

## Workflow Composition

Define multi-phase workflows that compose multiple agents:

```typescript
import { agent, phase, workflow } from "@open-scaffold/core"
import { z } from "zod"

const planner = agent({ name: "planner", model: "claude-sonnet-4-5", /* ... */ })
const worker = agent({ name: "worker", model: "claude-sonnet-4-5", /* ... */ })
const reviewer = agent({ name: "reviewer", model: "claude-haiku-4-5", /* ... */ })

export const fullWorkflow = workflow({
  name: "full-pipeline",
  initialState: { /* ... */ },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: planner, next: "working" },
    working: { run: worker, next: "review" },
    review: { run: reviewer, next: "done" },
    done: phase.terminal()
  }
})
```

## Related Documentation

- [Testing Guide](./testing.md) - Testing custom extensions
- [Error Handling Guide](./error-handling.md) - Error handling in extensions
- [Architecture](../reference/architecture.md) - Understanding the system
- [SDK Internals](../reference/sdk-internals.md) - Effect patterns
