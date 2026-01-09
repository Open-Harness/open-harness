# The Progressive Example Thread

**Concept:** One example that builds through ALL documentation levels, teaching ONE concept per level.

---

## Domain: The Code Review Assistant

### Why This Domain?
- Developers building with Open Harness are familiar with code review workflows
- Naturally supports all concepts: state, branching, loops, persistence, testing
- Realistic enough to be useful, simple enough to follow
- Claude excels at code review tasks

---

## Level 1: Hello World
**Concept:** Flows execute nodes

```yaml
# flow.yaml
name: hello-reviewer
nodes:
  - id: greet
    type: echo
    input:
      text: "Code Review Assistant ready!"
edges: []
```

```typescript
// run.ts
import { runFlow, parseFlowYaml } from "@open-harness/server";
import fs from "node:fs";

const yaml = fs.readFileSync("flow.yaml", "utf-8");
const snapshot = await runFlow({
  flow: parseFlowYaml(yaml),
});
console.log(snapshot.outputs.greet.text);
// Output: "Code Review Assistant ready!"
```

**What You Learn:**
- Flows have `name` and `nodes`
- Nodes have `id`, `type`, and `input`
- `runFlow()` executes and returns a snapshot
- Node outputs are in `snapshot.outputs.{nodeId}`

---

## Level 2: Stateful Reviewer
**Concept:** Workflows have memory

```yaml
# flow.yaml
name: review-counter
state:
  initial:
    reviewCount: 0
nodes:
  - id: review
    type: claude.agent
    input:
      prompt: |
        Review this code snippet for potential issues:
        {{ flow.input.code }}
edges: []
```

```typescript
// run.ts
import { runFlow, parseFlowYaml, createRuntime } from "@open-harness/server";

// Custom node that tracks review count
const reviewTracker = {
  type: "review.tracker" as const,
  run: async (ctx, input) => {
    const count = ctx.state.get("reviewCount") ?? 0;
    ctx.state.set("reviewCount", count + 1);
    return { reviewNumber: count + 1 };
  },
};

const runtime = createRuntime({
  flow: parseFlowYaml(yaml),
  registry: { "review.tracker": reviewTracker },
});

const snapshot = await runtime.run({ code: "function foo() { return bar }" });
console.log(`Review #${snapshot.outputs.review.reviewNumber}`);
```

**What You Learn:**
- `state.initial` defines starting values
- `ctx.state.get()` and `ctx.state.set()` for reading/writing
- State persists across node executions
- Custom nodes use `ctx` for state access

---

## Level 3: Data Flow Between Nodes
**Concept:** Nodes communicate through bindings

```yaml
name: analyze-and-suggest
nodes:
  - id: analyze
    type: claude.agent
    input:
      prompt: |
        Analyze this code for issues. Return JSON with:
        - issues: array of problems found
        - severity: overall severity (low/medium/high)

        Code: {{ flow.input.code }}

  - id: suggest
    type: claude.agent
    input:
      prompt: |
        Based on this analysis:
        {{ analyze.text }}

        Provide specific suggestions to fix each issue.

edges:
  - from: analyze
    to: suggest
```

**What You Learn:**
- `{{ nodeId.field }}` passes output from one node to another
- Edges define execution order
- `analyze.text` references the text output from the `analyze` node
- No `nodes.X.output.Y` prefix - just `nodeId.field`

---

## Level 4: Branching Reviews
**Concept:** Flows can branch based on data

```yaml
name: severity-router
nodes:
  - id: classify
    type: claude.agent
    input:
      prompt: |
        Classify the severity of issues in this code.
        Return ONLY: "critical", "major", or "minor"

        Code: {{ flow.input.code }}

  - id: critical-handler
    type: claude.agent
    input:
      prompt: |
        CRITICAL ISSUE DETECTED!

        Provide an urgent fix for: {{ flow.input.code }}

  - id: standard-handler
    type: claude.agent
    input:
      prompt: |
        Standard review for: {{ flow.input.code }}

        Provide improvement suggestions.

edges:
  - from: classify
    to: critical-handler
    when: "$contains(classify.text, 'critical')"

  - from: classify
    to: standard-handler
    when: "$not($contains(classify.text, 'critical'))"
```

**What You Learn:**
- `when` clauses on edges enable conditional branching
- JSONata expressions in `when` evaluate to true/false
- Only edges where `when` is true are followed
- Multiple outgoing edges can have different conditions

---

## Level 5: Persistent Reviews
**Concept:** Workflows survive restarts

```typescript
import { createRuntime } from "@open-harness/server";
import { SqliteRunStore } from "@open-harness/run-store-sqlite";

// Create persistent store
const store = new SqliteRunStore({ filename: "./reviews.db" });

const runtime = createRuntime({
  flow: parseFlowYaml(yaml),
  registry,
  store,  // <-- Enable persistence
});

// Start a review
const runId = "review-" + Date.now();
const snapshot = await runtime.run({ code: "..." }, { runId });

// Later: Resume from where we left off
const events = store.loadEvents(runId);
const savedSnapshot = store.loadSnapshot(runId);
```

**What You Learn:**
- `SqliteRunStore` persists events and snapshots
- Pass `store` to `createRuntime()` to enable persistence
- `runId` identifies a specific execution
- `loadEvents()` and `loadSnapshot()` for recovery
- Workflows can survive process restarts

---

## Level 6: Recording Reviews
**Concept:** Test without hitting APIs

```typescript
import { withRecording, createMemoryRecordingStore } from "@open-harness/core";

// Record a real review session
const recordingStore = createMemoryRecordingStore();
const recordedRuntime = withRecording(runtime, recordingStore);

// This calls the real Claude API
await recordedRuntime.run({ code: "function foo() {}" });

// Export the recording
const fixture = recordingStore.getRecording();

// In tests: Replay without API calls
const testRuntime = withRecording(
  createRuntime({ flow, registry }),
  recordingStore,
  { mode: "replay" }  // <-- Use recorded responses
);

// This does NOT call Claude - uses recorded responses
await testRuntime.run({ code: "function foo() {}" });
```

**What You Learn:**
- `withRecording()` wraps runtime to capture interactions
- `mode: "live"` (default) calls real APIs and records
- `mode: "replay"` uses recorded responses
- Deterministic tests without API costs
- Great for CI/CD pipelines

---

## Level 7: Evaluating Review Quality
**Concept:** Data proves what's better

```typescript
import { defineSuite, variant, gates, runSuite } from "@open-harness/core";

// Define test cases
const suite = defineSuite({
  name: "review-quality",

  // The workflow to test
  flow: () => parseFlowYaml(fs.readFileSync("flow.yaml", "utf-8")),

  // Test cases with expected outcomes
  cases: [
    {
      id: "null-check",
      input: { code: "function foo(x) { return x.bar; }" },
      expect: { behavior: (result) => result.text.includes("null") },
    },
    {
      id: "unused-var",
      input: { code: "function foo() { const x = 1; return 2; }" },
      expect: { behavior: (result) => result.text.includes("unused") },
    },
  ],

  // Compare different configurations
  variants: [
    variant("sonnet", { model: "claude-sonnet-4-20250514" }),
    variant("haiku", { model: "claude-haiku-3-20250307" }),
  ],

  // Quality gates
  gates: [
    gates.maxCost(0.01),        // $0.01 max per case
    gates.maxLatency(5000),     // 5 second max
    gates.minPassRate(0.9),     // 90% must pass
  ],
});

// Run the evaluation
const report = await runSuite(suite, { mode: "live" });

console.log(`Passed: ${report.passed}`);
console.log(`Haiku cost: $${report.variants.haiku.cost}`);
console.log(`Sonnet cost: $${report.variants.sonnet.cost}`);

if (!report.passed) {
  process.exit(1);  // Fail CI
}
```

**What You Learn:**
- `defineSuite()` creates a test suite
- Cases define inputs and expected behaviors
- Variants compare different configurations
- Gates enforce quality thresholds (cost, latency, pass rate)
- `runSuite()` executes all cases against all variants
- Report shows which variant is better and why
- Data-driven decisions replace guesswork

---

## How to Use This Thread

### In Documentation

1. **Quickstart** (5 min) - Level 1 only
2. **Your First Agent** - Level 2 + Level 3
3. **Branching & Control Flow** - Level 4
4. **Persistence** - Level 5
5. **Testing** - Level 6
6. **Evaluations** - Level 7

### Naming Convention

All examples use consistent naming:
- Flow: `review-*` prefix
- Input: Always `flow.input.code`
- Output: `*.text` for LLM responses
- State: `reviewCount`, `severity`

### Cross-References

Each page should say:
- "Building on Level N..."
- "Next: Level N+1..."
- "Full example: /examples/code-review-assistant"

---

## Implementation Checklist

- [ ] Create `/examples/code-review-assistant/` directory
- [ ] Add `level-1/`, `level-2/`, etc. subdirectories
- [ ] Each level has working `flow.yaml` and `run.ts`
- [ ] Add tests that verify each level runs
- [ ] Update quickstart to use Level 1
- [ ] Update tutorials to reference appropriate levels
- [ ] Add "Building on..." callouts to each page

---

*Generated from Example Audit on 2026-01-08*
