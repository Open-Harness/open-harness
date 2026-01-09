# Open Harness Starter Kit

A demonstration of the Open Harness eval system for prompt comparison.

## User Story

> "I have a workflow. I changed my prompt. Is it better or worse?"

This starter kit shows how to compare different system prompts on the same workflow to measure which performs better.

## Quick Start

```bash
# From apps/starter-kit directory
cd apps/starter-kit

# Run eval in live mode (real API calls)
bun run eval --mode live

# Run with verbose output
bun run eval --mode live --verbose

# Run specific cases only
bun run eval --cases add-numbers,fizzbuzz

# Show help
bun run eval --help
```

## Commands

### `bun run eval`

Run the prompt comparison eval suite.

```
Options:
  -m, --mode <mode>      Execution mode: live, replay, record (default: live)
  -c, --cases <ids>      Comma-separated case IDs to run
  -t, --tags <tags>      Comma-separated tags to filter cases
  -b, --baseline <id>    Override baseline variant ID
  -v, --verbose          Show detailed output
  -h, --help             Show help message
```

**Examples:**

```bash
# Run all cases in live mode
bun run eval --mode live

# Run only smoke-tagged cases
bun run eval --tags smoke

# Run specific cases with verbose output
bun run eval --cases add-numbers --verbose

# Run in replay mode (uses recorded fixtures)
bun run eval --mode replay
```

### `bun run record`

Record fixtures from live SDK for replay testing.

```
Options:
  -v, --variant <id>     Record only specific variant
  -c, --cases <ids>      Comma-separated case IDs to record
  --dry-run              Show what would be recorded without recording
  -h, --help             Show help message
```

**Examples:**

```bash
# Record all variants and cases
bun run record

# Record only baseline variant
bun run record --variant baseline

# Preview what would be recorded
bun run record --dry-run
```

## What's Included

### Workflow: Simple Coder

A minimal single-node workflow that takes a coding task and produces code.

- **Input:** `{ task: string }`
- **Output:** `{ text: string, usage: {...}, totalCostUsd: number, ... }`

### Variants

| ID | Description | System Prompt |
|----|-------------|---------------|
| `baseline` | Production style | "You are a helpful coding assistant. Write clean, working code." |
| `candidate` | Experimental style | "You are a senior software engineer. Be concise. Prefer modern patterns." |

### Test Cases

| ID | Task | Tags |
|----|------|------|
| `add-numbers` | Write a JavaScript function that adds two numbers | smoke, javascript |
| `fizzbuzz` | Write fizzbuzz in Python | smoke, python |
| `reverse-string` | Write a TypeScript function to reverse a string | smoke, typescript |

### Gates

The suite uses these pass/fail gates:

- **no-regressions** - No cases that passed in baseline now fail
- **pass-rate** - At least 90% of cases pass
- **cost-under** - Each case costs less than $0.10
- **latency-under** - Each case completes in less than 30 seconds

## Example Output

```
================================================================================
Prompt Comparison Eval
================================================================================
Mode: live
Cases: all
Baseline: baseline
================================================================================

================================================================================
Results
================================================================================
Suite: prompt-comparison
Status: PASSED
Duration: 45.2s

Summary:
  Cases: 6/6 passed (100%)
  Gates: 4/4 passed
  Regressions: 0

Gates:
  [PASS] no-regressions: No regressions detected
  [PASS] pass-rate: Pass rate 100% >= 90%
  [PASS] cost-under: Max cost $0.04 < $0.10
  [PASS] latency-under: Max latency 25000ms < 30000ms

Variant Results:
----------------
baseline:
  Pass Rate: 100%
  Passed: 3/3

candidate:
  Pass Rate: 100%
  Passed: 3/3

Comparison (vs baseline):
-----------------------------------------
  Regressions: 0
  Improvements: 2
================================================================================
```

## File Structure

```
apps/starter-kit/
├── package.json
├── tsconfig.json
├── README.md                       # This file
├── EXAMPLE_SPEC.md                 # Design document
├── src/
│   ├── index.ts                    # Main exports
│   ├── workflows/
│   │   └── simple-coder.ts         # Workflow factory
│   └── evals/
│       ├── prompt-comparison.ts    # Suite definition
│       ├── run.ts                  # Eval CLI
│       └── record.ts               # Recording CLI
└── fixtures/
    ├── goldens/                    # Recorded responses
    └── provenance/                 # Event captures
```

## Extending

### Add a New Test Case

Edit `src/evals/prompt-comparison.ts`:

```typescript
cases: [
  // ... existing cases
  {
    id: "new-case",
    name: "Description",
    input: { task: "Your coding task here" },
    assertions: [
      { type: "behavior.no_errors" },
      { type: "output.contains", path: "outputs.coder.text", value: "expected" },
    ],
    tags: ["smoke"],
  },
],
```

### Add a New Variant

```typescript
variants: [
  // ... existing variants
  variant("new-variant", {
    model: "claude-sonnet-4-20250514",
    config: {
      systemPrompt: "Your new system prompt here",
    },
  }),
],
```

### Add a Custom Gate

```typescript
gates: [
  // ... existing gates
  gates.custom("my-gate", "Description", (result) => ({
    passed: /* your logic */,
    message: "Result message",
  })),
],
```

## Learn More

- [Eval System README](../../packages/internal/core/src/eval/README.md) - Full eval API documentation
- [EXAMPLE_SPEC.md](./EXAMPLE_SPEC.md) - Design document for this example
