# Test Fixtures

Recorded LLM sessions for replay testing.

## Structure

```
fixtures/
  └── agents/          # Individual agent recordings
      └── smoke/
          └── smoke_session.jsonl
```

## Format

Each `.jsonl` file contains recorded sessions:

```json
{"prompt": "...", "options": {...}, "messages": [...SDK messages...]}
```

## Creating Fixtures

Use the @Record decorator or Vault directly:

```typescript
import { createContainer } from "../../src/core/container.js";
import { IVaultToken } from "../../src/core/tokens.js";

const container = createContainer({
  mode: "live",
  config: { recordingsDir: "./tests/fixtures" }
});

const vault = container.get(IVaultToken);
const session = await vault.startSession("agents", "my-fixture");

// Run agent...
// Session captures via @Record decorator or RecordingFactory
```

## Using Fixtures in Tests

```typescript
import { createContainer } from "../../src/core/container.js";
import { ReplayRunner } from "../../src/core/replay-runner.js";

const container = createContainer({
  mode: "replay",
  config: { recordingsDir: "./tests/fixtures" }
});

const runner = container.get(ReplayRunner);
runner.setScenario("my-fixture");

// runner.run() will replay from the fixture
```

## Guidelines

1. Keep fixtures small - one scenario per file
2. Name descriptively - `coding-adds-function.jsonl` not `test1.jsonl`
3. Commit to git - fixtures are test data
