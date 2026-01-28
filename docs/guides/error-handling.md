# Error Handling in Open Scaffold

This guide covers error types, handling strategies, and recovery patterns for Open Scaffold workflows.

## Error Types

### Provider Errors

Errors from AI provider calls (Anthropic API):

| Error | Code | Cause | Recovery |
|-------|------|-------|----------|
| Rate limit | `rate_limited` | Too many requests | Automatic retry with backoff |
| Token limit | `token_limit` | Prompt too large | Emit blocker event |
| Model unavailable | `model_unavailable` | Service outage | Retry or fail |
| Network timeout | `timeout` | Connection issues | Automatic retry |
| Invalid response | `invalid_response` | Schema mismatch | Retry or fail |

### Workflow Errors

Errors from workflow execution:

| Error | Cause | Recovery |
|-------|-------|----------|
| `AgentError` | Agent output invalid | Logged, may retry |
| `WorkflowNotFound` | Invalid session ID | Return 404 |
| `SessionNotFound` | Invalid session for events | Return 404 |

### Infrastructure Errors

Errors from storage and infrastructure:

| Error | Cause | Recovery |
|-------|-------|----------|
| `StoreError` | Database write failed | Retry or fail |
| `ConnectionError` | Database unreachable | Fail with error |

## Handling Provider Errors

### Automatic Retry

Provider errors are automatically retried with exponential backoff:

```typescript
// Built-in behavior - no configuration needed
// Retries: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
```

### Custom Error Handling in Agents

Define custom error handling in your agent:

```typescript
import { agent } from "@open-scaffold/core"

export const resilientWorker = agent({
  name: "resilient-worker",
  model: "claude-sonnet-4-5",
  output: z.object({ result: z.string() }),
  prompt: (state) => `Process: ${state.input}`,
  update: (output, draft) => { draft.result = output.result },

  onError: (error, state, context) => {
    // Handle specific error types
    if (error.code === "rate_limited") {
      // Use retry with custom backoff
      return context.retry({
        backoff: error.retryAfter ?? 5000
      })
    }

    if (error.code === "token_limit") {
      // Update state to reflect the blocker
      return {
        update: (draft) => {
          draft.blockers.push("Token limit exceeded - task too complex")
        }
      }
    }

    if (error.code === "invalid_response") {
      // Retry with a more specific prompt
      return context.retry({
        promptOverride: `${context.originalPrompt}\n\nIMPORTANT: Return valid JSON matching the schema.`
      })
    }

    // Let other errors bubble up
    throw error
  }
})
```

### Error Context

The `context` parameter in `onError` provides:

```typescript
interface ErrorContext<S, Trigger> {
  // Retry the agent call
  retry(options?: {
    backoff?: number
    promptOverride?: string
    maxRetries?: number
  }): RetryResult

  // The original prompt sent to the provider
  originalPrompt: string

  // The event that triggered this agent
  trigger: Trigger

  // Current workflow state
  state: S

  // Number of retries so far
  retryCount: number
}
```

## Effect-Based Error Handling

Open Scaffold uses Effect for composable error handling. If you're working with the internal APIs:

### Catching Specific Errors

```typescript
import { Effect, pipe } from "effect"
import { StoreError, ProviderError } from "@open-scaffold/core"

const result = await pipe(
  someWorkflowOperation(),

  // Handle store errors
  Effect.catchTag("StoreError", (error) =>
    Effect.succeed({ fallback: true, error: error.message })
  ),

  // Handle provider errors
  Effect.catchTag("ProviderError", (error) => {
    if (error.code === "rate_limited") {
      return Effect.retry(retryPolicy)
    }
    return Effect.fail(error)
  }),

  Effect.runPromise
)
```

### Retry Policies

```typescript
import { Effect, Schedule } from "effect"

// Exponential backoff with jitter
const retryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(5))
)

const resilientOperation = Effect.retry(
  someEffectOperation,
  retryPolicy
)
```

## Recovery Patterns

### Pattern 1: Automatic Retry

Built-in for transient errors. No code needed.

```
Request -> Error (429) -> Wait -> Retry -> Success
```

### Pattern 2: Graceful Degradation

Update state to reflect the blocker and continue the workflow:

```typescript
onError: (error, state, context) => {
  // Instead of failing, update state with blocker
  return {
    update: (draft) => {
      draft.blockers.push(`${error.code}: ${error.message}`)
    }
  }
}
```

The judge agent can then decide how to handle accumulated blockers.

### Pattern 3: Manual Recovery

For unrecoverable errors, the workflow pauses:

```typescript
// Workflow emits workflow:error event
// State is preserved
// User can:
// 1. Fix the issue
// 2. Resume with POST /sessions/:id/resume
```

### Pattern 4: Fork and Retry

Before risky operations, fork the session:

```typescript
// 1. Fork current session
const { forkSessionId } = await fetch(`${baseUrl}/sessions/${sessionId}/fork`, {
  method: "POST"
}).then(r => r.json())

// 2. Try risky operation on fork
const result = await attemptRiskyOperation(forkSessionId)

// 3. If successful, continue with fork
// 4. If failed, abandon fork and try different approach on original
```

## Error Events

### Workflow Errors

```typescript
// Emitted when workflow encounters unrecoverable error
{
  type: "workflow:error",
  payload: {
    error: "StoreError",
    message: "Database connection lost",
    sessionId: "session-123",
    recoverable: false
  }
}
```

### Agent Errors

```typescript
// Emitted when agent fails after retries
{
  type: "agent:error",
  payload: {
    agentName: "planner",
    error: "ProviderError",
    code: "token_limit",
    message: "Request exceeded token limit",
    triggeredBy: "phase:planning",
    retryCount: 3
  }
}
```

## HTTP Error Responses

The HTTP API returns appropriate status codes:

| Status | Meaning | Body |
|--------|---------|------|
| 400 | Invalid request | `{ error: "Invalid input", details: [...] }` |
| 404 | Session not found | `{ error: "Session not found" }` |
| 409 | Session already complete | `{ error: "Session terminated" }` |
| 500 | Internal error | `{ error: "Internal server error" }` |
| 503 | Provider unavailable | `{ error: "Provider unavailable", retryAfter: 30 }` |

### Client-Side Handling

```typescript
async function createSession(goal: string): Promise<string> {
  const response = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: goal })
  })

  if (!response.ok) {
    const error = await response.json()

    if (response.status === 503) {
      // Provider unavailable - retry after delay
      await new Promise(r => setTimeout(r, error.retryAfter * 1000))
      return createSession(goal)
    }

    throw new Error(`Failed to create session: ${error.error}`)
  }

  const { sessionId } = await response.json()
  return sessionId
}
```

## Debugging Errors

### Enable Verbose Logging

```bash
DEBUG=open-scaffold:* pnpm start "My goal"
```

### Inspect Event History

```typescript
// Get all events for debugging
const events = await fetch(`${baseUrl}/sessions/${sessionId}/events?all=true`)
  .then(r => r.json())

// Find error events
const errors = events.filter(e => e.type.includes("error"))
console.log(errors)
```

## Related Documentation

- [Testing Guide](./testing.md) - Testing error scenarios
- [Extension Guide](./extension.md) - Custom error handlers
- [Architecture](../reference/architecture.md) - Error flow in the system
