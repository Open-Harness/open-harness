# SpecKit: Threaded Example

A progressive tutorial that builds from a simple Task Executor to a full 3-agent
system that transforms PRDs into implemented code.

## Quick Start

```bash
cd examples/speckit
bun install
bun test level-1/
```

## Levels

| Level | Concept | Lines | Run |
|-------|---------|-------|-----|
| 1 | Basic agent + text output | ~15 | `bun test level-1/` |
| 2 | Agent with state | ~25 | `bun test level-2/` |
| 3 | Self-validation loop | ~80 | `bun test level-3/` |
| 4 | Multi-agent harness | ~60 | `bun test level-4/` |
| 5 | Full 3-agent system | ~80 | `bun test level-5/` |
| 6 | Fixtures + replay | ~60 | `bun test level-6/` |
| 7 | Model comparison + CI | ~80 | `bun test level-7/` |

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

### Level 2: Agent with State
Add state that persists across invocations.

```typescript
const taskExecutor = agent({
  prompt: `You are a task planning assistant...`,
  state: { tasksProcessed: 0 }
})
```

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

### Level 6: Fixtures + Replay
Record and replay agent responses for deterministic testing.

```bash
# Record fixtures
FIXTURE_MODE=record bun test level-6/

# Replay in CI (no API calls)
FIXTURE_MODE=replay bun test level-6/
```

### Level 7: CI Quality Gates
Set thresholds for latency, cost, and quality in CI.

## The Full System

```
PRD → [Spec Agent] → tasks → [Coding Agent] → code → [Reviewer Agent] → approval
```

## Important Notes

- **Test Duration**: Claude Code SDK tests take 1-3 minutes due to subprocess overhead
- **Timeouts**: All integration tests use 180s+ timeouts
- **Fixtures**: Level 6+ shows how to record/replay for fast CI
- **Token Counts**: Show 0 due to subscription auth (expected)
- **Costs**: Are tracked per run for budget monitoring

## Running All Tests

```bash
# Run all levels (takes ~15-20 minutes)
bun test

# Run specific level
bun test level-3/

# Run with fixture replay (fast, no API calls)
FIXTURE_MODE=replay bun test level-6/
```

## Learn More

- [Open Harness Documentation](https://open-harness.dev/docs)
- [API Reference](https://open-harness.dev/docs/reference/api)
