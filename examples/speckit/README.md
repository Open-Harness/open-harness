# SpecKit: Threaded Example

A progressive tutorial that builds from a simple Task Executor to a full 3-agent
system that transforms PRDs into implemented code.

## Quick Start

```bash
cd examples/speckit
bun install

# Record fixtures first (one-time)
bun test:record

# Run tests (uses fixtures, fast and free)
bun test
```

## Running Tests

| Command | What it does | Cost |
|---------|--------------|------|
| `bun test` | Replay from fixtures | $0 |
| `bun test:record` | Execute live, save fixtures | ~$0.14 |
| `bun test:live` | Execute live, no fixtures | ~$0.14 |

**Key insight:** Fixtures are introduced at Level 2 because they're a **core feature**, not an advanced one. Every production use of Open Harness should use fixture recording for testing.

## Levels

| Level | Concept | Uses Fixtures? |
|-------|---------|----------------|
| 1 | Basic agent | No (minimal example) |
| 2 | **State + Fixtures** | Yes |
| 3 | Self-validation loop | Yes |
| 4 | Multi-agent harness | Yes |
| 5 | Full 3-agent system | Yes |
| 6 | Advanced fixture patterns | Yes |
| 7 | Model comparison + CI | Yes |

## What You'll Learn

### Level 1: Basic Agent
Create your first agent with `createWorkflow()` and run it with `runReactive()`.

```typescript
import { createWorkflow, ClaudeHarness } from "@open-harness/core"

// 1. Define state type
type TaskState = { prompt: string; plan: string | null }

// 2. Create typed workflow factory
const { agent, runReactive } = createWorkflow<TaskState>()

// 3. Define agent with signal activation
const taskExecutor = agent({
  prompt: `You are a task planning assistant. Task: {{ state.prompt }}`,
  activateOn: ["workflow:start"],
  emits: ["plan:complete"],
  updates: "plan",
})

// 4. Run the workflow
const result = await runReactive({
  agents: { taskExecutor },
  state: { prompt: "Implement email validation", plan: null },
  harness: new ClaudeHarness({ model: "claude-sonnet-4-20250514" }),
  endWhen: (state) => state.plan !== null,
})
```

### Level 2: State + Fixtures
Add state AND learn the fixture recording pattern.

```typescript
import { setupFixtures, withFixture } from "../test-utils"

beforeAll(() => {
  setupFixtures()  // Sets default store + replay mode
})

it("runs with fixture", async () => {
  const result = await run(taskExecutor, input, withFixture("my-test"))
})
```

See [level-2/README.md](./level-2/README.md) for full fixture documentation.

### Level 3: Self-Validation Loop
Agents can validate their own output and iterate until quality thresholds are met.

### Level 4: Multi-Agent Harness
Coordinate multiple agents with signal chaining (activateOn/emits).

```typescript
// Spec agent activates on start, emits when done
const specAgent = agent({
  prompt: `Break down PRD into tasks: {{ state.prompt }}`,
  activateOn: ["workflow:start"],
  emits: ["spec:complete"],
  updates: "specOutput",
})

// Coder agent activates when spec completes
const codingAgent = agent({
  prompt: `Implement tasks from: {{ state.specOutput }}`,
  activateOn: ["spec:complete"],  // Signal chaining!
  emits: ["code:complete"],
  updates: "coderOutput",
})

// Run coordinated workflow
const result = await runReactive({
  agents: { spec: specAgent, coder: codingAgent },
  state: initialState,
  harness,
  endWhen: (state) => state.coderOutput !== null,
})
```

### Level 5: Full 3-Agent System
Complete PRD → Spec → Coder → Reviewer workflow.

### Level 6: Advanced Fixture Patterns
More fixture patterns: variants, selective recording, fixture inspection.

### Level 7: CI Quality Gates
Set thresholds for latency, cost, and quality in CI.

## The Full System

```
PRD → [Spec Agent] → tasks → [Coding Agent] → code → [Reviewer Agent] → approval
```

## Fixture Workflow

```bash
# 1. Record fixtures (first time or after prompt changes)
bun test:record

# 2. Commit fixtures to git
git add fixtures/
git commit -m "Update test fixtures"

# 3. Run tests (uses fixtures)
bun test

# 4. In CI
bun test  # Fast, free, deterministic
```

## Important Notes

- **Test Duration**: Live tests take 1-3 minutes due to Claude SDK overhead
- **Fixtures**: Make tests instant and free after initial recording
- **Timeouts**: Integration tests use 180s+ timeouts for live mode
- **Token Counts**: Show 0 due to subscription auth (expected)
- **Costs**: Are tracked per run for budget monitoring

## Learn More

- [Open Harness Documentation](https://open-harness.dev/docs)
- [API Reference](https://open-harness.dev/docs/reference/api)
