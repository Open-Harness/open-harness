# Recording and Replay Guide

Complete guide for using fixtures with OpenHarness to avoid hitting the API repeatedly.

## Quick Summary

```typescript
// 1. RECORDING MODE - Runs real API calls and saves responses
const RecordingHarness = defineHarness({
  name: "my-workflow",
  mode: "live", // Uses real LLM
  agents: { coder: CodingAgent },
  run: async ({ agents }) => {
    return await agents.coder.execute({ task: "Hello world" });
  },
});

// 2. REPLAY MODE - Uses saved fixtures, no API calls
const ReplayHarness = defineHarness({
  name: "my-workflow",
  mode: "replay", // Uses fixtures
  agents: { coder: CodingAgent },
  run: async ({ agents }) => {
    return await agents.coder.execute({ task: "Hello world" });
  },
});
```

## How It Works

### 1. Container Modes

The harness passes `mode` to the container, which determines which runner is used:

- **`mode: "live"`** → Uses `AnthropicRunner` (real API calls)
- **`mode: "replay"`** → Uses `ReplayRunner` (reads from fixtures)

### 2. Fixture Structure

Fixtures are JSONL files (one JSON object per line):

```json
{"prompt": "Write a hello world function", "options": {...}, "messages": [...]}
{"prompt": "Review this code", "options": {...}, "messages": [...]}
```

Each line is a **recorded session** containing:
- `prompt`: The exact prompt sent to the LLM
- `options`: SDK options (model, temperature, etc.)
- `messages`: Array of SDK messages (system, assistant, user, result)

### 3. Directory Structure

```
tests/fixtures/
├── golden/              # Curated test scenarios (committed to git)
│   ├── coding-agent/
│   │   └── hello-world.jsonl
│   └── review-agent/
│       └── code-review.jsonl
└── artifacts/           # Auto-generated recordings (gitignored)
    └── temp-recordings.jsonl
```

## Complete Example

### Step 1: Create a Harness with Agent

```typescript
import { defineHarness } from "@openharness/sdk";
import { defineAnthropicAgent } from "@openharness/anthropic";
import { z } from "zod";

// Define agent
const CodingAgent = defineAnthropicAgent({
  name: "Coder",
  prompt: "Write code for: {{task}}",
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ code: z.string() }),
});

// Define harness
const CodeWorkflow = defineHarness({
  name: "coding-workflow",
  mode: "live", // or "replay"
  agents: { coder: CodingAgent },
  state: () => ({ results: [] as string[] }),
  run: async ({ agents, state, phase, task }) => {
    await phase("Coding", async () => {
      await task("task-1", async () => {
        const result = await agents.coder.execute({ task: "Hello world function" });
        state.results.push(result.code);
        return result;
      });
    });
    return { code: state.results };
  },
});
```

### Step 2: Record a Fixture (Live Mode)

```typescript
// recording-example.ts
import { CodeWorkflow } from "./workflow.js";

async function record() {
  console.log("📹 Recording new fixture...");

  // Run in live mode (hits real API)
  const result = await CodeWorkflow.create({}).run();

  console.log("✅ Recorded! Result:", result);
  console.log("💾 Fixture saved to: tests/fixtures/artifacts/");
}

record();
```

**What happens:**
1. Harness uses `AnthropicRunner` (real API)
2. Agent makes LLM call
3. Response is automatically saved to `tests/fixtures/artifacts/coding-agent/hello-world.jsonl`
4. You can now commit this to `tests/fixtures/golden/` if it's a good test case

### Step 3: Use Replay Mode (No API Calls)

```typescript
// replay-example.ts
import { defineHarness } from "@openharness/sdk";
import { CodingAgent } from "./agents.js";

// Same harness, but in replay mode
const ReplayWorkflow = defineHarness({
  name: "coding-workflow",
  mode: "replay", // 👈 Uses fixtures instead of API
  agents: { coder: CodingAgent },
  run: async ({ agents }) => {
    const result = await agents.coder.execute({ task: "Hello world function" });
    return result;
  },
});

async function replay() {
  console.log("▶️  Replaying from fixture...");

  // No API call - reads from fixture
  const result = await ReplayWorkflow.create({}).run();

  console.log("✅ Replayed! Result:", result);
  console.log("⚡ Fast! No API latency!");
}

replay();
```

**What happens:**
1. Harness uses `ReplayRunner` instead of `AnthropicRunner`
2. `ReplayRunner` looks for fixture in `tests/fixtures/golden/` or `tests/fixtures/agents/`
3. Finds `coding-agent/hello-world.jsonl`
4. Replays the recorded messages
5. Returns the same result - no API call!

## Using Fixtures in Tests

```typescript
// tests/coding-workflow.test.ts
import { describe, test, expect } from "bun:test";
import { defineHarness } from "@openharness/sdk";
import { CodingAgent } from "../src/agents.js";

describe("Coding Workflow", () => {
  test("generates hello world function", async () => {
    // Use replay mode in tests
    const Workflow = defineHarness({
      name: "coding-workflow",
      mode: "replay", // Fast tests, no API costs
      agents: { coder: CodingAgent },
      run: async ({ agents }) => {
        return await agents.coder.execute({ task: "Hello world function" });
      },
    });

    const result = await Workflow.create({}).run();

    // Assert on recorded response
    expect(result.result.code).toContain("function");
    expect(result.result.code).toContain("hello");
  });
});
```

## Advanced: Scenario IDs

For more complex workflows with multiple agent calls, you can use scenario IDs:

```typescript
const agent = defineAnthropicAgent({
  name: "Coder",
  // ...
  options: {
    scenarioId: "complex-workflow-1", // 👈 Matches fixture filename
  },
});
```

This helps `ReplayRunner` find the right fixture when you have many recordings.

## Best Practices

### 1. Golden Fixtures (Committed)
- Small, focused test scenarios
- One scenario per file
- Descriptive names: `coding-agent/adds-function.jsonl`
- Review before committing (check for secrets!)

### 2. Artifacts (Gitignored)
- Temporary recordings during development
- Can be large and messy
- Move to `golden/` after cleanup

### 3. Test Organization

```typescript
// Safe tests (no API, always run)
bun test tests/unit tests/replay

// Live tests (requires API key, manual run)
bun test tests/integration
```

## Channels Work with Replay!

The channel fix we just made works with replay mode too:

```typescript
const Workflow = defineHarness({
  mode: "replay",
  agents: { coder: CodingAgent },
  run: async ({ agents }) => { /* ... */ },
});

// Channels receive ALL events, even from replayed agents
await Workflow.create({})
  .attach(consoleChannel())
  .attach(clackChannel())
  .run();
```

You'll see:
- ✅ Agent events (agent:start, agent:text, agent:tool:*, agent:complete)
- ✅ Harness events (phase, task)
- ⚡ Fast execution (no API latency)
- 💰 No API costs

## How Recording Actually Works

Currently, recording is done by the runner infrastructure. When you use `mode: "live"`:

1. Container binds `AnthropicRunner`
2. `AnthropicRunner` calls the SDK's `query()` function
3. SDK returns messages
4. **Recording happens automatically** (if configured)
5. Messages are saved to JSONL

When you use `mode: "replay"`:

1. Container binds `ReplayRunner` instead
2. `ReplayRunner.run()` reads the JSONL file
3. Fires the same callback sequence
4. Returns the recorded result

**The agent doesn't know the difference!** Both runners implement `IAgentRunner` interface.

## Common Issues

### "Recording not found"

```
ReplayRunner: Recording not found for scenario XYZ
```

**Solution**: Make sure:
1. You recorded in live mode first
2. The fixture exists in `tests/fixtures/golden/` or `tests/fixtures/agents/`
3. The scenario ID matches the filename

### "No matching session found for prompt"

The prompt in replay mode must **exactly match** the recorded prompt.

**Solution**: Use the exact same prompt string, or use scenario IDs.

## Next: Two-Phase Harness Example

Your request about "task agent for phase 1 and coder for phase 2" would look like this:

```typescript
const TwoPhaseWorkflow = defineHarness({
  name: "two-phase",
  mode: "replay", // or "live" to record
  agents: {
    planner: PlannerAgent,
    coder: CodingAgent,
  },
  state: () => ({ tasks: [], code: [] }),
  run: async ({ agents, state, phase, task }) => {
    // Phase 1: Planning
    await phase("Planning", async () => {
      await task("generate-tasks", async () => {
        const plan = await agents.planner.execute({ prd: "Build TODO app" });
        state.tasks = plan.tasks;
        return plan;
      });
    });

    // Phase 2: Coding (iterate through tasks)
    await phase("Coding", async () => {
      for (const t of state.tasks) {
        await task(t.id, async () => {
          const code = await agents.coder.execute({ task: t.description });
          state.code.push(code.code);
          return code;
        });
      }
    });

    return { tasks: state.tasks, code: state.code };
  },
});
```

With replay mode, this runs instantly with NO API calls!
