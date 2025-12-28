# Test Fixtures

Recorded LLM sessions for replay testing.

## Structure

```
fixtures/
  ├── golden/        # Curated test scenarios
  └── artifacts/     # Auto-generated recordings (gitignored)
```

## Format

Each `.jsonl` file contains recorded sessions:

```json
{"prompt": "...", "options": {...}, "messages": [...SDK messages...]}
```

## Recording (Opt-in)

Recording is opt-in via `@Record` decorator from `@openharness/anthropic`:

```typescript
import { createContainer } from "../../src/infra/container.js";

// Configure recording directory (defaults to ./tests/fixtures/artifacts)
const container = createContainer({
  mode: "live",
  config: { recordingsDir: "./tests/fixtures/artifacts" }
});

// Apply @Record decorator to methods you want to record
// See @openharness/anthropic documentation
```

## Using Fixtures in Tests

```typescript
import { createContainer } from "../../src/infra/container.js";

const container = createContainer({
  mode: "replay",
  config: { recordingsDir: "./tests/fixtures/golden" }
});

// runner.run() will replay from the fixture
```

## Guidelines

1. Keep fixtures small - one scenario per file
2. Name descriptively - `coding-adds-function.jsonl` not `test1.jsonl`
3. Commit golden fixtures to git, gitignore artifacts
