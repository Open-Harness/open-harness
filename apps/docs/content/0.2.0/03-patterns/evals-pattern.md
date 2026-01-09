# Evals Pattern

**Status:** v0.2.0
**Purpose:** How evals make improvement automatic

---

## Overview

Evals are the point.

Recording, replay, telemetry, and persistence matter because they produce **evidence**. Evals turn evidence into **decisions**:

- which prompt is better
- which provider/model is better for this workflow
- whether a change is a regression
- how to trade off cost vs quality

If you don't measure, you don't improve—you just iterate blindly.

---

## Sections

## What Are Evals

An eval is a repeatable way to grade outcomes.

At minimum, evals produce:

- **Metrics** (numbers): latency, cost, tokens, pass rate, quality scores
- **Gates** (decisions): pass/fail rules that catch regressions
- **Reports** (context): what changed, where it got worse, what to fix

---

## Why Evals Matter

- No guesswork ("I think this is better")
- Data proves what's better
- Regression detection
- Optimization (cost vs. quality tradeoffs)

---

## Eval Types

- Assertions (output contains, latency under, cost under)
- Scorers (built-in: latency, cost, tokens)
- LLM-as-Judge (quality criteria, minScore)
- Human annotation (async, requires human input)
- Custom (user-defined functions)

---

## The v0.2.0 Approach: Native Vitest

Open Harness v0.2.0 uses **native Vitest** for evals. Instead of a custom eval framework, you write standard tests with specialized matchers:

```ts
import { test, expect } from 'vitest'
import { run, agent } from '@open-harness/vitest'

const myAgent = agent({ prompt: 'You are a helpful coding assistant.' })

test('agent responds quickly and cheaply', async () => {
  const result = await run(myAgent, { prompt: 'Write a hello world function' })

  expect(result.output).toBeDefined()
  expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
  expect(result).toCostUnder(0.01)         // < $0.01
  expect(result).toHaveTokensUnder(1000)   // < 1000 total tokens
})
```

### Why Vitest?

- **Familiar**: Standard testing patterns everyone knows
- **Ecosystem**: Vitest reporters, coverage, watch mode, parallelization
- **Maintainable**: No custom framework to learn or maintain
- **Extensible**: Custom matchers for agent-specific assertions

---

## Core Pattern: Cases as Tests

Each test case is a standard Vitest test:

```ts
import { describe, test, expect } from 'vitest'
import { run, agent } from '@open-harness/vitest'

const codeReviewer = agent({
  prompt: 'Review code for bugs, security issues, and style problems.'
})

describe('code reviewer agent', () => {
  test('catches division by zero', async () => {
    const result = await run(codeReviewer, {
      prompt: 'function divide(a, b) { return a / b; }'
    })

    expect(result.output).toContain('division')
    expect(result).toHaveLatencyUnder(10000)
  })

  test('catches SQL injection', async () => {
    const result = await run(codeReviewer, {
      prompt: 'const query = `SELECT * FROM users WHERE id = ${userId}`'
    })

    expect(result.output).toContain('injection')
    expect(result).toCostUnder(0.02)
  })
})
```

---

## Vitest Configuration

### Setup File (Auto-Register Matchers)

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { OpenHarnessReporter } from '@open-harness/vitest'

export default defineConfig({
  test: {
    setupFiles: ['@open-harness/vitest/setup'],
    reporters: ['default', new OpenHarnessReporter({ passRate: 0.8 })],
  }
})
```

### Manual Setup

```ts
// vitest.setup.ts
import { setupMatchers } from '@open-harness/vitest'

setupMatchers()
```

---

## Custom Matchers

### toHaveLatencyUnder(ms)

Asserts the run completed in under the specified milliseconds:

```ts
expect(result).toHaveLatencyUnder(5000)  // Must complete in < 5s
```

### toCostUnder(usd)

Asserts the run cost less than the specified USD amount:

```ts
expect(result).toCostUnder(0.01)  // Must cost < $0.01
```

### toHaveTokensUnder(count)

Asserts total tokens (input + output) are under the specified count:

```ts
expect(result).toHaveTokensUnder(1000)  // Must use < 1000 total tokens
```

---

## Quality Gates with Reporter

The `OpenHarnessReporter` enforces suite-level quality gates:

```ts
import { OpenHarnessReporter } from '@open-harness/vitest'

new OpenHarnessReporter({
  passRate: 0.9,        // At least 90% of tests must pass
  maxLatencyMs: 30000,  // No test can exceed 30s (optional)
  maxCostUsd: 1.0,      // Total cost under $1 (optional)
})
```

If the pass rate drops below the threshold, the reporter sets `process.exitCode = 1`, failing the CI build.

---

## Recording and Replay (Fixtures)

Use fixtures to record live responses and replay them in CI:

```ts
import { FileFixtureStore } from '@open-harness/stores'

const store = new FileFixtureStore('./fixtures')

// Record mode: saves responses to fixtures
const result = await run(myAgent, { prompt: 'Hello' }, {
  fixture: 'hello-test',
  mode: 'record',
  store,
})

// Replay mode: uses saved fixtures (no API calls)
const result = await run(myAgent, { prompt: 'Hello' }, {
  fixture: 'hello-test',
  mode: 'replay',
  store,
})
```

### Environment Variable

Control mode via environment variable:

```bash
# Record fixtures
FIXTURE_MODE=record bun test

# Replay fixtures (CI)
FIXTURE_MODE=replay bun test

# Live mode (default)
bun test
```

---

## Comparing Variants

To compare different prompts or configurations, create separate agents:

```ts
const promptA = agent({
  prompt: 'You are a helpful assistant. Be thorough and detailed.'
})

const promptB = agent({
  prompt: 'You are a concise expert. Be brief and direct.'
})

describe('prompt comparison', () => {
  const testCase = { prompt: 'Explain recursion' }

  test('prompt A', async () => {
    const result = await run(promptA, testCase)
    expect(result).toHaveLatencyUnder(10000)
    // Store result for manual comparison
  })

  test('prompt B', async () => {
    const result = await run(promptB, testCase)
    expect(result).toHaveLatencyUnder(10000)
    // Store result for manual comparison
  })
})
```

---

## Multi-Agent Harnesses

For workflows with multiple agents, use `harness()`:

```ts
import { harness, agent, run } from '@open-harness/vitest'

const classifier = agent({ prompt: 'Classify the input as question or statement.' })
const responder = agent({ prompt: 'Respond helpfully to the input.' })

const myHarness = harness({
  agents: { classifier, responder },
  flow: async (agents, input) => {
    const classification = await agents.classifier.run(input)
    const response = await agents.responder.run(input)
    return { classification, response }
  }
})

test('harness processes input', async () => {
  const result = await run(myHarness, { prompt: 'What is the capital of France?' })
  expect(result.output.classification).toContain('question')
})
```

---

## Regression Detection

Compare new runs against golden recordings:

```bash
# 1. Record baseline
FIXTURE_MODE=record bun test

# 2. Commit fixtures to git
git add fixtures/
git commit -m "Add test fixtures"

# 3. Run in CI (replay mode)
FIXTURE_MODE=replay bun test
```

If tests fail in replay mode, either:
- The agent behavior changed (regression)
- The test expectations need updating

---

## CI Integration

```yaml
# .github/workflows/evals.yml
name: Evals
on: [push, pull_request]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: FIXTURE_MODE=replay bun test
```

The reporter's exit code ensures CI fails on quality gate violations.

---

## FAQ

### What's the difference between assertions and gates?

**Assertions** are per-test checks that validate individual outputs:
- "Output contains 'function'"
- "Latency under 30s"

**Gates** are suite-level decisions via the reporter:
- "90% of tests must pass"
- "Total cost under $1"

### How do I debug a failing test?

1. **Run with verbose output**:
   ```bash
   bun test --reporter verbose
   ```

2. **Run a single test**:
   ```bash
   bun test -t "catches division by zero"
   ```

3. **Check the result object** - log `result.output` and `result.metrics`

### What run modes are available?

| Mode | Description | Use Case |
|------|-------------|----------|
| `live` (default) | Real API calls | Development |
| `replay` | Use recorded fixtures | CI, fast iteration |
| `record` | Live calls, save fixtures | Creating test fixtures |

### Can I use custom assertions?

Yes. Use standard Vitest custom matchers or write helper functions:

```ts
function expectContainsCode(result: RunResult) {
  expect(result.output).toMatch(/```[\s\S]*```/)
}

test('generates code', async () => {
  const result = await run(agent, { prompt: 'Write a function' })
  expectContainsCode(result)
})
```

---

## See Also

- [@open-harness/vitest](../../../../packages/open-harness/vitest/) - Vitest plugin source
- [Quickstart](../../docs/learn/quickstart.mdx) - Getting started guide

---

## Purpose

Explain the evals pattern and how to use it with native Vitest integration.
