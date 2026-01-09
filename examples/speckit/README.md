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
Create your first agent with `agent()` and run it with `run()`.

```typescript
import { agent, run } from "@open-harness/core"

const taskExecutor = agent({
  prompt: `You are a task planning assistant...`
})

const result = await run(taskExecutor, { prompt: "Implement email validation" })
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
Coordinate multiple agents with `harness()` and edges.

```typescript
const specKit = harness({
  agents: { spec: specAgent, coder: codingAgent },
  edges: [{ from: "spec", to: "coder" }],
  state: initialState
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
