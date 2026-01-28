# Testing Open Scaffold Workflows

This guide covers testing strategies for Open Scaffold workflows, from unit testing pure functions to integration testing with recorded AI responses.

## Overview

| Level | What to Test | Tools | Speed |
|-------|--------------|-------|-------|
| Unit | State update functions, `computeStateAt()` | Vitest | Fast |
| Integration | Agents with recorded responses | ProviderRecorder | Medium |
| E2E | Full HTTP flow | Vitest + fetch | Slow |

## Testing State Updates

Agent `update` functions are pure: `(output, draft) => void`. They are the easiest to test.

```typescript
import { describe, it, expect } from "vitest"

// Test the update function directly with a draft state
describe("planner agent update", () => {
  it("adds tasks to queue", () => {
    const output = {
      tasks: [
        { id: "task-1", description: "Implement user login", priority: "high" as const }
      ],
      planningComplete: false
    }

    const state = {
      goal: "Build auth system",
      taskQueue: [],
      cyclePhase: "planning" as const
    }

    // Simulate the update function
    const draft = structuredClone(state)
    // Assuming the update function does: draft.taskQueue.push(...output.tasks)
    draft.taskQueue.push(...output.tasks)

    expect(draft.taskQueue).toHaveLength(1)
    expect(draft.taskQueue[0].description).toBe("Implement user login")
  })

  it("preserves existing tasks", () => {
    const existingTask = {
      id: "task-0",
      description: "Existing task",
      priority: "medium" as const
    }

    const output = {
      tasks: [
        { id: "task-1", description: "New task", priority: "low" as const }
      ],
      planningComplete: false
    }

    const state = {
      goal: "Build auth system",
      taskQueue: [existingTask],
      cyclePhase: "planning" as const
    }

    const draft = structuredClone(state)
    draft.taskQueue.push(...output.tasks)

    expect(draft.taskQueue).toHaveLength(2)
    expect(draft.taskQueue[0]).toEqual(existingTask)
  })
})
```

### Testing State Derivation with `computeStateAt`

Use `computeStateAt(events, position)` to derive and verify state at any point:

```typescript
import { computeStateAt } from "@open-scaffold/core"

describe("computeStateAt", () => {
  it("derives correct state from events", () => {
    const events = [
      { name: "workflow:started", payload: { input: "Build a todo app" } },
      { name: "agent:completed", payload: { agentName: "planner" } },
      { name: "phase:changed", payload: { from: "planning", to: "working" } }
    ]

    const state = computeStateAt(events, 2)
    expect(state.phase).toBe("working")
  })
})
```

## Testing Agents with ProviderRecorder

Open Scaffold uses `ProviderRecorderLive` to record real AI responses and replay them deterministically in tests.

### Recording Mode

First run tests in "live" mode to record actual Anthropic responses:

```typescript
import { describe, it, expect } from "vitest"
import { execute } from "@open-scaffold/core"
import { myWorkflow } from "./workflow"

describe("PlannerAgent (recording)", () => {
  it("creates tasks from goal", async () => {
    // Use "live" mode to call real API and record
    const events = []

    const execution = execute(myWorkflow, {
      input: "Add a health check endpoint",
      database: "file:./test/fixtures/planner-test.db",
      mode: "live",
      providers: { "claude-sonnet-4-5": anthropicProvider }
    })

    for await (const event of execution) {
      events.push(event)
    }

    expect(events.length).toBeGreaterThan(0)
    expect(events.some(e => e.name === "agent:completed")).toBe(true)
  }, 60000) // Long timeout for real API calls
})
```

### Playback Mode

Subsequent test runs use "playback" mode:

```typescript
describe("PlannerAgent (playback)", () => {
  it("replays recorded tasks", async () => {
    // Use "playback" mode to replay recorded responses
    const events = []

    const execution = execute(myWorkflow, {
      input: "Add a health check endpoint",
      database: "file:./test/fixtures/planner-test.db",
      mode: "playback",
      providers: { "claude-sonnet-4-5": anthropicProvider }
    })

    for await (const event of execution) {
      events.push(event)
    }

    // This runs much faster - no API calls
    expect(events.length).toBeGreaterThan(0)
    expect(events.some(e => e.name === "agent:completed")).toBe(true)
  }, 10000) // Short timeout - no API calls
})
```

### CI Integration

Commit the recorded fixtures database to your repository:

```
test/
  fixtures/
    planner-test.db     # Recorded API responses
    worker-test.db
    full-workflow.db
```

In CI, always use playback mode:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      PROVIDER_MODE: playback
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
```

## E2E Testing with HTTP Client

Test the full HTTP API including SSE event streaming:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"

describe("HTTP API E2E", () => {
  let baseUrl: string

  beforeAll(async () => {
    // Start server in playback mode
    // ...
    baseUrl = `http://localhost:${port}`
  })

  it("POST /sessions creates a new session", async () => {
    const response = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "Test goal" })
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.sessionId).toBeDefined()
    expect(typeof body.sessionId).toBe("string")
  })

  it("GET /sessions/:id/events streams SSE events", async () => {
    // Create session
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "Test goal" })
    })
    const { sessionId } = await createResponse.json()

    // Stream events
    const eventsResponse = await fetch(`${baseUrl}/sessions/${sessionId}/events`)
    expect(eventsResponse.headers.get("content-type")).toContain("text/event-stream")

    const reader = eventsResponse.body!.getReader()
    const decoder = new TextDecoder()
    const events: unknown[] = []

    // Read a few events
    for (let i = 0; i < 5; i++) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          events.push(JSON.parse(line.slice(6)))
        }
      }
    }

    reader.releaseLock()

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toHaveProperty("type")
  })

  it("GET /sessions/:id/state returns current state", async () => {
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "Test goal" })
    })
    const { sessionId } = await createResponse.json()

    const stateResponse = await fetch(`${baseUrl}/sessions/${sessionId}/state`)
    expect(stateResponse.status).toBe(200)

    const state = await stateResponse.json()
    expect(state).toHaveProperty("goal")
  })
})
```

## Best Practices

### 1. Use Deterministic IDs in Tests

```typescript
// Bad - random IDs make assertions fragile
const taskId = crypto.randomUUID()

// Good - predictable IDs
const taskId = "test-task-1"
```

### 2. Test State Transitions Exhaustively

Each agent's `update` function should have tests for:
- Normal operation
- Edge cases (empty arrays, missing fields)
- Invalid inputs (if applicable)

### 3. Commit Recorded Fixtures

Keep fixtures in version control so CI doesn't need API access:

```bash
# Record new fixtures locally
PROVIDER_MODE=live pnpm test:record

# Commit the fixtures
git add test/fixtures/*.db
git commit -m "chore: update test fixtures"
```

### 4. Use Separate Databases per Test Suite

```typescript
// planner.test.ts
const config = { database: "file:./test/fixtures/planner.db", mode: "playback" }

// worker.test.ts
const config = { database: "file:./test/fixtures/worker.db", mode: "playback" }
```

### 5. Clean Up Resources

Always clean up after tests to avoid connection leaks.

## Related Documentation

- [Error Handling Guide](./error-handling.md) - Testing error scenarios
- [Extension Guide](./extension.md) - Testing custom agents
- [Reference Implementation](../reference/reference-implementation.md) - Full workflow example
