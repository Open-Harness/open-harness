# Prompt Comparison Eval Example

> **Status:** Design document for Phase 8.1-8.2
> **User Story:** "I have a workflow. I changed my prompt. Is it better or worse?"

## Overview

This example demonstrates the primary use case for Open Harness evals: comparing different system prompts on the same workflow to measure which performs better.

## User Story

```
As a developer iterating on prompts,
I want to compare two system prompts on the same tasks,
So I can see which performs better.
```

## Why Prompt Comparison (Not Provider Comparison)

1. v0.2.0 only ships Claude provider (multi-provider comes later)
2. Teams iterate on prompts 100x more than they switch providers
3. This is immediate, practical value
4. It exercises the full eval API surface

## Workflow: Simple Coder

A minimal single-node workflow that demonstrates the eval system without complexity.

| Property | Value |
|----------|-------|
| **Nodes** | 1 (coder) |
| **Input** | `{ task: string }` |
| **Output** | `{ code: string }` |
| **Provider** | Claude (via Agent SDK) |

### Flow Definition

```typescript
const flow: FlowDefinition = {
  name: "simple-coder",
  nodes: [
    { id: "coder", type: "claude", input: { task } }
  ],
  edges: []
};
```

## Variants

The key differentiator is the **system prompt**. We pass this through `variant.config.systemPrompt`.

| ID | Description | System Prompt |
|----|-------------|---------------|
| `baseline` | Current production style | "You are a helpful coding assistant. Write clean, working code." |
| `candidate` | New experimental style | "You are a senior software engineer. Be concise. Prefer modern patterns. No comments unless complex." |

### Variant Configuration

```typescript
variant("baseline", {
  model: "claude-sonnet-4-20250514",
  config: {
    systemPrompt: "You are a helpful coding assistant. Write clean, working code."
  }
})

variant("candidate", {
  model: "claude-sonnet-4-20250514",
  config: {
    systemPrompt: "You are a senior software engineer. Be concise. Prefer modern patterns. No comments unless complex."
  }
})
```

## Test Cases

Simple coding tasks that can be objectively evaluated.

| ID | Task | Assertions |
|----|------|------------|
| `add-numbers` | "Write a JavaScript function that adds two numbers" | `behavior.no_errors`, `output.contains("function")` |
| `fizzbuzz` | "Write fizzbuzz in Python" | `behavior.no_errors`, `output.contains("fizz")` |
| `reverse-string` | "Write a TypeScript function to reverse a string" | `behavior.no_errors`, `output.contains("function")` |

### Dataset Structure

```json
{
  "id": "prompt-comparison.v1",
  "workflowName": "simple-coder",
  "version": "1.0.0",
  "cases": [
    {
      "id": "add-numbers",
      "name": "Add two numbers",
      "input": { "task": "Write a JavaScript function that adds two numbers" },
      "assertions": [
        { "type": "behavior.no_errors" },
        { "type": "output.contains", "path": "outputs.coder.text", "value": "function" }
      ],
      "tags": ["smoke", "javascript"]
    },
    {
      "id": "fizzbuzz",
      "name": "FizzBuzz implementation",
      "input": { "task": "Write fizzbuzz in Python" },
      "assertions": [
        { "type": "behavior.no_errors" },
        { "type": "output.contains", "path": "outputs.coder.text", "value": "fizz" }
      ],
      "tags": ["smoke", "python"]
    },
    {
      "id": "reverse-string",
      "name": "Reverse a string",
      "input": { "task": "Write a TypeScript function to reverse a string" },
      "assertions": [
        { "type": "behavior.no_errors" },
        { "type": "output.contains", "path": "outputs.coder.text", "value": "function" }
      ],
      "tags": ["smoke", "typescript"]
    }
  ]
}
```

## Metrics to Compare

The eval system automatically captures these metrics from SDK events:

| Metric | Description | Comparison Goal |
|--------|-------------|-----------------|
| Pass rate | All assertions pass | Higher is better |
| Tokens | input + output tokens | Fewer is more efficient |
| Cost | USD cost | Lower is cheaper |
| Latency | ms to complete | Lower is faster |

## Expected Outcome

Running this eval produces a report showing:

```
Suite: prompt-comparison
=======================

Variants:
  - baseline: 3/3 passed (100%)
  - candidate: 3/3 passed (100%)

Comparison (candidate vs baseline):
  - Tokens: -15% (improvement)
  - Cost: -12% (improvement)
  - Latency: +5% (within threshold)
  - Assertions: No regressions

Gates:
  [PASS] no-regressions: No regressions detected
  [PASS] pass-rate: Pass rate 100% >= 90%
  [PASS] cost-under: Max cost $0.0042 < $0.10

Overall: PASSED
```

## File Structure

```
apps/starter-kit/
├── package.json
├── tsconfig.json
├── EXAMPLE_SPEC.md              # This file
├── src/
│   ├── index.ts                 # Main entry point
│   ├── workflows/
│   │   └── simple-coder.ts      # Workflow factory
│   └── evals/
│       ├── prompt-comparison.ts # Suite definition
│       └── run.ts               # CLI runner
└── fixtures/
    ├── goldens/                 # Recorded provider responses
    │   └── prompt-comparison.v1/
    │       ├── baseline/
    │       │   ├── add-numbers__coder__inv0.json
    │       │   ├── fizzbuzz__coder__inv0.json
    │       │   └── reverse-string__coder__inv0.json
    │       └── candidate/
    │           ├── add-numbers__coder__inv0.json
    │           ├── fizzbuzz__coder__inv0.json
    │           └── reverse-string__coder__inv0.json
    └── provenance/              # Event captures for debugging
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `eval` | `bun run eval` | Run eval suite (live or replay) |
| `record` | `bun run record` | Record fixtures from live SDK |

### CLI Interface

```bash
# Run eval in live mode (real API calls)
bun run eval --mode live

# Run eval in replay mode (uses fixtures)
bun run eval --mode replay

# Run specific cases
bun run eval --mode live --cases add-numbers,fizzbuzz

# Run with specific tags
bun run eval --mode live --tags smoke

# Record new fixtures
bun run record --variant baseline
bun run record --variant candidate
bun run record --all
```

## Implementation Notes

### WorkflowFactory Pattern

The workflow factory receives the variant and uses `variant.config.systemPrompt`:

```typescript
const simpleCoder: SuiteWorkflowFactory = ({ caseId, caseInput, variant }) => ({
  flow: {
    name: "simple-coder",
    nodes: [{ id: "coder", type: "claude", input: caseInput }],
    edges: [],
  },
  register(registry, mode) {
    registry.register(createClaudeNode({
      model: variant.model,
      systemPrompt: variant.config?.systemPrompt as string,
    }));
  },
  primaryOutputNodeId: "coder",
});
```

### Recording Strategy

Fixtures are recorded from REAL SDK interactions (per CLAUDE.md):

1. Run each case/variant combination against live Claude API
2. Capture the full request/response
3. Store in `fixtures/goldens/{dataset}/{variant}/{caseId}__{nodeId}__inv{n}.json`

### Gates

Default gates for this example:

```typescript
gates: [
  gates.noRegressions(),           // No cases that passed now fail
  gates.passRate(0.9),             // At least 90% pass rate
  gates.costUnder(0.10),           // Each case under $0.10
  gates.latencyUnder(30000),       // Each case under 30 seconds
]
```

## Definition of Done

- [ ] `simple-coder.ts` workflow factory implemented
- [ ] `prompt-comparison.ts` suite definition created
- [ ] `prompt-comparison.v1.json` dataset file created
- [ ] `run.ts` CLI script works: `bun run eval --help`
- [ ] Recording script works: `bun run record --help`
- [ ] Real fixtures recorded for both variants
- [ ] End-to-end test passes in both live and replay modes
