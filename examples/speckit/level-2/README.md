# Level 2: Fixtures

## Why Record?

Every `run()` call costs money and time. Recording lets you:

- **Fast CI** - Run tests in seconds for $0
- **Deterministic** - Same input always produces same output
- **Benchmarking** - Compare model behavior over time
- **Collaboration** - Share fixtures with your team

## Quick Start

```bash
# Record fixtures (first time or after prompt changes)
bun test:record

# Run tests (uses fixtures, fast and free)
bun test

# Force live execution (skip fixtures)
bun test:live
```

## How It Works

```typescript
import { run, setDefaultStore, setDefaultMode } from "@open-harness/core";
import { FileRecordingStore } from "@open-harness/stores";

// 1. Create a store
const store = new FileRecordingStore({ directory: "./fixtures" });

// 2. Set defaults (or pass to each run())
setDefaultStore(store);
setDefaultMode("replay");

// 3. Run with fixture name
const result = await run(myAgent, input, { fixture: "my-test" });
```

Or use the shared test utilities:

```typescript
import { setupFixtures, withFixture } from "../test-utils";

beforeAll(() => {
  setupFixtures();
});

it("runs with fixture", async () => {
  const result = await run(myAgent, input, withFixture("my-test"));
});
```

## Fixture Modes

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `replay` | Load saved response, fail if missing | CI, normal development |
| `record` | Execute live, save response | First run, after prompt changes |
| `live` | Execute live, don't save | Debugging, one-off testing |

Mode priority: explicit option > `FIXTURE_MODE` env var > default (`replay`)

## Fixture Files

Fixtures are saved as JSON in your store directory:

```
fixtures/
├── my-test_agent_inv0.json      # Agent fixture
├── workflow_harness_inv0.json   # Harness fixture
```

The naming convention is: `{fixture}_{type}_inv{invocation}.json`

## When to Re-record

Re-run `bun test:record` when:

- Changed agent prompt
- Changed output parsing logic
- Upgraded to new model version
- Test input changed

## CI Integration

```yaml
# GitHub Actions example
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test  # Uses fixtures, fast and free
```

The `fixtures/` directory should be committed to git.

## State + Fixtures

This level also introduces agent state. State is defined in the agent config and returned with each result:

```typescript
const myAgent = agent({
  prompt: "...",
  state: { count: 0 },  // Initial state
});

const result = await run(myAgent, input, withFixture("test"));
console.log(result.state);  // { count: 0 }
```

State is recorded with fixtures, so replay produces consistent state too.
