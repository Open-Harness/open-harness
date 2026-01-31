# Execution API

**Single entry point: `run()`**

Open Scaffold provides one function for running workflows. It returns a handle that can be awaited directly or controlled with pause/resume/abort methods.

> **Design rationale:** See [ADR-001: Execution API Design](../plans/adr/001-execution-api.md)

---

## Basic Usage

```typescript
import { run } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build a REST API",
  runtime: myRuntime
})

console.log("Final state:", result.state)
```

---

## The `run()` Function

```typescript
function run<S, Input>(
  workflow: WorkflowDef<S, Input>,
  options: RunOptions<S, Input>
): WorkflowExecution<S>
```

### RunOptions

| Option | Type | Description |
|--------|------|-------------|
| `input` | `Input` | Input to the workflow's `start()` function |
| `runtime` | `RuntimeConfig` | Provider mode and services |
| `sessionId?` | `string` | Optional session ID (auto-generated if omitted) |
| `signal?` | `AbortSignal` | For external cancellation |
| `observer?` | `WorkflowObserver<S>` | Event callbacks for streaming |
| `humanInput?` | `HumanInputHandler` | HITL handlers (see below) |

### WorkflowExecution

The return type implements `PromiseLike`, so you can await it directly. It also exposes control methods:

| Member | Description |
|--------|-------------|
| `sessionId` | The session ID for this execution |
| `isPaused` | Whether execution is paused |
| `pause()` | Pause at the next yield point |
| `resume()` | Resume a paused execution |
| `abort()` | Cancel execution (rejects the promise) |

---

## With Observer Callbacks

Stream events in real-time:

```typescript
const result = await run(myWorkflow, {
  input: "Hello",
  runtime: myRuntime,
  observer: {
    onTextDelta: ({ delta }) => process.stdout.write(delta),
    onStateChanged: (state, patches) => console.log("State:", state),
    onAgentStarted: ({ agent }) => console.log(`${agent} started`),
    onAgentCompleted: ({ agent, durationMs }) => console.log(`${agent} done in ${durationMs}ms`)
  }
})
```

---

## With Pause/Resume

Control execution flow:

```typescript
const execution = run(myWorkflow, { input: "Hello", runtime: myRuntime })

// Pause when needed
execution.pause()

// Resume later
execution.resume()

// Await final result
const result = await execution
```

---

## With AbortSignal

Integrate with external cancellation:

```typescript
const controller = new AbortController()

const execution = run(myWorkflow, {
  input: "Hello",
  runtime: myRuntime,
  signal: controller.signal
})

// Cancel from elsewhere
controller.abort()

try {
  await execution
} catch (e) {
  console.log("Aborted:", e.message)
}
```

---

## With Human-in-the-Loop (HITL)

Use `humanInput` handlers for phases that require human input:

```typescript
import { cliPrompt, autoApprove } from "@open-scaffold/core"

// Terminal prompts
await run(myWorkflow, {
  input: "Deploy to production",
  runtime: myRuntime,
  humanInput: cliPrompt()
})

// Auto-approve for testing
await run(myWorkflow, {
  input: "Deploy to production",
  runtime: myRuntime,
  humanInput: autoApprove()
})
```

> **More details:** See the HITL documentation for custom handlers.

---

## RunResult

The awaited result includes:

| Field | Type | Description |
|-------|------|-------------|
| `state` | `S` | Final workflow state |
| `sessionId` | `string` | Session ID |
| `events` | `AnyEvent[]` | All events generated |
| `completed` | `boolean` | Whether completed normally |
| `exitPhase?` | `string` | Final phase (for phased workflows) |
| `durationMs` | `number` | Total execution time in ms |

---

## See Also

- [Getting Started](../getting-started.md) - First workflow in 5 minutes
- [Building Workflows](../building-workflows.md) - Defining workflows and phases
- [ADR-001](../plans/adr/001-execution-api.md) - Why a single `run()` API
