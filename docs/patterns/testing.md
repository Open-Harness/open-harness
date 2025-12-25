# Testing Patterns

This document covers the testing patterns for Open Harness, implementing [Constitution Principle II: Verified by Reality](.specify/memory/constitution.md).

## The TDD + Reality Workflow

```
1. Capture fixtures    → Record real LLM responses (golden recordings)
2. TDD against fixtures → Red-green-refactor with ReplayRunner (fast)
3. Prove completion    → Live integration test with real LLM (proves it works)
```

## Recording Pattern

The recorder captures real LLM responses to JSONL files for deterministic replay.

### Record Mode (Capture Real Responses)

```typescript
// Creates fixtures from actual LLM calls
const container = createContainer({ mode: "live" });
// Writes: recordings/golden/{scenarioId}.jsonl
```

### Replay Mode (Fast TDD)

```typescript
// Replays captured fixtures deterministically
const container = createContainer({ mode: "replay" });
// Reads: recordings/golden/{scenarioId}.jsonl
```

## Recording File Format

Recordings are stored as JSONL (one JSON object per line):

```
recordings/
├── golden/           # Committed to repo, used in CI
│   ├── coding-simple.jsonl
│   └── workflow-full.jsonl
└── scratch/          # Local experiments, gitignored
    └── debug-session.jsonl
```

Each line contains:
```json
{
  "prompt": "Write a function that adds two numbers",
  "options": { "model": "opus" },
  "messages": [
    { "type": "system", "subtype": "init", ... },
    { "type": "assistant", "message": { "content": [...] } },
    { "type": "result", "subtype": "success", ... }
  ]
}
```

## Test File Organization

```
tests/
├── unit/           # Pure logic (no external calls)
│   ├── parser.test.ts
│   └── state-machine.test.ts
└── integration/    # Real or recorded LLM calls
    ├── live-sdk.test.ts      # Real API (slow, proves production)
    └── recorded-*.test.ts    # Replay mode (fast, deterministic)
```

## When to Use What

| Scenario | Test Type | Speed | Reality |
|----------|-----------|-------|---------|
| Parser/transformer | Unit | Fast | N/A |
| State machine | Unit | Fast | N/A |
| Agent behavior | Recorded integration | Fast | Captured |
| Workflow E2E | Recorded integration | Fast | Captured |
| Feature completion | Live integration | Slow | Real |

## Writing a Recorded Test

```typescript
import { describe, test, expect } from "bun:test";
import { createContainer, CodingAgent } from "@openharness/sdk";

describe("CodingAgent (recorded)", () => {
  test("executes simple task", async () => {
    const container = createContainer({ mode: "replay" });
    const agent = container.get(CodingAgent);

    const result = await agent.execute(
      "Write a function that adds two numbers",
      "coding-simple", // matches recordings/golden/coding-simple.jsonl
    );

    expect(result).toBeDefined();
    expect(result.stopReason).toBe("success");
  });
});
```

## Capturing New Recordings

```typescript
// scripts/capture-recording.ts
import { createContainer, CodingAgent } from "@openharness/sdk";

const container = createContainer({ mode: "live" }); // Real calls
const agent = container.get(CodingAgent);

// This will write to recordings/golden/{scenarioId}.jsonl
await agent.execute("Write a function that adds two numbers", "coding-simple");
```

Run with:
```bash
RECORD_MODE=true bun run scripts/capture-recording.ts
```

## Live Integration Tests

Live tests are slower but prove production behavior. Run them when completing a feature:

```typescript
describe("CodingAgent (live)", () => {
  test("executes with real LLM", async () => {
    const container = createContainer({ mode: "live" });
    const agent = container.get(CodingAgent);

    const result = await agent.execute(
      "Write a function that adds two numbers",
      `live-${Date.now()}`,
    );

    expect(result).toBeDefined();
  }, { timeout: 60000 }); // LLM calls can be slow
});
```

## Key Rules

1. **Fixtures MUST be real** — never hand-craft JSONL files
2. **Golden recordings are committed** — they're part of the test suite
3. **Completion requires live proof** — at least one real LLM call when marking "done"
4. **Unit tests for pure logic only** — no network, no DI, no external services
