# Quickstart

**Status:** Complete  
**Purpose:** Build your first Open Harness agent in 5 minutes

---

## Overview

Get up and running in 5 minutes with a simple code review agent.

---

## What You'll Build

A code review assistant that analyzes code and provides feedback with metrics tracking.

```
Input: Code → [Code Reviewer Agent] → Output: Review + Metrics (latency, cost, tokens)
```

---

## Step 1: Install SDK

```bash
mkdir my-agent && cd my-agent
bun init -y
bun add @open-harness/core @open-harness/server @open-harness/stores
```

---

## Step 2: Create the Agent

Create `agent.ts`:

```typescript
import { agent, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";

// Configure provider (auth handled by Claude Code subscription)
setDefaultProvider(createClaudeNode());

// Define your agent with a system prompt
const codeReviewer = agent({
  prompt: `You are an expert code reviewer. Analyze code for:
- Bugs and edge cases
- Security vulnerabilities  
- Performance issues

Format as:
## Issues
[List with severity: HIGH/MEDIUM/LOW]

## Verdict
APPROVE or REQUEST_CHANGES`,
});

// Run the agent
const result = await run(codeReviewer, {
  prompt: `Review: function divide(a, b) { return a / b; }`,
});

console.log("Review:", result.output);
console.log("Latency:", result.metrics.latencyMs, "ms");
console.log("Cost: $", result.metrics.cost.toFixed(4));
```

---

## Step 3: Run It

```bash
bun run agent.ts
```

Expected output:

```
Review: ## Issues
- **HIGH**: Division by zero - no check for b === 0

## Verdict
REQUEST_CHANGES

Latency: 2341 ms
Cost: $ 0.0023
```

---

## Step 4: Add Fixtures for Testing

Create `test-utils.ts`:

```typescript
import { FileRecordingStore } from "@open-harness/stores";
import { setDefaultStore, setDefaultMode } from "@open-harness/core";

export const fixtureStore = new FileRecordingStore({ directory: "./fixtures" });

export function setupFixtures() {
  setDefaultStore(fixtureStore);
  if (!process.env.FIXTURE_MODE) {
    setDefaultMode("replay");
  }
}

export function withFixture(name: string) {
  return { fixture: name, store: fixtureStore };
}
```

Create `agent.test.ts`:

```typescript
import { describe, expect, it, beforeAll } from "bun:test";
import { run, setDefaultProvider, agent } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { setupFixtures, withFixture } from "./test-utils";

beforeAll(() => {
  setDefaultProvider(createClaudeNode());
  setupFixtures();
});

const codeReviewer = agent({
  prompt: "Review code for bugs and security issues.",
});

describe("Code Reviewer", () => {
  it("catches division by zero", async () => {
    const result = await run(
      codeReviewer,
      { prompt: "function divide(a, b) { return a / b; }" },
      withFixture("division-review"),
    );

    expect(result.output).toContain("division");
  }, { timeout: 180000 });
});
```

Run tests:

```bash
# Record fixtures (first time, costs ~$0.01)
FIXTURE_MODE=record bun test

# Replay fixtures (free, instant)
bun test
```

---

## Step 5: Next Steps

| Next Step | What You Learn |
|-----------|----------------|
| [SpecKit Tutorial](./speckit-tutorial.md) | 7-level progressive tutorial |
| [Multi-Agent Harness](./speckit-tutorial.md#level-4-multi-agent-harness) | Compose agents with `harness()` |
| [Quality Gates](./speckit-tutorial.md#level-7-ci-quality-gates) | CI integration |

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| `agent()` | Creates an agent with a system prompt |
| `run()` | Executes agent, returns `{ output, metrics, state }` |
| `metrics` | Automatic tracking of latency, cost, tokens |
| Fixtures | Record once, replay forever for free tests |

---

## Troubleshooting

**Cannot find module '@open-harness/core'**
```bash
bun install
```

**Authentication failed**
Run from within Claude Code - authentication uses Claude Code subscription.

**Test timeout**
LLM calls take 30-60s. Use `{ timeout: 180000 }` or fixtures for instant replay.
